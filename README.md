# AgenticBlog

Pipeline multi-agents qui lit des flux RSS, sélectionne l'article le plus pertinent, rédige un post validé par un critique, et exporte trois formats prêts à publier — en une commande.

```
python main.py --category security
```

Construit avec **LangGraph** + **FastAPI** + **React**. Backend LLM configurable : OpenRouter, Ollama, llama.cpp, ou OpenAI direct.

---

## Ce que ça fait concrètement

Chaque run produit trois fichiers dans `output/{date}/{run_id}/` :

| Fichier | Contenu |
|---------|---------|
| `blog_post.md` | Article Markdown 900–1200 mots avec YAML front matter |
| `linkedin_post.md` | Post ≤ 280 caractères, hook + 3 hashtags |
| `youtube_script.md` | Script ~90s avec timecodes (hook / problème / solution / CTA) |

Le pipeline scrape les feeds RSS de la catégorie choisie, score chaque article avec le LLM, choisit le meilleur en tenant compte de la fraîcheur et de la **mémoire éditoriale** (évite de répéter un sujet couvert récemment), fetche le contenu complet, rédige, fait critiquer, corrige, formate.

Le writer reçoit aussi les **leçons des runs précédents** : chaque rejet par le critique est mémorisé et réinjecté automatiquement au run suivant — le pipeline apprend de ses erreurs éditoriales.

---

## Démarrage rapide

### 1. Prérequis

- Python 3.12+
- Une clé [OpenRouter](https://openrouter.ai/keys) — ou Ollama en local

### 2. Installation

```bash
git clone https://github.com/Tutanka01/AgenticBlog
cd AgenticBlog

python -m venv venv
source venv/bin/activate          # Windows : venv\Scripts\activate

pip install -r requirements.txt
```

### 3. Configuration

```bash
cp .env.example .env
# Ouvrir .env et renseigner LLM_API_KEY
```

Le minimum à renseigner :

```bash
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=sk-or-xxxxxxxxxxxx
LLM_MODEL=mistralai/mistral-small-3.1
```

### 4. Premier run

```bash
python main.py
```

Les outputs arrivent dans `output/` à la fin du run. C'est tout.

---

## Référence CLI

```
python main.py [OPTIONS]
```

| Option | Description |
|--------|-------------|
| *(aucune)* | Run complet — catégorie `infra` (défaut) |
| `--category <id>` / `-c <id>` | Choisir la catégorie de veille |
| `--resume <run_id>` | Reprendre un run interrompu (checkpoints SQLite) |
| `--list` | Lister les runs passés avec leurs métadonnées |

### Catégories disponibles

```bash
python main.py -c infra       # Kubernetes, DevOps, Linux, Terraform…
python main.py -c security    # CVE, pentest, kernel, OWASP, zero-day…
python main.py -c ai          # LLM, RAG, fine-tuning, Ollama, agents…
python main.py -c cloud       # AWS, GCP, Azure, FinOps, serverless…
python main.py -c africa      # Tech Maroc, Afrique, startups, fintech…
```

### Reprendre un run interrompu

Le pipeline checkpointe chaque étape dans `memory/checkpoints.sqlite` via LangGraph.
Si un run est interrompu (coupure réseau, erreur LLM passagère), il suffit de :

```bash
python main.py --resume <run_id>
```

Le `run_id` s'affiche au démarrage de chaque run et est listé par `--list`.

---

## Pipeline

```
scraper    Lit les feeds RSS de la catégorie → liste d'articles bruts
   │
filter     LLM score chaque article 0–10 (topics de la catégorie)
   │        garde score ≥ FILTER_THRESHOLD, top TOP_N_FILTERED
   │
selector   Score composite : LLM score + fraîcheur + pénalité mémoire éditoriale
   │        → choisit l'article, construit le contexte des articles passés
   │
fetcher    Fetch le contenu complet (direct → Jina AI Reader → résumé RSS)
   │
writer  ◄──────────────────────────────────┐
   │    Rédige le brouillon                │ feedback
   │                                       │
critic  ── score < 7 et iter < 3 ──────────┘
   │    ── approuve ou passe à la suite
   │
formatter  Construit le front matter YAML + génère LinkedIn + YouTube via LLM
   │
output_saver  Écrit output/ + met à jour la mémoire éditoriale
```

La boucle writer ↔ critic est bornée à `MAX_CRITIQUE_ITERATIONS` (défaut : 3).

---

## Backends LLM

Le client LLM est centralisé dans `llm.py` et compatible avec tout backend API OpenAI.

### OpenRouter (défaut, recommandé)

```bash
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=sk-or-xxxxxxxxxxxx
LLM_MODEL=mistralai/mistral-small-3.1
```

Modèles testés et recommandés :

| Modèle | Qualité | Coût |
|--------|---------|------|
| `mistralai/mistral-small-3.1` | Bon équilibre | ~$0.10/run |
| `anthropic/claude-3-haiku` | Excellent pour la rédaction | ~$0.30/run |
| `google/gemini-flash-1.5` | Rapide et multilingue | ~$0.08/run |
| `meta-llama/llama-3.1-8b-instruct:free` | Gratuit, pour tester | $0 |

### Ollama (local, hors-ligne)

```bash
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=ollama
LLM_MODEL=mistral

# Démarrer Ollama :
ollama pull mistral && ollama serve
```

---

## Mémoire éditoriale

AgenticBlog implémente une architecture **dual-bank** inspirée des travaux récents sur les agents à mémoire persistante (Live-Evo, MemRL, Trajectory-Informed Memory) :

### Experience Bank — ce qui a été couvert

`memory/topics/{category}.md` enregistre chaque article publié. À chaque run :

- Le **selector** applique une pénalité de nouveauté aux articles trop proches d'un sujet couvert dans les 14 derniers jours (similarité de Jaccard sur les mots-clés) — favorise la diversité éditoriale sans exclure un bon article.
- Le **writer** reçoit le contexte des articles passés pertinents pour créer de la continuité narrative ("Dans mon article sur X, j'avais expliqué Y...").

### Meta-Guideline Bank — ce qui a échoué (Reflexion Loop)

`memory/lessons/{category}.md` enregistre les rejets du critique. Quand un brouillon demande ≥ 2 itérations avant d'être approuvé, la raison du rejet est mémorisée et **réinjectée automatiquement dans le prompt du writer au run suivant** :

```
### Leçons critiques — à appliquer obligatoirement
- [haute priorité] ton trop formel dans l'introduction; manque d'exemples CLI concrets
- [priorité normale] structure trop linéaire, accroche trop neutre
```

Les leçons vieillissent par usage (×0.85 à chaque run sur la même catégorie) et sont purgées automatiquement après ~17 runs — les erreurs récentes ont plus de poids que les anciennes.

**Cycle d'homéostasie :**

| Runs | Ce qui se passe |
|------|----------------|
| 1–3 | Le critic rejette le brouillon (ton trop formel, structure plate…). La leçon est mémorisée avec `poids: 1.00`. |
| 4–10 | Le writer reçoit la leçon en `[haute priorité]`, s'ajuste dès le premier brouillon — `iteration_count = 1`. |
| 11–20 | Les poids décroissent (×0.85 à chaque run). La leçon passe en `[priorité normale]` puis disparaît. |
| 21+ | Le writer refait peut-être l'erreur. Le critic la rattrape, la leçon remonte à `poids: 1.00`. Et ainsi de suite. |

Le pipeline ne converge pas vers un état figé — il oscille autour d'un équilibre éditorial, comme un système à rétroaction.

Aucune base vectorielle, aucune infrastructure — uniquement des fichiers Markdown.

```
memory/
├── MEMORY.md           ← Index des 60 derniers runs
├── topics/             ← Experience Bank (articles produits)
│   ├── infra.md
│   ├── security.md
│   └── ...
├── lessons/            ← Meta-Guideline Bank (leçons éditoriales)
│   ├── infra.md
│   └── ...
└── archive/            ← Overflow automatique
```

Voir `docs/memory.md` pour les fondements théoriques et les références académiques.

---

## Variables d'environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `LLM_BASE_URL` | `https://openrouter.ai/api/v1` | URL de l'API LLM |
| `LLM_MODEL` | `mistralai/mistral-small-3.1` | Modèle |
| `LLM_API_KEY` | *(vide)* | Clé API — **obligatoire** |
| `LLM_TEMPERATURE` | `0.3` | Température (filter, critic, formatter) |
| `LLM_TIMEOUT_SECONDS` | `90` | Timeout par requête LLM |
| `FILTER_THRESHOLD` | `6` | Score minimum pour garder un article (0–10) |
| `MAX_ARTICLES_TO_FETCH` | `40` | Limite d'articles scrappés |
| `TOP_N_FILTERED` | `5` | Articles transmis au selector |
| `MAX_CRITIQUE_ITERATIONS` | `3` | Boucles writer ↔ critic max |
| `CHECKPOINT_DB` | `memory/checkpoints.sqlite` | Base SQLite LangGraph |
| `OUTPUT_DIR` | `./output` | Dossier de sortie |

---

## Interface web (optionnelle)

La CLI est le mode principal. L'interface web est disponible pour visualiser le pipeline
en temps réel et consulter l'historique des runs.

**Mode développement (2 terminaux) :**

```bash
# Terminal 1 — API
source venv/bin/activate
pip install -r requirements_ui.txt
uvicorn api:app --port 8000 --reload

# Terminal 2 — Frontend
cd frontend && npm ci && npm run dev
```

Accès : `http://localhost:5173`

**Via Docker :**

```bash
docker-compose up
```

Accès : `http://localhost:3000`

---

## Structure du projet

```
AgenticBlog/
├── main.py              # Point d'entrée CLI
├── graph.py             # StateGraph LangGraph
├── state.py             # PipelineState TypedDict + ACPMessage
├── config.py            # Catégories, feeds RSS, style rédactionnel
├── llm.py               # Client LLM partagé
├── memory_manager.py    # Mémoire éditoriale Markdown-First
├── api.py               # API FastAPI + SSE (UI optionnelle)
├── agents/
│   ├── scraper.py
│   ├── filter.py
│   ├── selector.py
│   ├── fetcher.py
│   ├── writer.py
│   ├── critic.py
│   ├── formatter.py
│   └── output_saver.py
├── prompts/             # Prompts Markdown avec variables {placeholder}
├── frontend/            # React 18 + Vite + Tailwind (UI optionnelle)
├── memory/              # Dual-Bank (topics/ + lessons/) + checkpoints SQLite
├── output/              # Contenu généré (jamais commité)
└── docs/
    ├── agents.md        # Contrats et comportements des agents
    ├── memory.md        # Architecture mémoire + références académiques
    ├── setup.md         # Configuration détaillée
    ├── frontend.md      # Architecture React
    └── docker.md        # Déploiement conteneurisé
```

---

## Documentation

| Doc | Contenu |
|-----|---------|
| [`docs/setup.md`](docs/setup.md) | Installation, configuration, backends LLM |
| [`docs/agents.md`](docs/agents.md) | Contrats des agents, comportements, fallbacks |
| [`docs/memory.md`](docs/memory.md) | Architecture mémoire éditoriale + papers |
| [`docs/frontend.md`](docs/frontend.md) | Interface web React |
| [`docs/docker.md`](docs/docker.md) | Déploiement Docker Compose |

---

## Auteur

**Mohamad El Akhal** — ingénieur DevOps/Cloud, [makhal.fr](https://makhal.fr)
