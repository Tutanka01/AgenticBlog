from datetime import datetime, timezone

from state import PipelineState, ACPMessage


def _freshness_bonus(article: dict) -> float:
    """Retourne un bonus 0-1 selon l'âge de l'article (plus récent = plus haut)."""
    fetched = article.get("fetched_at", "")
    published = article.get("published", fetched)
    try:
        if isinstance(published, str) and published:
            dt = datetime.fromisoformat(published.replace("Z", "+00:00"))
        else:
            dt = datetime.now(timezone.utc)
        age_hours = (datetime.now(timezone.utc) - dt).total_seconds() / 3600
        # Bonus max si < 24h, décroit jusqu'à 0 à 168h (1 semaine)
        return max(0.0, 1.0 - age_hours / 168)
    except Exception:
        return 0.0


def selector_node(state: PipelineState) -> dict:
    """Pick top article by composite score (LLM score + freshness bonus) → selected_article."""
    filtered = state["filtered_articles"]

    if not filtered:
        selected = state["raw_articles"][0] if state["raw_articles"] else {}
        print("[SELECTOR]   No article passed filter — using first raw article as fallback")
    else:
        # Score composite : score LLM (0-10) + bonus fraîcheur (0-1)
        ranked = sorted(
            filtered,
            key=lambda a: a["score"] + _freshness_bonus(a),
            reverse=True,
        )
        selected = ranked[0]
        bonus = round(_freshness_bonus(selected), 2)
        print(f"[SELECTOR]   Selected: \"{selected['title']}\"")
        print(f"             Score: {selected['score']}/10 + freshness bonus: {bonus}")

    msg = ACPMessage(
        sender="selector",
        receiver="fetcher",
        msg_type="task",
        content=f"Write article about: {selected.get('title', '')}",
        metadata={"url": selected.get("url", ""), "score": selected.get("score", 0)},
    )
    return {"selected_article": selected, "messages": [msg]}
