"""
Shared OpenAI client — compatible with Ollama, llama.cpp, and OpenRouter.
OpenRouter requires HTTP-Referer and X-Title headers for attribution.
All agents import `llm_client` from this module.
"""
from openai import OpenAI
from config import (
    LLM_BASE_URL,
    LLM_API_KEY,
    LLM_TIMEOUT_SECONDS,
    OPENROUTER_SITE_URL,
    OPENROUTER_APP_NAME,
)

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
    timeout=LLM_TIMEOUT_SECONDS,
)
