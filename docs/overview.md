# AgenticBlog — Overview

## Documentation

- Local setup and variables: `docs/setup.md`
- Agent contracts: `docs/agents.md`
- Frontend (React/Vite/Tailwind): `docs/frontend.md`
- Docker deployment: `docs/docker.md`
- Editorial memory (architecture + papers): `docs/memory.md`

Multi-agent pipeline that reads tech RSS feeds, picks the most relevant article, fetches its full content, drafts a post validated by a critic, then exports 3 formats (Markdown blog, LinkedIn, YouTube Shorts). The entire run is persisted in SQLite and can be resumed after an interruption.

The project also includes a web control interface:

- FastAPI + SSE backend API (`api.py`)
- React/Vite/Tailwind frontend (`frontend/`)
- Docker Compose orchestration (`docker-compose.yml`)

---

## Pipeline architecture

```
scraper_node         ← RSS feeds based on active category
    ↓  raw_articles[] — {title, url, summary, source, published, fetched_at}
filter_node          ← LLM: score each article 0-10 (category topics)
    ↓  filtered_articles[] (score ≥ FILTER_THRESHOLD, top TOP_N_FILTERED)
selector_node        ← composite score: LLM score + freshness bonus (0-1)
    ↓  selected_article{}
fetcher_node         ← cascade: direct → Jina AI Reader → RSS summary fallback
    ↓  selected_article{} + full_content + fetch_method
writer_node  ←──────────────────────────────┐
    ↓  draft (v1, v2…)                       │ critic_feedback
critic_node  ──(score < 7, iter < 3)────────┘
    ↓  (approve OR max_iter reached)
formatter_node       ← blog = YAML front matter + draft (no LLM)
    ↓                  linkedin + youtube = LLM via prompts/formatter_social.md
output_saver_node    ← write output/{date}/ + SQLite checkpoints
    ↓
END
```

The writer ↔ critic loop is capped at `MAX_CRITIQUE_ITERATIONS` (default: 3). If the score does not reach 7/10 after 3 attempts, the pipeline continues with the best draft produced.

---

## Categories

The pipeline supports several content categories, each with its own RSS feeds and filter topics:

| Category | Label | Feeds |
|----------|-------|-------|
| `infra` (default) | Infrastructure & DevOps | HN, Reddit K8s/DevOps/Selfhosted, LWN |
| `security` | Cybersecurity | The Hacker News, BleepingComputer, LWN, Exploit-DB |
| `ai` | Artificial Intelligence | HN, Reddit ML/LocalLLaMA/Artificial |
| `cloud` | Cloud | HN, AWS Blog, Reddit AWS/GCP/Azure |
| `africa` | Tech Africa & Morocco | HN, Reddit Africa/Morocco |

The active category is passed in `state["active_category"]` and read by `scraper` and `filter`.

---

## File structure

```
.
├── main.py              # Entry point (CLI: --resume, --list, --category, --lang)
├── graph.py             # LangGraph StateGraph + SQLite checkpointer
├── state.py             # PipelineState (TypedDict) + ACPMessage (Pydantic)
├── config.py            # Centralized config: CATEGORIES, DEFAULT_CATEGORY, .env
├── llm.py               # Shared OpenAI client (OpenRouter headers auto-injected)
├── .env                 # Environment variables (not committed)
├── .env.example         # Template to copy
├── requirements.txt
├── agents/
│   ├── scraper.py       # Fetch RSS → raw_articles (feeds by category)
│   ├── filter.py        # LLM score → filtered_articles (topics by category)
│   ├── selector.py      # Composite score → selected_article
│   ├── fetcher.py       # Cascade fetch: direct → Jina → RSS fallback
│   ├── writer.py        # Draft / revise → draft (with length retry)
│   ├── critic.py        # Evaluate → feedback + approve/reject
│   ├── formatter.py     # blog (YAML+draft) + linkedin/youtube (LLM)
│   └── output_saver.py  # Persist + console summary
├── prompts/             # Markdown prompts with {placeholder} variables
│   ├── filter.md
│   ├── writer.md
│   ├── critic.md
│   ├── formatter.md        # (kept, not used — replaced by formatter_social.md)
│   └── formatter_social.md # LinkedIn + YouTube only
├── memory/
│   └── checkpoints.sqlite  # Managed automatically by LangGraph
└── output/
    └── {run_date}/
        └── {run_id[:8]}/       # one subdirectory per run — never overwritten
            ├── blog_post.md
            ├── linkedin_post.md
            ├── youtube_script.md
            └── run_metadata.json
```

---

## Shared state

All data flows through `PipelineState` (defined in `state.py`). Each agent receives the full state as read-only input and returns **only the keys it modifies**.

Inter-agent messages (`ACPMessage`) are accumulated in `state["messages"]` via `operator.add` as a reducer — they are never overwritten, only appended. (LangGraph's `add_messages` is not used as it expects LangChain objects with an `.id` field, incompatible with pure Pydantic models.)

Key state fields:

| Key | Type | Role |
|-----|------|------|
| `active_category` | `str` | Run category (`"infra"`, `"security"`, `"ai"`, etc.) |
| `output_language` | `str` | Output language code: `"fr"`, `"en"`, `"ar"` |

---

## LLM

The client is centralized in `llm.py`. It exposes a `llm_client` singleton imported by all agents — one place to change if the backend changes.

OpenRouter is the default backend. `llm.py` automatically detects if `LLM_BASE_URL` contains `openrouter.ai` and injects the required attribution headers (`HTTP-Referer`, `X-Title`). For any other backend, these headers are omitted.

| Backend | `LLM_BASE_URL` | `LLM_API_KEY` |
|---------|----------------|---------------|
| OpenRouter | `https://openrouter.ai/api/v1` | `sk-or-...` |
| Ollama (local) | `http://localhost:11434/v1` | `ollama` |
| llama.cpp | `http://localhost:8080/v1` | `any` |
| OpenAI | `https://api.openai.com/v1` | `sk-...` |
