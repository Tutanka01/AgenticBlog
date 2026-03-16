import json
import time
from pathlib import Path

from state import PipelineState, ACPMessage
from config import OUTPUT_DIR, CHECKPOINT_DB
from memory_manager import update_memory


def output_saver_node(state: PipelineState) -> dict:
    """Persist outputs to disk and print run summary."""
    run_date = state.get("run_date", "unknown")
    run_id = state.get("run_id", "unknown")
    article = state.get("selected_article", {})

    run_slug = run_id[:8] if run_id != "unknown" else "unknown"
    out_dir = OUTPUT_DIR / run_date / run_slug
    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        (out_dir / "blog_post.md").write_text(state.get("blog_post", ""), encoding="utf-8")
        (out_dir / "linkedin_post.md").write_text(state.get("linkedin_post", ""), encoding="utf-8")
        (out_dir / "youtube_script.md").write_text(state.get("youtube_script", ""), encoding="utf-8")

        metadata = {
            "run_id": run_id,
            "run_date": run_date,
            "article_selected": {
                "title": article.get("title", ""),
                "url": article.get("url", ""),
                "source": article.get("source", ""),
                "score": article.get("score", 0),
            },
            "scores": [
                {"title": a.get("title", ""), "score": a.get("score", 0)}
                for a in state.get("filtered_articles", [])
            ],
            "nb_iterations_critique": state.get("iteration_count", 0),
            "critique_approved": state.get("critique_approved", False),
            "security_flag": state.get("security_flag", False),
            "tokens_used": state.get("total_tokens_used", 0),
            "checkpoint_db": CHECKPOINT_DB,
        }
        (out_dir / "run_metadata.json").write_text(
            json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8"
        )
    except Exception as exc:
        print(f"[OUTPUT]  Write error: {exc}")

    tokens = state.get("total_tokens_used", 0)
    print(f"[OUTPUT]     Saved → {out_dir}/")
    print(f"             Checkpoint: {CHECKPOINT_DB} (run_id: {run_id[:8]}...)")
    if state.get("security_flag"):
        print(f"[OUTPUT]  ⚠ SECURITY FLAG — a code snippet was flagged as dangerous by the debate panel.")
        print(f"             Review {out_dir}/blog_post.md before publishing.")
    print(f"Done — {tokens} tokens used")

    try:
        update_memory(state)
        print(f"[OUTPUT]     Memory updated — MEMORY.md + topics/")
    except Exception as exc:
        print(f"[OUTPUT]  Memory update failed (non-blocking): {exc}")

    msg = ACPMessage(
        sender="output_saver",
        receiver="system",
        msg_type="result",
        content=f"Run {run_id} saved to {out_dir}",
        metadata={"path": str(out_dir), "tokens": tokens},
    )
    return {"messages": [msg]}
