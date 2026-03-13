import re
import yaml

from state import PipelineState, ACPMessage
from config import LLM_MODEL, LLM_TEMPERATURE, INTEREST_TOPICS, PROMPTS_DIR
from llm import llm_client


def _extract_section(text: str, marker: str) -> str:
    pattern = rf"==={marker}===\s*(.*?)(?====\w+===|$)"
    match = re.search(pattern, text, re.DOTALL)
    return match.group(1).strip() if match else ""


def _build_blog_post(draft: str, run_date: str, tags: list[str], article: dict) -> str:
    """
    Construit le blog post SANS appeler le LLM.
    Ajoute juste le front matter YAML au draft validé.
    Le draft est le contenu final — ne pas le réécrire.
    """
    title = article.get("title", "Article")
    description = " ".join(draft.split()[:25]) + "..."  # 25 premiers mots comme description SEO

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
    - blog_post : front matter YAML + draft validé (PAS de réécriture LLM)
    - linkedin_post + youtube_script : générés par LLM depuis le draft
    """
    draft = state["draft"]
    run_date = state.get("run_date", "")
    article = state.get("selected_article", {})

    tags = [t for t in INTEREST_TOPICS if t.lower() in article.get("title", "").lower()][:5]
    if not tags:
        tags = INTEREST_TOPICS[:3]

    # Blog post : PAS de LLM, juste front matter + draft
    blog_post = _build_blog_post(draft, run_date, tags, article)

    # LinkedIn + YouTube : LLM avec prompt dédié
    prompt_template = (PROMPTS_DIR / "formatter_social.md").read_text()
    prompt = (prompt_template
              .replace("{draft}", draft)
              .replace("{date}", run_date)
              .replace("{tags}", ", ".join(tags)))

    linkedin_post = youtube_script = ""
    tokens_used = 0
    try:
        response = llm_client.chat.completions.create(
            model=LLM_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=LLM_TEMPERATURE,
        )
        raw = response.choices[0].message.content.strip()
        tokens_used = response.usage.total_tokens if response.usage else 0
        linkedin_post = _extract_section(raw, "LINKEDIN")
        youtube_script = _extract_section(raw, "YOUTUBE")
    except Exception as exc:
        print(f"[FORMATTER] LLM error: {exc}")

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
