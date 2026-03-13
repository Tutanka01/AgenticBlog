# Agents — contrats et comportements

Chaque agent est une fonction pure `(state: PipelineState) -> dict`. Il reçoit le state complet, retourne uniquement les clés qu'il modifie, et ajoute toujours un `ACPMessage` dans `messages`.

---

## scraper

**Fichier :** `agents/scraper.py`
**Lit :** `config.RSS_FEEDS`, `config.MAX_ARTICLES_TO_FETCH`
**Écrit :** `raw_articles`, `messages`

Parse chaque feed RSS avec `feedparser`. En cas d'erreur sur un feed, il log et continue (les autres feeds ne sont pas bloqués). Retourne une liste de dicts `{title, url, summary, source, fetched_at}`.

---

## filter

**Fichier :** `agents/filter.py`
**Lit :** `raw_articles`, `config.INTEREST_TOPICS`, `prompts/filter.md`
**Écrit :** `filtered_articles`, `total_tokens_used`, `messages`

Envoie tous les articles au LLM en une seule requête avec le prompt `filter.md`. Le LLM retourne un JSON array `[{url, score, reason}]`. Les articles avec `score >= FILTER_THRESHOLD` sont gardés, triés par score décroissant, limités à `TOP_N_FILTERED`.

**Fallback :** si le LLM échoue ou retourne du JSON invalide, tous les articles reçoivent un score de 5 (passent le filtre, mais aucun n'est mis en avant).

---

## selector

**Fichier :** `agents/selector.py`
**Lit :** `filtered_articles`, `raw_articles`
**Écrit :** `selected_article`, `messages`

Prend simplement `filtered_articles[0]` (déjà trié par score). Si `filtered_articles` est vide (tous les articles en dessous du seuil), utilise `raw_articles[0]` comme fallback.

---

## writer

**Fichier :** `agents/writer.py`
**Lit :** `selected_article`, `critic_feedback`, `iteration_count`, `prompts/writer.md`
**Écrit :** `draft`, `iteration_count`, `total_tokens_used`, `messages`

Au premier appel (`iteration_count == 0`), rédige le brouillon complet depuis `selected_article`. Aux appels suivants, reçoit `critic_feedback` et applique uniquement les corrections demandées sans réécrire l'article entièrement.

Utilise `temperature=0.7` (plus créatif que les autres agents).

---

## critic

**Fichier :** `agents/critic.py`
**Lit :** `draft`, `prompts/critic.md`
**Écrit :** `critique_approved`, `critic_feedback`, `total_tokens_used`, `messages`

Évalue le draft sur 4 critères pondérés (exactitude, clarté, structure, valeur ajoutée). Retourne un JSON `{approved, score, issues, specific_corrections}`.

- `approved = true` si `score >= 7`
- `critic_feedback` contient les `specific_corrections` (instructions précises pour writer)
- **Fallback :** si le JSON est unparseable, auto-approve pour éviter une boucle infinie

Le conditional edge dans `graph.py` reboucle sur `writer` si `approved == false` et `iteration_count < MAX_CRITIQUE_ITERATIONS`.

---

## formatter

**Fichier :** `agents/formatter.py`
**Lit :** `draft`, `selected_article`, `run_date`, `prompts/formatter.md`
**Écrit :** `blog_post`, `linkedin_post`, `youtube_script`, `total_tokens_used`, `messages`

Génère les 3 formats en une seule requête LLM. Le prompt demande au modèle de séparer les sections avec des marqueurs `===BLOG===`, `===LINKEDIN===`, `===YOUTUBE===`. L'agent extrait ensuite chaque section avec une regex.

**Fallback :** si les marqueurs sont absents, `blog_post = draft`.

---

## output_saver

**Fichier :** `agents/output_saver.py`
**Lit :** `blog_post`, `linkedin_post`, `youtube_script`, `run_id`, `run_date`, `filtered_articles`, `selected_article`, `iteration_count`, `total_tokens_used`
**Écrit :** `messages`

Crée `output/{run_date}/` et écrit les 4 fichiers. Le `run_metadata.json` contient toutes les méta du run pour permettre une analyse post-run sans relire les fichiers markdown.

---

## Ajouter un agent

1. Créer `agents/mon_agent.py` avec la signature `def mon_agent_node(state: PipelineState) -> dict`
2. L'importer dans `graph.py` et l'ajouter avec `builder.add_node("mon_agent", mon_agent_node)`
3. Câbler les edges (`add_edge` ou `add_conditional_edges`)
4. Ajouter les clés nécessaires dans `PipelineState` si besoin (`state.py`)
