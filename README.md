# AgenticBlog

A multi-agent pipeline that reads RSS feeds, picks the most relevant article, drafts a post, debates it internally, and exports three publish-ready formats — in a single command.

```bash
python main.py -c ai -l fr
```

Built with **LangGraph** · works with any OpenAI-compatible backend (OpenRouter, Ollama, llama.cpp, OpenAI).

---

## What you get

Every run produces three files in `output/{date}/{run_id}/`:

| File | Content |
|------|---------|
| `blog_post.md` | 900–1200 word Markdown article with YAML front matter |
| `linkedin_post.md` | Hook + key points, 3 hashtags |
| `youtube_script.md` | ~90s script with timecodes |
| `run_metadata.json` | Scores, iterations, tokens, security flags |

---

## How it works

```
RSS feeds → score & filter → select (novelty-aware) → fetch full content
    → write → debate panel → revise → format → output
```

**Debate panel** — instead of a single critic pass, three context-aware expert personas debate the draft across two rounds before the writer revises. Personas are generated at runtime from the article topic — never hardcoded. → [`docs/multi_critic.md`](docs/multi_critic.md)

**Editorial memory** — the pipeline tracks what it has covered (avoids repeating topics in the last 14 days) and memorizes why past drafts were rejected (lessons re-injected at the next run). No vector database — pure Markdown files.

**Any LLM** — one `LLM_BASE_URL` swap to switch between OpenRouter, Ollama, llama.cpp, or OpenAI. A separate `DEBATE_MODEL` variable lets you use a cheaper model for the debate rounds.

---

## Quick start

```bash
git clone https://github.com/Tutanka01/AgenticBlog && cd AgenticBlog
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # set LLM_API_KEY
python main.py
```

---

## Categories

```bash
python main.py -c infra       # Kubernetes, Linux, Terraform, eBPF
python main.py -c security    # CVE, pentest, OWASP, zero-day
python main.py -c ai          # LLM, RAG, fine-tuning, Ollama, agents
python main.py -c cloud       # AWS, GCP, Azure, FinOps, serverless
python main.py -c africa      # Morocco, Africa, fintech, tech startups
```

Three output languages: `--lang en` (default) · `--lang fr` · `--lang ar`

---

## LLM backends

```bash
# OpenRouter (default)
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=sk-or-xxxxxxxxxxxx
LLM_MODEL=google/gemini-2.0-flash

# Ollama (local)
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=ollama
LLM_MODEL=mistral

# Cost split — cheaper model for debate rounds
DEBATE_MODEL=google/gemini-flash-lite
```

---

## CLI

| Option | Description |
|--------|-------------|
| `-c` / `--category` | `infra`, `security`, `ai`, `cloud`, `africa` |
| `-l` / `--lang` | `en` (default), `fr`, `ar` |
| `--resume <run_id>` | Resume an interrupted run (SQLite checkpoints) |
| `--list` | List past runs |

---

## Key environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_API_KEY` | *(required)* | API key |
| `LLM_MODEL` | `google/gemini-3.1-flash-lite-preview` | Main model |
| `DEBATE_MODEL` | `LLM_MODEL` | Model for debate rounds (override to cut cost) |
| `MAX_CRITIQUE_ITERATIONS` | `3` | Max writer ↔ critic loops |
| `FILTER_THRESHOLD` | `6` | Min score to keep an article (0–10) |

Full list in [`docs/setup.md`](docs/setup.md).

---

## Web interface (optional)

A React dashboard to run the pipeline, watch agents execute in real time, and browse outputs.

- **Pipeline view** — live node graph, per-agent status, debate panel details, log console
- **Outputs view** — tabbed blog/LinkedIn/YouTube preview with inline editor and one-click copy
- **History view** — past runs table with search, category filter, resume and delete actions

```bash
# Dev mode
uvicorn api:app --port 8000 --reload   # Terminal 1: backend + SSE stream
cd frontend && npm ci && npm run dev   # Terminal 2: Vite → http://localhost:5173

# Docker (production build)
docker-compose up                      # → http://localhost:3000
```

---

## Documentation

| Doc | Content |
|-----|---------|
| [`docs/multi_critic.md`](docs/multi_critic.md) | Debate panel — full architecture, flow, research backing |
| [`docs/memory.md`](docs/memory.md) | Editorial memory — dual-bank architecture + 18 references |
| [`docs/agents.md`](docs/agents.md) | All agent contracts and behaviors |
| [`docs/overview.md`](docs/overview.md) | Pipeline overview, state schema, env vars |
| [`docs/setup.md`](docs/setup.md) | Installation and advanced configuration |
| [`docs/docker.md`](docs/docker.md) | Docker Compose deployment |

---

**Mohamad El Akhal** — [makhal.fr](https://makhal.fr)
