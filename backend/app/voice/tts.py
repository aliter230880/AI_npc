"""Text-to-Speech через Piper.

Piper читает текст буквально, поэтому перед синтезом чистим markdown,
ремарки в звёздочках (*leans back*), служебные символы.

Каталог голосов — это пресеты: один Piper-файл с вариациями параметров
(length_scale = скорость, noise_scale/noise_w = вариативность интонации)
даёт несколько разных «характеров» голоса — calm/cheerful.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import re
from dataclasses import dataclass
from pathlib import Path

log = logging.getLogger(__name__)


# --- Чистка текста перед синтезом ---------------------------------------------

_MD_CODE_FENCE = re.compile(r"```[\s\S]*?```")
_MD_INLINE_CODE = re.compile(r"`([^`]*)`")
_MD_LINK = re.compile(r"\[([^\]]+)\]\([^)]+\)")
_MD_IMAGE = re.compile(r"!\[[^\]]*\]\([^)]+\)")
_MD_HEADERS = re.compile(r"^\s{0,3}#{1,6}\s+", re.MULTILINE)
_MD_BOLD_ITAL = re.compile(r"(\*\*|__|\*|_)(.+?)\1")
_MD_LIST_BULLET = re.compile(r"^\s*[-*+]\s+", re.MULTILINE)
_MD_LIST_NUMBER = re.compile(r"^\s*\d+\.\s+", re.MULTILINE)
_MD_BLOCKQUOTE = re.compile(r"^\s*>\s+", re.MULTILINE)
_MD_HR = re.compile(r"^\s*[-*_]{3,}\s*$", re.MULTILINE)
_MD_STAGE_DIRECTION = re.compile(r"\*[^*\n]{1,80}\*")
_MD_BRACKETS = re.compile(r"[\[\]\{\}<>]")
_WS = re.compile(r"\s+")


def clean_text_for_tts(text: str, drop_stage_directions: bool = True) -> str:
    if not text:
        return ""
    s = text
    s = _MD_CODE_FENCE.sub(" ", s)
    s = _MD_IMAGE.sub(" ", s)
    s = _MD_LINK.sub(r"\1", s)
    s = _MD_HEADERS.sub("", s)
    if drop_stage_directions:
        s = _MD_STAGE_DIRECTION.sub(" ", s)
    s = _MD_BOLD_ITAL.sub(r"\2", s)
    s = _MD_LIST_BULLET.sub("", s)
    s = _MD_LIST_NUMBER.sub("", s)
    s = _MD_BLOCKQUOTE.sub("", s)
    s = _MD_HR.sub("", s)
    s = _MD_INLINE_CODE.sub(r"\1", s)
    s = _MD_BRACKETS.sub(" ", s)
    s = s.replace("—", "-").replace("–", "-")
    s = _WS.sub(" ", s).strip()
    return s


# --- Каталог пресетов голосов -------------------------------------------------

PIPER_BIN = os.environ.get("PIPER_BIN", "/opt/piper/piper")
VOICES_DIR = Path(os.environ.get("PIPER_VOICES_DIR", "/opt/piper/voices"))
CACHE_DIR = Path(os.environ.get("TTS_CACHE_DIR", "/opt/character-platform/data/tts-cache"))
CACHE_DIR.mkdir(parents=True, exist_ok=True)


@dataclass(frozen=True)
class Voice:
    """Пресет голоса для UI/каталога. Несколько пресетов могут использовать одну
    Piper-модель, отличаясь параметрами синтеза."""
    id: str                 # "en_female_calm"
    name: str               # читаемое имя для UI
    language: str           # "en", "ru"
    gender: str             # "female" / "male"
    style: str              # "calm" / "cheerful"
    model_file: str         # имя файла модели в /opt/piper/voices без .onnx
    length_scale: float = 1.0  # < 1 быстрее, > 1 медленнее
    noise_scale: float = 0.667
    noise_w: float = 0.8
    sample_rate: int = 22050


# 8 пресетов: 2 пола × 2 языка × 2 стиля
VOICES: dict[str, Voice] = {
    # ENGLISH FEMALE
    "en_female_calm": Voice(
        id="en_female_calm", name="Amy — calm",
        language="en", gender="female", style="calm",
        model_file="en_us_amy_medium",
        length_scale=1.0, noise_scale=0.6, noise_w=0.7,
    ),
    "en_female_cheerful": Voice(
        id="en_female_cheerful", name="HFC — cheerful",
        language="en", gender="female", style="cheerful",
        model_file="en_us_hfc_female_medium",
        length_scale=0.92, noise_scale=0.75, noise_w=0.9,
    ),
    # ENGLISH MALE
    "en_male_calm": Voice(
        id="en_male_calm", name="Ryan — calm",
        language="en", gender="male", style="calm",
        model_file="en_us_ryan_medium",
        length_scale=1.0, noise_scale=0.6, noise_w=0.7,
    ),
    "en_male_cheerful": Voice(
        id="en_male_cheerful", name="Kusal — cheerful",
        language="en", gender="male", style="cheerful",
        model_file="en_us_kusal_medium",
        length_scale=0.95, noise_scale=0.75, noise_w=0.95,
    ),
    # RUSSIAN FEMALE
    "ru_female_calm": Voice(
        id="ru_female_calm", name="Ирина — спокойная",
        language="ru", gender="female", style="calm",
        model_file="ru_irina_medium",
        length_scale=1.0, noise_scale=0.6, noise_w=0.7,
    ),
    "ru_female_cheerful": Voice(
        id="ru_female_cheerful", name="Ирина — весёлая",
        language="ru", gender="female", style="cheerful",
        model_file="ru_irina_medium",
        length_scale=0.85, noise_scale=0.85, noise_w=1.0,
    ),
    # RUSSIAN MALE
    "ru_male_calm": Voice(
        id="ru_male_calm", name="Дмитрий — спокойный",
        language="ru", gender="male", style="calm",
        model_file="ru_dmitri_medium",
        length_scale=1.0, noise_scale=0.6, noise_w=0.7,
    ),
    "ru_male_cheerful": Voice(
        id="ru_male_cheerful", name="Денис — весёлый",
        language="ru", gender="male", style="cheerful",
        model_file="ru_denis_medium",
        length_scale=0.95, noise_scale=0.8, noise_w=0.95,
    ),
}

DEFAULT_VOICE_BY_LANG = {
    "en": "en_female_calm",
    "ru": "ru_female_calm",
}


def list_voices() -> list[Voice]:
    """Доступные пресеты — те у которых модель есть на диске."""
    out = []
    for v in VOICES.values():
        if (VOICES_DIR / f"{v.model_file}.onnx").exists():
            out.append(v)
    return out


def resolve_voice(voice_id: str | None, language: str | None = None) -> Voice | None:
    """Найти пресет по id или дефолт по языку."""
    if voice_id and voice_id in VOICES:
        v = VOICES[voice_id]
        if (VOICES_DIR / f"{v.model_file}.onnx").exists():
            return v
    if language:
        default_id = DEFAULT_VOICE_BY_LANG.get(language.split("-")[0].lower())
        if default_id and default_id in VOICES:
            v = VOICES[default_id]
            if (VOICES_DIR / f"{v.model_file}.onnx").exists():
                return v
    voices = list_voices()
    return voices[0] if voices else None


def _cache_key(voice: Voice, text: str) -> str:
    """Ключ кэша зависит от голоса И параметров — иначе calm/cheerful из одной
    модели наложатся друг на друга."""
    raw = f"{voice.id}|{voice.length_scale}|{voice.noise_scale}|{voice.noise_w}|{text}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _cache_path(voice: Voice, text: str) -> Path:
    return CACHE_DIR / f"{voice.id}_{_cache_key(voice, text)}.wav"


async def synthesize_wav_piper(text: str, voice: Voice) -> bytes:
    """Синтезируем текст через Piper (fallback). Кэшируем результат."""
    text = clean_text_for_tts(text or "")
    if not text:
        raise ValueError("empty text after cleanup")
    if len(text) > 5000:
        text = text[:5000]

    cache = _cache_path(voice, text)
    if cache.exists():
        return cache.read_bytes()

    model = VOICES_DIR / f"{voice.model_file}.onnx"
    if not model.exists():
        raise FileNotFoundError(f"voice model not found: {model}")

    tmp_out = CACHE_DIR / f"_tmp_{os.getpid()}_{_cache_key(voice, text)[:8]}.wav"
    args = [
        PIPER_BIN,
        "--model", str(model),
        "--output_file", str(tmp_out),
        "--length_scale", f"{voice.length_scale}",
        "--noise_scale", f"{voice.noise_scale}",
        "--noise_w", f"{voice.noise_w}",
        "--quiet",
    ]
    proc = await asyncio.create_subprocess_exec(
        *args,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        _, stderr = await asyncio.wait_for(proc.communicate(text.encode("utf-8")), timeout=120)
    except asyncio.TimeoutError:
        proc.kill()
        raise RuntimeError("piper timeout")

    if proc.returncode != 0:
        msg = (stderr or b"").decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"piper failed (code={proc.returncode}): {msg}")

    if not tmp_out.exists() or tmp_out.stat().st_size < 100:
        raise RuntimeError("piper produced no output")

    data = tmp_out.read_bytes()
    try:
        tmp_out.replace(cache)
    except Exception:
        try: tmp_out.unlink()
        except Exception: pass
    return data


async def synthesize_wav(
    text: str,
    voice_id: str | None = None,
    language: str | None = None,
    emotion: str | None = None,
    provider: str | None = None,
) -> bytes:
    """Универсальный синтез с fallback цепочкой: Yandex (RU) → ElevenLabs → Google → Edge → Piper.
    
    Args:
        text: текст для синтеза
        voice_id: ID голоса (yandex_*, elevenlabs_*, google_*, edge_*, или piper *)
        language: язык (en, ru) — для автовыбора голоса
        emotion: эмоция (happy, sad, angry, neutral) — для всех провайдеров
        provider: явное указание провайдера ("yandex", "elevenlabs", "google", "edge" или "piper")
    
    Returns:
        Audio bytes (MP3 или WAV в зависимости от провайдера)
    """
    # Определяем провайдер по voice_id или явному указанию
    if provider == "piper" or (voice_id and not voice_id.startswith(("yandex_", "elevenlabs_", "google_", "edge_"))):
        # Явно Piper или voice_id не из других провайдеров
        voice = resolve_voice(voice_id, language)
        if not voice:
            raise ValueError("No Piper voice available")
        return await synthesize_wav_piper(text, voice)
    
    # 🇷🇺 1️⃣ Пробуем Yandex SpeechKit (best quality for Russian)
    from app.core.config import get_settings
    from app.voice.yandex_provider import (
        HTTPX_AVAILABLE as YANDEX_AVAILABLE,
        resolve_yandex_voice,
        synthesize_yandex_wav,
    )
    
    s = get_settings()
    if YANDEX_AVAILABLE and s.yandex_api_key and (language == "ru" or (voice_id and voice_id.startswith("yandex_"))):
        yandex_voice = resolve_yandex_voice(voice_id)
        if yandex_voice:
            try:
                log.info("Trying Yandex TTS: voice=%s emotion=%s", yandex_voice.id, emotion)
                return await synthesize_yandex_wav(text, yandex_voice, emotion, s.yandex_api_key, CACHE_DIR)
            except Exception as e:
                log.warning("Yandex TTS failed (%s), falling back to ElevenLabs", e)
    
    # 🌟 2️⃣ Пробуем ElevenLabs (premium, best quality, emotions)
    from app.voice.elevenlabs_provider import (
        HTTPX_AVAILABLE as ELEVENLABS_AVAILABLE,
        resolve_elevenlabs_voice,
        synthesize_elevenlabs_mp3,
    )
    
    if ELEVENLABS_AVAILABLE and provider != "google" and provider != "edge" and provider != "yandex":
        elevenlabs_voice = resolve_elevenlabs_voice(voice_id, language)
        if elevenlabs_voice:
            try:
                log.info("Trying ElevenLabs TTS: voice=%s emotion=%s", elevenlabs_voice.id, emotion)
                return await synthesize_elevenlabs_mp3(text, elevenlabs_voice, emotion, CACHE_DIR)
            except Exception as e:
                log.warning("ElevenLabs TTS failed (%s), falling back to Google TTS", e)
    
    # 3️⃣ Fallback на Google Cloud TTS (premium, best free tier)
    from app.voice.google_provider import (
        GOOGLE_TTS_AVAILABLE,
        resolve_google_voice,
        synthesize_google_wav,
    )
    
    if GOOGLE_TTS_AVAILABLE and provider != "edge" and provider != "elevenlabs" and provider != "yandex":
        google_voice = resolve_google_voice(voice_id, language)
        if google_voice:
            try:
                log.info("Trying Google TTS: voice=%s emotion=%s", google_voice.id, emotion)
                return await synthesize_google_wav(text, google_voice, emotion, CACHE_DIR)
            except Exception as e:
                log.warning("Google TTS failed (%s), falling back to Edge TTS", e)
    
    # 4️⃣ Fallback на Edge TTS (free, good quality, может быть заблокирован)
    from app.voice.edge_provider import (
        EDGE_AVAILABLE,
        resolve_edge_voice,
        synthesize_edge_wav,
    )
    
    if EDGE_AVAILABLE and provider != "google" and provider != "elevenlabs" and provider != "yandex":
        edge_voice = resolve_edge_voice(voice_id, language)
        if edge_voice:
            try:
                log.info("Trying Edge TTS: voice=%s emotion=%s", edge_voice.id, emotion)
                return await synthesize_edge_wav(text, edge_voice, emotion, CACHE_DIR)
            except Exception as e:
                log.warning("Edge TTS failed (%s), falling back to Piper", e)
    
    # 5️⃣ Last resort: Piper (local, basic quality, always works)
    log.info("Using Piper fallback")
    voice = resolve_voice(voice_id, language)
    if not voice:
        raise RuntimeError("No voice provider available (all TTS providers failed or unavailable)")
    return await synthesize_wav_piper(text, voice)
