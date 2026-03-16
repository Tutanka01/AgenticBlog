"""
Multi-persona debate critic node.
Replaces critic_node with a 3-persona HackerNews-style debate sub-system.

Flow per call:
  1. [First call only] Generate 3 personas via LLM  (1 call — LLM_MODEL)
  2. Round 1: each persona critiques the draft       (3 calls — DEBATE_MODEL)
  3. Round 2: each persona responds to the others   (3 calls — DEBATE_MODEL)
  4. Synthesizer: debate → actionable corrections   (1 call — LLM_MODEL)
  Total: 8 LLM calls per iteration (personas cached across iterations)
"""
import json
import re

from state import PipelineState, ACPMessage
from config import (
    LLM_MODEL, LLM_TEMPERATURE, PROMPTS_DIR, OUTPUT_LANGUAGE_LABELS,
    DEBATE_MODEL, NUM_DEBATE_PERSONAS, DEBATE_ROUNDS, MAX_CRITIQUE_ITERATIONS,
)
from llm import llm_client

APPROVAL_THRESHOLD = 7

# ── Fallback personas (used only if persona generation LLM call fails) ────────
_FALLBACK_PERSONAS = [
    {
        "id": "persona_1",
        "name": "Alex Chen",
        "role": "Staff Engineer",
        "background": "10 years building distributed systems",
        "primary_concern": "Technical accuracy and depth",
        "tone": "skeptical",
        "system_prompt": (
            "You are Alex Chen, a staff engineer with 10 years of distributed systems experience. "
            "You've seen countless blog posts that get the details wrong. "
            "Your main lens is technical accuracy — you immediately check if commands run, "
            "if configs are valid, and if the claims are substantiated. "
            "You tend to quote the exact sentence that's wrong and explain why."
        ),
    },
    {
        "id": "persona_2",
        "name": "Sarah Müller",
        "role": "DevOps Lead",
        "background": "Runs production infra for a 200-person SaaS startup",
        "primary_concern": "Practical applicability and operational cost",
        "tone": "pragmatic",
        "system_prompt": (
            "You are Sarah Müller, DevOps Lead at a 200-person SaaS startup. "
            "You care about whether advice actually works in production, not just in demos. "
            "Your main lens is practical applicability — will a real team be able to implement this? "
            "What are the operational costs nobody mentions? "
            "You tend to ask 'what happens at 3am when this breaks?'"
        ),
    },
    {
        "id": "persona_3",
        "name": "Marcus Webb",
        "role": "Tech Writer & Educator",
        "background": "Writes for junior engineers transitioning to senior roles",
        "primary_concern": "Pedagogical clarity and narrative structure",
        "tone": "pedagogical",
        "system_prompt": (
            "You are Marcus Webb, a tech writer who creates content for junior engineers. "
            "You have a sharp eye for articles that lose their audience halfway through. "
            "Your main lens is pedagogical clarity — does the article build understanding step by step? "
            "Is the structure logical? Does the hook earn its promise? "
            "You tend to identify the exact paragraph where a reader would give up."
        ),
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _generate_personas(state: PipelineState) -> tuple[list[dict], int]:
    """Generate NUM_DEBATE_PERSONAS context-aware personas. Returns (personas, tokens)."""
    article = state.get("selected_article", {})
    title = article.get("title", "")
    category = state.get("active_category", "")
    content = (article.get("full_content") or article.get("summary", ""))[:800]
    lang_code = state.get("output_language", "en")
    output_language = OUTPUT_LANGUAGE_LABELS.get(lang_code, "English")

    prompt_template = (PROMPTS_DIR / "persona_generator.md").read_text()
    prompt = (
        prompt_template
        .replace("{article_title}", title)
        .replace("{article_category}", category)
        .replace("{article_content_excerpt}", content)
        .replace("{output_language}", output_language)
    )

    response = llm_client.chat.completions.create(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=LLM_TEMPERATURE,
    )
    raw_text = response.choices[0].message.content.strip()
    tokens = response.usage.total_tokens if response.usage else 0

    match = re.search(r"\[.*\]", raw_text, re.DOTALL)
    if not match:
        raise ValueError("Persona generator did not return a JSON array")

    personas = json.loads(match.group())
    # Trim to configured count
    return personas[:NUM_DEBATE_PERSONAS], tokens


def _run_debate(
    draft: str,
    personas: list[dict],
    output_language: str,
    rounds: int = DEBATE_ROUNDS,
) -> tuple[str, int]:
    """
    Run `rounds` rounds of debate. Each round: all personas critique independently.
    Round 2+: each persona sees the previous round's critiques.
    Returns (full_transcript, total_tokens).
    """
    prompt_template = (PROMPTS_DIR / "debate_round.md").read_text()
    transcript_parts: list[str] = []
    total_tokens = 0
    previous_critiques = ""

    for round_num in range(1, rounds + 1):
        round_critiques: list[str] = []

        for persona in personas:
            prompt = (
                prompt_template
                .replace("{persona_system_prompt}", persona.get("system_prompt", ""))
                .replace("{persona_name}", persona.get("name", "Unknown"))
                .replace("{draft}", draft)
                .replace("{previous_critiques}", previous_critiques)
                .replace("{output_language}", output_language)
            )

            response = llm_client.chat.completions.create(
                model=DEBATE_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=LLM_TEMPERATURE,
            )
            critique = response.choices[0].message.content.strip()
            total_tokens += response.usage.total_tokens if response.usage else 0
            round_critiques.append(critique)

        round_block = f"## Round {round_num}\n\n" + "\n\n".join(round_critiques)
        transcript_parts.append(round_block)

        # Build previous_critiques string for next round (persona name + first 400 chars)
        previous_critiques = "\n\n".join(
            f"**{persona.get('name', '?')}:** {critique[:400]}..."
            for persona, critique in zip(personas, round_critiques)
        )

    return "\n\n---\n\n".join(transcript_parts), total_tokens


def _synthesize(
    draft: str,
    transcript: str,
    output_language: str,
    source_url: str = "",
    source_name: str = "",
) -> tuple[dict, int]:
    """Synthesize debate transcript → JSON result (same shape as critic_node). Returns (result, tokens)."""
    prompt_template = (PROMPTS_DIR / "debate_synthesizer.md").read_text()
    prompt = (
        prompt_template
        .replace("{draft}", draft)
        .replace("{debate_transcript}", transcript)
        .replace("{output_language}", output_language)
        .replace("{source_url}", source_url or "unknown")
        .replace("{source_name}", source_name or "unknown")
    )

    response = llm_client.chat.completions.create(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=LLM_TEMPERATURE,
    )
    raw_text = response.choices[0].message.content.strip()
    tokens = response.usage.total_tokens if response.usage else 0

    match = re.search(r"\{.*\}", raw_text, re.DOTALL)
    if not match:
        print("[MULTI_CRITIC]  Synthesizer returned no JSON — auto-approving")
        return {"approved": True, "score": 7, "issues": [], "feedback": ""}, tokens

    result = json.loads(match.group())
    score = result.get("score", 0)
    issues = result.get("issues", [])
    corrections = result.get("specific_corrections", [])
    security_flag = result.get("security_flag", False)
    # APPROVAL_THRESHOLD in code is authoritative — the LLM's "approved" field is ignored.
    # The LLM scoring 8/10 but returning "approved: false" would otherwise block a valid draft.
    approved = score >= APPROVAL_THRESHOLD
    if security_flag:
        approved = False
    feedback = "\n".join(corrections) if corrections else "\n".join(issues)

    return {
        "approved": approved,
        "score": score,
        "issues": issues,
        "feedback": feedback,
        "security_flag": security_flag,
    }, tokens


# ─────────────────────────────────────────────────────────────────────────────
# Public node
# ─────────────────────────────────────────────────────────────────────────────

def multi_critic_node(state: PipelineState) -> dict:
    """
    Multi-persona debate critic. Drop-in replacement for critic_node.
    Returns the same keys: critique_approved, critic_feedback, total_tokens_used, messages.
    Also persists: debate_personas, debate_transcript.
    """
    draft = state["draft"]
    iteration = state.get("iteration_count", 1)
    lang_code = state.get("output_language", "en")
    output_language = OUTPUT_LANGUAGE_LABELS.get(lang_code, "English")

    total_tokens = 0

    # ── Step 1: Generate personas (once per pipeline run, then reused) ────────
    personas: list[dict] = state.get("debate_personas") or []
    if not personas:
        print(f"[MULTI_CRITIC] Generating {NUM_DEBATE_PERSONAS} context-aware personas...")
        try:
            personas, persona_tokens = _generate_personas(state)
            total_tokens += persona_tokens
            names = ", ".join(p.get("name", "?") for p in personas)
            roles = " | ".join(p.get("role", "?") for p in personas)
            print(f"[MULTI_CRITIC] Personas: {names}")
            print(f"              Roles: {roles}")
        except Exception as exc:
            print(f"[MULTI_CRITIC]  Persona generation failed ({exc}) — using fallback personas")
            personas = _FALLBACK_PERSONAS[:NUM_DEBATE_PERSONAS]
    else:
        names = ", ".join(p.get("name", "?") for p in personas)
        print(f"[MULTI_CRITIC] Reusing personas from iteration 1: {names}")

    # ── Step 2: Run debate rounds ─────────────────────────────────────────────
    print(f"[MULTI_CRITIC] Running {DEBATE_ROUNDS} debate rounds ({len(personas)} personas × {DEBATE_ROUNDS} rounds = {len(personas) * DEBATE_ROUNDS} calls)...")
    transcript = ""
    try:
        transcript, debate_tokens = _run_debate(draft, personas, output_language, rounds=DEBATE_ROUNDS)
        total_tokens += debate_tokens
        print(f"[MULTI_CRITIC] Debate complete ({debate_tokens} tokens)")
    except Exception as exc:
        print(f"[MULTI_CRITIC]  Debate failed: {exc} — synthesizing with empty transcript")

    # ── Step 3: Synthesize → same JSON shape as critic_node ──────────────────
    article = state.get("selected_article", {})
    source_url = article.get("url", "")
    source_name = article.get("source", "")

    print("[MULTI_CRITIC] Synthesizing debate transcript...")
    result = {"approved": True, "score": 7, "issues": [], "feedback": ""}
    try:
        result, synth_tokens = _synthesize(draft, transcript, output_language, source_url, source_name)
        total_tokens += synth_tokens
    except Exception as exc:
        print(f"[MULTI_CRITIC]  Synthesis failed: {exc} — auto-approving to avoid infinite loop")

    approved = result["approved"]
    score = result.get("score", 0)
    issues = result.get("issues", [])
    feedback = result.get("feedback", "")
    security_flag = result.get("security_flag", False)

    # ── Best-draft tracking ───────────────────────────────────────────────────
    best_score = state.get("best_score", 0)
    best_draft = state.get("best_draft", "") or draft
    stagnation_count = state.get("stagnation_count", 0)

    if score > best_score:
        best_score = score
        best_draft = draft
        stagnation_count = 0
    else:
        stagnation_count += 1

    # On the final iteration, if the current draft regressed, restore the best one
    final_iteration = iteration >= MAX_CRITIQUE_ITERATIONS
    if final_iteration and score < state.get("best_score", 0):
        print(f"[MULTI_CRITIC] ↩ Score regressed ({state.get('best_score')}→{score}) — reverting to best draft (score {state.get('best_score')}/10)")
        draft_to_use = best_draft
    else:
        draft_to_use = draft

    status = "APPROVED" if approved else f"NOT approved (iteration {iteration}/{MAX_CRITIQUE_ITERATIONS})"
    stagnation_note = f", stagnation×{stagnation_count}" if stagnation_count >= 1 else ""
    print(f"[MULTI_CRITIC] Score: {score}/10 — {status}{stagnation_note}")
    if security_flag:
        print(f"[MULTI_CRITIC] ⚠ SECURITY FLAG — dangerous code snippet detected, overriding approval")
    if issues:
        print(f"              Issues: {'; '.join(str(i) for i in issues[:2])}")

    msg = ACPMessage(
        sender="multi_critic",
        receiver="writer" if not approved else "formatter",
        msg_type="approve" if approved else "reject",
        content=f"Score {score}/10 — {'approved' if approved else 'rejected'} (multi-persona debate, {len(personas)} personas × {DEBATE_ROUNDS} rounds)",
        metadata={
            "score": score,
            "issues": issues,
            "iteration": iteration,
            "tokens": total_tokens,
            "personas": [p.get("name") for p in personas],
            "debate_model": DEBATE_MODEL,
            "security_flag": security_flag,
            "stagnation_count": stagnation_count,
        },
    )

    updates = {
        "debate_personas": personas,
        "debate_transcript": transcript,
        "critique_approved": approved,
        "critic_feedback": feedback,
        "security_flag": security_flag,
        "best_draft": best_draft,
        "best_score": best_score,
        "stagnation_count": stagnation_count,
        "total_tokens_used": state.get("total_tokens_used", 0) + total_tokens,
        "messages": [msg],
    }
    if draft_to_use != draft:
        updates["draft"] = draft_to_use

    return updates
