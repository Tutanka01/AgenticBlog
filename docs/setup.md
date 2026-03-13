# Installation et configuration

## Prérequis

- Python 3.12 (recommandé — voir ci-dessous)
- Node.js 20+ (pour l'interface web)
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
pip install -r requirements_ui.txt
```

### 4. Installer les dépendances frontend

```bash
cd frontend
npm ci
cd ..
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
| `LLM_TIMEOUT_SECONDS` | `90` | Timeout max par requête LLM (évite les blocages silencieux) |
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
| `CHECKPOINT_DB` | `memory/checkpoints.sqlite` | Base SQLite LangGraph |
| `OUTPUT_DIR` | `./output` | Dossier de sortie |
| `PROMPTS_DIR` | `./prompts` | Dossier des prompts Markdown |

> **Note :** `RSS_FEEDS` et `INTEREST_TOPICS` ne sont plus les variables principales. Les feeds et topics sont maintenant définis par catégorie dans `config.CATEGORIES`. Ces variables `.env` sont conservées pour compatibilité mais ne sont plus utilisées par `scraper` et `filter`.

---

## Lancer le pipeline

```bash
# Run complet — catégorie par défaut (infra)
python main.py

# Choisir une catégorie
python main.py --category infra      # Infrastructure & DevOps (défaut)
python main.py --category security   # veille cybersécurité
python main.py --category ai         # veille IA / LLM
python main.py --category cloud      # veille Cloud
python main.py --category africa     # tech Maroc / Afrique

# Forme courte (-c est un alias de --category)
python main.py -c security

# Lister les runs précédents
python main.py --list

# Reprendre un run interrompu
python main.py --resume <run_id>
python main.py --resume <run_id> --category security
```

Au démarrage, si un run précédent existe, le pipeline propose automatiquement de le reprendre.

---

## Lancer l'interface web en local (mode dev)

Ouvre 2 terminaux.

### Terminal 1: API backend

```bash
source venv/bin/activate
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

### Terminal 2: frontend

```bash
cd frontend
npm run dev
```

Acces:

- Frontend: `http://localhost:5173`
- API: `http://localhost:8000`
- Healthcheck: `http://localhost:8000/api/health`

En mode dev, Vite proxy automatiquement `/api` vers `http://localhost:8000`.

---

## Deploiement conteneurise

Pour lancer l'application complete via Docker Compose (backend + frontend), consulte `docs/docker.md`.

Pour les details d'architecture frontend, consulte `docs/frontend.md`.

---

## Catégories disponibles

Les catégories sont définies dans `config.CATEGORIES`. Chacune embarque ses propres feeds RSS et topics de filtrage — aucune variable `.env` à toucher pour changer de domaine.

| Option CLI | Label | Topics clés |
|------------|-------|-------------|
| `infra` | Infrastructure & DevOps | kubernetes, docker, linux, devops, CI/CD, GitOps, terraform… |
| `security` | Cybersécurité | CVE, vulnerability, exploit, zero-day, ransomware, OWASP… |
| `ai` | Intelligence Artificielle | LLM, AI agents, RAG, fine-tuning, ollama, llama.cpp… |
| `cloud` | Cloud | AWS, GCP, Azure, serverless, FinOps, cloud-native… |
| `africa` | Tech Afrique & Maroc | Maroc, Morocco, Afrique, fintech Afrique, startup Maroc… |

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

Après chaque run, `output/{run_date}/{run_id[:8]}/` contient :

```
output/
└── 2026-03-13/
    ├── a1b2c3d4/               ← run du matin
    │   ├── blog_post.md        ← YAML front matter + draft validé (inchangé)
    │   ├── linkedin_post.md    ← Post ≤ 280 caractères + 3 hashtags
    │   ├── youtube_script.md   ← Script 60–90s avec timecodes
    │   └── run_metadata.json   ← run_id, article, scores, itérations, tokens
    └── e5f6a7b8/               ← run de l'après-midi (jamais écrasé)
        ├── blog_post.md
        └── ...
```

Plusieurs runs le même jour coexistent sans jamais s'écraser.
