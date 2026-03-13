"""
Client OpenAI partagé — compatible Ollama, llama.cpp et OpenRouter.
OpenRouter exige les headers HTTP-Referer et X-Title pour l'attribution.
Tous les agents importent `llm_client` depuis ce module.
"""
from openai import OpenAI
from config import LLM_BASE_URL, LLM_API_KEY, OPENROUTER_SITE_URL, OPENROUTER_APP_NAME

_headers = {}
if "openrouter.ai" in LLM_BASE_URL:
    _headers = {
        "HTTP-Referer": OPENROUTER_SITE_URL,
        "X-Title": OPENROUTER_APP_NAME,
    }

llm_client = OpenAI(
    base_url=LLM_BASE_URL,
    api_key=LLM_API_KEY,
    default_headers=_headers or None,
)
