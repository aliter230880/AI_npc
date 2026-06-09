"""Суммаризация куска диалога в короткую сводку.

Логика: каждые N сообщений берём последние M реплик и просим LLM выжать
1-3 предложения «что важного запомнить». Эту сводку кладём в Qdrant.

Используем тот же LLM-провайдер что и для чата, дешёвую модель.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable

from app.llm.base import ChatMessage, LLMProvider
from app.llm.factory import get_llm

log = logging.getLogger(__name__)

SUMMARY_SYSTEM_PROMPT = (
    "You compress chat dialogues into short memory notes. "
    "Output only 1–3 short sentences with the key facts the assistant should "
    "remember next time: user's name, preferences, important events, decisions, "
    "shared secrets, ongoing plot threads. "
    "No fluff, no role-playing, no self-references. "
    "If nothing is worth remembering, output the single word: SKIP"
)


def _format_dialog(messages: Iterable[tuple[str, str]]) -> str:
    """messages: iterable of (role, content). Возвращает простой текст-диалог."""
    lines = []
    for role, content in messages:
        prefix = "USER" if role == "user" else "ASSISTANT" if role == "assistant" else role.upper()
        lines.append(f"{prefix}: {content}")
    return "\n".join(lines)


async def summarize(
    messages: list[tuple[str, str]],
    *,
    llm: LLMProvider | None = None,
    model: str | None = None,
) -> str | None:
    """Возвращает сводку или None если нечего запоминать."""
    if not messages:
        return None
    llm = llm or get_llm()
    body = _format_dialog(messages)
    prompt = [
        ChatMessage(role="system", content=SUMMARY_SYSTEM_PROMPT),
        ChatMessage(role="user", content=f"Dialogue:\n\n{body}\n\nMemory note:"),
    ]
    try:
        out = await llm.complete(prompt, model=model, temperature=0.2, max_tokens=120)
    except Exception as e:
        log.warning("summarize: LLM call failed: %s", e)
        return None
    text = (out.content or "").strip()
    if not text or text.upper().startswith("SKIP"):
        return None
    # ограничим длину чтобы не пихать огромные сводки
    if len(text) > 600:
        text = text[:600].rsplit(" ", 1)[0] + "…"
    return text
