"""Google Gemini API провайдер.

Прямое подключение к Google AI Studio API (ai.google.dev).
Бесплатный tier: Gemini 2.5 Flash/Pro — без токенных лимитов, только RPM.

API документация: https://ai.google.dev/gemini-api/docs

**Structured output с эмоциями:**
Как и OpenRouter, просим JSON:
{
  "text": "Привет! Как дела?",
  "emotion": "happy",
  "action": "улыбается"
}

Эмоции: neutral, happy, sad, angry, surprised, confused, flirty, scared
Действия: краткие ремарки типа "кивает", "отводит взгляд", "вздыхает"
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

import httpx

from app.core.config import get_settings
from app.llm.base import ChatCompletion, ChatMessage, LLMProvider


class GeminiError(RuntimeError):
    """Человекочитаемая ошибка от Gemini API — пробросится в API."""

    def __init__(self, status_code: int, message: str, model: str) -> None:
        self.status_code = status_code
        self.message = message
        self.model = model
        super().__init__(f"Gemini {status_code} ({model}): {message}")


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


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self) -> None:
        s = get_settings()
        if not s.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not set")
        self._api_key = s.gemini_api_key
        self._base_url = "https://generativelanguage.googleapis.com/v1beta"
        self._default_model = s.gemini_default_model or "gemini-2.0-flash-exp"

    def _convert_messages(self, messages: list[ChatMessage]) -> tuple[str | None, list[dict]]:
        """Конвертация OpenAI-формата в Gemini.
        
        Gemini API использует:
        - systemInstruction (отдельный параметр для system-промпта)
        - contents: [{role: "user"|"model", parts: [{text: "..."}]}]
        
        Returns:
            (system_instruction, contents)
        """
        system_instruction = None
        contents = []
        
        for msg in messages:
            if msg.role == "system":
                # Gemini принимает только один system instruction
                if system_instruction is None:
                    system_instruction = msg.content
                else:
                    # Если несколько system сообщений — объединяем
                    system_instruction += "\n\n" + msg.content
            else:
                # Gemini использует "model" вместо "assistant"
                role = "model" if msg.role == "assistant" else "user"
                contents.append({
                    "role": role,
                    "parts": [{"text": msg.content}]
                })
        
        return system_instruction, contents

    def _payload(
        self,
        messages: list[ChatMessage],
        *,
        model: str | None,
        temperature: float,
        max_tokens: int,
    ) -> tuple[str, dict]:
        """Формирование API запроса.
        
        Returns:
            (model_name, request_body)
        """
        model_name = model or self._default_model
        system_instruction, contents = self._convert_messages(messages)
        
        body = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
                "responseMimeType": "text/plain",  # или application/json для structured output
            }
        }
        
        if system_instruction:
            body["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }
        
        return model_name, body

    async def complete(
        self,
        messages: list[ChatMessage],
        *,
        model: str | None = None,
        temperature: float = 0.8,
        max_tokens: int = 1024,
    ) -> ChatCompletion:
        model_name, body = self._payload(messages, model=model, temperature=temperature, max_tokens=max_tokens)
        
        url = f"{self._base_url}/models/{model_name}:generateContent"
        params = {"key": self._api_key}
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, params=params, json=body)
            if resp.status_code >= 400:
                raise GeminiError(resp.status_code, _extract_error(resp), model_name)
            data = resp.json()

        # Извлекаем контент из ответа
        candidates = data.get("candidates", [])
        if not candidates:
            content = "[empty response from model]"
        else:
            parts = candidates[0].get("content", {}).get("parts", [])
            content = "".join(p.get("text", "") for p in parts).strip()
            if not content:
                content = "[empty response from model]"
        
        # Парсим structured output (text, emotion, action)
        text, emotion, action = _parse_structured_response(content)
        if not text:
            text = content  # fallback если парсинг не сработал
        
        # Извлекаем usage metadata
        usage = data.get("usageMetadata", {})
        tokens_in = int(usage.get("promptTokenCount", 0))
        tokens_out = int(usage.get("candidatesTokenCount", 0))
        
        return ChatCompletion(
            content=text,
            emotion=emotion,
            action=action,
            model=model_name,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
        )

    async def stream(
        self,
        messages: list[ChatMessage],
        *,
        model: str | None = None,
        temperature: float = 0.8,
        max_tokens: int = 1024,
    ) -> AsyncIterator[str]:
        model_name, body = self._payload(messages, model=model, temperature=temperature, max_tokens=max_tokens)
        
        url = f"{self._base_url}/models/{model_name}:streamGenerateContent"
        params = {"key": self._api_key, "alt": "sse"}
        
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream("POST", url, params=params, json=body) as resp:
                if resp.status_code >= 400:
                    text = (await resp.aread()).decode("utf-8", errors="replace")
                    raise GeminiError(resp.status_code, text[:500], model_name)
                
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    if not line.startswith("data:"):
                        continue
                    
                    payload = line[5:].strip()
                    if not payload:
                        continue
                    
                    try:
                        chunk = json.loads(payload)
                    except json.JSONDecodeError:
                        continue
                    
                    # Извлекаем текст из chunk
                    candidates = chunk.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        for part in parts:
                            text = part.get("text")
                            if text:
                                yield text
