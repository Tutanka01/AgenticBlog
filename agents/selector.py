from datetime import datetime, timezone

from state import PipelineState, ACPMessage
from memory_manager import load_memory_index, get_novelty_penalty, build_writer_context


def _freshness_bonus(article: dict) -> float:
    """Returns a 0-1 bonus based on article age (more recent = higher bonus)."""
    fetched = article.get("fetched_at", "")
    published = article.get("published", fetched)
    try:
        if isinstance(published, str) and published:
            dt = datetime.fromisoformat(published.replace("Z", "+00:00"))
        else:
            dt = datetime.now(timezone.utc)
        age_hours = (datetime.now(timezone.utc) - dt).total_seconds() / 3600
        # Max bonus if < 24h, decays to 0 at 168h (1 week)
        return max(0.0, 1.0 - age_hours / 168)
    except Exception:
        return 0.0


def selector_node(state: PipelineState) -> dict:
    """Pick top article by composite score (LLM score + freshness bonus) → selected_article."""
    filtered = state["filtered_articles"]

    recent_runs = load_memory_index()

    if not filtered:
        selected = state["raw_articles"][0] if state["raw_articles"] else {}
        print("[SELECTOR]   No article passed filter — using first raw article as fallback")
        memory_context = ""
    else:
        # Composite score: LLM score (0-10) + freshness bonus (0-1) - novelty penalty (0-2)
        def _composite(a: dict) -> float:
            penalty = get_novelty_penalty(a, recent_runs)
            return a["score"] + _freshness_bonus(a) - penalty

        ranked = sorted(filtered, key=_composite, reverse=True)
        selected = ranked[0]
        bonus = round(_freshness_bonus(selected), 2)
        penalty = round(get_novelty_penalty(selected, recent_runs), 2)
        print(f"[SELECTOR]   Selected: \"{selected['title']}\"")
        print(f"             Score: {selected['score']}/10 + freshness: {bonus} - novelty penalty: {penalty}")
        if recent_runs:
            print(f"             Memory: {len(recent_runs)} runs loaded")

        memory_context = build_writer_context(selected, recent_runs)

    msg = ACPMessage(
        sender="selector",
        receiver="fetcher",
        msg_type="task",
        content=f"Write article about: {selected.get('title', '')}",
        metadata={"url": selected.get("url", ""), "score": selected.get("score", 0)},
    )
    return {"selected_article": selected, "memory_context": memory_context, "messages": [msg]}
