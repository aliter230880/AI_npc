"""OpenRouter LLM-провайдер.

OpenRouter API совместим с OpenAI Chat Completions, поэтому реализация
проста: POST /chat/completions с заголовком Authorization: Bearer KEY.
Документация: https://openrouter.ai/docs

Ключевое отличие — обязательные опциональные заголовки HTTP-Referer и
X-Title для попадания в публичную аналитику и более высокого rate limit.

**Structured output с эмоциями:**
Для живости персонажей LLM возвращает не просто текст, а JSON:
{
  "text": "Hello there! How are you today?",
  "emotion": "happy",
  "action": "smiles warmly"
}

Эмоции: neutral, happy, sad, angry, surprised, confused, flirty, scared
Действия: краткие ремарки типа "nods", "looks away", "sighs"
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

import httpx

from app.core.config import get_settings
from app.llm.base import ChatCompletion, ChatMessage, LLMProvider


class OpenRouterError(RuntimeError):
    """Человекочитаемая ошибка от OpenRouter — пробросится в API."""

    def __init__(self, status_code: int, message: str, model: str) -> None:
        self.status_code = status_code
        self.message = message
        self.model = model
        super().__init__(f"OpenRouter {status_code} ({model}): {message}")


def _extract_error(resp: httpx.Response) -> str:
    try:
        data = resp.json()
    except Exception:
        return resp.text[:500]
    err = data.get("error") if isinstance(data, dict) else None
    if isinstance(err, dict):
        return err.get("message") or json.dumps(err)
    return json.dumps(data)[:500]


def _parse_structured_response(text: str) -> tuple[str, str | None, str | None]:
    """Парсим ответ LLM: если JSON с emotion/action — извлекаем, иначе текст как есть.
    
    Returns:
        (text, emotion, action)
    """
    text = text.strip()
    if not text:
        return "", None, None
    
    # Пробуем распарсить как JSON
    if text.startswith("{") and text.endswith("}"):
        try:
            data = json.loads(text)
            if isinstance(data, dict) and "text" in data:
                return (
                    data.get("text", "").strip(),
                    data.get("emotion"),
                    data.get("action"),
                )
        except json.JSONDecodeError:
            pass
    
    # Не JSON или нет структуры — возвращаем как есть
    return text, None, None


class OpenRouterProvider(LLMProvider):
    name = "openrouter"

    def __init__(self) -> None:
        s = get_settings()
        if not s.openrouter_api_key:
            raise RuntimeError("OPENROUTER_API_KEY is not set")
        self._base_url = s.openrouter_base_url.rstrip("/")
        self._headers = {
            "Authorization": f"Bearer {s.openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": s.openrouter_http_referer,
            "X-Title": s.openrouter_app_title,
        }
        self._default_model = s.llm_default_model

    def _payload(
        self,
        messages: list[ChatMessage],
        *,
        model: str | None,
        temperature: float,
        max_tokens: int,
        stream: bool,
    ) -> dict:
        return {
            "model": model or self._default_model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": stream,
            # выключаем reasoning-traces от gpt-oss и других reasoning-моделей —
            # нам нужно только полезное content-сообщение, иначе клиент ничего не увидит
            "reasoning": {"exclude": True},
        }

    async def complete(
        self,
        messages: list[ChatMessage],
        *,
        model: str | None = None,
        temperature: float = 0.8,
        max_tokens: int = 1024,
    ) -> ChatCompletion:
        body = self._payload(messages, model=model, temperature=temperature, max_tokens=max_tokens, stream=False)
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{self._base_url}/chat/completions",
                headers=self._headers,
                json=body,
            )
            if resp.status_code >= 400:
                raise OpenRouterError(resp.status_code, _extract_error(resp), body["model"])
            data = resp.json()

        choice = data["choices"][0]
        msg = choice["message"]
        content = (msg.get("content") or "").strip()
        # Некоторые модели (особенно reasoning-style как gpt-oss) могут вернуть
        # пустой content и положить всё в reasoning. Если контента нет — берём reasoning
        # как fallback, чтобы не показать пустой ответ.
        if not content and msg.get("reasoning"):
            content = str(msg["reasoning"]).strip()
        if not content:
            content = "[empty response from model]"
        
        # Парсим structured output (text, emotion, action)
        text, emotion, action = _parse_structured_response(content)
        if not text:
            text = content  # fallback если парсинг не сработал
        
        usage = data.get("usage") or {}
        return ChatCompletion(
            content=text,
            emotion=emotion,
            action=action,
            model=data.get("model", body["model"]),
            tokens_in=int(usage.get("prompt_tokens", 0)),
            tokens_out=int(usage.get("completion_tokens", 0)),
        )

    async def stream(
        self,
        messages: list[ChatMessage],
        *,
        model: str | None = None,
        temperature: float = 0.8,
        max_tokens: int = 1024,
    ) -> AsyncIterator[str]:
        body = self._payload(messages, model=model, temperature=temperature, max_tokens=max_tokens, stream=True)
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                f"{self._base_url}/chat/completions",
                headers=self._headers,
                json=body,
            ) as resp:
                if resp.status_code >= 400:
                    text = (await resp.aread()).decode("utf-8", errors="replace")
                    raise OpenRouterError(resp.status_code, text[:500], body["model"])
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    if not line.startswith("data:"):
                        continue
                    payload = line[5:].strip()
                    if payload == "[DONE]":
                        break
                    try:
                        chunk = json.loads(payload)
                    except json.JSONDecodeError:
                        continue
                    delta = (chunk.get("choices") or [{}])[0].get("delta") or {}
                    # некоторые модели стримят reasoning отдельным полем — игнорируем,
                    # чтобы пользователь не видел "размышления" модели.
                    piece = delta.get("content")
                    if piece:
                        yield piece
