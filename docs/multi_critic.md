# Multi-Critic — Debate Panel Architecture

> **Relevant files:** `agents/multi_critic.py`, `prompts/persona_generator.md`,
> `prompts/debate_round.md`, `prompts/debate_synthesizer.md`, `state.py`

---

## Why not a single critic?

The original pipeline had one LLM call to evaluate the draft. It worked — but it had a fundamental limit: one evaluator, one lens. A single critic optimizing for "Mohamad's voice" will catch tone issues and structural problems but has no built-in mechanism to catch orthogonal concerns simultaneously: an infrastructure engineer reviewing a cloud cost article won't naturally think like a FinOps consultant, and neither will think like a developer trying to implement the advice from scratch.

The research literature formalizes this problem:

- A single reviewer converges to a dominant concern and neglects others \[1\]
- Multi-agent debate with orthogonal roles produces systematically more complete and calibrated evaluation than any single-role reviewer, even a highly capable one \[1\]
- Without an orthogonality constraint, multiple reviewers converge prematurely and produce the same critique — which defeats the purpose \[3\]

The solution: three personas with genuinely different concerns debate the draft across two rounds, then a **judge who knows Mohamad's editorial standards** filters their findings and produces the final verdict. The personas surface domain issues the writer missed; the judge decides which ones actually matter for Mohamad's article.

---

## Full flow

```
multi_critic_node(state)
│
├── [Iteration 1 only] Persona generator
│       Input:  article title + category + content excerpt + output_language
│       Model:  LLM_MODEL (1 call)
│       Output: 3 personas as JSON → state["debate_personas"]
│       Cached: reused as-is on iterations 2 and 3
│
├── Round 1 — independent critique
│       For each persona (3 calls, DEBATE_MODEL):
│         Input:  persona system_prompt + draft + empty previous_critiques
│         Output: 3–5 bullet critique in the persona's voice
│
├── Round 2 — cross-examination
│       For each persona (3 calls, DEBATE_MODEL):
│         Input:  persona system_prompt + draft + Round 1 summaries (400 chars/persona)
│         Output: response to the other two critiques + refined position
│
└── Judge (Mohamad's personal critic)
        Input:  full debate transcript + draft + source_url + source_name + output_language
        Model:  LLM_MODEL (1 call)
        Role:   scores the draft against Mohamad's 4 editorial criteria,
                using the debate transcript as evidence
        Output: JSON {approved, score, security_flag, issues, specific_corrections}
                → state["critique_approved"], state["critic_feedback"]
                → state["debate_transcript"] (for writer context on next revision)

Total: 8 LLM calls per iteration (1 persona gen + 3 round1 + 3 round2 + 1 synthesis)
       Persona gen only on iteration 1 → 7 calls on iterations 2 and 3
```

---

## Persona generation

### What the LLM receives

The `persona_generator.md` prompt receives:
- `{article_title}` — the RSS article title
- `{article_category}` — the pipeline category (`ai`, `security`, `cloud`, etc.)
- `{article_content_excerpt}` — first 800 chars of the fetched content
- `{output_language}` — for language-appropriate names and profiles

### Orthogonality constraint

The central rule in the prompt: **personas must represent genuinely different concerns**. The prompt provides a menu of axes and forces the LLM to pick 3 distinct ones:

| Axis | What it catches |
|------|----------------|
| Technical depth | Incorrect commands, shallow explanations, missing nuance |
| Developer experience | Is this actually implementable? Missing prerequisites? |
| Business / cost impact | FinOps, vendor lock-in, OPEX traps, sustainability |
| Security / risk | Dangerous code, attack surfaces, missing caveats |
| Pedagogy / clarity | Will a junior engineer follow this? Structure issues? |
| Contrarian / hype detector | Is this claim actually new? Marketing narrative? |
| Domain specialist | Deep knowledge of the specific category |

The LLM tailors the personas to the article — a Web3/Africa article generates crypto-native profiles, an infrastructure article generates DevOps profiles. Names, background, and behavioral traits are all context-driven.

### Examples from real runs

```
Article: "GGML and llama.cpp join Hugging Face"  (category: ai)

→ Élise Moreau       | ML Infrastructure Engineer
                     | concern: technical accuracy on memory mgmt and execution backends
→ Marc Dubois        | FinOps & Open-Source Sustainability Consultant
                     | concern: vendor lock-in, CLA implications, OSS governance
→ Dr. Anika Vogel    | AI Research Scientist
                     | concern: real community impact vs. press release framing
```

```
Article: "$5M Core Africa Innovation Fund: Web3 Builders"  (category: africa)

→ Kwame_DevOps_Lagos  | Regional Infrastructure Lead
                      | concern: last-mile realities — RPC latency, local node support
→ VC_Skeptic_88       | Venture Partner & Token Economist
                      | concern: OPEX traps, grant dependency, unsustainable models
→ ChainWatcher_Alpha  | Protocol Security Researcher
                      | concern: Satoshi Plus security claims, slashing conditions
```

The second example shows the persona generator adapting to the culture of the domain — Web3 pseudonymous handles rather than professional names.

---

## Debate rounds

### Round 1 — independent assessment

Each persona receives:
- Its own `system_prompt` (2–3 sentence character sheet)
- The full draft
- Empty `previous_critiques` field

Returns **1 to 4 bullets** in the persona's voice, depending on what they genuinely find. Raw Markdown with the persona's name as `###` header.

Crucially, personas are NOT forced to find problems. The prompt presents two explicit paths:
- **No issues from their angle** → 1 bullet endorsing what works, then stop
- **Genuine concern** → 2–4 bullets, leading with the most important issue

This design is grounded in documented LLM behavior: when forced to critique, models reliably manufacture concerns even in good content ("forced critique bias", ACM 2025). A clean endorsement from a persona is a meaningful positive signal for the synthesizer, not a failure to critique.

### Round 2 — cross-examination

Each persona receives the same draft plus a summary of Round 1 from the other two personas (400 chars each). This is intentionally short — enough for a persona to react to the other positions, not enough to fully absorb them and converge.

The cross-examination reveals:
- **Consensus** — two or more personas flag the same issue independently → high priority for the synthesizer
- **Positive consensus** — two or more personas find no issues from their angle → strong evidence the draft holds up, synthesizer must not invent rejection reasons
- **Disagreement** — personas cancel each other out → synthesizer filters this noise
- **New angles** — Round 2 often surfaces more specific sub-issues missed in Round 1 (e.g., "the code is bad" in Round 1 becomes "the Trusted Forwarder lacks `onlyOwner` guard" in Round 2)

---

## The judge

The judge is not a generic editor. It is Mohamad's own critic — the same role that `critic.md` played in the single-critic architecture, now enriched with the debate transcript as evidence.

### Two-layer architecture

```
Layer 1 — Personas (domain experts)
  What they do:  surface issues from specialized angles the writer missed
  What they don't do: apply Mohamad's editorial standards

Layer 2 — Judge (Mohamad's critic)
  What it does:  score the draft against Mohamad's 4 criteria,
                 using the debate as evidence
  Can also:      catch issues the personas missed (e.g. a flat hook none of them flagged)
  Can also:      discard debate concerns irrelevant to Mohamad's editorial goals
```

This separation is the key architectural decision. Without it (original implementation), the judge was a generic "senior editor" — the personas could all approve a draft that opened with `"Dans cet article nous allons voir..."` because no one was responsible for enforcing Mohamad's voice.

### Scoring rubric — Mohamad's 4 criteria

The judge scores against these criteria (same as `prompts/critic.md`):

| Criterion | Weight | What it checks |
|-----------|--------|---------------|
| Tone & voice | 25% | Hook, position-taking, direct register, opening conclusion |
| Technical accuracy | 30% | Commands, YAML/JSON, assertions vs. established knowledge |
| Structure | 25% | 5-step progression, no plan announcement, narrative > bullet lists |
| Density & length | 20% | 750–1600 words, no padding, every paragraph introduces something new |

Score ≥ 7 → approved. A technically correct article with a generic hook fails. A stylistically strong article with a factual error also fails.

### How the judge uses the debate

The debate provides evidence for the rubric — it doesn't override it:

1. **Consensus → high priority evidence** — ≥2 personas flagging the same issue strengthens that criterion's case
2. **Severity wins** — one factual error or dangerous code outweighs 3 style nitpicks
3. **Filter contradictions** — opposing opinions that cancel out are dropped
4. **Source-inherited issues** — if personas critique a claim from the source article itself (a PR narrative, a fund announcement), the writer can only add nuance. The judge credits added nuance as a fix and does not re-penalize for the underlying claim on subsequent iterations.
5. **Security code rule** — if ≥2 personas flag a code snippet as **actively dangerous in production** (data loss, credential exposure, unauthorized access if copy-pasted), `security_flag: true` overrides the score and forces rejection. The correction must fix it, remove it, or add an explicit `> ⚠ not production-ready` warning. Technical inaccuracies and suboptimal advice affect the score only — they do not trigger this flag.
6. **Irrelevant debate noise** — if a persona raises a concern unrelated to Mohamad's editorial goals (e.g., "the fund's investment thesis is questionable"), the judge discards it.

### Additional judge context

Unlike the old single-critic, the judge also receives:
- `{source_url}` and `{source_name}` — to apply the recent-features rule (don't penalize for features unknown due to knowledge cutoff if the source is an official publisher blog)
- The full debate transcript — as evidence, not as instructions

### Output JSON shape

The synthesizer returns the same JSON shape as the legacy single-critic — zero interface changes needed in `graph.py` or `writer.py`:

```json
{
  "approved": false,
  "score": 6,
  "security_flag": false,
  "issues": [
    "The 'Bitcoin-aligned security' claim is misleading (source-inherited) — add nuance on Satoshi Plus slashing conditions",
    "Solidity snippet lacks access control (fixable) — consensus: 2 personas"
  ],
  "specific_corrections": [
    "After the paragraph on Satoshi Plus, add: 'Note that BTC miners in this model do not face cross-chain slashing...'",
    "Replace the Trusted Forwarder snippet with a conceptual description or add an explicit ⚠ warning"
  ]
}
```

---

## Writer feedback loop

On revision iterations (iteration ≥ 2), the writer receives more than the 2-bullet synthesized corrections. `agents/writer.py` enriches the `{feedback}` variable with a truncated view of Round 1 from each persona (heading + max 6 bullets, ~450 chars/persona):

```
**Synthesized corrections:**
- After the Satoshi Plus paragraph, add a nuance on cross-chain slashing
- Replace the Trusted Forwarder snippet or add a ⚠ warning

**Arguments détaillés du panel d'experts (Round 1):**

### Kwame_DevOps_Lagos
- The code snippet has no onlyOwner or access control guard
- Any address can call this function — it's an open relay exploit vector
- ...

### VC_Skeptic_88
- "Bitcoin-aligned security" is a marketing claim, not a technical guarantee
- ...

### ChainWatcher_Alpha
- The Trusted Forwarder pattern requires ERC-2771 compliance, not shown here
- ...
```

Without this context, the writer receives 2 vague bullet points and can't understand the depth or specificity of each concern. With it, the writer knows exactly what `Kwame_DevOps_Lagos` wants and can address it directly.

---

## State fields

| Field | Type | Populated by | Used by |
|-------|------|--------------|---------|
| `debate_personas` | `list` (optional) | `multi_critic_node` (iter 1) | `multi_critic_node` (iter 2, 3) |
| `debate_transcript` | `str` (optional) | `multi_critic_node` | `writer_node` (enriched feedback) |
| `security_flag` | `bool` (optional) | `multi_critic_node` | `output_saver_node` (warning + metadata) |
| `best_draft` | `str` (optional) | `multi_critic_node` | `multi_critic_node` (regression guard) |
| `best_score` | `int` (optional) | `multi_critic_node` | `multi_critic_node`, `writer_node` (stagnation) |
| `stagnation_count` | `int` (optional) | `multi_critic_node` | `writer_node` (adaptive strategy) |

`debate_personas` is cached in state and never regenerated — the same panel evaluates all revisions of the same draft, ensuring consistent evaluation criteria across the loop.

---

## Cost model

```
Per iteration (DEBATE_ROUNDS=2, NUM_DEBATE_PERSONAS=3):

  Persona generation:  1 call  × LLM_MODEL     (only on iteration 1)
  Round 1:             3 calls × DEBATE_MODEL
  Round 2:             3 calls × DEBATE_MODEL
  Synthesis:           1 call  × LLM_MODEL

  Total calls:  8 (iter 1)  /  7 (iter 2+)
```

The `DEBATE_MODEL` variable is the cost lever. The 6 debate-round calls are the bulk of the cost — using a cheaper/faster model there has minimal impact on output quality since the synthesizer (on `LLM_MODEL`) normalizes the output anyway.

```bash
# Example: high quality synthesis, cheap debate rounds
LLM_MODEL=google/gemini-2.0-flash        # persona gen + synthesis
DEBATE_MODEL=google/gemini-flash-lite    # 6 debate calls (~10x cheaper)
```

Token counts from real runs:
```
Run 1 (ai/fr, 3 iterations):    ~115k tokens total
Run 2 (africa/en, 3 iterations): ~105k tokens total
  ↳ Debate alone (6 calls × 3 iter): ~50k tokens → savings if DEBATE_MODEL set
```

---

## Security flag

When ≥2 personas flag a code snippet as **actively dangerous in production** — meaning copy-pasting it could cause data loss, credential exposure, or unauthorized access — the synthesizer sets `security_flag: true`.

1. `security_flag: true` is set in the synthesizer JSON
2. `multi_critic_node` forces `approved = False` regardless of the score
3. The ACP message metadata records `security_flag: true`
4. `output_saver_node` prints a visible warning and persists the flag in `run_metadata.json`:

```
[OUTPUT]  ⚠ SECURITY FLAG — a code snippet was flagged as dangerous by the debate panel.
             Review output/2026-03-16/91c5430e/blog_post.md before publishing.
```

The article is still saved (the formatter ran before the flag could block it in the current architecture) but the warning is visible in the terminal and queryable via `--list`.

**What does NOT trigger the flag:** technical inaccuracies, incomplete explanations, architecture-specific code (e.g. SIMD flags that would crash on a different CPU), or advice that is merely suboptimal. These affect the **score** only — the flag is reserved for genuine safety concerns.

## Best-draft tracking and stagnation detection

`multi_critic_node` tracks the highest-scoring draft across all iterations:

- **`best_draft` / `best_score`** — updated whenever the current score exceeds the stored best. On the final iteration, if the score has regressed (e.g. 5→5→4), the node restores `best_draft` into `state["draft"]` before handing off to the formatter. This prevents the pipeline from publishing a worse draft simply because it was produced last.

- **`stagnation_count`** — incremented each time the score does not improve. When `stagnation_count >= 1` going into a revision, `writer_node` switches to a conservative strategy: it anchors technical claims to the source article, adds uncertainty caveats on previously-flagged details, and focuses revisions on tone/structure/density rather than attempting to guess at technical corrections it cannot verify.

```
[MULTI_CRITIC] Score: 5/10 — NOT approved (iteration 2/3), stagnation×1
[MULTI_CRITIC] Score: 4/10 — NOT approved (iteration 3/3), stagnation×2
[MULTI_CRITIC] ↩ Score regressed (5→4) — reverting to best draft (score 5/10)
```

This design is grounded in the empirical finding that LLMs cannot reliably self-correct on factual claims without external verified information (Huang et al., 2023; critical survey, 2024). Without the adaptive strategy, the writer would hallucinate "corrections" to technical errors it cannot actually verify — sometimes producing a new, different error in place of the old one.

---

## Known limitations

**Score plateau on technical accuracy** — if the source article is shallow (RSS fetch truncated at 8000 chars) on a technically deep topic, the writer cannot produce a factually impeccable draft regardless of iteration count. The stagnation-adaptive strategy mitigates this (caveats + source-anchored claims) but does not solve the root cause: the model lacks the ground truth to correct toward. A future improvement would add a targeted web search after the critic identifies specific factual errors, injecting the verified correct information before the revision (CRITIC-with-tools approach, Gou et al. 2024).

**Personas don't track progress across iterations** — each debate evaluates the current draft in isolation; personas don't know what they said in previous iterations. This means a partially-fixed issue may still be raised at full severity in iteration 2. A future improvement would pass a diff summary or the previous transcript to the persona prompt.

**Formatter runs before security flag can block** — the current graph wires `writer → critic → formatter`. A `security_flag` on the last iteration (iteration 3) cannot block the formatter since `should_continue_writing` routes to `formatter` at `iteration_count >= 3`. The output is saved with the flag set, but not prevented. Mitigation: review `run_metadata.json` or watch for the terminal warning before publishing.

---

## Research references

\[1\] Liang, T. et al. (2024). **D3: Diverse Multi-Role Debate for LLM Evaluation**.
*arXiv:2410.04663*. Role-specialized agents (advocates + judge) outperform single-reviewer
evaluation. Direct inspiration for the 3-role debate structure.

\[2\] Liu, Y. et al. (2025). **PersonaAgent: Test-Time Persona Generation for Aligned LLM Agents**.
*arXiv:2506.06254*. Context-driven persona generation at inference time outperforms
pre-defined profiles. Justifies the runtime persona generation approach.

\[3\] Li, J. et al. (2025). **DEBATE: A Benchmark for Multi-Agent Debate Quality in LLMs**.
*arXiv:2510.25110*. Identifies premature convergence as the primary failure mode of
multi-agent debate. Justifies the orthogonality constraint in `persona_generator.md`.

\[4\] Perplexity AI (February 2026). **Model Council: Multi-Agent Review in Production**.
30% fewer factual errors vs. single reviewer. Justifies the `DEBATE_MODEL` split between
cheap debate rounds and capable synthesis/persona-gen calls.

\[5\] Anon. (2025). **Yes is Harder than No: Framing Effects in LLMs**.
*ACM DL:10.1145/3746252.3761350*. Documents that LLMs exhibit asymmetric response patterns
to positive vs. negative task framings — when instructed to "critique", models reliably
manufacture concerns even for good content. Justifies the two-path evaluation structure in
`debate_round.md` and the explicit "do not manufacture concerns" instruction.

\[6\] Anon. (2025). **LLM-Rubric: Multidimensional Calibrated Evaluation**.
*arXiv:2501.00274*. Shows that rubric design matters more than model choice for calibrated
evaluation. Key finding: rubrics with explicit permission for "no issues" conclusions
significantly reduce manufactured criticism. Justifies the explicit APPROVE/endorse path in
`debate_round.md` and the "do not manufacture rejection" rule in `debate_synthesizer.md`.

\[7\] McAleese, N. et al. (2024). **LLM Critics Help Catch LLM Bugs**.
*arXiv:2407.00215* (OpenAI). Critics trained on real error data achieve >60% preference over
human contractors but also hallucinate bugs. Works best in human-in-the-loop settings.
Reinforces the need for the synthesizer judge layer to filter spurious critique signals.
