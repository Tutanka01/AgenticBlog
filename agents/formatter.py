import re
import yaml

from state import PipelineState, ACPMessage
from config import LLM_MODEL, LLM_TEMPERATURE, INTEREST_TOPICS, PROMPTS_DIR
from llm import llm_client


def _extract_section(text: str, marker: str) -> str:
    pattern = rf"==={marker}===\s*(.*?)(?====\w+===|$)"
    match = re.search(pattern, text, re.DOTALL)
    return match.group(1).strip() if match else ""


def _fallback_description(draft: str) -> str:
    """Extrait les premiers mots du draft en ignorant les lignes de heading Markdown."""
    for line in draft.splitlines():
        stripped = line.strip().lstrip("#").strip()
        if len(stripped) > 40:
            words = stripped.split()[:20]
            return " ".join(words) + "..."
    return draft[:120] + "..."


def _build_blog_post(draft: str, run_date: str, tags: list[str],
                     title: str, description: str) -> str:
    """Préfixe le front matter YAML au draft validé. Ne réécrit pas le contenu."""
    front_matter = {
        "title": title,
        "date": run_date,
        "tags": tags,
        "description": description[:160],
        "author": "Mohamad",
    }
    yaml_block = yaml.dump(front_matter, allow_unicode=True, default_flow_style=False).strip()
    return f"---\n{yaml_block}\n---\n\n{draft}"


def formatter_node(state: PipelineState) -> dict:
    """
    - title + description : générés par LLM (français, hook fort)
    - blog_post : front matter YAML + draft validé (PAS de réécriture LLM)
    - linkedin_post + youtube_script : générés par LLM
    """
    draft = state["draft"]
    run_date = state.get("run_date", "")
    article = state.get("selected_article", {})

    tags = [t for t in INTEREST_TOPICS if t.lower() in article.get("title", "").lower()][:5]
    if not tags:
        tags = INTEREST_TOPICS[:3]

    # Fallbacks si le LLM échoue
    title = article.get("title", "Article")
    description = _fallback_description(draft)

    linkedin_post = youtube_script = ""
    tokens_used = 0

    prompt_template = (PROMPTS_DIR / "formatter_social.md").read_text()
    prompt = (prompt_template
              .replace("{draft}", draft)
              .replace("{date}", run_date)
              .replace("{tags}", ", ".join(tags)))

    try:
        response = llm_client.chat.completions.create(
            model=LLM_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=LLM_TEMPERATURE,
        )
        raw = response.choices[0].message.content.strip()
        tokens_used = response.usage.total_tokens if response.usage else 0

        title = _extract_section(raw, "TITLE") or title
        description = _extract_section(raw, "DESCRIPTION") or description
        linkedin_post = _extract_section(raw, "LINKEDIN")
        youtube_script = _extract_section(raw, "YOUTUBE")
    except Exception as exc:
        print(f"[FORMATTER] LLM error: {exc}")

    blog_post = _build_blog_post(draft, run_date, tags, title, description)

    blog_words = len(blog_post.split())
    linkedin_chars = len(linkedin_post)
    yt_words = len(youtube_script.split())
    yt_seconds = round(yt_words / 150 * 60)
    print(f"[FORMATTER]  Blog: {blog_words} words | LinkedIn: {linkedin_chars} chars | YouTube: ~{yt_seconds}s script")

    msg = ACPMessage(
        sender="formatter",
        receiver="output_saver",
        msg_type="result",
        content=f"3 formats ready",
        metadata={"tokens": tokens_used},
    )
    return {
        "blog_post": blog_post,
        "linkedin_post": linkedin_post,
        "youtube_script": youtube_script,
        "total_tokens_used": state.get("total_tokens_used", 0) + tokens_used,
        "messages": [msg],
    }
