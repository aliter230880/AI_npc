"""Заглушка LLM для этапа 1 / тестов / окружения без ключа.

Возвращает детерминированный текст, имитирует стриминг.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

from app.llm.base import ChatCompletion, ChatMessage, LLMProvider


def _mock_reply(messages: list[ChatMessage]) -> str:
    last_user = next((m.content for m in reversed(messages) if m.role == "user"), "")
    sys = next((m.content for m in messages if m.role == "system"), "")
    persona = sys.splitlines()[0][:60] if sys else "AI character"
    snippet = last_user[:200].strip() or "(empty)"
    return (
        f"[stub:{persona}] Heard you: \"{snippet}\". "
        "This is a placeholder response from the stub provider. "
        "Configure OPENROUTER_API_KEY to switch to a real LLM."
    )


class StubLLMProvider(LLMProvider):
    name = "stub"

    async def complete(
        self,
        messages: list[ChatMessage],
        *,
        model: str | None = None,
        temperature: float = 0.8,
        max_tokens: int = 1024,
    ) -> ChatCompletion:
        text = _mock_reply(messages)
        return ChatCompletion(
            content=text,
            model=model or "stub",
            tokens_in=sum(len(m.content) // 4 for m in messages),  # грубая оценка
            tokens_out=len(text) // 4,
        )

    async def stream(
        self,
        messages: list[ChatMessage],
        *,
        model: str | None = None,
        temperature: float = 0.8,
        max_tokens: int = 1024,
    ) -> AsyncIterator[str]:
        text = _mock_reply(messages)
        # отдадим словами с задержкой — похоже на реальный стрим
        for word in text.split(" "):
            await asyncio.sleep(0.02)
            yield word + " "
