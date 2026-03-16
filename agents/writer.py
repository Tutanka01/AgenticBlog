import re

from state import PipelineState, ACPMessage
from config import LLM_MODEL, WRITING_STYLE, PROMPTS_DIR, OUTPUT_LANGUAGE_LABELS
from llm import llm_client

WRITER_TEMPERATURE = 0.7
MIN_WORDS = 800


def _count_words(text: str) -> int:
    return len(text.split())


def writer_node(state: PipelineState) -> dict:
    """Draft or revise article based on critic feedback → draft."""
    article = state["selected_article"]
    feedback = state.get("critic_feedback", "")
    iteration = state.get("iteration_count", 0) + 1

    # On revision iterations, enrich feedback with the debate panel's Round 1 context.
    # The writer only receives the synthesized corrections (2-3 bullets) — without
    # the personas' actual arguments, it can't understand *why* or *how deep* to go.
    debate_transcript = state.get("debate_transcript", "")
    stagnation_count = state.get("stagnation_count", 0)

    if feedback and debate_transcript and iteration > 1:
        round1_match = re.search(
            r"## Round 1\n\n(.*?)(?:\n\n---\n\n## Round 2|\Z)",
            debate_transcript,
            re.DOTALL,
        )
        if round1_match:
            round1_text = round1_match.group(1)
            # Split by persona section (### headers), keep max 6 lines per persona
            sections = re.split(r"\n(?=### )", round1_text)
            excerpts = []
            for section in sections[:3]:
                lines = [l for l in section.strip().splitlines() if l.strip()]
                excerpt = "\n".join(lines[:7])  # heading + up to 6 bullets
                excerpts.append(excerpt[:450])
            if excerpts:
                panel_context = "\n\n".join(excerpts)
                feedback = (
                    f"{feedback}\n\n"
                    f"**Arguments détaillés du panel d'experts (Round 1) :**\n\n"
                    f"{panel_context}"
                )

    # When the score hasn't improved across ≥2 consecutive iterations, switch strategy:
    # stop guessing at technical corrections and focus on what the LLM can reliably fix.
    if stagnation_count >= 1 and feedback and iteration > 1:
        feedback = (
            f"{feedback}\n\n"
            f"**⚠ STAGNATION DETECTED — Strategy change required (iteration {iteration}):**\n"
            f"The previous revision did not improve the score. Do NOT attempt to rewrite technical "
            f"claims you cannot verify from the source article. Instead:\n"
            f"1. Anchor all technical assertions directly to what the source article states — "
            f"use formulations like 'selon l'article source' / 'as the upstream documentation notes' "
            f"rather than asserting your own understanding.\n"
            f"2. If a technical detail was flagged as potentially incorrect and you cannot verify it "
            f"from the source, add: `> ⚠ This behavior may vary by version — consult official docs before applying.`\n"
            f"3. Focus your revision on tone, hook quality, and structure — these can be improved "
            f"without risking new factual errors.\n"
            f"4. Do NOT invent examples or commands not present in the source article."
        )

    lang_code = state.get("output_language", "en")
    output_language = OUTPUT_LANGUAGE_LABELS.get(lang_code, "English")

    prompt_template = (PROMPTS_DIR / "writer.md").read_text()
    article_text = (
        f"Title: {article.get('title', '')}\n"
        f"URL: {article.get('url', '')}\n"
        f"Full content:\n{article.get('full_content') or article.get('summary', '')}"
    )
    memory_ctx = state.get("memory_context", "")
    prompt = (prompt_template
              .replace("{article}", article_text)
              .replace("{feedback}", feedback if feedback else "No feedback — first draft.")
              .replace("{memory_context}", memory_ctx if memory_ctx else "No previous articles on this topic.")
              .replace("{output_language}", output_language))

    draft = ""
    tokens_used = 0
    try:
        print(f"[WRITER]     Generating draft v{iteration}...")
        response = llm_client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": WRITING_STYLE},
                {"role": "user", "content": prompt},
            ],
            temperature=WRITER_TEMPERATURE,
        )
        draft = response.choices[0].message.content.strip()
        tokens_used = response.usage.total_tokens if response.usage else 0
    except Exception as exc:
        print(f"[WRITER]  LLM error: {exc}")
        draft = f"# {article.get('title', 'Article')}\n\n[Generation error]"

    word_count = _count_words(draft)

    # Auto-retry if too short, only on first draft
    if word_count < MIN_WORDS and iteration == 1:
        retry_prompt = (
            f"{prompt}\n\n"
            f"WARNING: Your previous response was {word_count} words. "
            f"That is too short. Expand each section to reach a minimum of {MIN_WORDS} words. "
            f"Add concrete examples, real commands, and use cases."
        )
        try:
            print(f"[WRITER]     Draft too short ({word_count} words), retrying...")
            response2 = llm_client.chat.completions.create(
                model=LLM_MODEL,
                messages=[
                    {"role": "system", "content": WRITING_STYLE},
                    {"role": "user", "content": retry_prompt},
                ],
                temperature=WRITER_TEMPERATURE,
            )
            draft2 = response2.choices[0].message.content.strip()
            tokens_used += response2.usage.total_tokens if response2.usage else 0
            if _count_words(draft2) > word_count:
                draft = draft2
                word_count = _count_words(draft)
                print(f"[WRITER]     Retry — extended to {word_count} words")
        except Exception:
            pass  # Keep original draft if retry fails

    print(f"[WRITER]     Draft v{iteration} — {word_count} words")

    msg = ACPMessage(
        sender="writer",
        receiver="critic",
        msg_type="result",
        content=f"Draft v{iteration} ready ({word_count} words)",
        metadata={"iteration": iteration, "words": word_count, "tokens": tokens_used},
    )
    return {
        "draft": draft,
        "iteration_count": iteration,
        "total_tokens_used": state.get("total_tokens_used", 0) + tokens_used,
        "messages": [msg],
    }
