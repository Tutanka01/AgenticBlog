# Agents — contracts and behaviors

Each agent is a pure function `(state: PipelineState) -> dict`. It receives the full state, returns only the keys it modifies, and always appends an `ACPMessage` to `messages`.

---

## scraper

**File:** `agents/scraper.py`
**Reads:** `state["active_category"]`, `config.CATEGORIES`, `config.MAX_ARTICLES_TO_FETCH`, `state["direct_url"]` (optional)
**Writes:** `raw_articles`, `messages`

**Direct URL bypass:** if `state["direct_url"]` is set, the node returns immediately with `raw_articles = []` and logs `"Direct URL mode — skipping RSS scrape"`. No feeds are fetched.

Otherwise, parses each RSS feed with `feedparser`. The feeds used depend on the active category (`CATEGORIES[active_category]["feeds"]`). On feed error, it logs and continues (other feeds are not blocked). Returns a list of dicts:

```
{title, url, summary, source, published, fetched_at}
```

`published` is the publication date from the RSS feed (empty if absent). Used by `selector` to compute the freshness bonus.

---

## filter

**File:** `agents/filter.py`
**Reads:** `raw_articles`, `state["active_category"]`, `config.CATEGORIES`, `prompts/filter.md`, `state["direct_url"]` (optional)
**Writes:** `filtered_articles`, `total_tokens_used`, `messages`

**Direct URL bypass:** if `state["direct_url"]` is set, returns immediately with `filtered_articles = []`. No LLM call is made.

Otherwise, sends all articles to the LLM in a single request using the `filter.md` prompt. Topics used are those of the active category (`CATEGORIES[active_category]["topics"]`), not the global `INTEREST_TOPICS` list. The LLM returns a JSON array `[{url, score, reason}]`. Articles with `score >= FILTER_THRESHOLD` are kept, sorted by descending score, capped at `TOP_N_FILTERED`.

**Fallback:** if the LLM fails or returns invalid JSON, all articles receive a score of 5 (they pass the filter, but none is ranked above the others).

---

## selector

**File:** `agents/selector.py`
**Reads:** `filtered_articles`, `raw_articles`, `memory/MEMORY.md` (via `memory_manager`), `state["direct_url"]` (optional)
**Writes:** `selected_article`, `memory_context`, `messages`

**Direct URL bypass:** if `state["direct_url"]` is set, skips composite scoring and injects directly:
```python
selected_article = {"url": direct_url, "title": direct_url, "summary": "", "source": "direct", "score": 10}
```
`memory_context` is still built from past runs as usual (novelty penalty is not applied).

Otherwise, selects the article with the highest **composite score**:

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
**Reads:** `selected_article` (including `full_content`), `critic_feedback`, `iteration_count`, `stagnation_count`, `debate_transcript`, `output_language`, `prompts/writer.md`
**Writes:** `draft`, `iteration_count`, `total_tokens_used`, `messages`

Uses `full_content` over `summary` to feed the prompt — the LLM gets the actual article content, not just the RSS summary.

On the first call (`iteration_count == 0`), writes the full draft. On subsequent calls, applies only the `critic_feedback` corrections without full rewrite.

**Automatic length retry:** if draft v1 is below 800 words, a second LLM call is triggered automatically with an explicit instruction to expand. The longer of the two drafts is kept. This retry only applies at iteration 1 to avoid doubling calls during critic revisions.

Uses `temperature=0.7` (more creative than other agents which use `LLM_TEMPERATURE`).

**Title constraints:** the `writer.md` prompt enforces strict limits on headings — H1 max 60 characters, H2/H3 max 40 characters. Subtitles must name a concept, not summarize an entire paragraph.

**Stagnation-adaptive strategy:** when `stagnation_count >= 1` (the previous iteration did not improve the score), the writer receives an additional instruction block that changes its revision approach. Instead of attempting to fix technical claims it may not have enough information to correct accurately, it is instructed to:
1. Anchor technical assertions to what the source article explicitly states
2. Add uncertainty caveats (`> ⚠ behavior may vary — consult official docs`) on claims previously flagged as potentially incorrect
3. Focus the revision energy on tone, hook quality, and structure (criteria the LLM can reliably improve without external knowledge)
4. Not invent commands or examples absent from the source article

This is grounded in the finding that LLMs cannot reliably self-correct on factual claims without external verified information (Huang et al., NeurIPS 2023) — the adaptive strategy stops the writer from hallucinating "corrections" that may introduce new errors.

---

## critic — multi-persona debate (`multi_critic_node`)

**File:** `agents/multi_critic.py`
**Reads:** `draft`, `selected_article`, `output_language`, `debate_personas` (optional — cached), `best_draft`, `best_score`, `stagnation_count`, `prompts/persona_generator.md`, `prompts/debate_round.md`, `prompts/debate_synthesizer.md`
**Writes:** `critique_approved`, `critic_feedback`, `debate_personas`, `debate_transcript`, `security_flag`, `best_draft`, `best_score`, `stagnation_count`, `total_tokens_used`, `messages`

> `agents/critic.py` (single-critic, monolithic) is kept untouched as rollback reference.
> `graph.py` now points to `multi_critic_node` — the node is still registered as `"critic"`
> so no edge wiring changes are needed.

### How it works

Instead of a single LLM call evaluating the draft, three context-aware personas debate it across 2 rounds. A **judge who knows Mohamad's editorial standards** then scores the draft against his 4 criteria, using the debate as evidence.

```
1. [First iteration only] Generate 3 personas    → 1 call (LLM_MODEL)
2. Round 1: each persona critiques independently  → 3 calls (DEBATE_MODEL)
3. Round 2: each persona responds to the others  → 3 calls (DEBATE_MODEL)
4. Synthesizer: debate → writer feedback (JSON)  → 1 call (LLM_MODEL)
   Total: 8 LLM calls per iteration
```

Personas are **generated once** (iteration 1) from the article context, then cached in `state["debate_personas"]` and reused as-is on iterations 2 and 3. This means the same panel evaluates all revisions — ensuring consistent evaluation criteria across the loop.

### Persona generation (`prompts/persona_generator.md`)

The persona generator receives the article title, category, and a content excerpt. It outputs a JSON array of 3 personas, each with: `id`, `name`, `role`, `background`, `primary_concern`, `tone`, and a `system_prompt` (2–3 sentence character sheet injected into each debate call).

**Key constraint:** personas must represent **genuinely orthogonal concerns** — never 3 variants of "senior engineer". The prompt forces the LLM to assign each persona a distinct axis from: technical depth, developer experience, business/cost impact, security/risk, pedagogy/clarity, contrarian/hype detection, or domain specialist.

### Debate round prompt (`prompts/debate_round.md`)

Each persona receives: its own `system_prompt`, the draft, and a summary of the previous round's assessments (empty in round 1). Returns **1 to 4 bullets** in the persona's voice. No JSON — raw Markdown with the persona's name as `###` header.

The prompt presents two explicit paths rather than a forced critique:
- **No issues** → 1 bullet endorsement, then stop. This is a valid, meaningful signal.
- **Genuine concern** → 2–4 specific bullets quoting exact draft sentences.

The fixed "3-5 bullet" quota has been removed because it caused the model to manufacture concerns to fill the count, even in good drafts (documented "forced critique bias", ACM 2025). An endorsement from a persona now counts as positive evidence for the synthesizer.

### Judge prompt (`prompts/debate_synthesizer.md`)

The judge is Mohamad's personal critic. It receives the debate transcript as *evidence* and scores the draft against Mohamad's 4 editorial criteria (tone/voice 25%, technical accuracy 30%, structure 25%, density/length 20%) — the same rubric as the legacy `critic.md`.

It also receives `{source_url}` and `{source_name}` to apply the recent-features rule: never reject for an unknown feature if the source is an official publisher blog.

Returns the **same JSON shape** as the legacy `critic.md` — zero changes needed in `graph.py` or `writer.py`:

```json
{
  "approved": false,
  "score": 6,
  "security_flag": false,
  "issues": ["Criterion: tone — hook announces the plan instead of destabilizing an assumption"],
  "specific_corrections": ["Replace the opening sentence with a direct assertion that overturns..."]
}
```

### How the judge uses the debate
1. Consensus (≥2 personas) → high-priority evidence for the relevant criterion
2. A single critical issue (factual error, dangerous code) outweighs 3 style nitpicks
3. Contradictory opinions that cancel out are discarded
4. Source-inherited issues (PR claims, fund narratives) → credit nuance added by writer, don't re-penalize
5. Security code flagged by ≥2 personas as **actively dangerous in production** (data loss, credential exposure, unauthorized access) → `security_flag: true`, forces rejection. Technical inaccuracies and suboptimal advice lower the score but do NOT trigger the flag.
6. Debate concerns irrelevant to Mohamad's editorial goals → discarded

### Corrections format
`specific_corrections` in the synthesizer JSON now follow a prescriptive format:
- For tone/structure/density: describe the exact change
- For technical accuracy: provide the CORRECT technical information (`REPLACE [claim] WITH [correction]. Reason: [why]`), or flag explicitly as unverifiable (`VERIFY AND CORRECT: [claim] — add a caveat or remove it`)

See `docs/multi_critic.md` for the full judge architecture.

### Cost control — `DEBATE_MODEL`

```bash
# .env — use a cheaper model for the 6 debate-round calls
DEBATE_MODEL=google/gemini-flash-lite

# Persona generation (1 call) and synthesis (1 call) always use LLM_MODEL
```

If `DEBATE_MODEL` is not set, it defaults to `LLM_MODEL`. At `MAX_CRITIQUE_ITERATIONS=3` and `DEBATE_ROUNDS=2`, the worst case is 24 LLM calls (8 × 3), of which 18 use the cheaper `DEBATE_MODEL`.

### Fallback chain

1. Persona generation fails → use `_FALLBACK_PERSONAS` (3 hardcoded personas: Staff Engineer / DevOps Lead / Tech Writer)
2. Debate LLM call fails → synthesize with empty transcript
3. Synthesizer returns invalid JSON → auto-approve to avoid an infinite loop

### Log output

```
[MULTI_CRITIC] Generating 3 context-aware personas...
[MULTI_CRITIC] Personas: Aisha Okonkwo, Dmitri Volkov, Fiona Lacoste
              Roles: FinOps Architect | Platform Eng | Developer Educator
[MULTI_CRITIC] Running 2 debate rounds (3 personas × 2 rounds = 6 calls)...
[MULTI_CRITIC] Debate complete (4821 tokens)
[MULTI_CRITIC] Synthesizing debate transcript...
[MULTI_CRITIC] Score: 6/10 — NOT approved (iteration 1/3)
              Issues: hook announces the plan; no concrete cost numbers
```

### Research foundations

This sub-system is backed by 4 papers and one production reference:

| Reference | Contribution |
|-----------|-------------|
| **D3** — Liang et al. (2024) *arXiv:2410.04663* | Role-specialized agents (advocates + judge) outperform single-reviewer on structured critique tasks |
| **PersonaAgent** — Liu et al. (2025) *arXiv:2506.06254* | Test-time persona generation aligned to context (article topic/category) rather than hardcoded profiles |
| **DEBATE Benchmark** — Li et al. (2025) *arXiv:2510.25110* | Orthogonality constraint: without enforcing genuinely different concerns, debaters converge prematurely and produce single-perspective critique |
| **Perplexity Model Council** (Feb 2026) | Production system using multi-agent debate: 30% fewer factual errors vs. single reviewer at matched cost (via model tiering) |

See `docs/memory.md` references \[15\]–\[18\] for full citations.

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
