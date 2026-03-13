import httpx
from bs4 import BeautifulSoup

from state import PipelineState, ACPMessage

MAX_CHARS = 8000  # contexte raisonnable pour un LLM 7B


def fetcher_node(state: PipelineState) -> dict:
    """Fetch le HTML de l'article sélectionné → enrichit selected_article avec 'full_content'."""
    article = state["selected_article"]
    url = article.get("url", "")
    full_content = ""

    try:
        headers = {"User-Agent": "Mozilla/5.0 (compatible; AgenticBlog/1.0)"}
        resp = httpx.get(url, headers=headers, timeout=15, follow_redirects=True)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        # Supprimer nav, footer, scripts, ads
        for tag in soup(["script", "style", "nav", "footer", "aside", "header", "form"]):
            tag.decompose()

        # Extraire le texte principal
        main = soup.find("article") or soup.find("main") or soup.find("body")
        if main:
            full_content = " ".join(main.get_text(separator=" ").split())[:MAX_CHARS]

        print(f"[FETCHER]    Fetched {len(full_content)} chars from {url[:60]}...")
    except Exception as exc:
        # Fallback propre : on garde le summary RSS, on ne bloque pas le pipeline
        full_content = article.get("summary", "")
        print(f"[FETCHER]    Fetch failed ({exc}) — using RSS summary as fallback")

    enriched_article = {**article, "full_content": full_content}

    msg = ACPMessage(
        sender="fetcher",
        receiver="writer",
        msg_type="result",
        content=f"Article fetched: {len(full_content)} chars",
        metadata={"url": url, "chars": len(full_content)},
    )
    return {"selected_article": enriched_article, "messages": [msg]}
