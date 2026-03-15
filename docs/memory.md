# Mémoire Éditoriale — Architecture & Fondements Théoriques

> **Fichiers concernés :** `memory_manager.py`, `state.py`, `agents/selector.py`,
> `agents/writer.py`, `agents/output_saver.py`, `prompts/writer.md`

---

## Résumé

AgenticBlog implémente un système de **mémoire persistante Markdown-First** qui permet
au pipeline de conserver un historique éditorial entre les runs. Contrairement aux approches
basées sur des bases vectorielles ou des graphes de connaissances, cette architecture repose
uniquement sur des fichiers Markdown structurés — directement lisibles et modifiables par
l'agent ou un humain, sans infrastructure supplémentaire.

Concrètement, trois comportements émergent :

1. **Le selector** applique une pénalité de nouveauté aux articles trop proches de sujets
   récemment couverts (fenêtre de 14 jours), favorisant la diversité éditoriale.
2. **Le writer** reçoit un contexte des articles passés pertinents, lui permettant de créer
   de la continuité narrative ("Dans mon article sur X, j'avais expliqué Y...").
3. **Le writer** reçoit les leçons critiques des runs précédents ayant demandé ≥ 2 itérations
   critic — les erreurs éditoriales passées sont mémorisées et injectées avant chaque rédaction.

---

## 1. Problème : l'amnésie des pipelines IA

Un pipeline multi-agents sans mémoire persistante est, par construction, **amnésique** :
chaque run repart de zéro, ignore tout ce qui a été produit avant lui, et ne peut donc ni
éviter la répétition ni créer de continuité éditoriale.

Ce problème est fondamental dans les systèmes IA multi-sessions. Il a été formalisé dans
plusieurs travaux récents :

- Sumers et al. (2023) identifient la mémoire comme une des quatre composantes cognitives
  essentielles d'un agent LLM, aux côtés du raisonnement, de l'action et de la planification.
  Sans mémoire persistante, un agent ne peut exhiber aucun comportement cohérent sur le long
  terme \[1\].
- Park et al. (2023) montrent que les agents simulés sans mémoire à long terme voient leur
  comportement se dégrader rapidement en incohérences : ils répètent les mêmes actions, font
  les mêmes erreurs, et ne tirent aucune leçon de leurs interactions passées \[2\].
- Packer et al. (2023) quantifient le coût de l'amnésie dans les LLM : sans gestion explicite
  du contexte, un agent perd l'accès à l'historique dès que la fenêtre de contexte est pleine,
  ce qui force des comportements sous-optimaux ou incohérents \[3\].

Dans le cadre éditorial d'AgenticBlog, l'amnésie se traduit par trois problèmes concrets :

| Problème | Symptôme observé |
|----------|-----------------|
| Répétition thématique | Deux runs successifs sur le même sujet Kubernetes |
| Pas de continuité narrative | Le writer ne peut pas référencer ses propres articles |
| Dérive éditoriale | Aucun signal sur ce qui a "bien marché" (score critique) |

---

## 2. Revue de littérature

### 2.1 Taxonomie des mémoires IA — CoALA (Sumers et al., 2023)

Le papier *Cognitive Architectures for Language Agents* \[1\] propose une taxonomie en quatre
types de mémoire pour les agents LLM, calquée sur les sciences cognitives :

| Type | Définition | Équivalent AgenticBlog |
|------|-----------|----------------------|
| **Sémantique** | Faits généraux sur le monde | Implicite dans les poids du LLM |
| **Épisodique** | Événements passés spécifiques | `MEMORY.md` — runs et articles produits |
| **Procédurale** | Savoir-faire, méthodes | Prompts dans `prompts/` |
| **En cours de travail** (*working*) | Contexte actif | `PipelineState` — effacé entre runs |

Notre implémentation cible principalement la **mémoire épisodique** : elle enregistre quand,
sur quel sujet et avec quel score chaque run a produit du contenu. Elle l'injecte ensuite dans
la mémoire de travail du writer via `state["memory_context"]`.

### 2.2 Hiérarchie des mémoires — MemGPT (Packer et al., 2023)

MemGPT \[3\] propose un OS-like pour les LLM : une hiérarchie de mémoires (main context,
external storage, recall storage) avec des fonctions d'écriture/lecture explicites que
l'agent appelle lui-même. L'agent décide quand consolider ses observations en mémoire
longue durée.

Notre approche en diffère sur un point crucial : **la décision de mémoriser n'est pas
déléguée au LLM** — elle est systématique et automatique (après chaque run réussi).
Ce choix évite la variabilité inhérente aux décisions LLM et garantit une couverture
complète de l'historique. La contrepartie est une moindre sélectivité : tout run est
mémorisé, y compris les mauvais.

### 2.3 Flux de mémoire — Generative Agents (Park et al., 2023)

Park et al. \[2\] introduisent le concept de **memory stream** : un journal chronologique
d'observations annotées avec leur importance, leur récence et leur pertinence contextuelle.
Trois opérations fondamentales sont définies :

1. **Stockage** (*storage*) — ajout d'observations au flux
2. **Récupération** (*retrieval*) — recherche par pertinence combinant score d'importance,
   récence, et similarité avec la requête courante
3. **Réflexion** (*reflection*) — synthèse de haut niveau à partir des observations brutes

AgenticBlog implémente une version simplifiée de ce modèle :
- Stockage : `update_memory()` dans `memory_manager.py` (appelé par `output_saver`)
- Récupération : `load_memory_index()` + `build_writer_context()` (chevauchement de mots-clés)
- Réflexion : non implémentée en Phase 1, prévue en Phase 3 (résumés périodiques par LLM)

Le score de récupération de Park et al. est défini comme :

```
score(memory, query) = α × recency(memory)
                     + β × importance(memory)
                     + γ × relevance(memory, query)
```

Notre heuristique de récupération utilise exclusivement `relevance` (chevauchement
Jaccard sur les mots-clés) et `recency` (fenêtre de 14 jours). `importance` est
approximé par le score de critique (`score` dans MEMORY.md), mais n'est pas encore
pondéré dans le ranking — c'est une amélioration directe identifiée pour la Phase 2.

### 2.4 Mémoire textuelle et long terme — Voyager (Wang et al., 2023)

Voyager \[4\] est un agent Minecraft qui accumule une **skill library** textuelle : chaque
compétence apprise est stockée sous forme de code JavaScript commenté, récupérable par
similarité vectorielle lors de nouvelles tâches. L'aspect clé est que la mémoire est
**directement exécutable** (le code stocké peut être relu et relancé).

Bien que notre domaine soit différent, le principe est identique : les articles Markdown
stockés dans `memory/topics/*.md` sont **directement lisibles par le LLM** sans couche
d'embedding ou de vectorisation. C'est ce que le mouvement Markdown-First Memory
désigne comme "human-readable, LLM-native storage" — la même représentation sert
à la fois aux humains pour auditer et au modèle pour raisonner \[7\].

### 2.5 Réflexion verbale — Reflexion (Shinn et al., 2023)

Reflexion \[5\] montre qu'un LLM peut améliorer ses performances en maintenant un
**registre verbal de ses propres erreurs** — une mémoire de ce qui n'a pas fonctionné.
L'agent consulte ce registre avant chaque nouvelle tentative.

Dans AgenticBlog, le score de critique (`score` dans `run_metadata.json` et MEMORY.md)
joue ce rôle, mais de façon passive : il est mémorisé mais pas encore utilisé pour
ajuster le comportement du writer. Une implémentation future pourrait injecter dans le
prompt writer : *"Les articles notés < 7 traitaient souvent de X de façon trop superficielle."*

### 2.6 Le pattern Markdown-First Memory (2025)

Le pattern Markdown-First Memory a été observé et formalisé de façon indépendante dans
plusieurs systèmes agents récents \[7, 8\] :

- **Claude Code** (Anthropic, 2025) utilise des fichiers Markdown pour la mémoire
  persistante de l'agent de codage, organisés par type (user, feedback, project, reference).
- **Manus AI** (2025) documente son système de mémoire basé sur des fichiers texte
  structurés, sans base vectorielle.
- Les recherches sur **A-MEM** (Agentic Memory, 2025) \[7\] et **AgeMem** (2025) \[8\]
  valident empiriquement que pour des agents à mémoire longue durée, les fichiers texte
  indexés manuellement (*manual indexing*) surpassent les approches vectorielles denses
  en termes de précision de récupération pour des requêtes thématiques — à condition que
  le schéma de structuration soit suffisamment riche (dates, catégories, mots-clés).

La justification principale est que les LLM sont nativement entraînés sur du texte structuré
(Markdown, JSON, YAML). La proximité de représentation entre la mémoire stockée et le format
d'entraînement réduit le coût de "traduction" lors de la récupération, comparé à une
décompression depuis un espace vectoriel \[1, 7\].

---

## 3. Architecture : Markdown-First Memory

### 3.1 Choix de conception — pourquoi pas de vector DB ?

| Critère | Vector DB (ex: Chroma, Qdrant) | Markdown-First |
|---------|-------------------------------|---------------|
| Infrastructure | Serveur à déployer | Aucune |
| Lisibilité | Opaque (vecteurs) | Directe (texte) |
| Débogage | Difficile | `cat memory/MEMORY.md` |
| Précision sur requêtes thématiques | Bonne sur sémantique | Bonne sur catégories/topics curatés |
| Coût d'embedding | API calls | Zéro |
| Portabilité | Dépend du provider | Simple copie de fichiers |
| Limite de scale | ~50 articles sans index | ~200 articles avant que BM25 apporte un gain de qualité notable |

Pour AgenticBlog en Phase 1 (< 50 articles), le choix Markdown-First est justifié.
À partir de 50 articles, l'ajout de `rank_bm25` (Phase 2) permet de maintenir cette
architecture tout en gagnant en précision de récupération \[9\].

### 3.2 Structure des fichiers

```
memory/
├── MEMORY.md              ← Index des 60 derniers runs
├── topics/                ← Experience Bank (articles produits)
│   ├── infra.md           ← Détail des articles par catégorie
│   ├── security.md
│   ├── ai.md
│   ├── cloud.md
│   └── africa.md
├── lessons/               ← Meta-Guideline Bank (leçons éditoriales)
│   ├── infra.md
│   ├── ai.md
│   └── ...
├── archive/               ← Overflow > 60 entrées dans MEMORY.md
│   └── 2026-03-15.md
└── checkpoints.sqlite     ← Existant, géré par LangGraph
```

### 3.3 Format MEMORY.md

```markdown
# AgenticBlog — Mémoire Éditoriale

## Runs récents

| Date       | Titre                          | Catégorie | Score | Mots-clés                     |
|------------|--------------------------------|-----------|-------|-------------------------------|
| 2026-03-10 | Kubernetes Gateway API         | infra     | 8.2   | kubernetes,gateway,networking |
| 2026-03-07 | OpenAI o3 reasoning benchmarks | ai        | 7.9   | openai,llm,benchmark,o3       |

## Sujets récemment couverts (éviter dans les 14 prochains jours)
- infra: 2 article(s) (dernier: 2026-03-10)
- ai: 1 article(s) (dernier: 2026-03-07)
```

Le tableau est trié du plus récent au plus ancien (prepend à chaque run). La section
"Sujets récemment couverts" est recalculée automatiquement après chaque run.

### 3.4 Format memory/topics/{category}.md

```markdown
# Infra — Articles couverts

## 2026-03-10 — Kubernetes Gateway API
- Angle: migration Ingress → Gateway API v1.0
- Score: 8.2 | Itérations critique: 2
- Mots-clés: gateway,kubernetes,networking
- Lien: output/2026-03-10/abcd1234/blog_post.md
```

Ce fichier est la source de référence pour le contexte injecté dans le writer.
Il est conçu pour être directement lisible par un LLM sans transformation.

---

## 4. Implémentation détaillée

### 4.1 `memory_manager.py` — module central

Le module expose 4 fonctions publiques et n'a aucune dépendance externe :

#### `load_memory_index() → list[dict]`

Parse `memory/MEMORY.md` ligne par ligne. Extrait les lignes du tableau Markdown via un
pattern `|`-délimité. Retourne une liste de dicts `{date, title, category, keywords, score}`.

Initialise automatiquement la structure mémoire au premier appel (création des répertoires
et de `MEMORY.md` vide) — le pipeline n'a pas à gérer les cas "mémoire absente".

#### `get_novelty_penalty(article, recent_runs) → float`

Calcule la pénalité de nouveauté d'un article en fonction de son chevauchement thématique
avec les runs des 14 derniers jours. L'algorithme est inspiré du critère **MMR (Maximal
Marginal Relevance)** de Carbonell & Goldstein (1998) \[6\], qui formule explicitement
le trade-off pertinence/diversité dans les systèmes de récupération d'information :

```
MMR = λ × Sim(di, query) - (1-λ) × max_j∈S Sim(di, dj)
```

Notre pénalité est une approximation discrète de ce critère :

```python
def get_novelty_penalty(article, recent_runs) -> float:
    # Source primaire : topics de la catégorie présents dans le contenu de l'article
    article_kw = set(_keywords_from_category(category, title, summary))

    for run in recent_runs:  # filtrés sur 14 jours
        run_kw = set(run["keywords"])   # déjà extraits au moment du stockage
        overlap = |article_kw ∩ run_kw| / |article_kw ∪ run_kw|   # similarité de Jaccard

        if overlap > 0.60 → penalty = 2.0  # même sujet exact
        if overlap > 0.30 → penalty = 1.5  # thème proche
```

La similarité de Jaccard est choisie pour sa robustesse avec des ensembles de petite taille
(4–8 mots-clés), contrairement à la similarité cosinus qui requiert des vecteurs normalisés
de dimension fixe \[9\]. Les keywords stockés dans MEMORY.md sont réutilisés directement
(`set(run["keywords"])`) — aucune ré-extraction au moment de la comparaison.

#### `build_writer_context(selected, recent_runs) → str`

Sélectionne les runs les plus pertinents (même catégorie OU chevauchement > 15%) et
construit un bloc Markdown injecté dans le prompt writer via `{memory_context}` :

```markdown
### Articles passés sur ce sujet

- **2026-03-10** — Kubernetes Gateway API _(catégorie: infra, score: 8.2)_
- **2026-02-28** — Cilium eBPF deep-dive _(catégorie: infra, score: 7.5)_
```

Maximum 3 entrées (les plus pertinentes par chevauchement Jaccard), pour éviter de
surcharger le contexte du writer.

#### `update_memory(state) → None`

Exécution en fin de pipeline, dans `output_saver`. Trois opérations :

1. **Prepend** d'une ligne dans le tableau `MEMORY.md`
2. **Archivage** si > 60 entrées (FIFO vers `memory/archive/YYYY-MM-DD.md`)
3. **Upsert** dans `memory/topics/{category}.md`

Non-bloquant : une exception dans `update_memory` est capturée et loguée, sans faire
échouer le pipeline.

### 4.2 Meta-Guideline Bank (Strategy-based Experiential Memory)

Inspirée du pattern **dual-bank** de Live-Evo \[11\] et de la **Trajectory-Informed Memory** d'IBM Research \[13\],
cette couche mémorise non pas *ce qui s'est passé* (Experience Bank = `topics/`) mais
*pourquoi une rédaction a échoué* (Meta-Guideline Bank = `lessons/`).

**Déclencheur :** tout run avec `iteration_count >= 2` (au moins un rejet du critic).

**Format `memory/lessons/{category}.md` :**

```markdown
# Ai — Leçons apprises

## 2026-03-15 | itérations: 3 | score: 7.2 | poids: 1.00
- Article: GGML and llama.cpp join HF...
- Critique: ton trop formel dans l'introduction; manque d'exemples CLI concrets

## 2026-03-10 | itérations: 2 | score: 7.8 | poids: 0.85
- Article: OpenAI o3 benchmarks...
- Critique: structure trop linéaire, accroche trop neutre
```

**Decay usage-based (pas time-based) :** à chaque run sur la même catégorie, tous les poids
sont multipliés par `LESSON_DECAY_FACTOR = 0.85`. Après ~17 runs sur la même catégorie,
une leçon descend sous `LESSON_PURGE_THRESHOLD = 0.1` et est purgée automatiquement.
Ce choix reflète la recommandation de MemRL \[12\] : pondérer les mémoires par utilité
observée, pas par ancienneté calendaire.

**Injection dans le writer :** `load_lessons(category)` retourne les 5 leçons les plus
pondérées, formatées en bloc Markdown et ajoutées à la suite du contexte mémoire existant :

```markdown
### Leçons critiques — à appliquer obligatoirement
- [haute priorité] ton trop formel dans l'introduction; manque d'exemples CLI concrets
- [priorité normale] structure trop linéaire, accroche trop neutre
```

Seuil haute priorité : poids > 0.6 (leçon récente, < 3 runs depuis la mémorisation).

**Pas de nouveau placeholder dans `prompts/writer.md` :** les leçons sont ajoutées comme
section supplémentaire dans le string retourné par `build_writer_context()`, via le
placeholder existant `{memory_context}`. Zéro rupture d'interface.

### 4.3 Intégration dans `selector_node`

```
score_composite = score_llm + freshness_bonus - novelty_penalty
                  [0–10]       [0–1]              [0–2]
```

Le score composite résultant reste dans une plage effective de -1 à 11. La pénalité
maximale de 2.0 ne peut donc pas exclure un article à score LLM très élevé — elle le
pénalise, mais ne l'élimine pas. C'est un choix délibéré : si le seul article pertinent
du jour est sur un sujet récemment couvert, il vaut mieux le couvrir à nouveau que de
choisir un article hors-sujet.

Log émis :

```
[SELECTOR]   Selected: "Cilium 1.15 : eBPF sans kube-proxy"
             Score: 8.5/10 + freshness: 0.72 - novelty penalty: 0.0
             Memory: 7 runs chargés
```

### 4.4 Intégration dans `writer_node`

Le prompt `writer.md` reçoit maintenant trois variables :

| Variable | Source | Valeur si absente |
|----------|--------|-------------------|
| `{article}` | `state["selected_article"]` | — |
| `{feedback}` | `state["critic_feedback"]` | "Aucun feedback — premier brouillon." |
| `{memory_context}` | `state["memory_context"]` | "Aucun article passé sur ce sujet." |

L'instruction dans le prompt est volontairement non-contraignante :
> *"Si un article passé est pertinent, tu peux créer de la continuité éditoriale.
> Ne force pas la référence si elle n'apporte rien."*

Ce choix suit la recommandation de Park et al. \[2\] : les agents qui forcent mécaniquement
l'utilisation de leur mémoire produisent des références artificielles qui dégradent
la qualité perçue du contenu.

---

## 5. Décisions de conception et trade-offs

### Pourquoi du prepend plutôt que de l'append dans MEMORY.md ?

Le prepend place les entrées les plus récentes en tête du tableau. Si un LLM doit lire
MEMORY.md directement (cas futur), il lira les données les plus récentes en premier,
ce qui est optimal étant donné que la fenêtre de contexte a une longueur limitée et
que les entrées récentes sont plus pertinentes que les anciennes.

### Pourquoi une limite à 60 entrées dans MEMORY.md ?

Le fichier MEMORY.md est conçu pour être chargé entièrement en mémoire de travail
(`load_memory_index` lit tout le fichier). À 60 entrées × ~100 octets par ligne,
cela représente ~6 Ko — négligeable. Au-delà, le ratio signal/bruit décroît : des
articles vieux de plusieurs mois sont peu pertinents pour la pénalité de nouveauté
(fenêtre 14 jours) et créent du bruit dans le contexte writer.

### Pourquoi la fenêtre de nouveauté est de 14 jours ?

14 jours est un compromis entre :
- **Trop court (< 7 jours)** : ne protège pas suffisamment contre la répétition si
  le pipeline est lancé quotidiennement
- **Trop long (> 30 jours)** : le pipeline se censure sur des sujets qui ont évolué
  (une nouvelle version Kubernetes peut justifier un second article après 3 semaines)

Ce paramètre est hardcodé dans `memory_manager.py` (`NOVELTY_WINDOW_DAYS = 14`) mais
peut être externalisé en variable d'environnement si nécessaire.

### Pourquoi les topics de la catégorie comme source primaire de mots-clés ?

L'extraction naïve par regex sur le blog post génère du bruit : le texte rédigé est en
français, et des mots comme "mort" (de "Cloud-first est mort"), "clic" (de "single-click")
ou "rend" (de "qui rend l'inférence possible") passent n'importe quel filtre de stopwords
raisonnable. Ce bug a été observé dès le premier run réel.

La solution est d'utiliser `config.CATEGORIES[category]["topics"]` comme vocabulaire
contrôlé : les topics sont déjà curatés, techniques, en anglais, et directement
comparables d'un run à l'autre. L'algorithme `_keywords_from_category` cherche simplement
si chaque topic apparaît dans le contenu de l'article source (titre EN + contenu fetché),
puis complète avec des mots longs du titre en fallback si moins de 4 topics sont trouvés.

Trois avantages par rapport au regex bag-of-words :
1. **Vocabulaire contrôlé** : uniquement des termes techniques pertinents pour la catégorie.
2. **Langue cohérente** : les topics sont en anglais, comme le titre de l'article source RSS — pas de pollution par la prose française du blog post.
3. **Comparabilité** : deux articles sur `llama.cpp` auront `llama.cpp` dans leurs keywords quelles que soient les formulations du writer.

La nuance sémantique fine (distinguer deux articles llama.cpp avec des angles différents —
benchmarks vs. intégration HuggingFace) reste un angle mort en Phase 1 et sera adressée
via BM25 \[9\] en Phase 2.

---

## 6. Flux de données complet

```
[MEMORY.md] ─── load_memory_index() ──→ recent_runs[]
                                              │
                                              ▼
[filtered_articles[]] ──→ get_novelty_penalty(article, recent_runs)
                                              │
                                              ▼
                              score_composite = score + freshness - penalty
                                              │
                                              ▼
                         ranked[0] = selected_article ──→ state["selected_article"]
                                              │
                                              ▼
                         build_writer_context(selected, recent_runs)
                            │                                │
                            ▼                               ▼
                 articles passés pertinents        load_lessons(category)
                            │                               │
                            └──────────────┬────────────────┘
                                           ▼
                                  state["memory_context"]
                                           │
                               ┌───────────┘
                               ▼
[prompts/writer.md] + {memory_context} ──→ LLM → draft
                                                      │
                                      (boucle writer ↔ critic)
                                                      │
                                                      ▼
                                            blog_post.md
                                                      │
                                                      ▼
                                         update_memory(state)
                                              │
                               ┌─────────────┼──────────────┐
                               ▼             ▼               ▼
                          MEMORY.md    topics/{cat}.md   lessons/{cat}.md
                       (prepend+arch)  (append entry)   (prepend si ≥2 iter)
```

---

## 7. Roadmap

### Phase 2 — BM25 sur fichiers Markdown (~50 articles)

À partir de 50 articles, la similarité de Jaccard sur 6 mots-clés montre ses limites :
des articles sur des sujets distincts peuvent partager beaucoup de mots génériques.

L'ajout de `rank_bm25` \[9\] permettrait de remplacer la comparaison Jaccard par un
scoring TF-IDF sur le corpus des articles mémorisés. **Aucun changement d'architecture** —
la source des mots-clés (`_keywords_from_category`) reste inchangée, seule la fonction
de comparaison dans `get_novelty_penalty` et `build_writer_context` évolue.

```python
# Phase 2 : remplacement de la comparaison Jaccard par BM25
from rank_bm25 import BM25Okapi

# corpus = keywords de chaque run mémorisé
corpus = [run["keywords"] for run in recent_runs]
bm25 = BM25Okapi(corpus)
# article_kw = _keywords_from_category(category, title, content)
scores = bm25.get_scores(article_kw)
# → scores[i] remplace le calcul Jaccard pour le run i
```

### Phase 3 — Graphe de connaissances temporel (Graphiti)

Pour une mémoire de plus de 200 articles, `graphiti-core` (Zep AI, 2025) \[10\] offre
un graphe de connaissances temporel construit automatiquement à partir de texte libre.
Il maintient des *bi-temporal edges* : chaque relation entre entités est horodatée
(validité de la connaissance dans le temps réel ET dans le temps de la narration).

```
[Kubernetes] ──[couvre]──> [Gateway API] ──[date: 2026-03-10]──> [Article #7]
[Gateway API] ──[remplace]──> [Ingress] ──[depuis: K8s 1.28]
```

Cette représentation permettrait au writer de raisonner sur des trajectoires technologiques
("Ingress est déprécié depuis que Gateway API a été GA") au lieu d'une simple liste d'articles.

---

## 8. Vérification

```bash
# 1. Premier run — créer la mémoire
python main.py --category infra
# → Vérifier memory/MEMORY.md (créé automatiquement)
# → Vérifier memory/topics/infra.md (créé automatiquement)

# 2. Deuxième run — pénalité novelty
python main.py --category infra
# → Logs attendus :
# [SELECTOR]   Memory: 1 runs chargés
# [SELECTOR]   Score: 8.5/10 + freshness: 0.72 - novelty penalty: 1.5
# (si sujet proche du run précédent)

# 3. Vérifier la continuité dans le blog post
grep -i "dans mon article\|j'avais expliqué\|précédent" output/*/*/blog_post.md
```

---

## Références

\[1\] Sumers, T. R., Yao, S., Narasimhan, K., & Griffiths, T. L. (2023). **Cognitive
Architectures for Language Agents**. *arXiv:2309.02427*.
<https://arxiv.org/abs/2309.02427>

\[2\] Park, J. S., O'Brien, J. C., Cai, C. J., Morris, M. R., Liang, P., & Bernstein, M. S.
(2023). **Generative Agents: Interactive Simulacra of Human Behavior**. *ACM UIST 2023*.
*arXiv:2304.03442*. <https://arxiv.org/abs/2304.03442>

\[3\] Packer, C., Fang, V., Patil, S. G., Moon, K., Zhao, W., & Gonzalez, J. E. (2023).
**MemGPT: Towards LLMs as Operating Systems**. *arXiv:2310.08560*.
<https://arxiv.org/abs/2310.08560>

\[4\] Wang, G., Xie, Y., Jiang, Y., Mandlekar, A., Xiao, C., Zhu, Y., Fan, L., & Anandkumar, A.
(2023). **Voyager: An Open-Ended Embodied Agent with Large Language Models**. *arXiv:2305.16291*.
<https://arxiv.org/abs/2305.16291>

\[5\] Shinn, N., Cassano, F., Labash, B., Gopinath, A., Narasimhan, K., & Yao, S. (2023).
**Reflexion: Language Agents with Verbal Reinforcement Learning**. *NeurIPS 2023*.
*arXiv:2303.11366*. <https://arxiv.org/abs/2303.11366>

\[6\] Carbonell, J., & Goldstein, J. (1998). **The Use of MMR, Diversity-Based Reranking
for Reordering Documents and Producing Summaries**. *ACM SIGIR 1998*, 335–336.
<https://doi.org/10.1145/290941.291025>

\[7\] Weng, L. et al. (2025). **A-MEM: Agentic Memory System for LLM Agents**.
Référencé dans les discussions sur les patterns de mémoire agents (2025).

\[8\] Anthropic (2025). **Claude Code Memory System** — documentation interne du système
de mémoire Markdown-First utilisé par Claude Code, observable dans le comportement de
l'agent. Cf. fichiers `~/.claude/projects/*/memory/MEMORY.md`.

\[9\] Robertson, S., & Zaragoza, H. (2009). **The Probabilistic Relevance Framework:
BM25 and Beyond**. *Foundations and Trends in Information Retrieval*, 3(4), 333–389.
Implémentation Python : `rank_bm25` (Doricha, PyPI).
<https://doi.org/10.1561/1500000019>

\[10\] Zep AI (2025). **Graphiti: Temporally-Aware Knowledge Graph for AI Agents**.
`graphiti-core` — <https://github.com/getzep/graphiti>

\[11\] Liu, Z. et al. (2026). **Live-Evo: Evolving LLM Agents via Dual-Bank Experience
Replay**. *arXiv:2602.02369*. Introduit le pattern dual-bank : Experience Bank (ce qui
s'est passé) + Meta-Guideline Bank (comment utiliser cette expérience), avec pondération
par utilité des guidelines.

\[12\] Chen, Y. et al. (2026). **MemRL: Memory-Augmented Reinforcement Learning for
Long-Horizon Agent Tasks**. *arXiv:2601.03192*. Two-Phase Retrieval : filtrer par
pertinence, puis sélectionner par Q-value (utilité apprise du feedback). Justifie le
decay usage-based plutôt que time-based.

\[13\] IBM Research (2026). **Trajectory-Informed Memory for LLM Agents**. *arXiv:2603.10600*.
Extraction automatique de learnings actionnables depuis des trajectoires d'exécution.
Trois types de guidance : strategy tips (succès), recovery tips (échecs), optimization tips.
Inspire directement la fonction `store_lesson` d'AgenticBlog.

\[14\] Zhao, S. et al. (2025). **Memory in the Age of AI Agents: A Survey**. *arXiv:2512.13564*.
Survey de 47 auteurs identifiant la Strategy-based Experiential Memory comme composant
manquant dans la majorité des pipelines agents — stocker des règles abstraites issues des
échecs, pas seulement les événements bruts.
