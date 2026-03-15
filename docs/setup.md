# Installation and configuration

## Prerequisites

- Python 3.12 (recommended — see below)
- Node.js 20+ (for the web interface)
- An OpenRouter account (default) or Ollama locally

---

## Installation

### 1. Check Python version

```bash
python3.12 --version
```

If the command fails, install Python 3.12 via Homebrew (macOS):

```bash
brew install python@3.12
```

### 2. Create and activate the venv

```bash
git clone <repo>
cd AgenticBlog

python3.12 -m venv venv
source venv/bin/activate

python --version   # should print 3.12.x
```

### 3. Install Python dependencies

```bash
pip install -r requirements.txt
pip install -r requirements_ui.txt
```

### 4. Install frontend dependencies

```bash
cd frontend
npm ci
cd ..
```

---

## Configuration

```bash
cp .env.example .env
# Edit .env and replace LLM_API_KEY with your OpenRouter key
```

### LLM variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_BASE_URL` | `https://openrouter.ai/api/v1` | LLM API URL |
| `LLM_MODEL` | `mistralai/mistral-7b-instruct` | Model name (OpenRouter format) |
| `LLM_API_KEY` | *(empty)* | API key — **required** |
| `LLM_TEMPERATURE` | `0.3` | Temperature (filter/critic). Writer is hardcoded at 0.7 |
| `LLM_TIMEOUT_SECONDS` | `90` | Max timeout per LLM request (avoids silent hangs) |
| `OPENROUTER_SITE_URL` | `https://github.com/AgenticBlog` | OpenRouter attribution header |
| `OPENROUTER_APP_NAME` | `AgenticBlog` | OpenRouter attribution header |

The two `OPENROUTER_SITE_URL` / `OPENROUTER_APP_NAME` headers are automatically injected by `llm.py` whenever `LLM_BASE_URL` contains `openrouter.ai`. They are ignored for any other backend.

### Pipeline variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FILTER_THRESHOLD` | `6` | Minimum score to keep an article (0–10) |
| `MAX_ARTICLES_TO_FETCH` | `40` | Total article scrape limit |
| `TOP_N_FILTERED` | `5` | Articles passed to selector after filtering |
| `MAX_CRITIQUE_ITERATIONS` | `3` | Max number of writer ↔ critic loops |
| `CHECKPOINT_DB` | `memory/checkpoints.sqlite` | LangGraph SQLite DB |
| `OUTPUT_DIR` | `./output` | Output directory |
| `PROMPTS_DIR` | `./prompts` | Markdown prompts directory |

> **Note:** `RSS_FEEDS` and `INTEREST_TOPICS` are no longer the main variables. Feeds and topics are now defined per category in `config.CATEGORIES`. These `.env` variables are kept for compatibility but are no longer used by `scraper` and `filter`.

---

## Run the pipeline

```bash
# Full run — default category (infra)
python main.py

# Choose a category
python main.py --category infra      # Infrastructure & DevOps (default)
python main.py --category security   # cybersecurity watch
python main.py --category ai         # AI / LLM watch
python main.py --category cloud      # Cloud watch
python main.py --category africa     # Tech Morocco / Africa

# Short form (-c is an alias for --category)
python main.py -c security

# Choose output language (default: en) — 3 supported: en, fr, ar
python main.py --lang en             # English (default)
python main.py --lang fr             # French
python main.py --lang ar             # Arabic (Modern Standard)
python main.py -c ai -l fr          # AI category, French output
python main.py -c africa -l ar      # Africa category, Arabic output

# List previous runs
python main.py --list

# Resume an interrupted run
python main.py --resume <run_id>
python main.py --resume <run_id> --category security
```

At startup, if a previous run exists, the pipeline automatically offers to resume it.

---

## Run the web interface locally (dev mode)

Open 2 terminals.

### Terminal 1: backend API

```bash
source venv/bin/activate
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

### Terminal 2: frontend

```bash
cd frontend
npm run dev
```

Access:

- Frontend: `http://localhost:5173`
- API: `http://localhost:8000`
- Healthcheck: `http://localhost:8000/api/health`

In dev mode, Vite automatically proxies `/api` to `http://localhost:8000`.

---

## Containerized deployment

To run the full application via Docker Compose (backend + frontend), see `docs/docker.md`.

For frontend architecture details, see `docs/frontend.md`.

---

## Available categories

Categories are defined in `config.CATEGORIES`. Each embeds its own RSS feeds and filter topics — no `.env` variable to touch to change domain.

| CLI option | Label | Key topics |
|------------|-------|------------|
| `infra` | Infrastructure & DevOps | kubernetes, docker, linux, devops, CI/CD, GitOps, terraform… |
| `security` | Cybersecurity | CVE, vulnerability, exploit, zero-day, ransomware, OWASP… |
| `ai` | Artificial Intelligence | LLM, AI agents, RAG, fine-tuning, ollama, llama.cpp… |
| `cloud` | Cloud | AWS, GCP, Azure, serverless, FinOps, cloud-native… |
| `africa` | Tech Africa & Morocco | Maroc, Morocco, Afrique, fintech Afrique, startup Maroc… |

---

## LLM backends

### OpenRouter (default)

```bash
# In .env:
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=sk-or-xxxxxxxxxxxxxxxxxxxx
LLM_MODEL=mistralai/mistral-7b-instruct
```

Recommended models by budget:

| Model | Use case |
|-------|----------|
| `mistralai/mistral-7b-instruct` | Fast, cheap, good for filter/critic |
| `mistralai/mistral-small-3.1` | Best quality/price balance |
| `anthropic/claude-3-haiku` | Excellent for writing (writer) |
| `google/gemini-flash-1.5` | Fast and multilingual |
| `meta-llama/llama-3.1-8b-instruct:free` | Free, for testing |

Generate your key at [openrouter.ai/keys](https://openrouter.ai/keys).

### Ollama (local, offline)

```bash
# In .env:
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=ollama
LLM_MODEL=mistral

# Start Ollama:
ollama pull mistral
ollama serve
```

OpenRouter headers are not sent if the URL does not contain `openrouter.ai`.

---

## Output structure

After each run, `output/{run_date}/{run_id[:8]}/` contains:

```
output/
└── 2026-03-13/
    ├── a1b2c3d4/               ← morning run
    │   ├── blog_post.md        ← YAML front matter + validated draft (unchanged)
    │   ├── linkedin_post.md    ← Post ≤ 280 characters + 3 hashtags
    │   ├── youtube_script.md   ← 60–90s script with timecodes
    │   └── run_metadata.json   ← run_id, article, scores, iterations, tokens
    └── e5f6a7b8/               ← afternoon run (never overwritten)
        ├── blog_post.md
        └── ...
```

Multiple runs on the same day coexist without ever overwriting each other.
