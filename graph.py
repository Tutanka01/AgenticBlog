"""
StateGraph du pipeline de contenu.
Routing : scraper → filter → selector → fetcher → writer ↔ critic (max 3 iter) → formatter → output_saver
"""
import sqlite3
from pathlib import Path
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.sqlite import SqliteSaver

from state import PipelineState
from config import CHECKPOINT_DB
from agents.scraper import scraper_node
from agents.filter import filter_node
from agents.selector import selector_node
from agents.fetcher import fetcher_node
from agents.writer import writer_node
from agents.critic import critic_node
from agents.formatter import formatter_node
from agents.output_saver import output_saver_node


def should_continue_writing(state: PipelineState) -> str:
    """Conditional edge après critic_node : reboucle sur writer ou passe au formatter."""
    if state["critique_approved"]:
        return "formatter"
    if state["iteration_count"] >= 3:
        return "formatter"   # Force exit après MAX_CRITIQUE_ITERATIONS
    return "writer"


def build_graph():
    builder = StateGraph(PipelineState)

    builder.add_node("scraper", scraper_node)
    builder.add_node("filter", filter_node)
    builder.add_node("selector", selector_node)
    builder.add_node("fetcher", fetcher_node)
    builder.add_node("writer", writer_node)
    builder.add_node("critic", critic_node)
    builder.add_node("formatter", formatter_node)
    builder.add_node("output_saver", output_saver_node)

    builder.set_entry_point("scraper")
    builder.add_edge("scraper", "filter")
    builder.add_edge("filter", "selector")
    builder.add_edge("selector", "fetcher")
    builder.add_edge("fetcher", "writer")
    builder.add_edge("writer", "critic")
    builder.add_conditional_edges("critic", should_continue_writing, {
        "writer": "writer",
        "formatter": "formatter",
    })
    builder.add_edge("formatter", "output_saver")
    builder.add_edge("output_saver", END)

    Path(CHECKPOINT_DB).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(CHECKPOINT_DB, check_same_thread=False)
    checkpointer = SqliteSaver(conn)
    return builder.compile(checkpointer=checkpointer)


graph = build_graph()
