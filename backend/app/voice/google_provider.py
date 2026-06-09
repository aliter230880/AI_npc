"""Google Cloud Text-to-Speech провайдер.

Лучший выбор по соотношению цена/качество/надёжность:
- FREE: 1 млн символов/мес (WaveNet/Neural2 премиум голоса)
- FREE: 4 млн символов/мес (Standard голоса)
- Качество WaveNet: 4.5/5 (сопоставимо с ElevenLabs)
- 220+ голосов, 40+ языков
- SSML для эмоций (pitch, rate, volume)
- Стабильно, не блокируют (в отличие от Edge TTS)

Документация: https://cloud.google.com/text-to-speech/docs

⚠️ Требуется API ключ или Service Account JSON.
"""

from __future__ import annotations

import base64
import hashlib
import io
import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path

log = logging.getLogger(__name__)

# google-cloud-texttospeech ставим через requirements.txt
try:
    from google.cloud import texttospeech
    from google.oauth2 import service_account
    GOOGLE_TTS_AVAILABLE = True
except ImportError:
    GOOGLE_TTS_AVAILABLE = False
    log.warning("google-cloud-texttospeech not installed, Google TTS disabled")


@dataclass(frozen=True)
class GoogleVoice:
    """Пресет Google TTS голоса."""
    id: str                      # "google_en_female_neural2_a"
    name: str                    # "Neural2 A — warm & friendly (US)"
    language: str                # "en", "ru"
    gender: str                  # "female" / "male"
    style: str                   # "calm" / "cheerful" / "professional"
    google_voice_id: str         # "en-US-Neural2-A"
    voice_type: str = "Neural2"  # "Standard" / "WaveNet" / "Neural2" / "Studio"


# Каталог лучших Google TTS голосов
# Neural2 — премиум, 1 млн/мес бесплатно, качество 4.5/5
GOOGLE_VOICES: dict[str, GoogleVoice] = {
    # ENGLISH FEMALE (Neural2 — премиум)
    "google_en_female_neural2_a": GoogleVoice(
        id="google_en_female_neural2_a",
        name="Neural2 A — warm & friendly",
        language="en",
        gender="female",
        style="calm",
        google_voice_id="en-US-Neural2-A",
        voice_type="Neural2",
    ),
    "google_en_female_neural2_c": GoogleVoice(
        id="google_en_female_neural2_c",
        name="Neural2 C — professional",
        language="en",
        gender="female",
        style="professional",
        google_voice_id="en-US-Neural2-C",
        voice_type="Neural2",
    ),
    "google_en_female_neural2_e": GoogleVoice(
        id="google_en_female_neural2_e",
        name="Neural2 E — cheerful",
        language="en",
        gender="female",
        style="cheerful",
        google_voice_id="en-US-Neural2-E",
        voice_type="Neural2",
    ),
    # ENGLISH MALE (Neural2)
    "google_en_male_neural2_d": GoogleVoice(
        id="google_en_male_neural2_d",
        name="Neural2 D — confident",
        language="en",
        gender="male",
        style="calm",
        google_voice_id="en-US-Neural2-D",
        voice_type="Neural2",
    ),
    "google_en_male_neural2_i": GoogleVoice(
        id="google_en_male_neural2_i",
        name="Neural2 I — friendly",
        language="en",
        gender="male",
        style="cheerful",
        google_voice_id="en-US-Neural2-I",
        voice_type="Neural2",
    ),
    # RUSSIAN FEMALE (WaveNet — тоже премиум, 1 млн/мес)
    "google_ru_female_wavenet_a": GoogleVoice(
        id="google_ru_female_wavenet_a",
        name="WaveNet A — спокойная",
        language="ru",
        gender="female",
        style="calm",
        google_voice_id="ru-RU-Wavenet-A",
        voice_type="WaveNet",
    ),
    "google_ru_female_wavenet_c": GoogleVoice(
        id="google_ru_female_wavenet_c",
        name="WaveNet C — дружелюбная",
        language="ru",
        gender="female",
        style="cheerful",
        google_voice_id="ru-RU-Wavenet-C",
        voice_type="WaveNet",
    ),
    # RUSSIAN MALE (WaveNet)
    "google_ru_male_wavenet_b": GoogleVoice(
        id="google_ru_male_wavenet_b",
        name="WaveNet B — спокойный",
        language="ru",
        gender="male",
        style="calm",
        google_voice_id="ru-RU-Wavenet-B",
        voice_type="WaveNet",
    ),
    "google_ru_male_wavenet_d": GoogleVoice(
        id="google_ru_male_wavenet_d",
        name="WaveNet D — уверенный",
        language="ru",
        gender="male",
        style="professional",
        google_voice_id="ru-RU-Wavenet-D",
        voice_type="WaveNet",
    ),
}

DEFAULT_GOOGLE_VOICE_BY_LANG = {
    "en": "google_en_female_neural2_a",
    "ru": "google_ru_female_wavenet_a",
}


def _get_client() -> texttospeech.TextToSpeechClient:
    """Создать Google TTS клиент с авторизацией.
    
    Поддерживаем три способа авторизации:
    1. GOOGLE_TTS_API_KEY (простой API ключ, для быстрого старта)
    2. GOOGLE_APPLICATION_CREDENTIALS (путь к service account JSON)
    3. GOOGLE_SERVICE_ACCOUNT_JSON (inline JSON в env var)
    """
    if not GOOGLE_TTS_AVAILABLE:
        raise RuntimeError("google-cloud-texttospeech not installed")
    
    # Способ 1: API Key (самый простой)
    api_key = os.environ.get("GOOGLE_TTS_API_KEY")
    if api_key:
        # Google Cloud SDK поддерживает API key через client_options
        from google.api_core import client_options as client_options_lib
        client_options = client_options_lib.ClientOptions(api_key=api_key)
        return texttospeech.TextToSpeechClient(client_options=client_options)
    
    # Способ 2: Service Account JSON файл
    sa_json_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if sa_json_path and Path(sa_json_path).exists():
        credentials = service_account.Credentials.from_service_account_file(sa_json_path)
        return texttospeech.TextToSpeechClient(credentials=credentials)
    
    # Способ 3: inline JSON в env var (для удобства на VPS)
    sa_json_inline = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    if sa_json_inline:
        try:
            sa_info = json.loads(sa_json_inline)
            credentials = service_account.Credentials.from_service_account_info(sa_info)
            return texttospeech.TextToSpeechClient(credentials=credentials)
        except Exception as e:
            log.warning("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON: %s", e)
    
    # Способ 4: Application Default Credentials (если на GCP VM)
    try:
        return texttospeech.TextToSpeechClient()
    except Exception as e:
        raise RuntimeError(
            "Google TTS credentials not found. Set GOOGLE_TTS_API_KEY, "
            "GOOGLE_APPLICATION_CREDENTIALS, or GOOGLE_SERVICE_ACCOUNT_JSON"
        ) from e


def list_google_voices() -> list[GoogleVoice]:
    """Все доступные Google голоса."""
    if not GOOGLE_TTS_AVAILABLE:
        return []
    return list(GOOGLE_VOICES.values())


def resolve_google_voice(voice_id: str | None, language: str | None = None) -> GoogleVoice | None:
    """Найти Google голос по ID или дефолт по языку."""
    if not GOOGLE_TTS_AVAILABLE:
        return None
    if voice_id and voice_id in GOOGLE_VOICES:
        return GOOGLE_VOICES[voice_id]
    if language:
        lang_code = language.split("-")[0].lower()
        default_id = DEFAULT_GOOGLE_VOICE_BY_LANG.get(lang_code)
        if default_id and default_id in GOOGLE_VOICES:
            return GOOGLE_VOICES[default_id]
    voices = list_google_voices()
    return voices[0] if voices else None


def _build_ssml(text: str, voice: GoogleVoice, emotion: str | None = None) -> str:
    """Собираем SSML для Google TTS с учётом эмоции.
    
    Эмоции через <prosody> теги:
    - happy, cheerful → pitch +5%, rate +10%
    - sad, confused → pitch -5%, rate -10%
    - angry, scared → pitch +10%, rate +15%
    - neutral → без изменений
    """
    pitch = "+0%"
    rate = "+0%"
    
    if emotion:
        emotion_lower = emotion.lower()
        if emotion_lower in ("happy", "cheerful", "excited"):
            pitch = "+5%"
            rate = "+10%"
        elif emotion_lower in ("sad", "confused", "tired"):
            pitch = "-5%"
            rate = "-10%"
        elif emotion_lower in ("angry", "scared", "surprised"):
            pitch = "+10%"
            rate = "+15%"
        elif emotion_lower == "flirty":
            pitch = "+3%"
            rate = "+5%"
    
    # Экранируем XML спецсимволы
    safe_text = (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )
    
    ssml = f"""<speak>
    <prosody pitch="{pitch}" rate="{rate}">
        {safe_text}
    </prosody>
</speak>"""
    
    return ssml


def _cache_key(voice: GoogleVoice, text: str, emotion: str | None) -> str:
    """Ключ кэша: voice + text + emotion."""
    raw = f"{voice.id}|{text}|{emotion or ''}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


async def synthesize_google_wav(
    text: str,
    voice: GoogleVoice,
    emotion: str | None = None,
    cache_dir: Path | None = None,
) -> bytes:
    """Синтез через Google Cloud TTS с кэшированием.
    
    Args:
        text: текст для синтеза
        voice: Google голос
        emotion: опциональная эмоция (happy, sad, angry, etc.)
        cache_dir: папка кэша (если None — без кэша)
    
    Returns:
        MP3 bytes (Google TTS возвращает MP3 по умолчанию)
    
    Raises:
        RuntimeError: если Google TTS недоступен или упал
    """
    if not GOOGLE_TTS_AVAILABLE:
        raise RuntimeError("google-cloud-texttospeech library not installed")
    
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
        cache_file = cache_dir / f"google_{voice.id}_{_cache_key(voice, text, emotion)}.mp3"
        if cache_file.exists():
            return cache_file.read_bytes()
    
    # Синтезируем через Google TTS
    ssml = _build_ssml(text, voice, emotion)
    
    try:
        client = _get_client()
        
        # Настройка синтеза
        synthesis_input = texttospeech.SynthesisInput(ssml=ssml)
        
        # Выбор голоса
        lang_code = voice.google_voice_id.split("-")[0] + "-" + voice.google_voice_id.split("-")[1]  # "en-US"
        voice_params = texttospeech.VoiceSelectionParams(
            language_code=lang_code,
            name=voice.google_voice_id,
        )
        
        # Аудио конфиг (MP3, 24kHz)
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            sample_rate_hertz=24000,
        )
        
        # Синтез (синхронный, но Google SDK быстрый ~200-300ms)
        response = client.synthesize_speech(
            input=synthesis_input,
            voice=voice_params,
            audio_config=audio_config,
        )
        
        if not response.audio_content:
            raise RuntimeError("Google TTS returned no audio data")
        
        audio_data = response.audio_content
        
        # Сохраняем в кэш
        if cache_dir:
            try:
                cache_file.write_bytes(audio_data)
            except Exception as e:
                log.warning("failed to cache Google TTS result: %s", e)
        
        return audio_data
    
    except Exception as e:
        error_msg = str(e)
        if "quota" in error_msg.lower() or "limit" in error_msg.lower():
            log.warning("Google TTS quota exceeded — falling back to next provider")
        elif "credentials" in error_msg.lower() or "authentication" in error_msg.lower():
            log.error("Google TTS authentication failed: %s", error_msg)
        else:
            log.warning("Google TTS failed: %s — falling back to next provider", error_msg)
        raise RuntimeError(f"Google TTS unavailable: {error_msg}") from e
