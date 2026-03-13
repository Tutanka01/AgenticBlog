# Agents — contrats et comportements

Chaque agent est une fonction pure `(state: PipelineState) -> dict`. Il reçoit le state complet, retourne uniquement les clés qu'il modifie, et ajoute toujours un `ACPMessage` dans `messages`.

---

## scraper

**Fichier :** `agents/scraper.py`
**Lit :** `state["active_category"]`, `config.CATEGORIES`, `config.MAX_ARTICLES_TO_FETCH`
**Écrit :** `raw_articles`, `messages`

Parse chaque feed RSS avec `feedparser`. Les feeds utilisés dépendent de la catégorie active (`CATEGORIES[active_category]["feeds"]`). En cas d'erreur sur un feed, il log et continue (les autres feeds ne sont pas bloqués). Retourne une liste de dicts :

```
{title, url, summary, source, published, fetched_at}
```

`published` est le champ de date de publication du feed RSS (vide si absent). Il est utilisé par `selector` pour calculer le bonus de fraîcheur.

---

## filter

**Fichier :** `agents/filter.py`
**Lit :** `raw_articles`, `state["active_category"]`, `config.CATEGORIES`, `prompts/filter.md`
**Écrit :** `filtered_articles`, `total_tokens_used`, `messages`

Envoie tous les articles au LLM en une seule requête avec le prompt `filter.md`. Les topics utilisés sont ceux de la catégorie active (`CATEGORIES[active_category]["topics"]`), pas la liste globale `INTEREST_TOPICS`. Le LLM retourne un JSON array `[{url, score, reason}]`. Les articles avec `score >= FILTER_THRESHOLD` sont gardés, triés par score décroissant, limités à `TOP_N_FILTERED`.

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
**Écrit :** `selected_article` (enrichi avec `full_content` + `fetch_method`), `messages`

Fetch le contenu de l'article via une **cascade de 3 stratégies**, dans cet ordre :

1. **Direct** — `httpx` avec headers navigateur réalistes (Chrome/macOS). Si le contenu extrait fait moins de 300 caractères après nettoyage, considéré comme bloqué.
2. **Jina AI Reader** (`r.jina.ai/{url}`) — proxy public gratuit qui contourne la plupart des blocages et paywalls légers. Retourne du texte brut.
3. **RSS summary** — dernier recours, utilise le `summary` déjà présent dans l'article.

Le champ `fetch_method` enregistre la stratégie utilisée (`"direct"`, `"jina"`, `"rss_fallback"`). L'extraction HTML supprime les balises parasites (`script`, `style`, `nav`, `footer`, `aside`, `header`, `form`, `iframe`) avant d'extraire `<article>` → `<main>` → `<body>`. Texte tronqué à 8000 caractères.

**Le pipeline n'est jamais bloqué** — même si les deux premières stratégies échouent, le summary RSS est suffisant pour que writer produise un article.

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
**Lit :** `draft`, `selected_article` (url + source), `prompts/critic.md`
**Écrit :** `critique_approved`, `critic_feedback`, `total_tokens_used`, `messages`

Évalue le draft sur 4 critères pondérés (exactitude, clarté, structure, valeur ajoutée). Retourne un JSON `{approved, score, issues, specific_corrections}`.

- `approved = true` si `score >= 7`
- `critic_feedback` contient les `specific_corrections` (instructions précises pour writer)
- **Fallback :** si le JSON est unparseable, auto-approve pour éviter une boucle infinie

Le conditional edge dans `graph.py` reboucle sur `writer` si `approved == false` et `iteration_count < MAX_CRITIQUE_ITERATIONS`.

**Gestion des fonctionnalités récentes :** le critic reçoit l'URL source et le nom de la source de l'article (`{source_url}`, `{source_name}`). Le prompt `critic.md` lui interdit de rejeter un article uniquement parce qu'il ne connaît pas la fonctionnalité décrite — sa knowledge cutoff peut lui faire manquer des annonces récentes. La règle : si la source est un blog officiel d'éditeur (`aws.amazon.com`, `cloud.google.com`, `azure.microsoft.com`, `kubernetes.io`, etc.), l'existence de la fonctionnalité est considérée comme vraie. Seules les erreurs vérifiables (mauvaise syntaxe, commande incorrecte, contradiction logique) justifient une pénalité sur l'exactitude technique.

---

## formatter

**Fichier :** `agents/formatter.py`
**Lit :** `draft`, `selected_article`, `run_date`, `prompts/formatter_social.md`
**Écrit :** `blog_post`, `linkedin_post`, `youtube_script`, `total_tokens_used`, `messages`

Génère les 3 formats avec deux chemins distincts :

**Blog post — sans LLM :**
Le draft validé n'est pas réécrit. `formatter` construit uniquement le front matter YAML (`title`, `date`, `tags`, `description`, `author`) et le préfixe au draft. La description est extraite des 25 premiers mots du draft. Cela garantit que le blog post conserve exactement les 900–1200 mots validés par le critic.

**LinkedIn + YouTube — via LLM :**
Un seul appel LLM avec `prompts/formatter_social.md`. Le prompt demande au modèle de séparer les sections avec des marqueurs `===LINKEDIN===` et `===YOUTUBE===`. L'agent extrait chaque section avec une regex.

Le post LinkedIn suit des contraintes strictes définies dans `formatter_social.md` : accroche par question directe ou fait chiffré, formules génériques interdites, exactement 3 hashtags, max 280 caractères. Le script YouTube respecte une structure en 4 temps avec timecodes (0s hook → 5s problème → 15s solution → 50s CTA).

**Tags :** extraits des mots de `article["title"]` intersectés avec `INTEREST_TOPICS` (5 max). Fallback sur les 3 premiers topics de la liste globale.

---

## output_saver

**Fichier :** `agents/output_saver.py`
**Lit :** `blog_post`, `linkedin_post`, `youtube_script`, `run_id`, `run_date`, `filtered_articles`, `selected_article`, `iteration_count`, `total_tokens_used`
**Écrit :** `messages`

Crée `output/{run_date}/{run_id[:8]}/` et écrit les 4 fichiers. Plusieurs runs le même jour coexistent sans jamais s'écraser. Le `run_metadata.json` contient toutes les méta du run pour permettre une analyse post-run sans relire les fichiers markdown.

---

## Ajouter un agent

1. Créer `agents/mon_agent.py` avec la signature `def mon_agent_node(state: PipelineState) -> dict`
2. L'importer dans `graph.py` et l'ajouter avec `builder.add_node("mon_agent", mon_agent_node)`
3. Câbler les edges (`add_edge` ou `add_conditional_edges`)
4. Ajouter les clés nécessaires dans `PipelineState` si besoin (`state.py`)
