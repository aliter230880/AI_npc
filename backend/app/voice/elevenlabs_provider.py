"""ElevenLabs Text-to-Speech провайдер.

Премиум качество для голосов персонажей:
- Качество: 5/5 (лучшее на рынке)
- Эмоции: нативная поддержка через API
- Voice cloning: профессиональное клонирование из 1 мин аудио
- 29 языков включая русский
- Стабильность: высокая

Free tier: 10k символов/месяц
Starter: $5/мес — 30k символов
Creator: $22/мес — 100k символов

Документация: https://elevenlabs.io/docs/api-reference/text-to-speech
"""

from __future__ import annotations

import hashlib
import logging
import os
from dataclasses import dataclass
from pathlib import Path

log = logging.getLogger(__name__)

try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False
    log.warning("httpx not installed, ElevenLabs TTS disabled")


@dataclass(frozen=True)
class ElevenLabsVoice:
    """Пресет ElevenLabs голоса."""
    id: str                    # "elevenlabs_rachel"
    name: str                  # "Rachel — calm American female"
    language: str              # "en", "ru"
    gender: str                # "female" / "male"
    style: str                 # "calm" / "expressive" / "emotional"
    elevenlabs_voice_id: str   # "21m00Tcm4TlvDq8ikWAM" (Rachel)


# Лучшие голоса ElevenLabs для разных персонажей
ELEVENLABS_VOICES: dict[str, ElevenLabsVoice] = {
    # ENGLISH FEMALE (премиум)
    "elevenlabs_rachel": ElevenLabsVoice(
        id="elevenlabs_rachel",
        name="Rachel — calm & warm",
        language="en",
        gender="female",
        style="calm",
        elevenlabs_voice_id="21m00Tcm4TlvDq8ikWAM",
    ),
    "elevenlabs_domi": ElevenLabsVoice(
        id="elevenlabs_domi",
        name="Domi — confident & strong",
        language="en",
        gender="female",
        style="expressive",
        elevenlabs_voice_id="AZnzlk1XvdvUeBnXmlld",
    ),
    "elevenlabs_bella": ElevenLabsVoice(
        id="elevenlabs_bella",
        name="Bella — soft & expressive",
        language="en",
        gender="female",
        style="emotional",
        elevenlabs_voice_id="EXAVITQu4vr4xnSDxMaL",
    ),
    # ENGLISH MALE (премиум)
    "elevenlabs_adam": ElevenLabsVoice(
        id="elevenlabs_adam",
        name="Adam — deep & authoritative",
        language="en",
        gender="male",
        style="calm",
        elevenlabs_voice_id="pNInz6obpgDQGcFmaJgB",
    ),
    "elevenlabs_josh": ElevenLabsVoice(
        id="elevenlabs_josh",
        name="Josh — young & energetic",
        language="en",
        gender="male",
        style="expressive",
        elevenlabs_voice_id="TxGEqnHWrfWFTfGW9XjX",
    ),
    # RUSSIAN MULTILINGUAL (поддерживают русский)
    "elevenlabs_multi_adam": ElevenLabsVoice(
        id="elevenlabs_multi_adam",
        name="Adam (multilingual) — мужской",
        language="ru",
        gender="male",
        style="calm",
        elevenlabs_voice_id="pNInz6obpgDQGcFmaJgB",  # Adam multilingual
    ),
    "elevenlabs_multi_rachel": ElevenLabsVoice(
        id="elevenlabs_multi_rachel",
        name="Rachel (multilingual) — женский",
        language="ru",
        gender="female",
        style="calm",
        elevenlabs_voice_id="21m00Tcm4TlvDq8ikWAM",  # Rachel multilingual
    ),
}

DEFAULT_ELEVENLABS_VOICE_BY_LANG = {
    "en": "elevenlabs_rachel",
    "ru": "elevenlabs_multi_rachel",
}


def list_elevenlabs_voices() -> list[ElevenLabsVoice]:
    """Все доступные ElevenLabs голоса."""
    if not HTTPX_AVAILABLE:
        return []
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        return []
    return list(ELEVENLABS_VOICES.values())


def resolve_elevenlabs_voice(voice_id: str | None, language: str | None = None) -> ElevenLabsVoice | None:
    """Найти ElevenLabs голос по ID или дефолт по языку."""
    if not HTTPX_AVAILABLE:
        return None
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        return None
    if voice_id and voice_id in ELEVENLABS_VOICES:
        return ELEVENLABS_VOICES[voice_id]
    if language:
        lang_code = language.split("-")[0].lower()
        default_id = DEFAULT_ELEVENLABS_VOICE_BY_LANG.get(lang_code)
        if default_id and default_id in ELEVENLABS_VOICES:
            return ELEVENLABS_VOICES[default_id]
    voices = list_elevenlabs_voices()
    return voices[0] if voices else None


def _cache_key(voice: ElevenLabsVoice, text: str, emotion: str | None) -> str:
    """Ключ кэша: voice + text + emotion."""
    raw = f"{voice.id}|{text}|{emotion or ''}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


async def synthesize_elevenlabs_mp3(
    text: str,
    voice: ElevenLabsVoice,
    emotion: str | None = None,
    cache_dir: Path | None = None,
) -> bytes:
    """Синтез через ElevenLabs API с кэшированием.
    
    Args:
        text: текст для синтеза
        voice: ElevenLabs голос
        emotion: опциональная эмоция (happy, sad, angry, etc.) — влияет на style/stability
        cache_dir: папка кэша (если None — без кэша)
    
    Returns:
        MP3 bytes
    
    Raises:
        RuntimeError: если ElevenLabs недоступен или упал
    """
    if not HTTPX_AVAILABLE:
        raise RuntimeError("httpx library not installed")
    
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY not set")
    
    # Чистим текст
    from app.voice.tts import clean_text_for_tts
    text = clean_text_for_tts(text)
    if not text:
        raise ValueError("empty text after cleanup")
    if len(text) > 5000:
        text = text[:5000]
    
    # Проверяем кэш
    if cache_dir:
        cache_dir.mkdir(parents=True, exist_ok=True)
        cache_file = cache_dir / f"elevenlabs_{voice.id}_{_cache_key(voice, text, emotion)}.mp3"
        if cache_file.exists():
            return cache_file.read_bytes()
    
    # Параметры синтеза с учётом эмоции
    # stability: 0-1 (higher = more consistent, lower = more expressive)
    # similarity_boost: 0-1 (how much to match the original voice)
    # style: 0-1 (higher = more exaggerated, lower = more neutral)
    stability = 0.5
    similarity_boost = 0.75
    style = 0.0
    
    if emotion:
        emotion_lower = emotion.lower()
        if emotion_lower in ("happy", "cheerful", "excited"):
            stability = 0.3  # более выразительно
            style = 0.6      # более стилизованно
        elif emotion_lower in ("sad", "confused", "tired"):
            stability = 0.7  # более стабильно
            style = 0.3
        elif emotion_lower in ("angry", "scared"):
            stability = 0.2  # очень выразительно
            style = 0.8
        elif emotion_lower == "flirty":
            stability = 0.4
            style = 0.5
        elif emotion_lower == "surprised":
            stability = 0.3
            style = 0.7
    
    # API request
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice.elevenlabs_voice_id}"
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2",  # поддерживает 29 языков включая русский
        "voice_settings": {
            "stability": stability,
            "similarity_boost": similarity_boost,
            "style": style,
            "use_speaker_boost": True,
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            
            if response.status_code != 200:
                error_text = response.text[:500]
                if response.status_code == 401:
                    raise RuntimeError("ElevenLabs API key invalid")
                elif response.status_code == 429:
                    raise RuntimeError("ElevenLabs quota exceeded — upgrade plan or wait")
                elif response.status_code == 400:
                    raise RuntimeError(f"ElevenLabs bad request: {error_text}")
                else:
                    raise RuntimeError(f"ElevenLabs HTTP {response.status_code}: {error_text}")
            
            audio_data = response.content
            if not audio_data:
                raise RuntimeError("ElevenLabs returned empty audio")
            
            # Сохраняем в кэш
            if cache_dir:
                try:
                    cache_file.write_bytes(audio_data)
                except Exception as e:
                    log.warning("failed to cache ElevenLabs result: %s", e)
            
            return audio_data
    
    except httpx.TimeoutException:
        raise RuntimeError("ElevenLabs API timeout") from None
    except httpx.RequestError as e:
        raise RuntimeError(f"ElevenLabs network error: {e}") from e
    except Exception as e:
        if "RuntimeError" in str(type(e)):
            raise
        raise RuntimeError(f"ElevenLabs synthesis failed: {e}") from e
