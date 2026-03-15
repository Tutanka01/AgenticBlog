# AgenticBlog

Multi-agent pipeline that reads RSS feeds, picks the most relevant article, drafts a post validated by a critic, and exports three publish-ready formats — in a single command.

```
python main.py --category security
```

Built with **LangGraph** + **FastAPI** + **React**. Configurable LLM backend: OpenRouter, Ollama, llama.cpp, or OpenAI directly.

---

## What it produces

Each run outputs three files in `output/{date}/{run_id}/`:

| File | Content |
|------|---------|
| `blog_post.md` | Markdown article 900–1200 words with YAML front matter |
| `linkedin_post.md` | Post ≤ 280 characters, hook + 3 hashtags |
| `youtube_script.md` | ~90s script with timecodes (hook / problem / solution / CTA) |

The pipeline scrapes RSS feeds for the chosen category, scores each article with the LLM, picks the best one while accounting for freshness and **editorial memory** (avoids repeating a topic covered recently), fetches the full content, drafts, critiques, revises, and formats.

The writer also receives **lessons from past runs**: every rejection by the critic is stored and automatically re-injected at the next run — the pipeline learns from its editorial mistakes.

---

## Quick start

### 1. Prerequisites

- Python 3.12+
- An [OpenRouter](https://openrouter.ai/keys) API key — or Ollama locally

### 2. Install

```bash
git clone https://github.com/Tutanka01/AgenticBlog
cd AgenticBlog

python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

pip install -r requirements.txt
```

### 3. Configure

```bash
cp .env.example .env
# Open .env and set LLM_API_KEY
```

Minimum required:

```bash
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=sk-or-xxxxxxxxxxxx
LLM_MODEL=mistralai/mistral-small-3.1
```

### 4. First run

```bash
python main.py
```

Outputs land in `output/` at the end of the run. That's it.

---

## CLI reference

```
python main.py [OPTIONS]
```

| Option | Description |
|--------|-------------|
| *(none)* | Full run — category `infra` (default) |
| `--category <id>` / `-c <id>` | Choose the content category |
| `--lang <code>` / `-l <code>` | Output language: `en` (default), `fr`, `ar` |
| `--resume <run_id>` | Resume an interrupted run (SQLite checkpoints) |
| `--list` | List past runs with their metadata |

### Available categories

```bash
python main.py -c infra       # Kubernetes, DevOps, Linux, Terraform…
python main.py -c security    # CVE, pentest, kernel, OWASP, zero-day…
python main.py -c ai          # LLM, RAG, fine-tuning, Ollama, agents…
python main.py -c cloud       # AWS, GCP, Azure, FinOps, serverless…
python main.py -c africa      # Tech Morocco, Africa, startups, fintech…
```

### Output language

Three supported languages:

```bash
python main.py --lang en      # English (default)
python main.py --lang fr      # French
python main.py --lang ar      # Arabic (Modern Standard)
```

### Flag combinations

```bash
# Category + language
python main.py -c security -l en        # Cybersecurity watch in English
python main.py -c ai -l fr              # AI watch in French
python main.py -c africa -l ar          # Tech Africa in Arabic
python main.py -c cloud -l en           # Cloud watch in English

# Resume + category + language
python main.py --resume <run_id> -c security -l en

# Default run (infra category, English output)
python main.py
```

The engine (code, docs, prompts) is in English. The generated content (blog post, LinkedIn, YouTube) uses the language you choose at run time.

### Resume an interrupted run

The pipeline checkpoints each step in `memory/checkpoints.sqlite` via LangGraph.
If a run is interrupted (network dropout, transient LLM error), just run:

```bash
python main.py --resume <run_id>
```

The `run_id` is printed at startup and listed by `--list`.

---

## Pipeline

```
scraper    Read RSS feeds for the category → list of raw articles
   │
filter     LLM scores each article 0–10 (category topics)
   │        keep score ≥ FILTER_THRESHOLD, top TOP_N_FILTERED
   │
selector   Composite score: LLM score + freshness + editorial memory penalty
   │        → picks the article, builds context from past articles
   │
fetcher    Fetch full content (direct → Jina AI Reader → RSS summary)
   │
writer  ◄──────────────────────────────────┐
   │    Draft the article                  │ feedback
   │                                       │
critic  ── score < 7 and iter < 3 ─────────┘
   │    ── approve or move on
   │
formatter  Build YAML front matter + generate LinkedIn + YouTube via LLM
   │
output_saver  Write output/ + update editorial memory
```

The writer ↔ critic loop is capped at `MAX_CRITIQUE_ITERATIONS` (default: 3).

---

## LLM backends

The LLM client is centralized in `llm.py` and compatible with any OpenAI-compatible API.

### OpenRouter (default, recommended)

```bash
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=sk-or-xxxxxxxxxxxx
LLM_MODEL=mistralai/mistral-small-3.1
```

Tested and recommended models:

| Model | Quality | Cost |
|-------|---------|------|
| `mistralai/mistral-small-3.1` | Good balance | ~$0.10/run |
| `anthropic/claude-3-haiku` | Excellent for writing | ~$0.30/run |
| `google/gemini-flash-1.5` | Fast and multilingual | ~$0.08/run |
| `meta-llama/llama-3.1-8b-instruct:free` | Free, for testing | $0 |

### Ollama (local, offline)

```bash
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=ollama
LLM_MODEL=mistral

# Start Ollama:
ollama pull mistral && ollama serve
```

---

## Editorial memory

AgenticBlog implements a **dual-bank** architecture inspired by recent work on persistent-memory agents (Live-Evo, MemRL, Trajectory-Informed Memory):

### Experience Bank — what has been covered

`memory/topics/{category}.md` records every published article. At each run:

- The **selector** applies a novelty penalty to articles too close to a topic covered in the last 14 days (Jaccard similarity on keywords) — promotes editorial diversity without excluding a good article.
- The **writer** receives the context of relevant past articles to create narrative continuity ("In my article on X, I explained Y...").

### Meta-Guideline Bank — what failed (Reflexion Loop)

`memory/lessons/{category}.md` records critic rejections. When a draft requires ≥ 2 iterations before approval, the rejection reason is stored and **automatically re-injected into the writer's prompt at the next run**:

```
### Critical lessons — apply without exception
- [high priority] tone too formal in the introduction; lacking concrete CLI examples
- [normal priority] structure too linear, hook too neutral
```

Lessons decay with use (×0.85 per run in the same category) and are automatically purged after ~17 runs — recent errors carry more weight than old ones.

**Homeostasis cycle:**

| Runs | What happens |
|------|-------------|
| 1–3 | Critic rejects the draft (tone too formal, flat structure…). Lesson stored with `weight: 1.00`. |
| 4–10 | Writer receives the lesson as `[high priority]`, adjusts from the first draft — `iteration_count = 1`. |
| 11–20 | Weights decay (×0.85 per run). Lesson moves to `[normal priority]` then disappears. |
| 21+ | Writer may repeat the mistake. Critic catches it, lesson rises back to `weight: 1.00`. And so on. |

The pipeline does not converge to a fixed state — it oscillates around an editorial equilibrium, like a feedback system.

No vector database, no infrastructure — just Markdown files.

```
memory/
├── MEMORY.md           ← Index of the last 60 runs
├── topics/             ← Experience Bank (articles produced)
│   ├── infra.md
│   ├── security.md
│   └── ...
├── lessons/            ← Meta-Guideline Bank (editorial lessons)
│   ├── infra.md
│   └── ...
└── archive/            ← Automatic overflow
```

See `docs/memory.md` for theoretical foundations and academic references.

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_BASE_URL` | `https://openrouter.ai/api/v1` | LLM API URL |
| `LLM_MODEL` | `mistralai/mistral-small-3.1` | Model |
| `LLM_API_KEY` | *(empty)* | API key — **required** |
| `LLM_TEMPERATURE` | `0.3` | Temperature (filter, critic, formatter) |
| `LLM_TIMEOUT_SECONDS` | `90` | Per-request LLM timeout |
| `FILTER_THRESHOLD` | `6` | Minimum score to keep an article (0–10) |
| `MAX_ARTICLES_TO_FETCH` | `40` | Max scraped articles |
| `TOP_N_FILTERED` | `5` | Articles passed to selector |
| `MAX_CRITIQUE_ITERATIONS` | `3` | Max writer ↔ critic loops |
| `CHECKPOINT_DB` | `memory/checkpoints.sqlite` | LangGraph SQLite DB |
| `OUTPUT_DIR` | `./output` | Output directory |

---

## Web interface (optional)

The CLI is the primary mode. The web interface is available to visualize the pipeline
in real time and browse run history.

**Development mode (2 terminals):**

```bash
# Terminal 1 — API
source venv/bin/activate
pip install -r requirements_ui.txt
uvicorn api:app --port 8000 --reload

# Terminal 2 — Frontend
cd frontend && npm ci && npm run dev
```

Access: `http://localhost:5173`

**Via Docker:**

```bash
docker-compose up
```

Access: `http://localhost:3000`

---

## Project structure

```
AgenticBlog/
├── main.py              # CLI entry point
├── graph.py             # LangGraph StateGraph
├── state.py             # PipelineState TypedDict + ACPMessage
├── config.py            # Categories, RSS feeds, writing style
├── llm.py               # Shared LLM client
├── memory_manager.py    # Markdown-First editorial memory
├── api.py               # FastAPI + SSE (optional UI)
├── agents/
│   ├── scraper.py
│   ├── filter.py
│   ├── selector.py
│   ├── fetcher.py
│   ├── writer.py
│   ├── critic.py
│   ├── formatter.py
│   └── output_saver.py
├── prompts/             # Markdown prompts with {placeholder} variables
├── frontend/            # React 18 + Vite + Tailwind (optional UI)
├── memory/              # Dual-Bank (topics/ + lessons/) + SQLite checkpoints
├── output/              # Generated content (never committed)
└── docs/
    ├── agents.md        # Agent contracts and behaviors
    ├── memory.md        # Memory architecture + academic references
    ├── setup.md         # Detailed configuration
    ├── frontend.md      # React architecture
    └── docker.md        # Containerized deployment
```

---

## Documentation

| Doc | Content |
|-----|---------|
| [`docs/setup.md`](docs/setup.md) | Installation, configuration, LLM backends |
| [`docs/agents.md`](docs/agents.md) | Agent contracts, behaviors, fallbacks |
| [`docs/memory.md`](docs/memory.md) | Editorial memory architecture + papers |
| [`docs/frontend.md`](docs/frontend.md) | React web interface |
| [`docs/docker.md`](docs/docker.md) | Docker Compose deployment |

---

## Author

**Mohamad El Akhal** — DevOps/Cloud engineer, [makhal.fr](https://makhal.fr)
