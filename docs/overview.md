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

### Normal mode (RSS)

```
scraper_node         ← RSS feeds based on active category
    ↓  raw_articles[] — {title, url, summary, source, published, fetched_at}
filter_node          ← LLM: score each article 0-10 (category topics)
    ↓  filtered_articles[] (score ≥ FILTER_THRESHOLD, top TOP_N_FILTERED)
selector_node        ← composite score: LLM score + freshness bonus (0-1)
    ↓  selected_article{}
fetcher_node         ← cascade: direct → Jina AI Reader → RSS summary fallback
    ↓  selected_article{} + full_content + fetch_method
writer_node  ←────────────────────────────────────┐
    ↓  draft (v1, v2…)                             │ critic_feedback
multi_critic_node  ──(score < 7, iter < 3)────────┘
    ↓  internal: persona gen (×1) + debate rounds (×6) + synthesis (×1) = 8 LLM calls
    ↓  (approve OR max_iter reached)
formatter_node       ← blog = YAML front matter + draft (no LLM)
    ↓                  linkedin + youtube = LLM via prompts/formatter_social.md
output_saver_node    ← write output/{date}/ + SQLite checkpoints
    ↓
END
```

### Direct URL mode (`--url`)

When `state["direct_url"]` is set, scraper/filter/selector are bypassed:

```
[scraper_node]  → skipped (logs "Direct URL mode — skipping RSS scrape")
[filter_node]   → skipped (logs "Direct URL mode — skipping LLM scoring")
[selector_node] → injects selected_article = {url, title=url, score=10} directly
fetcher_node    ← same 3-strategy cascade as normal mode
    ↓  (writer → critic loop → formatter → output_saver unchanged)
```

Triggered via CLI (`--url`) or API (`"url"` field in `POST /api/run`).

### Direct topic mode (`--topic`)

When `state["direct_topic"]` is set, the entire discovery pipeline is bypassed — including the fetcher. The selector builds a synthetic `selected_article` whose `full_content` is the topic itself, instructing the writer to generate original content from LLM knowledge alone:

```
[scraper_node]  → skipped (logs "Direct TOPIC mode — skipping RSS scrape")
[filter_node]   → skipped (logs "Direct TOPIC mode — skipping LLM scoring")
[selector_node] → builds synthetic selected_article {title=topic, url="topic://...", full_content=topic prompt}
[fetcher_node]  → skipped (logs "Direct TOPIC mode — fetcher bypassed")
    ↓  (writer → critic loop → formatter → output_saver unchanged)
```

The full writer → debate panel → formatter chain still runs. No source URL is needed — the writer produces an original article from the topic description, validated by the same critic loop and exported in all three formats.

Triggered via CLI (`--topic` / `-t`) or API (`"topic"` field in `POST /api/run`).

---

The writer ↔ critic loop is capped at `MAX_CRITIQUE_ITERATIONS` (default: 3). If the score does not reach 7/10 after 3 attempts, the pipeline continues. `multi_critic_node` tracks the highest-scoring draft across iterations (`best_draft` / `best_score`) and reverts to it if the final iteration produces a regression. When `stagnation_count >= 1` (no improvement from the previous iteration), `writer_node` automatically switches to a conservative revision strategy.

`multi_critic_node` generates 3 context-aware personas on the first iteration and reuses them on subsequent ones. The node is registered under the name `"critic"` in the graph — no edge wiring changes vs. the legacy single-critic architecture. See `docs/agents.md` for the full internal flow.

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
├── main.py              # Entry point (CLI: --resume, --list, --category, --lang, --url, --topic)
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
│   ├── multi_critic.py  # Multi-persona debate: persona gen + 2 rounds + synthesis (8 LLM calls)
│   ├── critic.py        # (legacy single-critic — kept as rollback reference, not used)
│   ├── formatter.py     # blog (YAML+draft) + linkedin/youtube (LLM)
│   └── output_saver.py  # Persist + console summary
├── prompts/             # Markdown prompts with {placeholder} variables
│   ├── filter.md
│   ├── writer.md
│   ├── critic.md               # (legacy — kept as rollback reference)
│   ├── persona_generator.md    # Generates 3 context-aware personas as JSON
│   ├── debate_round.md         # Per-persona critique (rounds 1 & 2)
│   ├── debate_synthesizer.md   # Mohamad's judge: scores against 4 editorial criteria using debate as evidence
│   ├── formatter.md            # (kept, not used — replaced by formatter_social.md)
│   └── formatter_social.md     # LinkedIn + YouTube only
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
| `direct_url` | `str` (optional) | If set, scraper/filter/selector are bypassed and the pipeline runs directly on this URL |
| `direct_topic` | `str` (optional) | If set, scraper/filter/selector/fetcher are all bypassed; the selector builds a synthetic article from the topic and the writer generates original content from LLM knowledge |
| `debate_personas` | `list` (optional) | 3 generated personas — populated on first iteration, reused on revisions |
| `debate_transcript` | `str` (optional) | Full debate text from last `multi_critic_node` call |
| `best_draft` | `str` (optional) | Highest-scoring draft seen so far — restored if final iteration regresses |
| `best_score` | `int` (optional) | Score of `best_draft` — used to detect regression and stagnation |
| `stagnation_count` | `int` (optional) | Consecutive iterations with no score improvement — triggers adaptive writer strategy |

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

**Multi-critic debate config** (all optional — reasonable defaults):

| Variable | Default | Role |
|----------|---------|------|
| `DEBATE_MODEL` | `LLM_MODEL` | Model for the 6 debate-round calls — use a cheaper/faster model here |
| `NUM_DEBATE_PERSONAS` | `3` | Number of personas generated |
| `DEBATE_ROUNDS` | `2` | Number of debate rounds per iteration |

Example cost-optimized setup:
```bash
LLM_MODEL=google/gemini-2.0-flash      # persona gen + synthesis (2 calls per iter)
DEBATE_MODEL=google/gemini-flash-lite  # debate rounds (6 calls per iter, much cheaper)
```
