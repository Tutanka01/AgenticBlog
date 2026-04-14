import json
import re

from state import PipelineState, ACPMessage
from config import LLM_MODEL, LLM_TEMPERATURE, FILTER_THRESHOLD, TOP_N_FILTERED, PROMPTS_DIR, CATEGORIES, DEFAULT_CATEGORY
from llm import llm_client


def _build_articles_text(articles: list[dict]) -> str:
    lines = []
    for a in articles:
        lines.append(f"- URL: {a['url']}\n  Title: {a['title']}\n  Summary: {a['summary']}")
    return "\n".join(lines)


def filter_node(state: PipelineState) -> dict:
    """Score raw_articles via LLM → filtered_articles. Bypassed when direct_url or direct_topic is set."""
    if state.get("direct_url"):
        print("[FILTER]     Direct URL mode — skipping LLM scoring")
        msg = ACPMessage(
            sender="filter",
            receiver="selector",
            msg_type="result",
            content="Direct URL mode — filter bypassed",
            metadata={"kept": 0},
        )
        return {"filtered_articles": [], "messages": [msg]}

    if state.get("direct_topic"):
        print("[FILTER]     Direct TOPIC mode — skipping LLM scoring")
        msg = ACPMessage(
            sender="filter",
            receiver="selector",
            msg_type="result",
            content="Direct TOPIC mode — filter bypassed",
            metadata={"kept": 0},
        )
        return {"filtered_articles": [], "messages": [msg]}

    raw = state["raw_articles"]

    category = state.get("active_category", DEFAULT_CATEGORY)
    cat_config = CATEGORIES.get(category, CATEGORIES[DEFAULT_CATEGORY])
    topics = cat_config["topics"]

    prompt_template = (PROMPTS_DIR / "filter.md").read_text()
    prompt = (prompt_template
              .replace("{topics}", ", ".join(topics))
              .replace("{articles}", _build_articles_text(raw)))

    scores: list[dict] = []
    tokens_used = 0
    try:
        print(f"[FILTER]     Sending scoring request to LLM for {len(raw)} articles...")
        response = llm_client.chat.completions.create(
            model=LLM_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=LLM_TEMPERATURE,
        )
        raw_text = response.choices[0].message.content.strip()
        tokens_used = response.usage.total_tokens if response.usage else 0

        # Extract JSON array even if the model wraps it in markdown fences
        match = re.search(r"\[.*\]", raw_text, re.DOTALL)
        if match:
            scores = json.loads(match.group())
    except Exception as exc:
        print(f"[FILTER]  LLM error: {exc} — falling back to unfiltered top {TOP_N_FILTERED}")
        scores = [{"url": a["url"], "score": 5, "reason": "fallback"} for a in raw]

    # Merge scores back into article dicts
    score_map = {s["url"]: s for s in scores}
    enriched = []
    for a in raw:
        s = score_map.get(a["url"], {"score": 0, "reason": "not scored"})
        enriched.append({**a, "score": s.get("score", 0), "reason": s.get("reason", "")})

    filtered = [a for a in enriched if a["score"] >= FILTER_THRESHOLD]
    filtered.sort(key=lambda x: x["score"], reverse=True)
    filtered = filtered[:TOP_N_FILTERED]

    top = filtered[0] if filtered else {}
    print(f"[FILTER]     Scored {len(raw)} articles — kept {len(filtered)} above threshold {FILTER_THRESHOLD}")
    if top:
        print(f"             Top: \"{top['title']}\" (score: {top['score']})")

    msg = ACPMessage(
        sender="filter",
        receiver="selector",
        msg_type="result",
        content=f"Filtered to {len(filtered)} articles",
        metadata={"kept": len(filtered), "tokens": tokens_used},
    )
    return {
        "filtered_articles": filtered,
        "total_tokens_used": state.get("total_tokens_used", 0) + tokens_used,
        "messages": [msg],
    }
