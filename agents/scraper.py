import time
import feedparser
from datetime import datetime, timezone

from state import PipelineState, ACPMessage
from config import RSS_FEEDS, MAX_ARTICLES_TO_FETCH


def scraper_node(state: PipelineState) -> dict:
    """Fetch RSS feeds → raw_articles list."""
    start = time.time()
    articles = []

    for feed_url in RSS_FEEDS:
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
    print(f"[SCRAPER]    Fetched {len(articles)} articles ({len(RSS_FEEDS)} feeds, {elapsed}s)")

    msg = ACPMessage(
        sender="scraper",
        receiver="filter",
        msg_type="result",
        content=f"Fetched {len(articles)} articles",
        metadata={"count": len(articles), "elapsed_s": elapsed},
    )
    return {"raw_articles": articles, "messages": [msg]}
