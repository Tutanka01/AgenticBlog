# AgenticBlog — Vue d'ensemble

## Documentation

- Setup local et variables: `docs/setup.md`
- Contrats des agents: `docs/agents.md`
- Frontend (React/Vite/Tailwind): `docs/frontend.md`
- Déploiement Docker: `docs/docker.md`
- Mémoire éditoriale (architecture + papers): `docs/memory.md`

Pipeline multi-agents qui lit des flux RSS tech, sélectionne l'article le plus pertinent, fetche son contenu complet, rédige un post validé par un critique, puis exporte 3 formats (blog Markdown, LinkedIn, YouTube Shorts). Tout le run est persisté en SQLite et peut être repris après une interruption.

Le projet inclut aussi une interface web de pilotage:

- Backend API FastAPI + SSE (`api.py`)
- Frontend React/Vite/Tailwind (`frontend/`)
- Orchestration Docker Compose (`docker-compose.yml`)

---

## Architecture du pipeline

```
scraper_node         ← feeds RSS selon la catégorie active
    ↓  raw_articles[] — {title, url, summary, source, published, fetched_at}
filter_node          ← LLM : score chaque article 0-10 (topics de la catégorie)
    ↓  filtered_articles[] (score ≥ FILTER_THRESHOLD, top TOP_N_FILTERED)
selector_node        ← score composite : LLM score + freshness bonus (0-1)
    ↓  selected_article{}
fetcher_node         ← cascade : direct → Jina AI Reader → RSS summary fallback
    ↓  selected_article{} + full_content + fetch_method
writer_node  ←──────────────────────────────┐
    ↓  draft (v1, v2…)                       │ critic_feedback
critic_node  ──(score < 7, iter < 3)────────┘
    ↓  (approve OR max_iter atteint)
formatter_node       ← blog = YAML front matter + draft (pas de LLM)
    ↓                  linkedin + youtube = LLM via prompts/formatter_social.md
output_saver_node    ← écrit output/{date}/ + checkpoints SQLite
    ↓
END
```

La boucle writer ↔ critic est bornée à `MAX_CRITIQUE_ITERATIONS` (défaut : 3). Si le score n'atteint pas 7/10 au bout de 3 tentatives, le pipeline continue quand même avec le meilleur draft produit.

---

## Catégories

Le pipeline supporte plusieurs catégories de veille, chacune avec ses propres feeds RSS et topics de filtrage :

| Catégorie | Label | Feeds |
|-----------|-------|-------|
| `infra` (défaut) | Infrastructure & DevOps | HN, Reddit K8s/DevOps/Selfhosted, LWN |
| `security` | Cybersécurité | The Hacker News, BleepingComputer, LWN, Exploit-DB |
| `ai` | Intelligence Artificielle | HN, Reddit ML/LocalLLaMA/Artificial |
| `cloud` | Cloud | HN, AWS Blog, Reddit AWS/GCP/Azure |
| `africa` | Tech Afrique & Maroc | HN, Reddit Africa/Morocco |

La catégorie active est transmise dans `state["active_category"]` et lue par `scraper` et `filter`.

---

## Structure des fichiers

```
.
├── main.py              # Point d'entrée (CLI : --resume, --list, --category)
├── graph.py             # StateGraph LangGraph + checkpointer SQLite
├── state.py             # PipelineState (TypedDict) + ACPMessage (Pydantic)
├── config.py            # Config centralisée : CATEGORIES, DEFAULT_CATEGORY, .env
├── llm.py               # Client OpenAI partagé (headers OpenRouter injectés auto)
├── .env                 # Variables d'environnement (non commité)
├── .env.example         # Template à copier
├── requirements.txt
├── agents/
│   ├── scraper.py       # Fetch RSS → raw_articles (feeds selon catégorie)
│   ├── filter.py        # Score LLM → filtered_articles (topics selon catégorie)
│   ├── selector.py      # Score composite → selected_article
│   ├── fetcher.py       # Cascade fetch : direct → Jina → RSS fallback
│   ├── writer.py        # Rédige / révise → draft (avec retry longueur)
│   ├── critic.py        # Évalue → feedback + approve/reject
│   ├── formatter.py     # blog (YAML+draft) + linkedin/youtube (LLM)
│   └── output_saver.py  # Persiste + résumé console
├── prompts/             # Prompts Markdown avec variables {placeholder}
│   ├── filter.md
│   ├── writer.md
│   ├── critic.md
│   ├── formatter.md        # (conservé, non utilisé — remplacé par formatter_social.md)
│   └── formatter_social.md # LinkedIn + YouTube uniquement
├── memory/
│   └── checkpoints.sqlite  # Géré automatiquement par LangGraph
└── output/
    └── {run_date}/
        └── {run_id[:8]}/       # un sous-dossier par run — jamais d'écrasement
            ├── blog_post.md
            ├── linkedin_post.md
            ├── youtube_script.md
            └── run_metadata.json
```

---

## State partagé

Toutes les données transitent via `PipelineState` (défini dans `state.py`). Chaque agent reçoit le state complet en lecture et retourne **uniquement les clés qu'il modifie**.

Les messages inter-agents (`ACPMessage`) sont accumulés dans `state["messages"]` via `operator.add` comme reducer — ils ne sont jamais écrasés, seulement ajoutés. (`add_messages` de LangGraph n'est pas utilisé car il attend des objets LangChain avec un champ `.id`, incompatible avec les Pydantic models purs.)

Champs clés ajoutés récemment :

| Clé | Type | Rôle |
|-----|------|------|
| `active_category` | `str` | Catégorie du run (`"infra"`, `"security"`, `"ai"`, etc.) |

---

## LLM

Le client est centralisé dans `llm.py`. Il expose un singleton `llm_client` importé par tous les agents — un seul endroit à modifier si le backend change.

OpenRouter est le backend par défaut. `llm.py` détecte automatiquement si `LLM_BASE_URL` contient `openrouter.ai` et injecte les headers d'attribution requis (`HTTP-Referer`, `X-Title`). Pour tout autre backend, ces headers sont absents.

| Backend | `LLM_BASE_URL` | `LLM_API_KEY` |
|---------|----------------|---------------|
| OpenRouter | `https://openrouter.ai/api/v1` | `sk-or-...` |
| Ollama (local) | `http://localhost:11434/v1` | `ollama` |
| llama.cpp | `http://localhost:8080/v1` | `any` |
| OpenAI | `https://api.openai.com/v1` | `sk-...` |
