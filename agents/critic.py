import json
import re

from state import PipelineState, ACPMessage
from config import LLM_MODEL, LLM_TEMPERATURE, PROMPTS_DIR, OUTPUT_LANGUAGE_LABELS
from llm import llm_client

APPROVAL_THRESHOLD = 7


def critic_node(state: PipelineState) -> dict:
    """Review draft → critic_feedback + critique_approved."""
    draft = state["draft"]
    iteration = state.get("iteration_count", 1)

    article = state.get("selected_article", {})
    source_url = article.get("url", "unknown source")
    source_name = article.get("source", "unknown source")

    lang_code = state.get("output_language", "en")
    output_language = OUTPUT_LANGUAGE_LABELS.get(lang_code, "English")

    prompt_template = (PROMPTS_DIR / "critic.md").read_text()
    prompt = (prompt_template
              .replace("{draft}", draft)
              .replace("{source_url}", source_url)
              .replace("{source_name}", source_name)
              .replace("{output_language}", output_language))

    approved = False
    feedback = ""
    score = 0
    issues: list[str] = []
    seo_issues: list[str] = []
    tokens_used = 0

    try:
        print(f"[CRITIC]     Evaluating draft v{iteration}...")
        response = llm_client.chat.completions.create(
            model=LLM_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=LLM_TEMPERATURE,
        )
        raw_text = response.choices[0].message.content.strip()
        tokens_used = response.usage.total_tokens if response.usage else 0

        # Extract JSON object even if wrapped in markdown fences
        match = re.search(r"\{.*\}", raw_text, re.DOTALL)
        if match:
            result = json.loads(match.group())
            score = result.get("score", 0)
            issues = result.get("issues", [])
            corrections = result.get("specific_corrections", [])
            seo_issues = result.get("seo_issues", [])
            approved = result.get("approved", score >= APPROVAL_THRESHOLD)
            all_feedback = corrections if corrections else issues
            if seo_issues:
                all_feedback = all_feedback + [f"[SEO] {s}" for s in seo_issues]
            feedback = "\n".join(all_feedback)
        else:
            # If the LLM does not return valid JSON, auto-approve to avoid looping
            print("[CRITIC]  Could not parse JSON response — auto-approving")
            approved = True

    except Exception as exc:
        print(f"[CRITIC]  LLM error: {exc} — auto-approving to avoid infinite loop")
        approved = True

    max_iter = state.get("iteration_count", 1)
    status = "APPROVED" if approved else f"NOT approved (iteration {iteration}/3)"
    print(f"[CRITIC]     Score: {score}/10 — {status}")
    if issues:
        print(f"             Issues: {'; '.join(issues[:2])}")
    if seo_issues:
        print(f"             SEO: {'; '.join(seo_issues[:2])}")

    msg = ACPMessage(
        sender="critic",
        receiver="writer" if not approved else "formatter",
        msg_type="approve" if approved else "reject",
        content=f"Score {score}/10 — {'approved' if approved else 'rejected'}",
        metadata={"score": score, "issues": issues, "iteration": max_iter, "tokens": tokens_used},
    )
    return {
        "critique_approved": approved,
        "critic_feedback": feedback,
        "total_tokens_used": state.get("total_tokens_used", 0) + tokens_used,
        "messages": [msg],
    }
