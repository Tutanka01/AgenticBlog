import time
import feedparser
from datetime import datetime, timezone

from state import PipelineState, ACPMessage
from config import MAX_ARTICLES_TO_FETCH, CATEGORIES, DEFAULT_CATEGORY


def scraper_node(state: PipelineState) -> dict:
    """Fetch RSS feeds → raw_articles list. Bypassed when direct_url or direct_topic is set."""
    if state.get("direct_url"):
        url = state["direct_url"]
        print(f"[SCRAPER]    Direct URL mode — skipping RSS scrape ({url[:60]}...)")
        msg = ACPMessage(
            sender="scraper",
            receiver="filter",
            msg_type="result",
            content="Direct URL mode — scraper bypassed",
            metadata={"direct_url": url},
        )
        return {"raw_articles": [], "messages": [msg]}

    if state.get("direct_topic"):
        topic = state["direct_topic"]
        print(f"[SCRAPER]    Direct TOPIC mode — skipping RSS scrape (topic: '{topic[:60]}')")
        msg = ACPMessage(
            sender="scraper",
            receiver="filter",
            msg_type="result",
            content=f"Direct TOPIC mode — scraper bypassed (topic: '{topic}')",
            metadata={"direct_topic": topic},
        )
        return {"raw_articles": [], "messages": [msg]}

    start = time.time()

    category = state.get("active_category", DEFAULT_CATEGORY)
    cat_config = CATEGORIES.get(category, CATEGORIES[DEFAULT_CATEGORY])
    feeds_to_use = cat_config["feeds"]

    articles = []

    for feed_url in feeds_to_use:
        if len(articles) >= MAX_ARTICLES_TO_FETCH:
            break
        try:
            feed = feedparser.parse(feed_url)
            source = feed.feed.get("title", feed_url)
            for entry in feed.entries:
                if len(articles) >= MAX_ARTICLES_TO_FETCH:
                    break
                articles.append({
                    "title": entry.get("title", ""),
                    "url": entry.get("link", ""),
                    "summary": entry.get("summary", entry.get("description", ""))[:500],
                    "source": source,
                    "published": entry.get("published", ""),
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                })
        except Exception as exc:
            print(f"[SCRAPER] Feed error ({feed_url}): {exc}")

    elapsed = round(time.time() - start, 1)
    print(f"[SCRAPER]    Fetched {len(articles)} articles ({len(feeds_to_use)} feeds, {elapsed}s)")

    msg = ACPMessage(
        sender="scraper",
        receiver="filter",
        msg_type="result",
        content=f"Fetched {len(articles)} articles",
        metadata={"count": len(articles), "elapsed_s": elapsed},
    )
    return {"raw_articles": articles, "messages": [msg]}
