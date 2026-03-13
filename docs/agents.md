# Agents — contrats et comportements

Chaque agent est une fonction pure `(state: PipelineState) -> dict`. Il reçoit le state complet, retourne uniquement les clés qu'il modifie, et ajoute toujours un `ACPMessage` dans `messages`.

---

## scraper

**Fichier :** `agents/scraper.py`
**Lit :** `config.RSS_FEEDS`, `config.MAX_ARTICLES_TO_FETCH`
**Écrit :** `raw_articles`, `messages`

Parse chaque feed RSS avec `feedparser`. En cas d'erreur sur un feed, il log et continue (les autres feeds ne sont pas bloqués). Retourne une liste de dicts :

```
{title, url, summary, source, published, fetched_at}
```

`published` est le champ de date de publication du feed RSS (vide si absent). Il est utilisé par `selector` pour calculer le bonus de fraîcheur.

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

Sélectionne l'article avec le **score composite** le plus élevé :

```
score_composite = score_llm (0–10) + freshness_bonus (0–1)
```

Le bonus de fraîcheur décroit linéairement de 1.0 (article publié maintenant) à 0.0 (article vieux de 7 jours ou plus). Il est calculé depuis le champ `published` du feed RSS, ou `fetched_at` en fallback. Cela permet de départager deux articles proches en score LLM en favorisant le plus récent, sans jamais écraser un bon score.

**Fallback :** si `filtered_articles` est vide, utilise `raw_articles[0]`.

---

## fetcher

**Fichier :** `agents/fetcher.py`
**Lit :** `selected_article`
**Écrit :** `selected_article` (enrichi avec `full_content`), `messages`

Fetch le HTML de l'URL de l'article sélectionné via `httpx`, puis extrait le texte principal avec `BeautifulSoup`. Les balises parasites (`script`, `style`, `nav`, `footer`, `aside`, `header`, `form`) sont supprimées avant extraction. Le texte est tronqué à 8000 caractères pour rester dans le contexte d'un LLM 7B.

La priorité d'extraction est : `<article>` → `<main>` → `<body>`.

**Fallback :** si le fetch échoue (timeout, 403, etc.), `full_content` prend la valeur du `summary` RSS. Le pipeline n'est jamais bloqué par un article inaccessible.

---

## writer

**Fichier :** `agents/writer.py`
**Lit :** `selected_article` (dont `full_content`), `critic_feedback`, `iteration_count`, `prompts/writer.md`
**Écrit :** `draft`, `iteration_count`, `total_tokens_used`, `messages`

Utilise `full_content` en priorité sur `summary` pour alimenter le prompt — le LLM dispose ainsi du contenu réel de l'article, pas juste du résumé RSS.

Au premier appel (`iteration_count == 0`), rédige le brouillon complet. Aux appels suivants, applique uniquement les corrections du `critic_feedback` sans réécrire entièrement.

**Retry automatique sur longueur :** si le brouillon v1 est inférieur à 800 mots, un second appel LLM est déclenché automatiquement avec une instruction explicite d'extension. Le draft le plus long des deux est conservé. Ce retry ne s'applique qu'à l'itération 1 pour éviter de doubler les appels lors des révisions critic.

Utilise `temperature=0.7` (plus créatif que les autres agents qui utilisent `LLM_TEMPERATURE`).

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

Le post LinkedIn suit des contraintes strictes définies dans `prompts/formatter.md` : accroche par question directe ou fait chiffré, formules génériques interdites, exactement 3 hashtags, max 280 caractères.

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
