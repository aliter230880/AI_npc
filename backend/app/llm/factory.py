"""Выбор LLM-провайдера на основе конфигурации.

Если есть OPENROUTER_API_KEY — берём OpenRouter, иначе stub.
В будущем добавим OpenAI/Anthropic прямые провайдеры — выбор по env.
"""

from __future__ import annotations

from app.core.config import get_settings
from app.llm.base import LLMProvider
from app.llm.openrouter_provider import OpenRouterProvider
from app.llm.stub_provider import StubLLMProvider


def get_llm() -> LLMProvider:
    s = get_settings()
    if s.openrouter_api_key:
        return OpenRouterProvider()
    return StubLLMProvider()
