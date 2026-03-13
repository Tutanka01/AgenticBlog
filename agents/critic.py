import json
import re

from state import PipelineState, ACPMessage
from config import LLM_MODEL, LLM_TEMPERATURE, PROMPTS_DIR
from llm import llm_client

APPROVAL_THRESHOLD = 7


def critic_node(state: PipelineState) -> dict:
    """Review draft → critic_feedback + critique_approved."""
    draft = state["draft"]
    iteration = state.get("iteration_count", 1)

    article = state.get("selected_article", {})
    source_url = article.get("url", "source inconnue")
    source_name = article.get("source", "source inconnue")

    prompt_template = (PROMPTS_DIR / "critic.md").read_text()
    prompt = (prompt_template
              .replace("{draft}", draft)
              .replace("{source_url}", source_url)
              .replace("{source_name}", source_name))

    approved = False
    feedback = ""
    score = 0
    issues: list[str] = []
    tokens_used = 0

    try:
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
            approved = result.get("approved", score >= APPROVAL_THRESHOLD)
            feedback = "\n".join(corrections) if corrections else "\n".join(issues)
        else:
            # Si le LLM ne respecte pas le format JSON, on approuve par défaut pour ne pas boucler
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
