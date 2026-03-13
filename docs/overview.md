# AgenticBlog — Vue d'ensemble

Pipeline multi-agents qui lit des flux RSS tech, sélectionne l'article le plus pertinent, rédige un post validé par un critique, puis exporte 3 formats (blog Markdown, LinkedIn, YouTube Shorts). Tout le run est persisté en SQLite et peut être repris après une interruption.

---

## Architecture du pipeline

```
scraper_node
    ↓  raw_articles[]
filter_node          ← LLM : score chaque article 0-10
    ↓  filtered_articles[] (score ≥ FILTER_THRESHOLD, top TOP_N_FILTERED)
selector_node        ← pick top-1
    ↓  selected_article{}
writer_node  ←──────────────────────────────┐
    ↓  draft (v1, v2…)                       │ critic_feedback
critic_node  ──(score < 7, iter < 3)────────┘
    ↓  (approve OR max_iter atteint)
formatter_node       ← LLM : 3 formats depuis le draft validé
    ↓  blog_post, linkedin_post, youtube_script
output_saver_node    ← écrit output/{date}/ + checkpoints SQLite
    ↓
END
```

La boucle writer ↔ critic est bornée à `MAX_CRITIQUE_ITERATIONS` (défaut : 3). Si le score n'atteint pas 7/10 au bout de 3 tentatives, le pipeline continue quand même avec le meilleur draft produit.

---

## Structure des fichiers

```
.
├── main.py              # Point d'entrée (CLI : --resume, --list)
├── graph.py             # StateGraph LangGraph + checkpointer SQLite
├── state.py             # PipelineState (TypedDict) + ACPMessage (Pydantic)
├── config.py            # Config centralisée, lue depuis .env
├── llm.py               # Client OpenAI partagé (headers OpenRouter injectés auto)
├── .env                 # Variables d'environnement (non commité)
├── .env.example         # Template à copier
├── requirements.txt
├── agents/
│   ├── scraper.py       # Fetch RSS → raw_articles
│   ├── filter.py        # Score LLM → filtered_articles
│   ├── selector.py      # Pick top-1 → selected_article
│   ├── writer.py        # Rédige / révise → draft
│   ├── critic.py        # Évalue → feedback + approve/reject
│   ├── formatter.py     # 3 formats → blog/linkedin/youtube
│   └── output_saver.py  # Persiste + résumé console
├── prompts/             # Prompts Markdown avec variables {placeholder}
│   ├── filter.md
│   ├── writer.md
│   ├── critic.md
│   └── formatter.md
├── memory/
│   └── checkpoints.sqlite  # Géré automatiquement par LangGraph
└── output/
    └── {run_date}/
        ├── blog_post.md
        ├── linkedin_post.md
        ├── youtube_script.md
        └── run_metadata.json
```

---

## State partagé

Toutes les données transitent via `PipelineState` (défini dans `state.py`). Chaque agent reçoit le state complet en lecture et retourne **uniquement les clés qu'il modifie**.

Les messages inter-agents (`ACPMessage`) sont accumulés dans `state["messages"]` via le reducer `add_messages` de LangGraph — ils ne sont jamais écrasés, seulement ajoutés.

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
