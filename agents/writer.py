from state import PipelineState, ACPMessage
from config import LLM_MODEL, WRITING_STYLE, PROMPTS_DIR
from llm import llm_client

WRITER_TEMPERATURE = 0.7
MIN_WORDS = 800


def _count_words(text: str) -> int:
    return len(text.split())


def writer_node(state: PipelineState) -> dict:
    """Draft or revise article based on critic feedback → draft."""
    article = state["selected_article"]
    feedback = state.get("critic_feedback", "")
    iteration = state.get("iteration_count", 0) + 1

    prompt_template = (PROMPTS_DIR / "writer.md").read_text()
    article_text = (
        f"Titre : {article.get('title', '')}\n"
        f"URL : {article.get('url', '')}\n"
        f"Contenu complet :\n{article.get('full_content') or article.get('summary', '')}"
    )
    prompt = (prompt_template
              .replace("{article}", article_text)
              .replace("{feedback}", feedback if feedback else "Aucun feedback — premier brouillon."))

    draft = ""
    tokens_used = 0
    try:
        response = llm_client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": WRITING_STYLE},
                {"role": "user", "content": prompt},
            ],
            temperature=WRITER_TEMPERATURE,
        )
        draft = response.choices[0].message.content.strip()
        tokens_used = response.usage.total_tokens if response.usage else 0
    except Exception as exc:
        print(f"[WRITER]  LLM error: {exc}")
        draft = f"# {article.get('title', 'Article')}\n\n[Erreur de génération]"

    word_count = _count_words(draft)

    # Retry automatique si trop court, uniquement au premier brouillon
    if word_count < MIN_WORDS and iteration == 1:
        retry_prompt = (
            f"{prompt}\n\n"
            f"ATTENTION : Ta réponse précédente faisait {word_count} mots. "
            f"C'est insuffisant. Développe chaque section pour atteindre minimum {MIN_WORDS} mots. "
            f"Ajoute des exemples concrets, des commandes réelles, des cas d'usage."
        )
        try:
            response2 = llm_client.chat.completions.create(
                model=LLM_MODEL,
                messages=[
                    {"role": "system", "content": WRITING_STYLE},
                    {"role": "user", "content": retry_prompt},
                ],
                temperature=WRITER_TEMPERATURE,
            )
            draft2 = response2.choices[0].message.content.strip()
            tokens_used += response2.usage.total_tokens if response2.usage else 0
            if _count_words(draft2) > word_count:
                draft = draft2
                word_count = _count_words(draft)
                print(f"[WRITER]     Retry — extended to {word_count} words")
        except Exception:
            pass  # On garde le draft original si le retry échoue

    print(f"[WRITER]     Draft v{iteration} — {word_count} words")

    msg = ACPMessage(
        sender="writer",
        receiver="critic",
        msg_type="result",
        content=f"Draft v{iteration} ready ({word_count} words)",
        metadata={"iteration": iteration, "words": word_count, "tokens": tokens_used},
    )
    return {
        "draft": draft,
        "iteration_count": iteration,
        "total_tokens_used": state.get("total_tokens_used", 0) + tokens_used,
        "messages": [msg],
    }
