"""Выбор LLM-провайдера на основе конфигурации.

Приоритет:
1. GEMINI_API_KEY → прямой Gemini API (бесплатный tier)
2. OPENROUTER_API_KEY → OpenRouter (платные/free модели)
3. Fallback → StubLLMProvider (тестовая заглушка)
"""

from __future__ import annotations

from app.core.config import get_settings
from app.llm.base import LLMProvider
from app.llm.gemini_provider import GeminiProvider
from app.llm.openrouter_provider import OpenRouterProvider
from app.llm.stub_provider import StubLLMProvider


def get_llm() -> LLMProvider:
    s = get_settings()
    # Приоритет: Gemini (бесплатный) → OpenRouter → Stub
    if s.gemini_api_key:
        return GeminiProvider()
    if s.openrouter_api_key:
        return OpenRouterProvider()
    return StubLLMProvider()
