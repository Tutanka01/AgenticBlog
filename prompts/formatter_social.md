You receive a validated technical article written by Mohamad El Akhal (makhal.fr).
You must produce 4 elements from this content.

## Output language

**CRITICAL: All generated content (title, description, LinkedIn post, YouTube script)
must be written entirely in {output_language}.**

The style examples and voice samples below are in French — they define Mohamad's voice
and tone. Reproduce this tone, this directness, this rawness — but in {output_language}.
Do not output a single word in any other language.

## Source article
{draft}

---

## FORMAT 1 — Blog title

Rules:
- Never the raw RSS title
- Direct and punchy — conveys the real stake, not the generic topic
- No "How to...", no "Guide to...", no "Introduction to..."
- **Maximum 60 characters** (Google truncates at ~60 — every character counts)
- Front-load the primary keyword — what appears first gets the most weight
- Voice examples (French — reproduce the directness in {output_language}):
  "CRIU : et si tuer vos conteneurs était optionnel ?"
  "S3 : AWS vient de changer les règles du naming"

---

## FORMAT 2 — SEO description (short hook)

Rules:
- 1 to 2 sentences maximum, 120–155 characters
- Start with a concrete fact, a number, or a direct question
- Summarizes the article's stake, not its content — what the reader will understand that they didn't know before
- Avoid generic openers like "In this article..." or "Discover..."

---

## FORMAT 3 — LinkedIn post

Write an ultra-engaging, raw, and direct LinkedIn post in Mohamad's style, **in {output_language}**.
The goal is to trigger comments from other engineers who live the same struggle.

ABSOLUTE RULES:
1. **Length and Format:** Short but narrative (approximately 300 to 500 characters). VERY airy (blank line between each idea).
2. **The Hook:** Hit hard from the first line. Use a sharp opinion, a daily pain point, or a paradox. NEVER a weak rhetorical question.
3. **The Body (the pain):** Write from the field. Use first-person voice ("I" / "we as engineers"). Use raw, unfiltered language — the kind a senior engineer would use with a colleague, not a marketing deck. The reader must nod and say "so true".
4. **The Call-to-Action:** End by mentioning that you broke it down on your blog.
5. **Anti-Corporate:** Zero cliché emojis (🚀, 🔥, 👇, 🎉). Zero corporate openers. Zero "Discover how".
6. **Hashtags:** Exactly 3 targeted hashtags at the very end.

VOICE EXAMPLES (in French — reproduce this tone in {output_language}):
- "On s'est fait lobotomiser par les providers Cloud sur le Zero Trust."
- "J'ai drainé 3 nodes en prod ce matin à cause de 9 CVEs AppArmor. C'est l'enfer, mais voici ce que j'ai appris."
- "Si votre pipeline CI/CD met plus de 10 minutes à tourner, vous ne faites pas du DevOps, vous faites de la file d'attente."

FORBIDDEN PATTERNS (language-agnostic — avoid regardless of output language):
- Summarizing what the article is about instead of expressing a strong opinion
- Starting with a generic topic announcement
- Using filler phrases ("the solution?", "it is crucial to...")
- Proposing vague optimization ("optimize your workflows")

---

## FORMAT 4 — YouTube Shorts script (60–90 seconds)

Write the script **in {output_language}**.

Mandatory structure with timecodes:
- [0s] Hook: shocking sentence or provocative question — must grab attention in 1 second
- [5s] Problem: what concrete problem does the audience immediately recognize?
- [15s] Solution: quick explanation with 1–2 verbalized examples or commands
- [50s] CTA: clear call to action

---

---

## FORMAT 5 — SEO Metadata (English only, regardless of article language)

Generate structured SEO metadata for this article.
**Always output this section in English**, even if the article is in French or Arabic.

Rules:
- **primary_keyword**: the single most important keyword phrase (2–4 words) a reader would Google
  to find this article. Must be specific, not generic ("kubernetes pod checkpointing" not "kubernetes")
- **keywords**: 5 to 8 targeted search terms, mix of exact and semantic variants,
  ordered by relevance. Include the primary_keyword as the first item.
- **slug**: URL-friendly version of the title — lowercase, hyphens only, max 60 characters,
  must contain the primary keyword. Example: "kubernetes-pod-checkpointing-criu"
- **schema_type**: one of "TechArticle", "HowTo", "NewsArticle" — pick the closest match:
  - TechArticle → deep technical explanation or concept analysis
  - HowTo → step-by-step commands or configuration
  - NewsArticle → announcement of a new feature, CVE, or release
- **search_intent**: one of "informational", "navigational", "how-to" — what the reader wants
- **internal_links**: 2–3 topic suggestions for internal links this article should link to.
  These must be specific sub-topics closely related to the article, not generic suggestions.
  Use the exact phrases an author would use as anchor text in a sentence.
  Example: `kubernetes network policies, eBPF observability, cilium vs calico`
  These will be shown to the editor as linking suggestions — do NOT invent article URLs.

---

## Rendering instruction

Reply ONLY with these markers (no other text):

===TITLE===
[blog title]

===DESCRIPTION===
[SEO description with hook]

===LINKEDIN===
[LinkedIn text]

===YOUTUBE===
[YouTube script with timecodes]

===SEO_META===
primary_keyword: [2-4 word exact match keyword phrase, in English]
keywords: [kw1, kw2, kw3, kw4, kw5, kw6]
slug: [url-slug-here]
schema_type: [TechArticle|HowTo|NewsArticle]
search_intent: [informational|how-to|navigational]
internal_links: [anchor text 1, anchor text 2, anchor text 3]
