import re

from state import PipelineState, ACPMessage
from config import LLM_MODEL, LLM_TEMPERATURE, INTEREST_TOPICS, PROMPTS_DIR
from llm import llm_client


def _extract_section(text: str, marker: str) -> str:
    """Extract content between ===MARKER=== and the next ===...=== or end of string."""
    pattern = rf"==={marker}===\s*(.*?)(?====\w+===|$)"
    match = re.search(pattern, text, re.DOTALL)
    return match.group(1).strip() if match else ""


def _estimate_script_duration(script: str) -> str:
    """Rough estimate: ~150 words/min for spoken delivery."""
    words = len(script.split())
    seconds = round(words / 150 * 60)
    return f"{seconds}s"


def formatter_node(state: PipelineState) -> dict:
    """Format approved draft → blog_post, linkedin_post, youtube_script."""
    draft = state["draft"]
    run_date = state.get("run_date", "")
    article = state.get("selected_article", {})

    # Build tags from article title keywords intersected with INTEREST_TOPICS
    tags = [t for t in INTEREST_TOPICS if t.lower() in article.get("title", "").lower()][:5]
    if not tags:
        tags = INTEREST_TOPICS[:3]

    prompt_template = (PROMPTS_DIR / "formatter.md").read_text()
    prompt = prompt_template.format(
        draft=draft,
        date=run_date,
        tags=", ".join(tags),
    )

    blog_post = linkedin_post = youtube_script = ""
    tokens_used = 0
    try:
        response = llm_client.chat.completions.create(
            model=LLM_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=LLM_TEMPERATURE,
        )
        raw = response.choices[0].message.content.strip()
        tokens_used = response.usage.total_tokens if response.usage else 0

        blog_post = _extract_section(raw, "BLOG")
        linkedin_post = _extract_section(raw, "LINKEDIN")
        youtube_script = _extract_section(raw, "YOUTUBE")

        # Fallback: if sections not found, use draft as blog
        if not blog_post:
            blog_post = draft
    except Exception as exc:
        print(f"[FORMATTER] LLM error: {exc} — using draft as blog fallback")
        blog_post = draft

    blog_words = len(blog_post.split())
    linkedin_chars = len(linkedin_post)
    yt_duration = _estimate_script_duration(youtube_script)
    print(f"[FORMATTER]  Blog: {blog_words} words | LinkedIn: {linkedin_chars} chars | YouTube: {yt_duration} script")

    msg = ACPMessage(
        sender="formatter",
        receiver="output_saver",
        msg_type="result",
        content=f"3 formats ready (blog {blog_words}w, linkedin {linkedin_chars}c, yt ~{yt_duration})",
        metadata={"tokens": tokens_used},
    )
    return {
        "blog_post": blog_post,
        "linkedin_post": linkedin_post,
        "youtube_script": youtube_script,
        "total_tokens_used": state.get("total_tokens_used", 0) + tokens_used,
        "messages": [msg],
    }
