"""Yandex SpeechKit TTS провайдер.

Лучшее качество для РУССКОГО языка:
- Естественные интонации и правильные ударения
- Поддержка эмоций через роли (role parameter)
- Premium качество голосов alena, filipp, ermil
- Trial grant при регистрации
- Платная после trial: ~$1.50-3.00 за 1000 синтезов

Документация: https://cloud.yandex.com/en/docs/speechkit/tts

⚠️ Требуется API key из Yandex Cloud AI Studio.
"""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from pathlib import Path

log = logging.getLogger(__name__)

try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False
    log.warning("httpx not installed, Yandex TTS disabled")


@dataclass(frozen=True)
class YandexVoice:
    """Пресет Yandex SpeechKit голоса."""
    id: str                    # "yandex_ru_female_alena"
    name: str                  # "Алёна — нейтральная"
    language: str              # "ru"
    gender: str                # "female" / "male"
    style: str                 # "neutral" / "good" / "evil"
    yandex_voice_id: str       # "alena"
    role: str = "neutral"      # "neutral" / "good" / "evil" (эмоциональная окраска)


# Каталог лучших Yandex SpeechKit голосов для русского языка
# Документация: https://cloud.yandex.com/en/docs/speechkit/tts/voices
YANDEX_VOICES: dict[str, YandexVoice] = {
    # RUSSIAN FEMALE
    "yandex_ru_female_alena_neutral": YandexVoice(
        id="yandex_ru_female_alena_neutral",
        name="Алёна — нейтральная",
        language="ru",
        gender="female",
        style="neutral",
        yandex_voice_id="alena",
        role="neutral",
    ),
    "yandex_ru_female_alena_good": YandexVoice(
        id="yandex_ru_female_alena_good",
        name="Алёна — добрая",
        language="ru",
        gender="female",
        style="cheerful",
        yandex_voice_id="alena",
        role="good",
    ),
    "yandex_ru_female_jane": YandexVoice(
        id="yandex_ru_female_jane",
        name="Джейн — нейтральная",
        language="ru",
        gender="female",
        style="calm",
        yandex_voice_id="jane",
        role="neutral",
    ),
    # RUSSIAN MALE
    "yandex_ru_male_filipp_neutral": YandexVoice(
        id="yandex_ru_male_filipp_neutral",
        name="Филипп — нейтральный",
        language="ru",
        gender="male",
        style="calm",
        yandex_voice_id="filipp",
        role="neutral",
    ),
    "yandex_ru_male_ermil_neutral": YandexVoice(
        id="yandex_ru_male_ermil_neutral",
        name="Ермил — нейтральный",
        language="ru",
        gender="male",
        style="calm",
        yandex_voice_id="ermil",
        role="neutral",
    ),
    "yandex_ru_male_ermil_good": YandexVoice(
        id="yandex_ru_male_ermil_good",
        name="Ермил — добрый",
        language="ru",
        gender="male",
        style="cheerful",
        yandex_voice_id="ermil",
        role="good",
    ),
}

DEFAULT_YANDEX_VOICE = "yandex_ru_female_alena_neutral"


def list_yandex_voices() -> list[YandexVoice]:
    """Все доступные Yandex голоса."""
    if not HTTPX_AVAILABLE:
        return []
    return list(YANDEX_VOICES.values())


def resolve_yandex_voice(voice_id: str | None) -> YandexVoice | None:
    """Найти Yandex голос по ID или дефолт."""
    if not HTTPX_AVAILABLE:
        return None
    if voice_id and voice_id in YANDEX_VOICES:
        return YANDEX_VOICES[voice_id]
    default_id = DEFAULT_YANDEX_VOICE
    return YANDEX_VOICES.get(default_id)


def _map_emotion_to_role(emotion: str | None) -> str:
    """Маппинг эмоций персонажа на роли Yandex (neutral/good/evil).
    
    Yandex поддерживает только 3 роли:
    - neutral — нейтральный (по умолчанию)
    - good — добрая, радостная интонация
    - evil — злая, угрожающая интонация
    """
    if not emotion:
        return "neutral"
    
    emotion_lower = emotion.lower()
    
    # Положительные эмоции → good
    if emotion_lower in ("happy", "cheerful", "excited", "flirty", "friendly"):
        return "good"
    
    # Негативные/агрессивные → evil
    if emotion_lower in ("angry", "evil", "scary", "annoyed"):
        return "evil"
    
    # Остальные → neutral (sad, confused, surprised, etc.)
    return "neutral"


def _cache_key(voice: YandexVoice, text: str, emotion: str | None) -> str:
    """Ключ кэша: voice + text + emotion."""
    raw = f"{voice.id}|{text}|{emotion or ''}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


async def synthesize_yandex_wav(
    text: str,
    voice: YandexVoice,
    emotion: str | None = None,
    api_key: str | None = None,
    cache_dir: Path | None = None,
) -> bytes:
    """Синтез через Yandex SpeechKit с кэшированием.
    
    Args:
        text: текст для синтеза
        voice: Yandex голос
        emotion: опциональная эмоция (happy, sad, angry, etc.)
        api_key: Yandex Cloud API key
        cache_dir: папка кэша (если None — без кэша)
    
    Returns:
        WAV bytes (LPCM 22050 Hz)
    
    Raises:
        RuntimeError: если Yandex API недоступен или упал
    """
    if not HTTPX_AVAILABLE:
        raise RuntimeError("httpx library not installed")
    if not api_key:
        raise RuntimeError("YANDEX_API_KEY not configured")
    
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
        cache_file = cache_dir / f"yandex_{voice.id}_{_cache_key(voice, text, emotion)}.wav"
        if cache_file.exists():
            return cache_file.read_bytes()
    
    # Определяем роль по эмоции
    role = _map_emotion_to_role(emotion)
    
    # Yandex SpeechKit API v3 (REST)
    # Документация: https://cloud.yandex.com/en/docs/speechkit/tts/api/tts-v3-rest
    url = "https://tts.api.cloud.yandex.net/tts/v3/utteranceSynthesis"
    
    headers = {
        "Authorization": f"Api-Key {api_key}",
        "Content-Type": "application/json",
    }
    
    payload = {
        "text": text,
        "outputAudioSpec": {
            "containerAudio": {
                "containerAudioType": "WAV"  # WAV container
            }
        },
        "hints": [
            {
                "voice": voice.yandex_voice_id,  # "alena", "filipp", "ermil", etc.
                "role": role  # "neutral", "good", "evil"
            }
        ],
        "loudnessNormalizationType": "LUFS"  # нормализация громкости
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            
            if resp.status_code >= 400:
                error_text = resp.text[:500]
                log.error("Yandex TTS error %s: %s", resp.status_code, error_text)
                raise RuntimeError(f"Yandex TTS API error {resp.status_code}: {error_text}")
            
            # Yandex API v3 возвращает JSON с base64-encoded audio
            try:
                import base64
                response_json = resp.json()
                # Извлекаем base64 audio из результата
                audio_content = response_json.get("result", {}).get("audioChunk", {}).get("data")
                if not audio_content:
                    raise RuntimeError("Yandex TTS response missing audioChunk.data")
                # Декодируем base64 в бинарный WAV
                audio_data = base64.b64decode(audio_content)
            except (json.JSONDecodeError, KeyError) as e:
                log.error("Failed to parse Yandex TTS response: %s", e)
                raise RuntimeError(f"Invalid Yandex TTS response format: {e}") from e
            
            if not audio_data:
                raise RuntimeError("Yandex TTS returned empty audio")
            
            # Сохраняем в кэш
            if cache_dir:
                try:
                    cache_file.write_bytes(audio_data)
                except Exception as e:
                    log.warning("failed to cache Yandex TTS result: %s", e)
            
            return audio_data
    
    except httpx.TimeoutException as e:
        log.warning("Yandex TTS timeout: %s", e)
        raise RuntimeError(f"Yandex TTS timeout: {e}") from e
    except httpx.HTTPStatusError as e:
        log.warning("Yandex TTS HTTP error: %s", e)
        raise RuntimeError(f"Yandex TTS unavailable: {e}") from e
    except Exception as e:
        log.warning("Yandex TTS failed: %s", e)
        raise RuntimeError(f"Yandex TTS error: {e}") from e
