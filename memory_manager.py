"""
Agentic Memory — Markdown-First pattern.
Zéro dépendance externe : lecture/écriture de fichiers Markdown structurés.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone, timedelta
from pathlib import Path

MEMORY_DIR = Path("memory")
MEMORY_INDEX = MEMORY_DIR / "MEMORY.md"
TOPICS_DIR = MEMORY_DIR / "topics"
ARCHIVE_DIR = MEMORY_DIR / "archive"
LESSONS_DIR = MEMORY_DIR / "lessons"
MAX_INDEX_ENTRIES = 60
NOVELTY_WINDOW_DAYS = 14
LESSON_DECAY_FACTOR = 0.85    # par run dans la même catégorie
LESSON_PURGE_THRESHOLD = 0.1  # purge si poids < 0.1 (≈ 17 runs)
MAX_LESSONS_INJECTED = 5      # injectées dans le writer

# ─────────────────────────────────────────────────────────────────────────────
# Helpers internes
# ─────────────────────────────────────────────────────────────────────────────

def _keywords_from_category(category: str, title: str, content: str) -> list[str]:
    """
    Source primaire de mots-clés : filtre les topics de la catégorie
    par présence dans le titre ou le contenu de l'article.
    Utilise les topics de config.CATEGORIES — déjà curatés, techniques, en anglais.
    """
    from config import CATEGORIES
    topics: list[str] = CATEGORIES.get(category, {}).get("topics", [])
    text_lower = (title + " " + content[:3000]).lower()

    found: list[str] = []
    seen: set[str] = set()

    for topic in topics:
        t = topic.lower()
        # Cherche le topic complet ou ses mots constitutifs
        if t in text_lower:
            key = t
        else:
            # "AI agents" → cherche "agents" ; "fine-tuning" → cherche "fine-tuning"
            parts = [p for p in re.split(r"[\s/]", t) if len(p) > 3]
            key = next((p for p in parts if p in text_lower), None)
        if key and key not in seen:
            seen.add(key)
            found.append(key)

    # Compléter avec des mots du titre anglais si < 4 topics trouvés
    if len(found) < 4:
        title_words = re.findall(r"[a-zA-Z][a-zA-Z\.\-]{3,}", title.lower())
        _common = {"that", "this", "with", "from", "have", "will", "been",
                   "long", "term", "join", "joins", "ensure", "local", "make",
                   "into", "over", "their", "about", "after", "progress"}
        for w in sorted(title_words, key=len, reverse=True):
            if w not in seen and w not in _common:
                seen.add(w)
                found.append(w)
            if len(found) >= 8:
                break

    return found[:8]


def _parse_memory_table(content: str) -> list[dict]:
    """Parse les lignes du tableau Markdown dans MEMORY.md → liste de dicts."""
    runs: list[dict] = []
    for line in content.splitlines():
        line = line.strip()
        if not line.startswith("|") or line.startswith("| Date") or line.startswith("|---"):
            continue
        parts = [p.strip() for p in line.strip("|").split("|")]
        if len(parts) < 5:
            continue
        date_str, title, category, score_str, kw_str = parts[:5]
        try:
            date = datetime.strptime(date_str.strip(), "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        try:
            score = float(score_str.strip())
        except ValueError:
            score = 0.0
        keywords = [k.strip() for k in kw_str.split(",") if k.strip()]
        runs.append({
            "date": date,
            "date_str": date_str.strip(),
            "title": title.strip(),
            "category": category.strip(),
            "score": score,
            "keywords": keywords,
        })
    return runs


def _ensure_memory_structure() -> None:
    """Crée les répertoires et MEMORY.md s'ils n'existent pas."""
    MEMORY_DIR.mkdir(exist_ok=True)
    TOPICS_DIR.mkdir(exist_ok=True)
    ARCHIVE_DIR.mkdir(exist_ok=True)
    LESSONS_DIR.mkdir(exist_ok=True)
    if not MEMORY_INDEX.exists():
        MEMORY_INDEX.write_text(
            "# AgenticBlog — Mémoire Éditoriale\n\n"
            "## Runs récents\n\n"
            "| Date       | Titre                          | Catégorie | Score | Mots-clés                     |\n"
            "|------------|--------------------------------|-----------|-------|-------------------------------|\n\n"
            "## Sujets récemment couverts (éviter dans les 14 prochains jours)\n\n"
            "_Aucun run enregistré pour l'instant._\n",
            encoding="utf-8",
        )


# ─────────────────────────────────────────────────────────────────────────────
# Lessons helpers (Meta-Guideline Bank)
# ─────────────────────────────────────────────────────────────────────────────

def _lessons_file(category: str) -> Path:
    return LESSONS_DIR / f"{category}.md"


def _parse_lessons(content: str) -> list[dict]:
    """Parse memory/lessons/{category}.md → liste de dicts."""
    lessons: list[dict] = []
    current: dict | None = None

    for line in content.splitlines():
        m = re.match(
            r"^## (\d{4}-\d{2}-\d{2}) \| itérations: (\d+) \| score: ([\d.]+) \| poids: ([\d.]+)",
            line,
        )
        if m:
            if current:
                lessons.append(current)
            current = {
                "date_str": m.group(1),
                "iteration_count": int(m.group(2)),
                "score": float(m.group(3)),
                "weight": float(m.group(4)),
                "article_title": "",
                "critique_text": "",
            }
        elif current and line.startswith("- Article:"):
            current["article_title"] = line[len("- Article:"):].strip()
        elif current and line.startswith("- Critique:"):
            current["critique_text"] = line[len("- Critique:"):].strip()

    if current:
        lessons.append(current)

    return lessons


def _build_lessons_file(category: str, lessons: list[dict]) -> str:
    header = f"# {category.capitalize()} — Leçons apprises\n\n"
    entries = []
    for lesson in lessons:
        entry = (
            f"## {lesson['date_str']} | itérations: {lesson['iteration_count']} | "
            f"score: {lesson['score']} | poids: {lesson['weight']:.2f}\n"
            f"- Article: {lesson['article_title']}\n"
            f"- Critique: {lesson['critique_text']}\n"
        )
        entries.append(entry)
    return header + "\n".join(entries)


def _apply_weight_decay(category: str) -> None:
    """Multiplie les poids par LESSON_DECAY_FACTOR et purge poids < LESSON_PURGE_THRESHOLD."""
    f = _lessons_file(category)
    if not f.exists():
        return

    lessons = _parse_lessons(f.read_text(encoding="utf-8"))
    kept = []
    for lesson in lessons:
        lesson["weight"] = round(lesson["weight"] * LESSON_DECAY_FACTOR, 4)
        if lesson["weight"] >= LESSON_PURGE_THRESHOLD:
            kept.append(lesson)

    f.write_text(_build_lessons_file(category, kept), encoding="utf-8")


# ─────────────────────────────────────────────────────────────────────────────
# API publique
# ─────────────────────────────────────────────────────────────────────────────

def load_memory_index() -> list[dict]:
    """Parse MEMORY.md → liste de runs récents [{date, title, category, keywords, score}]."""
    _ensure_memory_structure()
    if not MEMORY_INDEX.exists():
        return []
    content = MEMORY_INDEX.read_text(encoding="utf-8")
    return _parse_memory_table(content)


def get_novelty_penalty(article: dict, recent_runs: list[dict]) -> float:
    """
    Retourne 0.0–2.0 selon le chevauchement de mots-clés avec les 14 derniers jours.
    - Overlap > 60% mots-clés → pénalité 2.0 (même sujet exact)
    - Overlap > 30% mots-clés → pénalité 1.5
    - Sinon → 0.0
    """
    if not recent_runs:
        return 0.0

    cutoff = datetime.now(timezone.utc) - timedelta(days=NOVELTY_WINDOW_DAYS)
    recent = [r for r in recent_runs if r["date"] >= cutoff]
    if not recent:
        return 0.0

    # Extraire depuis le titre anglais de l'article candidat + summary RSS
    title = article.get("title", "")
    summary = article.get("summary", "")
    category = article.get("category", article.get("active_category", ""))
    article_kw = set(
        _keywords_from_category(category, title, summary)
        if category
        else re.findall(r"[a-zA-Z][a-zA-Z\.\-]{3,}", (title + " " + summary).lower())
    )
    if not article_kw:
        return 0.0

    max_penalty = 0.0
    for run in recent:
        # Les keywords stockés sont déjà propres — pas besoin de re-parser
        run_kw = set(run["keywords"])
        if not run_kw:
            continue
        overlap = len(article_kw & run_kw) / max(len(article_kw | run_kw), 1)
        if overlap > 0.60:
            return 2.0  # Même sujet exact → court-circuit
        elif overlap > 0.30:
            max_penalty = max(max_penalty, 1.5)

    return max_penalty


def store_lesson(state: "PipelineState") -> None:  # type: ignore[name-defined]
    """
    Mémorise la leçon critique si ≥ 2 itérations writer-critic.
    Applique d'abord le decay sur les leçons existantes, puis prepend la nouvelle.
    """
    category = state.get("active_category", state.get("selected_article", {}).get("category", "infra"))
    _apply_weight_decay(category)

    run_date = state.get("run_date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    iteration_count = state.get("iteration_count", 0)
    article = state.get("selected_article", {})
    title = article.get("title", "Sans titre")
    score = article.get("score", 0.0)
    critic_feedback = state.get("critic_feedback", "")[:300]

    f = _lessons_file(category)
    if not f.exists():
        f.write_text(f"# {category.capitalize()} — Leçons apprises\n\n", encoding="utf-8")

    new_entry = (
        f"## {run_date} | itérations: {iteration_count} | score: {score} | poids: 1.00\n"
        f"- Article: {title[:60]}\n"
        f"- Critique: {critic_feedback}\n"
    )

    existing = f.read_text(encoding="utf-8")
    # Prepend after the H1 heading (first blank line after header)
    split_pos = existing.find("\n\n")
    if split_pos != -1:
        f.write_text(existing[: split_pos + 2] + new_entry + "\n" + existing[split_pos + 2:], encoding="utf-8")
    else:
        f.write_text(existing.rstrip("\n") + "\n\n" + new_entry, encoding="utf-8")


def load_lessons(category: str, top_n: int = MAX_LESSONS_INJECTED) -> str:
    """
    Charge les top_n leçons les plus pertinentes (poids décroissant).
    Retourne un bloc Markdown injecté dans le prompt writer, ou "" si aucune leçon.
    """
    f = _lessons_file(category)
    if not f.exists():
        return ""

    lessons = _parse_lessons(f.read_text(encoding="utf-8"))
    if not lessons:
        return ""

    lessons.sort(key=lambda x: x["weight"], reverse=True)
    top = lessons[:top_n]

    lines = ["### Leçons critiques — à appliquer obligatoirement"]
    for lesson in top:
        priority = "haute priorité" if lesson["weight"] > 0.6 else "priorité normale"
        lines.append(f"- [{priority}] {lesson['critique_text']}")

    return "\n".join(lines)


def build_writer_context(selected: dict, recent_runs: list[dict]) -> str:
    """
    Construit un bloc Markdown des articles passés sur le même sujet/catégorie.
    Retourne une chaîne vide si aucun article pertinent trouvé.
    """
    if not recent_runs:
        return ""

    category = selected.get("category", selected.get("active_category", ""))
    title = selected.get("title", "")
    summary = selected.get("summary", "")
    article_kw = set(
        _keywords_from_category(category, title, summary)
        if category
        else re.findall(r"[a-zA-Z][a-zA-Z\.\-]{3,}", (title + " " + summary).lower())
    )

    relevant = []
    for run in recent_runs:
        same_cat = run["category"] == category
        # Keywords stockés déjà propres — comparaison directe
        run_kw = set(run["keywords"])
        overlap = len(article_kw & run_kw) / max(len(article_kw | run_kw), 1) if article_kw else 0

        if same_cat or overlap > 0.15:
            relevant.append((overlap, run))

    if not relevant:
        return ""

    # Trier par pertinence décroissante, garder max 3
    relevant.sort(key=lambda x: x[0], reverse=True)
    relevant = relevant[:3]

    lines = ["### Articles passés sur ce sujet\n"]
    for _, run in relevant:
        lines.append(
            f"- **{run['date_str']}** — {run['title']} "
            f"_(catégorie: {run['category']}, score: {run['score']})_"
        )

    context_parts = ["\n".join(lines)]

    lessons_block = load_lessons(category)
    if lessons_block:
        context_parts.append(lessons_block)

    return "\n\n".join(context_parts)


def update_memory(state: "PipelineState") -> None:  # type: ignore[name-defined]
    """
    Appelé par output_saver après chaque run réussi.
    1. Ajoute une ligne à MEMORY.md (prepend, garde max 60 entrées).
    2. Crée/met à jour memory/topics/{category}.md.
    3. Archive les entrées > 60 dans memory/archive/YYYY-MM-DD.md.
    """
    _ensure_memory_structure()

    run_date = state.get("run_date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    article = state.get("selected_article", {})
    category = state.get("active_category", article.get("category", "infra"))
    title = article.get("title", "Sans titre")
    score = article.get("score", 0.0)
    blog_post = state.get("blog_post", "")

    # Keywords depuis les topics de la catégorie filtrés par présence dans le contenu
    # Source : titre anglais de l'article + contenu — pas la prose française du blog post
    article_content = article.get("full_content") or article.get("summary", "")
    kw_list = _keywords_from_category(category, title, article_content)
    kw_str = ",".join(kw_list) if kw_list else category

    new_row = f"| {run_date} | {title[:40].replace('|', '-')} | {category} | {score} | {kw_str} |"

    # ── Lire MEMORY.md et extraire les lignes du tableau ──────────────────────
    content = MEMORY_INDEX.read_text(encoding="utf-8")
    lines = content.splitlines()

    header_lines: list[str] = []
    table_header: list[str] = []
    table_rows: list[str] = []
    footer_lines: list[str] = []
    in_table = False
    past_table = False

    for line in lines:
        if line.strip().startswith("| Date") or line.strip().startswith("|---"):
            in_table = True
            table_header.append(line)
        elif in_table and line.strip().startswith("|"):
            table_rows.append(line)
        elif in_table and not line.strip().startswith("|"):
            in_table = False
            past_table = True
            footer_lines.append(line)
        elif past_table:
            footer_lines.append(line)
        else:
            header_lines.append(line)

    # Prepend nouvelle entrée
    table_rows.insert(0, new_row)

    # Archiver overflow
    if len(table_rows) > MAX_INDEX_ENTRIES:
        overflow = table_rows[MAX_INDEX_ENTRIES:]
        table_rows = table_rows[:MAX_INDEX_ENTRIES]
        archive_path = ARCHIVE_DIR / f"{run_date}.md"
        archive_content = "# Archive — " + run_date + "\n\n"
        if table_header:
            archive_content += "\n".join(table_header) + "\n"
        archive_content += "\n".join(overflow) + "\n"
        with archive_path.open("a", encoding="utf-8") as f:
            f.write(archive_content)

    # ── Reconstruire MEMORY.md ─────────────────────────────────────────────────
    # Résumé des sujets récents
    cutoff = datetime.now(timezone.utc) - timedelta(days=NOVELTY_WINDOW_DAYS)
    all_rows = [new_row] + [r for r in table_rows[1:]]
    recent_runs = _parse_memory_table("\n".join(all_rows))
    cat_counts: dict[str, int] = {}
    cat_last: dict[str, str] = {}
    for run in recent_runs:
        if run["date"] >= cutoff:
            cat_counts[run["category"]] = cat_counts.get(run["category"], 0) + 1
            if run["category"] not in cat_last:
                cat_last[run["category"]] = run["date_str"]

    summary_lines = ["## Sujets récemment couverts (éviter dans les 14 prochains jours)\n"]
    if cat_counts:
        for cat, count in sorted(cat_counts.items()):
            summary_lines.append(f"- {cat}: {count} article(s) (dernier: {cat_last[cat]})")
    else:
        summary_lines.append("_Aucun run dans les 14 derniers jours._")

    new_content = (
        "\n".join(header_lines).rstrip() + "\n\n"
        + "\n".join(table_header) + "\n"
        + "\n".join(table_rows) + "\n\n"
        + "\n".join(summary_lines) + "\n"
    )
    MEMORY_INDEX.write_text(new_content, encoding="utf-8")

    # ── Mettre à jour memory/topics/{category}.md ─────────────────────────────
    run_id = state.get("run_id", "unknown")
    run_slug = run_id[:8] if run_id != "unknown" else "unknown"
    output_path = f"output/{run_date}/{run_slug}/blog_post.md"
    iteration_count = state.get("iteration_count", 0)

    topic_file = TOPICS_DIR / f"{category}.md"
    if not topic_file.exists():
        topic_file.write_text(
            f"# {category.capitalize()} — Articles couverts\n\n",
            encoding="utf-8",
        )

    # Angle : summary RSS en priorité, sinon premiers mots du contenu fetché
    angle = (article.get("summary") or article.get("full_content", ""))[:120].replace("\n", " ").strip()

    entry = (
        f"\n## {run_date} — {title}\n"
        f"- Angle: {angle}\n"
        f"- Score: {score} | Itérations critique: {iteration_count}\n"
        f"- Mots-clés: {kw_str}\n"
        f"- Lien: {output_path}\n"
    )
    existing = topic_file.read_text(encoding="utf-8")
    topic_file.write_text(existing + entry, encoding="utf-8")

    # ── Stocker la leçon si ≥ 2 itérations critic ─────────────────────────────
    if state.get("iteration_count", 0) >= 2:
        store_lesson(state)
