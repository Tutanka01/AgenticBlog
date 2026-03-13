import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ── LLM ───────────────────────────────────────────────────────────────────────
LLM_BASE_URL  = os.getenv("LLM_BASE_URL",  "https://openrouter.ai/api/v1")
LLM_MODEL     = os.getenv("LLM_MODEL",     "mistralai/mistral-7b-instruct")
LLM_API_KEY   = os.getenv("LLM_API_KEY",   "")
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.3"))

# Headers OpenRouter (ignorés si autre backend)
OPENROUTER_SITE_URL  = os.getenv("OPENROUTER_SITE_URL",  "https://github.com/AgenticBlog")
OPENROUTER_APP_NAME  = os.getenv("OPENROUTER_APP_NAME",  "AgenticBlog")

# ── Pipeline ──────────────────────────────────────────────────────────────────
FILTER_THRESHOLD        = int(os.getenv("FILTER_THRESHOLD",        "6"))
MAX_ARTICLES_TO_FETCH   = int(os.getenv("MAX_ARTICLES_TO_FETCH",   "40"))
TOP_N_FILTERED          = int(os.getenv("TOP_N_FILTERED",          "5"))
MAX_CRITIQUE_ITERATIONS = int(os.getenv("MAX_CRITIQUE_ITERATIONS", "3"))

# ── Chemins ───────────────────────────────────────────────────────────────────
CHECKPOINT_DB = os.getenv("CHECKPOINT_DB", "memory/checkpoints.sqlite")
OUTPUT_DIR    = Path(os.getenv("OUTPUT_DIR",  "./output"))
PROMPTS_DIR   = Path(os.getenv("PROMPTS_DIR", "./prompts"))

# ── Flux RSS ──────────────────────────────────────────────────────────────────
_default_feeds = (
    "https://hnrss.org/frontpage,"
    "https://lwn.net/headlines/rss,"
    "https://feeds.feedburner.com/TheHackersNews,"
    "https://www.reddit.com/r/kubernetes/.rss,"
    "https://www.reddit.com/r/devops/.rss"
)
RSS_FEEDS = [f.strip() for f in os.getenv("RSS_FEEDS", _default_feeds).split(",") if f.strip()]

# ── Topics d'intérêt ──────────────────────────────────────────────────────────
_default_topics = (
    "kubernetes,devops,linux,docker,CI/CD,GitOps,cloud,cybersecurity,"
    "AI agents,LLM,infrastructure,Maroc,Morocco,Afrique,tech africa"
)
INTEREST_TOPICS = [t.strip() for t in os.getenv("INTEREST_TOPICS", _default_topics).split(",") if t.strip()]

# ── Catégories disponibles ────────────────────────────────────────────────────
CATEGORIES = {
    "security": {
        "feeds": [
            "https://feeds.feedburner.com/TheHackersNews",
            "https://www.bleepingcomputer.com/feed/",
            "https://lwn.net/headlines/rss",
            "https://www.exploit-db.com/rss.xml",
        ],
        "topics": ["CVE", "vulnerability", "exploit", "cybersecurity", "pentest",
                   "kernel", "AppArmor", "seccomp", "zero-day", "ransomware", "OWASP"],
        "label": "Cybersécurité",
    },
    "infra": {
        "feeds": [
            "https://hnrss.org/frontpage",
            "https://www.reddit.com/r/kubernetes/.rss",
            "https://www.reddit.com/r/devops/.rss",
            "https://lwn.net/headlines/rss",
            "https://www.reddit.com/r/selfhosted/.rss",
        ],
        "topics": ["kubernetes", "docker", "linux", "devops", "CI/CD", "GitOps",
                   "terraform", "ansible", "proxmox", "homelab", "cloud", "infrastructure"],
        "label": "Infrastructure & DevOps",
    },
    "ai": {
        "feeds": [
            "https://hnrss.org/frontpage",
            "https://www.reddit.com/r/MachineLearning/.rss",
            "https://www.reddit.com/r/LocalLLaMA/.rss",
            "https://www.reddit.com/r/artificial/.rss",
        ],
        "topics": ["LLM", "AI agents", "RAG", "fine-tuning", "inference", "ollama",
                   "llama.cpp", "multi-agent", "embeddings", "open-source AI", "local AI"],
        "label": "Intelligence Artificielle",
    },
    "cloud": {
        "feeds": [
            "https://hnrss.org/frontpage",
            "https://aws.amazon.com/blogs/aws/feed/",
            "https://www.reddit.com/r/aws/.rss",
            "https://www.reddit.com/r/googlecloud/.rss",
            "https://www.reddit.com/r/AZURE/.rss",
        ],
        "topics": ["AWS", "GCP", "Azure", "serverless", "cloud-native", "FinOps",
                   "kubernetes", "managed services", "cloud cost", "multi-cloud"],
        "label": "Cloud",
    },
    "africa": {
        "feeds": [
            "https://hnrss.org/frontpage",
            "https://www.reddit.com/r/africa/.rss",
            "https://www.reddit.com/r/Morocco/.rss",
        ],
        "topics": ["Maroc", "Morocco", "Afrique", "Africa", "tech africa", "startup Maroc",
                   "numérique", "digital transformation", "fintech Afrique"],
        "label": "Tech Afrique & Maroc",
    },
}

DEFAULT_CATEGORY = "infra"

# ── Style rédactionnel (pas en .env — trop long, pas secret) ─────────────────
WRITING_STYLE = """
Tu es Mohamad, ingénieur DevOps/Cloud senior.
Tu écris des articles techniques en français, ton direct, zéro bullshit marketing.
Tu cibles des ingénieurs et étudiants en informatique de France et du Maghreb.
Tu fournis toujours des commandes réelles et des exemples concrets.
"""
