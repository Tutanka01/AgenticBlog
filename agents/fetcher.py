import httpx
from bs4 import BeautifulSoup
from state import PipelineState, ACPMessage

MAX_CHARS = 8000


def _clean_html(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "aside", "header", "form", "iframe"]):
        tag.decompose()
    main = soup.find("article") or soup.find("main") or soup.find("body")
    if main:
        return " ".join(main.get_text(separator=" ").split())[:MAX_CHARS]
    return ""


def _fetch_direct(url: str) -> str:
    """Fetch direct avec headers navigateur réalistes."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
    }
    resp = httpx.get(url, headers=headers, timeout=15, follow_redirects=True)
    resp.raise_for_status()
    content = _clean_html(resp.text)
    if len(content) < 300:
        raise ValueError(f"Content too short after cleaning ({len(content)} chars) — likely blocked")
    return content


def _fetch_via_jina(url: str) -> str:
    """Jina AI Reader — proxy public qui contourne la plupart des blocages."""
    jina_url = f"https://r.jina.ai/{url}"
    headers = {"Accept": "text/plain"}
    resp = httpx.get(jina_url, headers=headers, timeout=20, follow_redirects=True)
    resp.raise_for_status()
    text = resp.text.strip()
    if len(text) < 300:
        raise ValueError("Jina returned too little content")
    return text[:MAX_CHARS]


def fetcher_node(state: PipelineState) -> dict:
    """Fetch article content via cascade : direct → Jina Reader → RSS summary fallback."""
    article = state["selected_article"]
    url = article.get("url", "")
    full_content = ""
    method_used = "none"

    # Stratégie 1 : fetch direct avec headers navigateur
    try:
        full_content = _fetch_direct(url)
        method_used = "direct"
    except Exception as e1:
        print(f"[FETCHER]    Direct fetch failed: {e1}")
        # Stratégie 2 : Jina AI Reader (proxy public gratuit, contourne la plupart des paywalls légers)
        try:
            full_content = _fetch_via_jina(url)
            method_used = "jina"
        except Exception as e2:
            print(f"[FETCHER]    Jina fetch failed: {e2}")
            # Stratégie 3 : RSS summary (dernier recours)
            full_content = article.get("summary", "")
            method_used = "rss_fallback"

    print(f"[FETCHER]    {len(full_content)} chars fetched via [{method_used}] from {url[:60]}...")

    enriched_article = {**article, "full_content": full_content, "fetch_method": method_used}
    msg = ACPMessage(
        sender="fetcher",
        receiver="writer",
        msg_type="result",
        content=f"Article fetched: {len(full_content)} chars via {method_used}",
        metadata={"url": url, "chars": len(full_content), "method": method_used},
    )
    return {"selected_article": enriched_article, "messages": [msg]}
