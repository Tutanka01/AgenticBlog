You receive a validated technical article. You must produce 3 distinct formats from this content.

## Source article
{draft}

## Metadata
- Date: {date}
- Suggested tags: {tags}

## Output language
Write all content in {output_language}.

Note on tags: The `{tags}` placeholder contains pre-computed English keywords derived from the
category topic list. Include them as-is in the YAML front matter — do not translate them.
This ensures the editorial memory index (MEMORY.md) remains language-agnostic.

---

## FORMAT 1 — Blog Markdown article

Generate a complete Markdown article with:
- A YAML front matter at the beginning of the file:
```yaml
---
title: "Article title"
date: {date}
tags: [tag1, tag2, tag3]
description: "A one-sentence SEO description (max 160 characters)"
author: "Mohamad"
---
```
- Then the complete article body in Markdown, with `##` headings, code blocks with language specified (```yaml, ```bash, etc.), and clean formatting.

---

## FORMAT 2 — LinkedIn post

Absolute rules:
- Maximum 280 characters (spaces included)
- NEVER start with the tech name, an article title, or a generic statement
- Start with ONE DIRECT QUESTION or ONE SPECIFIC FACT that personally challenges the engineer
- Tone: direct, field-level, not "corporate". Talk like an engineer to peers, not like a press release.
- Exactly 3 relevant hashtags at the end
- No links, no Markdown tags

Forbidden formulas (never use):
- "X ne suffit plus."
- "La solution ?"
- "Découvrez pourquoi..."
- "Dans cet article..."
- Any formula that starts with the tech name

Examples of GOOD hooks:
```
Combien de tes nodes peuvent être rootés en moins de 5 minutes ? Nouvelle série de CVEs dans le noyau Linux, et le patch demande un redémarrage.

#Linux #Cybersecurity #DevOps
```
```
J'ai drainé 3 nodes en prod ce matin à cause de 9 CVEs AppArmor. Voici la checklist que j'aurais voulu avoir.

#Kubernetes #DevOps #CloudNative
```

---

## FORMAT 3 — YouTube Shorts script (60–90 seconds)

Mandatory structure:
1. **Hook (0–3s)**: a shocking sentence, a provocative question, or a surprising fact — must grab attention in 1 second
2. **Problem (3–15s)**: what concrete problem does the audience immediately recognize?
3. **Solution (15–50s)**: quick explanation with 1 or 2 visual examples or verbalized commands
4. **CTA (50–60s)**: clear call to action ("Abonne-toi", "Commente si tu utilises X", "Lien en bio")

Rendering format: indicate timecodes in brackets, then the text spoken aloud.

Example:
```
[0s] Tu perds du temps avec les Ingress Kubernetes ? Il existe mieux.
[5s] Les Ingress, c'est bien... mais c'est 2019. En prod, on galère avec les annotations propriétaires.
[15s] Kubernetes 1.32 sort la Gateway API en GA. C'est l'API standard pour router le trafic. Voici comment migrer en 3 commandes.
[50s] Si t'es sur Kubernetes, abonne-toi — je poste toutes les semaines sur ce genre de changements.
```

---

## Rendering instruction
Reply with the 3 formats separated by markers exactly as follows:

===BLOG===
[complete Markdown content]

===LINKEDIN===
[LinkedIn text]

===YOUTUBE===
[YouTube script]
