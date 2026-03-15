# Agents — contracts and behaviors

Each agent is a pure function `(state: PipelineState) -> dict`. It receives the full state, returns only the keys it modifies, and always appends an `ACPMessage` to `messages`.

---

## scraper

**File:** `agents/scraper.py`
**Reads:** `state["active_category"]`, `config.CATEGORIES`, `config.MAX_ARTICLES_TO_FETCH`
**Writes:** `raw_articles`, `messages`

Parses each RSS feed with `feedparser`. The feeds used depend on the active category (`CATEGORIES[active_category]["feeds"]`). On feed error, it logs and continues (other feeds are not blocked). Returns a list of dicts:

```
{title, url, summary, source, published, fetched_at}
```

`published` is the publication date from the RSS feed (empty if absent). Used by `selector` to compute the freshness bonus.

---

## filter

**File:** `agents/filter.py`
**Reads:** `raw_articles`, `state["active_category"]`, `config.CATEGORIES`, `prompts/filter.md`
**Writes:** `filtered_articles`, `total_tokens_used`, `messages`

Sends all articles to the LLM in a single request using the `filter.md` prompt. Topics used are those of the active category (`CATEGORIES[active_category]["topics"]`), not the global `INTEREST_TOPICS` list. The LLM returns a JSON array `[{url, score, reason}]`. Articles with `score >= FILTER_THRESHOLD` are kept, sorted by descending score, capped at `TOP_N_FILTERED`.

**Fallback:** if the LLM fails or returns invalid JSON, all articles receive a score of 5 (they pass the filter, but none is ranked above the others).

---

## selector

**File:** `agents/selector.py`
**Reads:** `filtered_articles`, `raw_articles`, `memory/MEMORY.md` (via `memory_manager`)
**Writes:** `selected_article`, `memory_context`, `messages`

Selects the article with the highest **composite score**:

```
composite_score = llm_score (0–10) + freshness_bonus (0–1) - novelty_penalty (0–2)
```

The freshness bonus decays linearly from 1.0 (article published now) to 0.0 (article 7+ days old). It is computed from the RSS feed `published` field, falling back to `fetched_at`.

The **novelty penalty** compares keywords of each candidate article with articles published in the last 14 days (via `memory_manager.get_novelty_penalty`). It returns 1.5 if Jaccard overlap exceeds 30%, and 2.0 if the topic is identical at > 60%. This promotes editorial diversity without eliminating any article — even penalized by 2.0, an article with LLM score 9/10 will still rank first.

After selection, builds `memory_context` (via `build_writer_context`): a Markdown list of the 3 thematically closest past articles, injected into the writer prompt.

**Fallback:** if `filtered_articles` is empty, uses `raw_articles[0]`.

See `docs/memory.md` for theoretical foundations.

---

## fetcher

**File:** `agents/fetcher.py`
**Reads:** `selected_article`
**Writes:** `selected_article` (enriched with `full_content` + `fetch_method`), `messages`

Fetches article content via a **3-strategy cascade**, in order:

1. **Direct** — `httpx` with realistic browser headers (Chrome/macOS). If extracted content is fewer than 300 characters after cleanup, considers it blocked.
2. **Jina AI Reader** (`r.jina.ai/{url}`) — free public proxy that bypasses most blocks and soft paywalls. Returns plain text.
3. **RSS summary** — last resort, uses the `summary` already present in the article.

The `fetch_method` field records the strategy used (`"direct"`, `"jina"`, `"rss_fallback"`). HTML extraction removes noise tags (`script`, `style`, `nav`, `footer`, `aside`, `header`, `form`, `iframe`) before extracting `<article>` → `<main>` → `<body>`. Text is truncated at 8000 characters.

**The pipeline is never blocked** — even if the first two strategies fail, the RSS summary is sufficient for the writer to produce an article.

---

## writer

**File:** `agents/writer.py`
**Reads:** `selected_article` (including `full_content`), `critic_feedback`, `iteration_count`, `output_language`, `prompts/writer.md`
**Writes:** `draft`, `iteration_count`, `total_tokens_used`, `messages`

Uses `full_content` over `summary` to feed the prompt — the LLM gets the actual article content, not just the RSS summary.

On the first call (`iteration_count == 0`), writes the full draft. On subsequent calls, applies only the `critic_feedback` corrections without full rewrite.

**Automatic length retry:** if draft v1 is below 800 words, a second LLM call is triggered automatically with an explicit instruction to expand. The longer of the two drafts is kept. This retry only applies at iteration 1 to avoid doubling calls during critic revisions.

Uses `temperature=0.7` (more creative than other agents which use `LLM_TEMPERATURE`).

**Title constraints:** the `writer.md` prompt enforces strict limits on headings — H1 max 60 characters, H2/H3 max 40 characters. Subtitles must name a concept, not summarize an entire paragraph.

---

## critic

**File:** `agents/critic.py`
**Reads:** `draft`, `selected_article` (url + source), `output_language`, `prompts/critic.md`
**Writes:** `critique_approved`, `critic_feedback`, `total_tokens_used`, `messages`

Evaluates the draft on 4 weighted criteria (accuracy, clarity, structure, added value). Returns JSON `{approved, score, issues, specific_corrections}`.

- `approved = true` if `score >= 7`
- `critic_feedback` contains the `specific_corrections` (precise instructions for the writer)
- **Fallback:** if JSON is unparseable, auto-approve to avoid an infinite loop

The conditional edge in `graph.py` loops back to `writer` if `approved == false` and `iteration_count < MAX_CRITIQUE_ITERATIONS`.

**Handling recent features:** the critic receives the source URL and source name of the article (`{source_url}`, `{source_name}`). The `critic.md` prompt forbids rejecting an article solely because it doesn't know the described feature — its knowledge cutoff may cause it to miss recent announcements. The rule: if the source is an official publisher blog (`aws.amazon.com`, `cloud.google.com`, `azure.microsoft.com`, `kubernetes.io`, etc.), the feature's existence is accepted as true. Only verifiable errors (bad syntax, wrong command, logical contradiction) justify a technical accuracy penalty.

**Output language awareness:** the critic receives `{output_language}` and evaluates style and voice quality within the norms of the chosen language. It does not penalize for not being in French.

---

## formatter

**File:** `agents/formatter.py`
**Reads:** `draft`, `selected_article`, `run_date`, `output_language`, `prompts/formatter_social.md`
**Writes:** `blog_post`, `linkedin_post`, `youtube_script`, `total_tokens_used`, `messages`

Generates 3 formats via two distinct paths:

**Title and description — via LLM:**
The LLM generates a punchy title (max 80 chars, never the raw RSS title) and a SEO description with hook (1–2 sentences, 120–155 chars). Fallbacks if the LLM fails: raw RSS title + first non-heading text from the draft (via `_fallback_description` which skips `#` lines).

**Blog post — no LLM:**
The validated draft is not rewritten. `formatter` builds the YAML front matter (`title`, `date`, `tags`, `description`, `author`) with the generated title and description, then prepends it to the draft. This guarantees the blog post retains exactly the 900–1200 words validated by the critic.

**LinkedIn + YouTube — via LLM:**
Same LLM call as for title/description. `prompts/formatter_social.md` requests 4 sections separated by `===TITLE===`, `===DESCRIPTION===`, `===LINKEDIN===`, `===YOUTUBE===` markers. The agent extracts each section with a regex.

**Tags:** extracted from `article["title"]` words intersected with `INTEREST_TOPICS` (max 5). Fallback to the first 3 topics in the global list.

---

## output_saver

**File:** `agents/output_saver.py`
**Reads:** `blog_post`, `linkedin_post`, `youtube_script`, `run_id`, `run_date`, `filtered_articles`, `selected_article`, `iteration_count`, `total_tokens_used`
**Writes:** `messages` + `memory/MEMORY.md` + `memory/topics/{category}.md`

Creates `output/{run_date}/{run_id[:8]}/` and writes the 4 files. Multiple runs on the same day coexist without ever overwriting each other. `run_metadata.json` contains all run metadata for post-run analysis without needing to re-read the Markdown files.

After writing files, calls `memory_manager.update_memory(state)` to update the MEMORY.md index and the corresponding topic file. This operation is **non-blocking**: a memory update error is logged but does not fail the pipeline.

---

## Adding an agent

1. Create `agents/my_agent.py` with signature `def my_agent_node(state: PipelineState) -> dict`
2. Import it in `graph.py` and add it with `builder.add_node("my_agent", my_agent_node)`
3. Wire the edges (`add_edge` or `add_conditional_edges`)
4. Add any required keys to `PipelineState` in `state.py`
