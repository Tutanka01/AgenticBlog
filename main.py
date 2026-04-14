"""
Pipeline entry point.
Usage: python main.py [--resume <run_id>] [--list] [--category <cat>] [--lang <lang>]
"""
import time
import uuid
import argparse
from datetime import date
from pathlib import Path

from graph import graph
from config import CHECKPOINT_DB, CATEGORIES, DEFAULT_CATEGORY, OUTPUT_LANGUAGE_LABELS, DEFAULT_OUTPUT_LANGUAGE


def list_recent_runs() -> list[str]:
    """Return distinct thread_ids from the SQLite checkpoint DB."""
    import sqlite3
    db = Path(CHECKPOINT_DB)
    if not db.exists():
        return []
    try:
        con = sqlite3.connect(str(db))
        cur = con.execute(
            "SELECT DISTINCT thread_id FROM checkpoints ORDER BY thread_ts DESC LIMIT 5"
        )
        ids = [row[0] for row in cur.fetchall()]
        con.close()
        return ids
    except Exception:
        return []


def run_pipeline(run_id: str | None = None, category: str = DEFAULT_CATEGORY, lang: str = DEFAULT_OUTPUT_LANGUAGE, url: str | None = None, topic: str | None = None) -> None:
    """Execute or resume the pipeline."""
    start = time.time()

    if run_id is None:
        run_id = str(uuid.uuid4())
        print(f"\nStarting new run — id: {run_id}\n")
    else:
        print(f"\nResuming run — id: {run_id}\n")

    cat_config = CATEGORIES.get(category, CATEGORIES[DEFAULT_CATEGORY])
    lang_label = OUTPUT_LANGUAGE_LABELS.get(lang, lang)
    if topic:
        mode_label = f" | Topic: {topic}"
    elif url:
        mode_label = f" | URL: {url}"
    else:
        mode_label = ""
    print(f"Category: [{cat_config['label']}] | Language: [{lang_label}]{mode_label}\n")

    run_date = date.today().isoformat()
    Path("memory").mkdir(exist_ok=True)

    initial_state = {
        "messages": [],
        "raw_articles": [],
        "filtered_articles": [],
        "selected_article": {},
        "draft": "",
        "critic_feedback": "",
        "iteration_count": 0,
        "critique_approved": False,
        "blog_post": "",
        "linkedin_post": "",
        "youtube_script": "",
        "run_id": run_id,
        "run_date": run_date,
        "total_tokens_used": 0,
        "active_category": category,
        "output_language": lang,
    }

    if url:
        initial_state["direct_url"] = url

    if topic:
        initial_state["direct_topic"] = topic

    config = {"configurable": {"thread_id": run_id}}

    # stream_mode="values" gives the full state after each node
    for step in graph.stream(initial_state, config=config, stream_mode="values"):
        pass   # progress is printed inside each node

    elapsed = round(time.time() - start, 1)
    print(f"\nDone in {elapsed}s")


def main() -> None:
    parser = argparse.ArgumentParser(description="AgenticBlog content pipeline")
    parser.add_argument("--resume", metavar="RUN_ID", help="Resume a previous run by its ID")
    parser.add_argument("--list", action="store_true", help="List recent run IDs")
    parser.add_argument(
        "--category", "-c",
        choices=list(CATEGORIES.keys()),
        default=DEFAULT_CATEGORY,
        help=f"Content category (default: {DEFAULT_CATEGORY}). Choices: {', '.join(CATEGORIES.keys())}"
    )
    parser.add_argument(
        "--lang", "-l",
        choices=list(OUTPUT_LANGUAGE_LABELS.keys()),
        default=DEFAULT_OUTPUT_LANGUAGE,
        help=f"Output language for generated content (default: {DEFAULT_OUTPUT_LANGUAGE}). Choices: {', '.join(OUTPUT_LANGUAGE_LABELS.keys())}"
    )
    parser.add_argument(
        "--url", "-u",
        metavar="URL",
        help="Run the pipeline directly on a specific URL (bypasses scraper/filter/selector)"
    )
    parser.add_argument(
        "--topic", "-t",
        metavar="TOPIC",
        help="Generate an article on a freeform topic (bypasses scraper/filter/selector/fetcher)"
    )
    args = parser.parse_args()

    if args.list:
        runs = list_recent_runs()
        if runs:
            print("Recent runs:")
            for r in runs:
                print(f"  {r}")
        else:
            print("No previous runs found.")
        return

    if args.resume:
        run_pipeline(run_id=args.resume, category=args.category, lang=args.lang, url=args.url)
        return

    # --url and --topic bypass the resume prompt
    if args.url:
        run_pipeline(category=args.category, lang=args.lang, url=args.url)
        return

    if args.topic:
        run_pipeline(category=args.category, lang=args.lang, topic=args.topic)
        return

    # Auto-detect last run and offer to resume
    recent = list_recent_runs()
    if recent:
        last = recent[0]
        answer = input(f"Last run found: {last}\nResume it? [y/N] ").strip().lower()
        if answer == "y":
            run_pipeline(run_id=last, category=args.category, lang=args.lang)
            return

    run_pipeline(category=args.category, lang=args.lang)


if __name__ == "__main__":
    main()
