# Editorial Memory — Architecture & Theoretical Foundations

> **Relevant files:** `memory_manager.py`, `state.py`, `agents/selector.py`,
> `agents/writer.py`, `agents/output_saver.py`, `prompts/writer.md`

---

## Summary

AgenticBlog implements a **Markdown-First persistent memory** system that allows the pipeline
to maintain an editorial history across runs. Unlike approaches based on vector databases or
knowledge graphs, this architecture relies exclusively on structured Markdown files — directly
readable and editable by the agent or a human, with no additional infrastructure.

Concretely, three behaviors emerge:

1. **The selector** applies a novelty penalty to articles that are too close to recently covered
   topics (14-day window), promoting editorial diversity.
2. **The writer** receives context from relevant past articles, enabling narrative continuity
   ("In my article on X, I had explained Y...").
3. **The writer** receives critical lessons from previous runs that required ≥ 2 critic
   iterations — past editorial mistakes are memorized and injected before each draft.

---

## 1. Problem: AI Pipeline Amnesia

A multi-agent pipeline without persistent memory is, by construction, **amnesiac**:
each run starts from scratch, ignores everything produced before it, and therefore cannot
avoid repetition or create editorial continuity.

This problem is fundamental in multi-session AI systems. It has been formalized in several
recent papers:

- Sumers et al. (2023) identify memory as one of the four essential cognitive components
  of an LLM agent, alongside reasoning, action, and planning. Without persistent memory,
  an agent cannot exhibit any coherent long-term behavior \[1\].
- Park et al. (2023) show that simulated agents without long-term memory see their behavior
  rapidly degrade into inconsistencies: they repeat the same actions, make the same mistakes,
  and learn nothing from their past interactions \[2\].
- Packer et al. (2023) quantify the cost of amnesia in LLMs: without explicit context
  management, an agent loses access to history once the context window is full, forcing
  suboptimal or incoherent behaviors \[3\].

In the editorial context of AgenticBlog, amnesia manifests as three concrete problems:

| Problem | Observed symptom |
|---------|-----------------|
| Thematic repetition | Two successive runs on the same Kubernetes topic |
| No narrative continuity | The writer cannot reference its own articles |
| Editorial drift | No signal on what "worked well" (critic score) |

---

## 2. Literature Review

### 2.1 AI Memory Taxonomy — CoALA (Sumers et al., 2023)

The paper *Cognitive Architectures for Language Agents* \[1\] proposes a four-type memory
taxonomy for LLM agents, modeled on cognitive science:

| Type | Definition | AgenticBlog equivalent |
|------|-----------|----------------------|
| **Semantic** | General facts about the world | Implicit in LLM weights |
| **Episodic** | Specific past events | `MEMORY.md` — runs and produced articles |
| **Procedural** | Know-how, methods | Prompts in `prompts/` |
| **Working** | Active context | `PipelineState` — cleared between runs |

Our implementation primarily targets **episodic memory**: it records when, on what topic,
and with what score each run produced content. It then injects it into the writer's working
memory via `state["memory_context"]`.

### 2.2 Memory Hierarchy — MemGPT (Packer et al., 2023)

MemGPT \[3\] proposes an OS-like architecture for LLMs: a memory hierarchy (main context,
external storage, recall storage) with explicit read/write functions that the agent calls
itself. The agent decides when to consolidate its observations into long-term memory.

Our approach differs on one crucial point: **the decision to memorize is not delegated to
the LLM** — it is systematic and automatic (after each successful run). This choice avoids
the inherent variability of LLM decisions and guarantees complete history coverage. The
trade-off is lower selectivity: every run is memorized, including poor ones.

### 2.3 Memory Stream — Generative Agents (Park et al., 2023)

Park et al. \[2\] introduce the concept of a **memory stream**: a chronological journal of
observations annotated with their importance, recency, and contextual relevance.
Three fundamental operations are defined:

1. **Storage** — adding observations to the stream
2. **Retrieval** — relevance search combining importance score, recency, and similarity
   with the current query
3. **Reflection** — high-level synthesis from raw observations

AgenticBlog implements a simplified version of this model:
- Storage: `update_memory()` in `memory_manager.py` (called by `output_saver`)
- Retrieval: `load_memory_index()` + `build_writer_context()` (keyword overlap)
- Reflection: not implemented in Phase 1, planned for Phase 3 (periodic LLM summaries)

Park et al.'s retrieval score is defined as:

```
score(memory, query) = α × recency(memory)
                     + β × importance(memory)
                     + γ × relevance(memory, query)
```

Our retrieval heuristic uses exclusively `relevance` (Jaccard overlap on keywords) and
`recency` (14-day window). `importance` is approximated by the critic score (`score` in
MEMORY.md), but is not yet weighted in the ranking — this is a direct improvement
identified for Phase 2.

### 2.4 Textual Long-Term Memory — Voyager (Wang et al., 2023)

Voyager \[4\] is a Minecraft agent that accumulates a textual **skill library**: each
learned skill is stored as commented JavaScript code, retrievable by vector similarity
for new tasks. The key aspect is that memory is **directly executable** (the stored code
can be re-read and re-run).

Although our domain differs, the principle is identical: the Markdown articles stored in
`memory/topics/*.md` are **directly readable by the LLM** without any embedding or
vectorization layer. This is what the Markdown-First Memory movement calls "human-readable,
LLM-native storage" — the same representation serves both humans for auditing and the
model for reasoning \[7\].

### 2.5 Verbal Reflection — Reflexion (Shinn et al., 2023)

Reflexion \[5\] shows that an LLM can improve its performance by maintaining a **verbal
record of its own mistakes** — a memory of what didn't work. The agent consults this record
before each new attempt.

In AgenticBlog, the critic score (`score` in `run_metadata.json` and MEMORY.md) plays this
role, but passively: it is memorized but not yet used to adjust writer behavior. A future
implementation could inject into the writer prompt: *"Articles scored < 7 often treated X
too superficially."*

### 2.6 The Markdown-First Memory Pattern (2025)

The Markdown-First Memory pattern has been independently observed and formalized in
several recent agent systems \[7, 8\]:

- **Claude Code** (Anthropic, 2025) uses Markdown files for persistent agent memory,
  organized by type (user, feedback, project, reference).
- **Manus AI** (2025) documents its memory system based on structured text files,
  without a vector database.
- Research on **A-MEM** (Agentic Memory, 2025) \[7\] and **AgeMem** (2025) \[8\]
  empirically validates that for long-term memory agents, manually indexed text files
  outperform dense vector approaches in retrieval precision for thematic queries —
  provided the structuring schema is sufficiently rich (dates, categories, keywords).

The main justification is that LLMs are natively trained on structured text (Markdown,
JSON, YAML). The representational proximity between stored memory and the training format
reduces the "translation" cost at retrieval time, compared to decompressing from a vector
space \[1, 7\].

---

## 3. Architecture: Markdown-First Memory

### 3.1 Design Choices — Why No Vector DB?

| Criterion | Vector DB (e.g., Chroma, Qdrant) | Markdown-First |
|-----------|----------------------------------|---------------|
| Infrastructure | Server to deploy | None |
| Readability | Opaque (vectors) | Direct (text) |
| Debugging | Difficult | `cat memory/MEMORY.md` |
| Precision on thematic queries | Good on semantics | Good on curated categories/topics |
| Embedding cost | API calls | Zero |
| Portability | Depends on provider | Simple file copy |
| Scale limit | ~50 articles without index | ~200 articles before BM25 yields a notable quality gain |

For AgenticBlog in Phase 1 (< 50 articles), the Markdown-First choice is justified.
Beyond 50 articles, adding `rank_bm25` (Phase 2) allows maintaining this architecture
while gaining retrieval precision \[9\].

### 3.2 File Structure

```
memory/
├── MEMORY.md              ← Index of the last 60 runs
├── topics/                ← Experience Bank (produced articles)
│   ├── infra.md           ← Article details by category
│   ├── security.md
│   ├── ai.md
│   ├── cloud.md
│   └── africa.md
├── lessons/               ← Meta-Guideline Bank (editorial lessons)
│   ├── infra.md
│   ├── ai.md
│   └── ...
├── archive/               ← Overflow > 60 entries in MEMORY.md
│   └── 2026-03-15.md
└── checkpoints.sqlite     ← Existing, managed by LangGraph
```

### 3.3 MEMORY.md Format

```markdown
# AgenticBlog — Editorial Memory

## Recent runs

| Date       | Title                          | Category  | Score | Keywords                      |
|------------|--------------------------------|-----------|-------|-------------------------------|
| 2026-03-10 | Kubernetes Gateway API         | infra     | 8.2   | kubernetes,gateway,networking |
| 2026-03-07 | OpenAI o3 reasoning benchmarks | ai        | 7.9   | openai,llm,benchmark,o3       |

## Topics recently covered (avoid for the next 14 days)
- infra: 2 article(s) (last: 2026-03-10)
- ai: 1 article(s) (last: 2026-03-07)
```

The table is sorted newest-first (prepend on each run). The "Topics recently covered"
section is recalculated automatically after each run.

### 3.4 Format memory/topics/{category}.md

```markdown
# Infra — Articles covered

## 2026-03-10 — Kubernetes Gateway API
- Angle: migration Ingress → Gateway API v1.0
- Score: 8.2 | Critique iterations: 2
- Keywords: gateway,kubernetes,networking
- Path: output/2026-03-10/abcd1234/blog_post.md
```

This file is the reference source for the context injected into the writer.
It is designed to be directly readable by an LLM without transformation.

---

## 4. Detailed Implementation

### 4.1 `memory_manager.py` — Core Module

The module exposes 4 public functions and has no external dependencies:

#### `load_memory_index() → list[dict]`

Parses `memory/MEMORY.md` line by line. Extracts Markdown table rows via a `|`-delimited
pattern. Returns a list of dicts `{date, title, category, keywords, score}`.

Automatically initializes the memory structure on first call (creates directories and
an empty `MEMORY.md`) — the pipeline does not need to handle "memory absent" cases.

#### `get_novelty_penalty(article, recent_runs) → float`

Calculates the novelty penalty for an article based on its thematic overlap with runs
from the last 14 days. The algorithm is inspired by the **MMR (Maximal Marginal Relevance)**
criterion from Carbonell & Goldstein (1998) \[6\], which explicitly formulates the
relevance/diversity trade-off in information retrieval systems:

```
MMR = λ × Sim(di, query) - (1-λ) × max_j∈S Sim(di, dj)
```

Our penalty is a discrete approximation of this criterion:

```python
def get_novelty_penalty(article, recent_runs) -> float:
    # Primary source: category topics present in the article content
    article_kw = set(_keywords_from_category(category, title, summary))

    for run in recent_runs:  # filtered to 14-day window
        run_kw = set(run["keywords"])   # already extracted at storage time
        overlap = |article_kw ∩ run_kw| / |article_kw ∪ run_kw|   # Jaccard similarity

        if overlap > 0.60 → penalty = 2.0  # exact same topic
        if overlap > 0.30 → penalty = 1.5  # related theme
```

Jaccard similarity is chosen for its robustness with small sets (4–8 keywords), unlike
cosine similarity which requires fixed-dimension normalized vectors \[9\]. Keywords stored
in MEMORY.md are reused directly (`set(run["keywords"])`) — no re-extraction at comparison time.

#### `build_writer_context(selected, recent_runs) → str`

Selects the most relevant runs (same category OR overlap > 15%) and builds a Markdown
block injected into the writer prompt via `{memory_context}`:

```markdown
### Previous articles on this topic

- **2026-03-10** — Kubernetes Gateway API _(category: infra, score: 8.2)_
- **2026-02-28** — Cilium eBPF deep-dive _(category: infra, score: 7.5)_
```

Maximum 3 entries (the most relevant by Jaccard overlap), to avoid overloading the
writer's context.

#### `update_memory(state) → None`

Executes at end of pipeline, in `output_saver`. Three operations:

1. **Prepend** a row to the `MEMORY.md` table
2. **Archive** if > 60 entries (FIFO to `memory/archive/YYYY-MM-DD.md`)
3. **Upsert** into `memory/topics/{category}.md`

Non-blocking: an exception in `update_memory` is caught and logged, without failing the pipeline.

### 4.2 Meta-Guideline Bank (Strategy-based Experiential Memory)

Inspired by the **dual-bank** pattern from Live-Evo \[11\] and the **Trajectory-Informed
Memory** from IBM Research \[13\], this layer memorizes not *what happened* (Experience
Bank = `topics/`) but *why a draft failed* (Meta-Guideline Bank = `lessons/`).

**Trigger:** any run with `iteration_count >= 2` (at least one critic rejection).

**Format `memory/lessons/{category}.md`:**

```markdown
# Ai — Lessons learned

## 2026-03-15 | iterations: 3 | score: 7.2 | weight: 1.00
- Article: GGML and llama.cpp join HF...
- Critique: tone too formal in the introduction; lacks concrete CLI examples

## 2026-03-10 | iterations: 2 | score: 7.8 | weight: 0.85
- Article: OpenAI o3 benchmarks...
- Critique: structure too linear, hook too neutral
```

**Usage-based decay (not time-based):** on each run in the same category, all weights are
multiplied by `LESSON_DECAY_FACTOR = 0.85`. After ~17 runs in the same category, a lesson
drops below `LESSON_PURGE_THRESHOLD = 0.1` and is automatically purged. This choice reflects
the MemRL \[12\] recommendation: weight memories by observed utility, not calendar age.

**Injection into the writer:** `load_lessons(category)` returns the 5 highest-weighted
lessons, formatted as a Markdown block and appended to the existing memory context:

```markdown
### Critical lessons — apply without exception
- [high priority] tone too formal in the introduction; lacks concrete CLI examples
- [normal priority] structure too linear, hook too neutral
```

High priority threshold: weight > 0.6 (recent lesson, < 3 runs since memorization).

**No new placeholder in `prompts/writer.md`:** lessons are added as an additional section
in the string returned by `build_writer_context()`, via the existing `{memory_context}`
placeholder. Zero interface breakage.

### 4.3 Integration in `selector_node`

```
composite_score = llm_score + freshness_bonus - novelty_penalty
                  [0–10]       [0–1]              [0–2]
```

The resulting composite score stays in an effective range of -1 to 11. The maximum penalty
of 2.0 therefore cannot exclude a very high LLM-scored article — it penalizes it, but does
not eliminate it. This is a deliberate choice: if the only relevant article of the day is
on a recently covered topic, it is better to cover it again than to pick an off-topic article.

Log output:

```
[SELECTOR]   Selected: "Cilium 1.15: eBPF without kube-proxy"
             Score: 8.5/10 + freshness: 0.72 - novelty penalty: 0.0
             Memory: 7 runs loaded
```

### 4.4 Integration in `writer_node`

The `writer.md` prompt now receives three variables:

| Variable | Source | Value if absent |
|----------|--------|-----------------|
| `{article}` | `state["selected_article"]` | — |
| `{feedback}` | `state["critic_feedback"]` | "No feedback — first draft." |
| `{memory_context}` | `state["memory_context"]` | "No previous articles on this topic." |

The instruction in the prompt is intentionally non-prescriptive:
> *"If a past article is relevant, you may create editorial continuity.
> Do not force the reference if it adds nothing."*

This choice follows the recommendation of Park et al. \[2\]: agents that mechanically force
the use of their memory produce artificial references that degrade the perceived content quality.

---

## 5. Design Decisions and Trade-offs

### Why prepend rather than append in MEMORY.md?

Prepend places the most recent entries at the top of the table. If an LLM must read
MEMORY.md directly (future use case), it will read the most recent data first, which is
optimal given that the context window has a limited length and recent entries are more
relevant than old ones.

### Why a limit of 60 entries in MEMORY.md?

The MEMORY.md file is designed to be loaded entirely into working memory
(`load_memory_index` reads the whole file). At 60 entries × ~100 bytes per line, this
represents ~6 KB — negligible. Beyond that, the signal/noise ratio decreases: articles
several months old are barely relevant for the novelty penalty (14-day window) and create
noise in the writer context.

### Why is the novelty window 14 days?

14 days is a compromise between:
- **Too short (< 7 days)**: does not sufficiently protect against repetition if the pipeline
  runs daily
- **Too long (> 30 days)**: the pipeline self-censors on topics that have evolved (a new
  Kubernetes release may justify a second article after 3 weeks)

This parameter is hardcoded in `memory_manager.py` (`NOVELTY_WINDOW_DAYS = 14`) but can
be externalized to an environment variable if needed.

### Why use category topics as the primary keyword source?

Naive regex extraction on the blog post generates noise: the drafted text may produce words
like "dead" (from "Cloud-first is dead"), "click" (from "single-click"), or "makes" (from
"that makes inference possible") that pass any reasonable stopword filter. This bug was
observed on the very first real run.

The solution is to use `config.CATEGORIES[category]["topics"]` as a controlled vocabulary:
the topics are already curated, technical, in English, and directly comparable across runs.
The `_keywords_from_category` algorithm simply checks if each topic appears in the source
article content (RSS title + fetched content), then falls back to long words from the title
if fewer than 4 topics are found.

Three advantages over a regex bag-of-words approach:
1. **Controlled vocabulary**: only technical terms relevant to the category.
2. **Consistent language**: topics are in English, like the RSS article title — no pollution
   from the generated content prose.
3. **Comparability**: two articles about `llama.cpp` will have `llama.cpp` in their keywords
   regardless of how the writer phrased it.

The fine semantic distinction (distinguishing two llama.cpp articles with different angles —
benchmarks vs. HuggingFace integration) remains a blind spot in Phase 1 and will be
addressed via BM25 \[9\] in Phase 2.

---

## 6. Complete Data Flow

```
[MEMORY.md] ─── load_memory_index() ──→ recent_runs[]
                                              │
                                              ▼
[filtered_articles[]] ──→ get_novelty_penalty(article, recent_runs)
                                              │
                                              ▼
                              composite_score = score + freshness - penalty
                                              │
                                              ▼
                         ranked[0] = selected_article ──→ state["selected_article"]
                                              │
                                              ▼
                         build_writer_context(selected, recent_runs)
                            │                                │
                            ▼                               ▼
                 relevant past articles           load_lessons(category)
                            │                               │
                            └──────────────┬────────────────┘
                                           ▼
                                  state["memory_context"]
                                           │
                               ┌───────────┘
                               ▼
[prompts/writer.md] + {memory_context} ──→ LLM → draft
                                                      │
                                      (writer ↔ critic loop)
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
                       (prepend+arch)  (append entry)   (prepend if ≥2 iter)
```

---

## 7. Roadmap

### Phase 2 — BM25 on Markdown Files (~50 articles)

Beyond 50 articles, Jaccard similarity on 6 keywords shows its limits: articles on
distinct topics may share many generic terms.

Adding `rank_bm25` \[9\] would replace the Jaccard comparison with TF-IDF scoring on the
memorized article corpus. **No architecture change** — the keyword source
(`_keywords_from_category`) remains unchanged; only the comparison function in
`get_novelty_penalty` and `build_writer_context` evolves.

```python
# Phase 2: replace Jaccard comparison with BM25
from rank_bm25 import BM25Okapi

# corpus = keywords from each memorized run
corpus = [run["keywords"] for run in recent_runs]
bm25 = BM25Okapi(corpus)
# article_kw = _keywords_from_category(category, title, content)
scores = bm25.get_scores(article_kw)
# → scores[i] replaces the Jaccard calculation for run i
```

### Phase 3 — Temporal Knowledge Graph (Graphiti)

For memory beyond 200 articles, `graphiti-core` (Zep AI, 2025) \[10\] offers a temporal
knowledge graph automatically built from free text. It maintains *bi-temporal edges*: each
relationship between entities is timestamped (validity of the knowledge in both real time
and narrative time).

```
[Kubernetes] ──[covers]──> [Gateway API] ──[date: 2026-03-10]──> [Article #7]
[Gateway API] ──[replaces]──> [Ingress] ──[since: K8s 1.28]
```

This representation would allow the writer to reason about technological trajectories
("Ingress has been deprecated since Gateway API went GA") instead of a simple article list.

---

## 8. Verification

```bash
# 1. First run — create memory
python main.py --category infra
# → Check memory/MEMORY.md (created automatically)
# → Check memory/topics/infra.md (created automatically)

# 2. Second run — novelty penalty
python main.py --category infra
# → Expected logs:
# [SELECTOR]   Memory: 1 runs loaded
# [SELECTOR]   Score: 8.5/10 + freshness: 0.72 - novelty penalty: 1.5
# (if topic close to previous run)

# 3. Verify continuity in the blog post
grep -i "in my article\|I had explained\|previous" output/*/*/blog_post.md
```

---

## References

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
Referenced in discussions on agent memory patterns (2025).

\[8\] Anthropic (2025). **Claude Code Memory System** — internal documentation of the
Markdown-First memory system used by Claude Code, observable in agent behavior.
See files `~/.claude/projects/*/memory/MEMORY.md`.

\[9\] Robertson, S., & Zaragoza, H. (2009). **The Probabilistic Relevance Framework:
BM25 and Beyond**. *Foundations and Trends in Information Retrieval*, 3(4), 333–389.
Python implementation: `rank_bm25` (Doricha, PyPI).
<https://doi.org/10.1561/1500000019>

\[10\] Zep AI (2025). **Graphiti: Temporally-Aware Knowledge Graph for AI Agents**.
`graphiti-core` — <https://github.com/getzep/graphiti>

\[11\] Liu, Z. et al. (2026). **Live-Evo: Evolving LLM Agents via Dual-Bank Experience
Replay**. *arXiv:2602.02369*. Introduces the dual-bank pattern: Experience Bank (what
happened) + Meta-Guideline Bank (how to use that experience), with utility-weighted guidelines.

\[12\] Chen, Y. et al. (2026). **MemRL: Memory-Augmented Reinforcement Learning for
Long-Horizon Agent Tasks**. *arXiv:2601.03192*. Two-Phase Retrieval: filter by relevance,
then select by Q-value (utility learned from feedback). Justifies usage-based rather than
time-based decay.

\[13\] IBM Research (2026). **Trajectory-Informed Memory for LLM Agents**. *arXiv:2603.10600*.
Automatic extraction of actionable learnings from execution trajectories. Three guidance
types: strategy tips (successes), recovery tips (failures), optimization tips. Directly
inspires the `store_lesson` function in AgenticBlog.

\[14\] Zhao, S. et al. (2025). **Memory in the Age of AI Agents: A Survey**. *arXiv:2512.13564*.
Survey of 47 authors identifying Strategy-based Experiential Memory as the missing component
in most agent pipelines — storing abstract rules derived from failures, not just raw events.
