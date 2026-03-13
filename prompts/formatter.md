Tu reçois un article technique validé. Tu dois produire 3 formats distincts à partir de ce contenu.

## Article source
{draft}

## Métadonnées
- Date : {date}
- Tags suggérés : {tags}

---

## FORMAT 1 — Article Blog Markdown

Génère un article Markdown complet avec :
- Un front matter YAML en début de fichier :
```yaml
---
title: "Titre de l'article"
date: {date}
tags: [tag1, tag2, tag3]
description: "Une phrase de description pour le SEO (max 160 caractères)"
author: "Mohamad"
---
```
- Puis le corps complet de l'article en Markdown, avec titres `##`, blocs de code avec langage spécifié (```yaml, ```bash, etc.), et mise en forme soignée.

---

## FORMAT 2 — Post LinkedIn

Règles absolues :
- Maximum 280 caractères (espaces compris)
- Première ligne = accroche forte qui donne envie de lire (pas de "Je partage...", "Bonjour LinkedIn...")
- Exactement 3 hashtags pertinents à la fin
- Pas de liens, pas de balises Markdown

Exemple de format attendu :
```
Kubernetes 1.32 vient de faire passer la Gateway API en GA. Fini les Ingress bricolés. Voici ce que ça change concrètement pour vos clusters.

#Kubernetes #DevOps #CloudNative
```

---

## FORMAT 3 — Script YouTube Shorts (60–90 secondes)

Structure obligatoire :
1. **Hook (0–3s)** : une phrase choc, une question provocante, ou un fait surprenant — doit accrocher en 1 seconde
2. **Problème (3–15s)** : quel problème concret l'audience reconnaît immédiatement ?
3. **Solution (15–50s)** : explication rapide avec 1 ou 2 exemples visuels ou commandes verbalisées
4. **CTA (50–60s)** : appel à l'action clair ("Abonne-toi", "Commente si tu utilises X", "Lien en bio")

Format de rendu : indique les timecodes entre crochets, le texte dit à voix haute ensuite.

Exemple :
```
[0s] Tu perds du temps avec les Ingress Kubernetes ? Il existe mieux.
[5s] Les Ingress, c'est bien... mais c'est 2019. En prod, on galère avec les annotations propriétaires.
[15s] Kubernetes 1.32 sort la Gateway API en GA. C'est l'API standard pour router le trafic. Voici comment migrer en 3 commandes.
[50s] Si t'es sur Kubernetes, abonne-toi — je poste toutes les semaines sur ce genre de changements.
```

---

## Instruction de rendu
Réponds avec les 3 formats séparés par des marqueurs exactement comme suit :

===BLOG===
[contenu Markdown complet]

===LINKEDIN===
[texte LinkedIn]

===YOUTUBE===
[script YouTube]
