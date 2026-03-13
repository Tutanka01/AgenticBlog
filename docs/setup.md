# Installation et configuration

## Prérequis

- Python 3.12 (recommandé — voir ci-dessous)
- Un compte OpenRouter (défaut) ou Ollama en local

---

## Installation

### 1. Vérifier la version Python

```bash
python3.12 --version
```

Si la commande échoue, installe Python 3.12 via Homebrew (macOS) :

```bash
brew install python@3.12
```

### 2. Créer et activer le venv

```bash
git clone <repo>
cd AgenticBlog

python3.12 -m venv venv
source venv/bin/activate

python --version   # doit afficher 3.12.x
```

### 3. Installer les dépendances

```bash
pip install -r requirements.txt
```

---

## Configuration

```bash
cp .env.example .env
# Édite .env et remplace LLM_API_KEY par ta clé OpenRouter
```

### Variables LLM

| Variable | Défaut | Description |
|----------|--------|-------------|
| `LLM_BASE_URL` | `https://openrouter.ai/api/v1` | URL de l'API LLM |
| `LLM_MODEL` | `mistralai/mistral-7b-instruct` | Nom du modèle (format OpenRouter) |
| `LLM_API_KEY` | *(vide)* | Clé API — **obligatoire** |
| `LLM_TEMPERATURE` | `0.3` | Température (filter/critic). Writer monte à 0.7 en dur |
| `OPENROUTER_SITE_URL` | `https://github.com/AgenticBlog` | Header d'attribution OpenRouter |
| `OPENROUTER_APP_NAME` | `AgenticBlog` | Header d'attribution OpenRouter |

Les deux headers `OPENROUTER_SITE_URL` / `OPENROUTER_APP_NAME` sont injectés automatiquement par `llm.py` dès que `LLM_BASE_URL` contient `openrouter.ai`. Ils sont ignorés pour tout autre backend.

### Variables pipeline

| Variable | Défaut | Description |
|----------|--------|-------------|
| `FILTER_THRESHOLD` | `6` | Score minimum pour garder un article (0–10) |
| `MAX_ARTICLES_TO_FETCH` | `40` | Limite totale d'articles scrappés |
| `TOP_N_FILTERED` | `5` | Articles transmis au selector après filtrage |
| `MAX_CRITIQUE_ITERATIONS` | `3` | Nombre max de boucles writer ↔ critic |
| `RSS_FEEDS` | 5 feeds par défaut | URLs séparées par des virgules |
| `INTEREST_TOPICS` | Liste DevOps/Cloud/Maghreb | Topics séparés par des virgules |
| `CHECKPOINT_DB` | `memory/checkpoints.sqlite` | Base SQLite LangGraph |
| `OUTPUT_DIR` | `./output` | Dossier de sortie |
| `PROMPTS_DIR` | `./prompts` | Dossier des prompts Markdown |

---

## Lancer le pipeline

```bash
# Run complet
python main.py

# Lister les runs précédents
python main.py --list

# Reprendre un run interrompu
python main.py --resume <run_id>
```

Au démarrage, si un run précédent existe, le pipeline propose automatiquement de le reprendre.

---

## Backends LLM

### OpenRouter (défaut)

```bash
# Dans .env :
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=sk-or-xxxxxxxxxxxxxxxxxxxx
LLM_MODEL=mistralai/mistral-7b-instruct
```

Modèles recommandés selon le budget :

| Modèle | Usage |
|--------|-------|
| `mistralai/mistral-7b-instruct` | Rapide, pas cher, bon pour filter/critic |
| `mistralai/mistral-small-3.1` | Meilleur équilibre qualité/prix |
| `anthropic/claude-3-haiku` | Très bon pour la rédaction (writer) |
| `google/gemini-flash-1.5` | Rapide et multilingue |
| `meta-llama/llama-3.1-8b-instruct:free` | Gratuit, pour tester |

La clé se génère sur [openrouter.ai/keys](https://openrouter.ai/keys).

### Ollama (local, hors-ligne)

```bash
# Dans .env :
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=ollama
LLM_MODEL=mistral

# Démarrer Ollama :
ollama pull mistral
ollama serve
```

Les headers OpenRouter ne sont pas envoyés si l'URL ne contient pas `openrouter.ai`.

---

## Structure des outputs

Après chaque run, `output/{run_date}/` contient :

```
output/2026-03-13/
├── blog_post.md        ← Article complet avec front matter YAML
├── linkedin_post.md    ← Post ≤ 280 caractères + 3 hashtags
├── youtube_script.md   ← Script 60–90s avec timecodes
└── run_metadata.json   ← run_id, article sélectionné, scores, nb itérations, tokens
```
