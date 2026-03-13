"""
State schema partagé entre tous les agents.
ACPMessage : message structuré inter-agents (pattern Agent Communication Protocol).
PipelineState : state complet du graph LangGraph.
"""
import operator
from typing import Annotated, TypedDict
from pydantic import BaseModel


class ACPMessage(BaseModel):
    """Message structuré ACP-style entre agents."""
    sender: str
    receiver: str
    msg_type: str   # "task" | "result" | "feedback" | "approve" | "reject"
    content: str
    metadata: dict = {}


class PipelineState(TypedDict):
    # Messages inter-agents (append-only via operator.add)
    messages: Annotated[list[ACPMessage], operator.add]

    # Articles
    raw_articles: list[dict]        # {title, url, summary, source, fetched_at}
    filtered_articles: list[dict]   # raw_articles + score, reason
    selected_article: dict

    # Cycle write / critique
    draft: str
    critic_feedback: str
    iteration_count: int            # incrémenté par writer, max=MAX_CRITIQUE_ITERATIONS
    critique_approved: bool

    # Outputs finaux
    blog_post: str
    linkedin_post: str
    youtube_script: str

    # Meta
    run_id: str
    run_date: str
    total_tokens_used: int
