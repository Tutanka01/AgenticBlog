import asyncio
import json
import os
import re
import select
import shutil
import subprocess
import threading
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "output"
LOG_PATTERN = re.compile(r"\[(\w+)\]\s+(.+)")

NODE_MAP = {
    "output": "saver",
    "output_saver": "saver",
    "multi_critic": "critic",
}

RUNNING_KEYWORDS = ("fetching", "scoring", "starting", "trying", "saving")
DONE_KEYWORDS = (
    "fetched",
    "kept",
    "selected",
    "success",
    "complete",
    "done",
    "approved",
    "saved",
    "draft v",        # writer: "Draft v1 — 969 words"
    "linkedin",       # formatter: "Blog: N words | LinkedIn: N chars | YouTube: ~Ns"
    "memory updated", # saver: "Memory updated — MEMORY.md + topics/"
)


class RunRequest(BaseModel):
    category: str
    resume_id: str | None = None
    lang: str = "en"


class RunManager:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.is_running = False
        self.current_run_id: str | None = None
        self.current_category: str | None = None
        self.process: subprocess.Popen[str] | None = None
        self.listeners: list[asyncio.Queue[dict[str, Any]]] = []
        self.history: list[dict[str, Any]] = []
        self.start_time = 0.0

    def _broadcast(self, event: dict[str, Any]) -> None:
        self.history.append(event)
        if len(self.history) > 2000:
            self.history = self.history[-2000:]

        for q in list(self.listeners):
            try:
                q.put_nowait(event)
            except Exception:
                continue

    def _meta_from_message(self, node: str, message: str) -> dict[str, Any]:
        meta: dict[str, Any] = {}

        ints = [int(v) for v in re.findall(r"\b(\d+)\b", message)]
        floats = [float(v) for v in re.findall(r"\b(\d+\.\d+)\b", message)]

        if node == "scraper":
            match = re.search(r"Fetched\s+(\d+)\s+articles", message, re.IGNORECASE)
            if match:
                meta["count"] = int(match.group(1))
        elif node == "filter":
            match = re.search(r"kept\s+(\d+)", message, re.IGNORECASE)
            if match:
                meta["kept"] = int(match.group(1))
        elif node == "selector":
            match = re.search(r"score[:\s]+(\d+(?:\.\d+)?)", message, re.IGNORECASE)
            if match:
                meta["score"] = float(match.group(1))
        elif node == "fetcher":
            chars = re.search(r"(\d+)\s+chars", message, re.IGNORECASE)
            if chars:
                meta["chars"] = int(chars.group(1))
            method = re.search(r"\[(direct|jina|rss_fallback)\]", message, re.IGNORECASE)
            if method:
                meta["method"] = method.group(1).lower()
        elif node == "writer":
            iter_match = re.search(r"v(\d+)", message, re.IGNORECASE)
            words_match = re.search(r"(\d+)\s+words", message, re.IGNORECASE)
            if iter_match:
                meta["iteration"] = int(iter_match.group(1))
            if words_match:
                meta["words"] = int(words_match.group(1))
        elif node == "critic":
            score = re.search(r"Score:\s*(\d+)\/10", message, re.IGNORECASE)
            if score:
                meta["score"] = int(score.group(1))
            # "APPROVED" alone = True; "NOT approved" = False
            meta["approved"] = (
                bool(re.search(r"\bapproved\b", message, re.IGNORECASE))
                and "not approved" not in message.lower()
            )
            personas_match = re.search(r"Personas:\s*(.+)", message, re.IGNORECASE)
            if personas_match:
                meta["personas"] = [p.strip() for p in personas_match.group(1).split(",")]
            stagnation_match = re.search(r"stagnation[×x](\d+)", message, re.IGNORECASE)
            if stagnation_match:
                meta["stagnation_count"] = int(stagnation_match.group(1))
            if "security flag" in message.lower():
                meta["security_flag"] = True
            rounds_match = re.search(r"Running\s+(\d+)\s+debate\s+rounds", message, re.IGNORECASE)
            if rounds_match:
                meta["debate_rounds"] = int(rounds_match.group(1))
            num_personas_match = re.search(r"(\d+)\s+personas", message, re.IGNORECASE)
            if num_personas_match:
                meta["num_personas"] = int(num_personas_match.group(1))
        elif node == "formatter":
            if ints:
                meta["numbers"] = ints
        elif node == "saver":
            path_match = re.search(r"Saved\s+[-→>]+\s+(output/.+)$", message, re.IGNORECASE)
            if path_match:
                meta["path"] = path_match.group(1).strip()
            run_match = re.search(r"run_id:\s*([a-zA-Z0-9\-]+)", message, re.IGNORECASE)
            if run_match:
                meta["run_id"] = run_match.group(1)

        if not meta:
            if floats:
                meta["floats"] = floats
            elif ints:
                meta["ints"] = ints
        return meta

    # Patterns that contain "failed" but are graceful recoveries, not real errors
    _RECOVERY_PATTERNS = (
        "— using fallback",
        "— auto-approving",
        "synthesizing with empty",
    )

    def _derive_status(self, message: str) -> str:
        lower = message.lower()
        if ("error" in lower or "failed" in lower) and not any(p in lower for p in self._RECOVERY_PATTERNS):
            return "error"
        if any(k in lower for k in DONE_KEYWORDS):
            return "done"
        if any(k in lower for k in RUNNING_KEYWORDS):
            return "running"
        return "running"

    def _parse_stdout_line(self, line: str) -> dict[str, Any]:
        clean = line.strip()
        ts = datetime.utcnow().isoformat() + "Z"

        match = LOG_PATTERN.search(clean)
        if not match:
            return {
                "ts": ts,
                "node": "system",
                "status": "running",
                "message": clean,
                "meta": {},
            }

        raw_node, message = match.groups()
        node = NODE_MAP.get(raw_node.lower(), raw_node.lower())
        status = self._derive_status(message)
        return {
            "ts": ts,
            "node": node,
            "status": status,
            "message": message,
            "meta": self._meta_from_message(node, message),
        }

    def _runner(self, cmd: list[str], run_id: str) -> None:
        try:
            self.process = subprocess.Popen(
                cmd,
                cwd=str(BASE_DIR),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                env={**os.environ, "PYTHONUNBUFFERED": "1"},
            )

            assert self.process.stdout is not None
            last_output_at = time.time()
            heartbeat_every = 12.0

            while True:
                ready, _, _ = select.select([self.process.stdout], [], [], 1.0)
                if ready:
                    line = self.process.stdout.readline()
                    if line:
                        if not line.strip():
                            continue
                        event = self._parse_stdout_line(line)
                        self._broadcast(event)
                        last_output_at = time.time()

                if self.process.poll() is not None:
                    break

                if time.time() - last_output_at >= heartbeat_every:
                    self._broadcast(
                        {
                            "ts": datetime.utcnow().isoformat() + "Z",
                            "node": "system",
                            "status": "running",
                            "message": "Pipeline running... waiting for next step/log",
                            "meta": {"run_id": run_id},
                        }
                    )
                    last_output_at = time.time()

            code = self.process.wait()
            elapsed = round(time.time() - self.start_time, 1)
            if code == 0:
                self._broadcast(
                    {
                        "ts": datetime.utcnow().isoformat() + "Z",
                        "node": "system",
                        "status": "complete",
                        "message": "Pipeline completed",
                        "meta": {"run_id": run_id, "duration_seconds": elapsed},
                        "run_id": run_id,
                    }
                )
            else:
                self._broadcast(
                    {
                        "ts": datetime.utcnow().isoformat() + "Z",
                        "node": "system",
                        "status": "error",
                        "message": f"Pipeline failed with exit code {code}",
                        "meta": {"run_id": run_id, "duration_seconds": elapsed},
                    }
                )
        except Exception as exc:
            self._broadcast(
                {
                    "ts": datetime.utcnow().isoformat() + "Z",
                    "node": "system",
                    "status": "error",
                    "message": str(exc),
                    "meta": {"run_id": run_id},
                }
            )
        finally:
            with self.lock:
                self.is_running = False
                self.current_category = None
                self.current_run_id = None
                self.process = None

    def start_run(self, category: str, resume_id: str | None = None, lang: str = "en") -> str:
        with self.lock:
            if self.is_running:
                raise RuntimeError("A run is already in progress")

            run_id = resume_id or str(uuid.uuid4())
            self.is_running = True
            self.current_run_id = run_id
            self.current_category = category
            self.start_time = time.time()
            self.history = []

            cmd = ["python", "main.py", "--resume", run_id, "--category", category, "--lang", lang]
            thread = threading.Thread(target=self._runner, args=(cmd, run_id), daemon=True)
            thread.start()
            return run_id

    def stop_run(self) -> bool:
        with self.lock:
            if not self.is_running or self.process is None:
                return False
            self.process.terminate()
            return True


run_manager = RunManager()
app = FastAPI(title="AgenticBlog API", version="1.0.0")

allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

frontend_origin = os.getenv("FRONTEND_ORIGIN")
if frontend_origin:
    allowed_origins.append(frontend_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _load_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _normalize_metadata(meta: dict[str, Any], run_dir: Path) -> dict[str, Any]:
    article = meta.get("selected_article") or meta.get("article_selected") or {}
    score = meta.get("critique_score")
    if score is None and isinstance(meta.get("scores"), list) and meta["scores"]:
        score = meta["scores"][0].get("score")

    blog_post = (run_dir / "blog_post.md").read_text(encoding="utf-8") if (run_dir / "blog_post.md").exists() else ""
    word_count = meta.get("word_count")
    if word_count is None and blog_post:
        word_count = len(blog_post.split())

    run_id = meta.get("run_id") or run_dir.name

    return {
        "run_id": run_id,
        "run_date": meta.get("run_date") or run_dir.parent.name,
        "active_category": meta.get("active_category", "infra"),
        "total_tokens_used": meta.get("total_tokens_used", meta.get("tokens_used", 0)),
        "duration_seconds": meta.get("duration_seconds", 0),
        "iteration_count": meta.get("iteration_count", meta.get("nb_iterations_critique", 0)),
        "critique_score": score or 0,
        "critique_approved": meta.get("critique_approved", False),
        "selected_article": {
            "title": article.get("title", ""),
            "url": article.get("url", ""),
            "source_name": article.get("source_name", article.get("source", "")),
        },
        "word_count": word_count or 0,
        "fetch_method": meta.get("fetch_method", ""),
        "security_flag": meta.get("security_flag", False),
    }


def _find_run_dir(run_id: str) -> Path | None:
    if not OUTPUT_DIR.exists():
        return None

    for date_dir in OUTPUT_DIR.iterdir():
        if not date_dir.is_dir():
            continue
        direct = date_dir / run_id
        if direct.exists() and direct.is_dir():
            return direct

        for run_dir in date_dir.iterdir():
            if not run_dir.is_dir():
                continue
            meta_path = run_dir / "run_metadata.json"
            if not meta_path.exists():
                continue
            meta = _load_json(meta_path)
            rid = str(meta.get("run_id", ""))
            if rid == run_id or rid.startswith(run_id):
                return run_dir
    return None


@app.get("/api/health")
async def health() -> dict[str, Any]:
    return {"status": "ok", "pipeline_running": run_manager.is_running}


@app.get("/api/runs")
async def get_runs() -> list[dict[str, Any]]:
    runs: list[dict[str, Any]] = []
    if not OUTPUT_DIR.exists():
        return runs

    for date_dir in OUTPUT_DIR.iterdir():
        if not date_dir.is_dir():
            continue
        for run_dir in date_dir.iterdir():
            if not run_dir.is_dir():
                continue
            meta_path = run_dir / "run_metadata.json"
            if not meta_path.exists():
                continue
            normalized = _normalize_metadata(_load_json(meta_path), run_dir)
            normalized["slug"] = run_dir.name
            runs.append(normalized)

    runs.sort(key=lambda r: (r.get("run_date", ""), r.get("run_id", "")), reverse=True)
    return runs


@app.get("/api/runs/{run_id}")
async def get_run(run_id: str) -> dict[str, Any]:
    run_dir = _find_run_dir(run_id)
    if not run_dir:
        raise HTTPException(status_code=404, detail="Run not found")

    meta = _normalize_metadata(_load_json(run_dir / "run_metadata.json"), run_dir)
    return {
        "metadata": meta,
        "blog_post": (run_dir / "blog_post.md").read_text(encoding="utf-8") if (run_dir / "blog_post.md").exists() else "",
        "linkedin_post": (run_dir / "linkedin_post.md").read_text(encoding="utf-8") if (run_dir / "linkedin_post.md").exists() else "",
        "youtube_script": (run_dir / "youtube_script.md").read_text(encoding="utf-8") if (run_dir / "youtube_script.md").exists() else "",
    }


@app.post("/api/run")
async def post_run(payload: RunRequest) -> dict[str, Any]:
    try:
        run_id = run_manager.start_run(payload.category, payload.resume_id, payload.lang)
    except RuntimeError:
        raise HTTPException(status_code=409, detail="A run is already in progress")
    return {"run_id": run_id, "status": "started"}


@app.post("/api/run/stop")
async def stop_run() -> dict[str, Any]:
    stopped = run_manager.stop_run()
    if not stopped:
        raise HTTPException(status_code=409, detail="No running pipeline")
    return {"status": "stopping"}


@app.get("/api/run/stream")
async def stream_run(
    category: str = Query(...),
    resume_id: str | None = Query(default=None),
):
    if not run_manager.is_running:
        try:
            run_manager.start_run(category, resume_id)
        except RuntimeError:
            pass

    q: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
    run_manager.listeners.append(q)

    for item in run_manager.history[-500:]:
        await q.put(item)

    async def event_generator():
        try:
            while True:
                event = await q.get()
                yield {"event": "message", "data": json.dumps(event, ensure_ascii=False)}
                if event.get("status") in {"complete", "error"}:
                    break
        finally:
            if q in run_manager.listeners:
                run_manager.listeners.remove(q)

    return EventSourceResponse(event_generator())


class BlogPatch(BaseModel):
    content: str = ""
    blog_post: str = ""


@app.patch("/api/runs/{run_id}/blog")
async def patch_blog(run_id: str, payload: BlogPatch) -> dict[str, Any]:
    run_dir = _find_run_dir(run_id)
    if not run_dir:
        raise HTTPException(status_code=404, detail="Run not found")
    text = payload.content or payload.blog_post or ""
    (run_dir / "blog_post.md").write_text(text, encoding="utf-8")
    return {"status": "saved"}


@app.delete("/api/runs/{run_id}")
async def delete_run(run_id: str) -> dict[str, Any]:
    run_dir = _find_run_dir(run_id)
    if not run_dir:
        raise HTTPException(status_code=404, detail="Run not found")

    shutil.rmtree(run_dir)
    return {"status": "deleted", "run_id": run_id}
