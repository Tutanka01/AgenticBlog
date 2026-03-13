from state import PipelineState, ACPMessage


def selector_node(state: PipelineState) -> dict:
    """Pick the top-scored article from filtered_articles → selected_article."""
    filtered = state["filtered_articles"]

    if not filtered:
        # Fallback : prendre le premier article brut si aucun n'a passé le filtre
        selected = state["raw_articles"][0] if state["raw_articles"] else {}
        print("[SELECTOR]   No article passed filter — using first raw article as fallback")
    else:
        selected = filtered[0]   # déjà trié par score décroissant dans filter_node
        print(f"[SELECTOR]   Selected: \"{selected['title']}\" ({selected.get('source', '?')}, score: {selected.get('score', '?')})")

    msg = ACPMessage(
        sender="selector",
        receiver="writer",
        msg_type="task",
        content=f"Write article about: {selected.get('title', '')}",
        metadata={"url": selected.get("url", ""), "score": selected.get("score", 0)},
    )
    return {"selected_article": selected, "messages": [msg]}
