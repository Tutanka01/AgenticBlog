"""
Shared state schema for all agents.
ACPMessage: structured inter-agent message (Agent Communication Protocol pattern).
PipelineState: full graph state for LangGraph.
"""
import operator
from typing import Annotated, NotRequired, TypedDict
from pydantic import BaseModel


class ACPMessage(BaseModel):
    """Structured ACP-style inter-agent message."""
    sender: str
    receiver: str
    msg_type: str   # "task" | "result" | "feedback" | "approve" | "reject"
    content: str
    metadata: dict = {}


class PipelineState(TypedDict):
    # Inter-agent messages (append-only via operator.add)
    messages: Annotated[list[ACPMessage], operator.add]

    # Articles
    raw_articles: list[dict]        # {title, url, summary, source, fetched_at}
    filtered_articles: list[dict]   # raw_articles + score, reason
    selected_article: dict

    # Write / critique cycle
    draft: str
    critic_feedback: str
    iteration_count: int            # incremented by writer, max=MAX_CRITIQUE_ITERATIONS
    critique_approved: bool

    # Final outputs
    blog_post: str
    linkedin_post: str
    youtube_script: str

    # Editorial memory
    memory_context: str    # Context from past articles, injected into writer

    # Multi-persona debate (multi_critic_node)
    debate_personas: NotRequired[list]   # generated once per run, reused across iterations
    debate_transcript: NotRequired[str]  # last full debate text (writer context + memory)
    security_flag: NotRequired[bool]     # True if a code snippet was flagged as dangerous

    # Iteration quality tracking
    best_draft: NotRequired[str]         # highest-scoring draft seen so far
    best_score: NotRequired[int]         # score of best_draft
    stagnation_count: NotRequired[int]   # consecutive iterations with no score improvement

    # Meta
    run_id: str
    run_date: str
    total_tokens_used: int
    active_category: str   # active category for this run ("security", "infra", "ai", etc.)
    output_language: str   # "fr" | "en" | "ar" — controls generated content language
