"""Абстрактный LLM-провайдер.

Один интерфейс под все реализации: OpenRouter, OpenAI, Anthropic, локальный
llama.cpp и stub-заглушка для тестов без сети.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Literal


@dataclass
class ChatMessage:
    role: Literal["system", "user", "assistant"]
    content: str


@dataclass
class ChatCompletion:
    """Результат полной (не-стрим) генерации."""
    content: str
    model: str
    emotion: str | None = None
    action: str | None = None
    tokens_in: int = 0
    tokens_out: int = 0


class LLMProvider(ABC):
    """Интерфейс LLM-провайдера."""

    name: str = "base"

    @abstractmethod
    async def complete(
        self,
        messages: list[ChatMessage],
        *,
        model: str | None = None,
        temperature: float = 0.8,
        max_tokens: int = 1024,
    ) -> ChatCompletion:
        """Единый ответ целиком."""

    @abstractmethod
    def stream(
        self,
        messages: list[ChatMessage],
        *,
        model: str | None = None,
        temperature: float = 0.8,
        max_tokens: int = 1024,
    ) -> AsyncIterator[str]:
        """Стрим текстовых дельт."""
