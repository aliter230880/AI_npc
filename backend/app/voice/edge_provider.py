"""Edge TTS провайдер — бесплатный Microsoft TTS через edge-tts библиотеку.

Качество 4/5, 400+ голосов, много языков, эмоциональные стили.
Работает через неофициальный API (обратная инженерия Edge браузера).

⚠️ Риски:
- Нет SLA, Microsoft может заблокировать
- Rate-limit непредсказуемый
- Поэтому используется как primary, но с fallback на Piper

Преимущества:
- Бесплатно навсегда
- Качество значительно лучше Piper
- Поддержка эмоций через SSML (pitch, rate, volume)
- Множество голосов для всех языков
"""

from __future__ import annotations

import asyncio
import hashlib
import io
import logging
from dataclasses import dataclass
from pathlib import Path

log = logging.getLogger(__name__)

# edge-tts ставим через requirements.txt
try:
    import edge_tts
    EDGE_AVAILABLE = True
except ImportError:
    EDGE_AVAILABLE = False
    log.warning("edge-tts not installed, Edge TTS provider disabled")


@dataclass(frozen=True)
class EdgeVoice:
    """Пресет Edge TTS голоса."""
    id: str                 # "edge_en_female_aria"
    name: str               # "Aria — friendly & warm"
    language: str           # "en", "ru"
    gender: str             # "female" / "male"
    style: str              # "calm" / "cheerful" / "sad" / "angry" и т.д.
    edge_voice_id: str      # "en-US-AriaNeural"
    edge_style: str | None = None  # "cheerful", "sad", "angry", "friendly"
    pitch: str = "+0Hz"     # "+5Hz" / "-10Hz"
    rate: str = "+0%"       # "+10%" (faster) / "-10%" (slower)
    volume: str = "+0%"     # "+10%" (louder) / "-10%" (quieter)


# Каталог Edge TTS голосов — выбрал лучшие Neural голоса для EN и RU
# Полный список: https://github.com/rany2/edge-tts/blob/master/src/edge_tts/list.py
EDGE_VOICES: dict[str, EdgeVoice] = {
    # ENGLISH FEMALE
    "edge_en_female_aria_friendly": EdgeVoice(
        id="edge_en_female_aria_friendly",
        name="Aria — friendly & warm",
        language="en",
        gender="female",
        style="calm",
        edge_voice_id="en-US-AriaNeural",
        edge_style="friendly",
    ),
    "edge_en_female_aria_cheerful": EdgeVoice(
        id="edge_en_female_aria_cheerful",
        name="Aria — cheerful",
        language="en",
        gender="female",
        style="cheerful",
        edge_voice_id="en-US-AriaNeural",
        edge_style="cheerful",
    ),
    "edge_en_female_jenny": EdgeVoice(
        id="edge_en_female_jenny",
        name="Jenny — professional",
        language="en",
        gender="female",
        style="calm",
        edge_voice_id="en-US-JennyNeural",
    ),
    # ENGLISH MALE
    "edge_en_male_guy": EdgeVoice(
        id="edge_en_male_guy",
        name="Guy — confident",
        language="en",
        gender="male",
        style="calm",
        edge_voice_id="en-US-GuyNeural",
    ),
    "edge_en_male_eric_friendly": EdgeVoice(
        id="edge_en_male_eric_friendly",
        name="Eric — friendly",
        language="en",
        gender="male",
        style="cheerful",
        edge_voice_id="en-US-EricNeural",
        edge_style="friendly",
    ),
    # RUSSIAN FEMALE
    "edge_ru_female_svetlana": EdgeVoice(
        id="edge_ru_female_svetlana",
        name="Светлана — спокойная",
        language="ru",
        gender="female",
        style="calm",
        edge_voice_id="ru-RU-SvetlanaNeural",
    ),
    "edge_ru_female_dariya": EdgeVoice(
        id="edge_ru_female_dariya",
        name="Дарья — дружелюбная",
        language="ru",
        gender="female",
        style="cheerful",
        edge_voice_id="ru-RU-DariyaNeural",
    ),
    # RUSSIAN MALE
    "edge_ru_male_dmitry": EdgeVoice(
        id="edge_ru_male_dmitry",
        name="Дмитрий — спокойный",
        language="ru",
        gender="male",
        style="calm",
        edge_voice_id="ru-RU-DmitryNeural",
    ),
}

DEFAULT_EDGE_VOICE_BY_LANG = {
    "en": "edge_en_female_aria_friendly",
    "ru": "edge_ru_female_svetlana",
}


def list_edge_voices() -> list[EdgeVoice]:
    """Все доступные Edge голоса."""
    if not EDGE_AVAILABLE:
        return []
    return list(EDGE_VOICES.values())


def resolve_edge_voice(voice_id: str | None, language: str | None = None) -> EdgeVoice | None:
    """Найти Edge голос по ID или дефолт по языку."""
    if not EDGE_AVAILABLE:
        return None
    if voice_id and voice_id in EDGE_VOICES:
        return EDGE_VOICES[voice_id]
    if language:
        lang_code = language.split("-")[0].lower()
        default_id = DEFAULT_EDGE_VOICE_BY_LANG.get(lang_code)
        if default_id and default_id in EDGE_VOICES:
            return EDGE_VOICES[default_id]
    voices = list_edge_voices()
    return voices[0] if voices else None


def _build_ssml(text: str, voice: EdgeVoice, emotion: str | None = None) -> str:
    """Собираем SSML с учётом эмоции персонажа.
    
    Эмоции влияют на pitch (тон) и rate (скорость):
    - happy, cheerful → pitch +5Hz, rate +5%
    - sad, confused → pitch -5Hz, rate -5%
    - angry, scared → pitch +10Hz, rate +10%
    - neutral → без изменений
    """
    pitch = voice.pitch
    rate = voice.rate
    volume = voice.volume
    
    # Динамическая подстройка под эмоцию
    if emotion:
        emotion_lower = emotion.lower()
        if emotion_lower in ("happy", "cheerful", "excited"):
            # Позитивные эмоции — выше тон, быстрее темп
            pitch = "+5Hz"
            rate = "+5%"
        elif emotion_lower in ("sad", "confused", "tired"):
            # Грустные — ниже тон, медленнее темп
            pitch = "-5Hz"
            rate = "-5%"
        elif emotion_lower in ("angry", "scared", "surprised"):
            # Резкие эмоции — высокий тон, быстрый темп
            pitch = "+10Hz"
            rate = "+10%"
        elif emotion_lower == "flirty":
            # Флирт — чуть выше тон, нормальный темп
            pitch = "+3Hz"
            rate = "+0%"
    
    # Edge TTS SSML структура
    ssml = f"""<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
    <voice name="{voice.edge_voice_id}">
        <prosody pitch="{pitch}" rate="{rate}" volume="{volume}">
"""
    
    # Если голос поддерживает стили (express-as) — используем
    if voice.edge_style:
        ssml += f'        <mstts:express-as style="{voice.edge_style}" xmlns:mstts="https://www.w3.org/2001/mstts">\n'
    
    # Экранируем спецсимволы XML
    safe_text = (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )
    
    ssml += f"            {safe_text}\n"
    
    if voice.edge_style:
        ssml += "        </mstts:express-as>\n"
    
    ssml += """        </prosody>
    </voice>
</speak>"""
    
    return ssml


def _cache_key(voice: EdgeVoice, text: str, emotion: str | None) -> str:
    """Ключ кэша: voice + text + emotion."""
    raw = f"{voice.id}|{text}|{emotion or ''}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


async def synthesize_edge_wav(
    text: str,
    voice: EdgeVoice,
    emotion: str | None = None,
    cache_dir: Path | None = None,
) -> bytes:
    """Синтез через Edge TTS с кэшированием.
    
    Args:
        text: текст для синтеза
        voice: Edge голос
        emotion: опциональная эмоция (happy, sad, angry, etc.)
        cache_dir: папка кэша (если None — без кэша)
    
    Returns:
        WAV bytes (не MP3!)
    
    Raises:
        RuntimeError: если Edge TTS недоступен или упал (403, timeout, etc.)
    """
    if not EDGE_AVAILABLE:
        raise RuntimeError("edge-tts library not installed")
    
    # Чистим текст (переиспользуем функцию из tts.py)
    from app.voice.tts import clean_text_for_tts
    text = clean_text_for_tts(text)
    if not text:
        raise ValueError("empty text after cleanup")
    if len(text) > 5000:
        text = text[:5000]
    
    # Проверяем кэш
    if cache_dir:
        cache_dir.mkdir(parents=True, exist_ok=True)
        cache_file = cache_dir / f"edge_{voice.id}_{_cache_key(voice, text, emotion)}.wav"
        if cache_file.exists():
            return cache_file.read_bytes()
    
    # Синтезируем через Edge TTS
    ssml = _build_ssml(text, voice, emotion)
    
    try:
        communicate = edge_tts.Communicate(ssml, voice.edge_voice_id)
        
        # Собираем аудио-чанки в памяти
        audio_chunks: list[bytes] = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_chunks.append(chunk["data"])
        
        if not audio_chunks:
            raise RuntimeError("Edge TTS returned no audio data")
        
        # Edge TTS возвращает MP3, но нам нужен WAV для единообразия
        # Конвертируем через pydub (если есть) или отдаём MP3 как есть
        audio_data = b"".join(audio_chunks)
        
        try:
            from pydub import AudioSegment
            # Конвертируем MP3 → WAV
            mp3_io = io.BytesIO(audio_data)
            audio = AudioSegment.from_mp3(mp3_io)
            wav_io = io.BytesIO()
            audio.export(wav_io, format="wav")
            wav_data = wav_io.getvalue()
        except ImportError:
            # pydub нет — отдаём MP3 (браузер всё равно проиграет)
            log.warning("pydub not installed, returning MP3 instead of WAV")
            wav_data = audio_data
        
        # Сохраняем в кэш
        if cache_dir:
            try:
                cache_file.write_bytes(wav_data)
            except Exception as e:
                log.warning("failed to cache Edge TTS result: %s", e)
        
        return wav_data
    
    except Exception as e:
        # Если 403 (блокировка Microsoft) или любая другая ошибка — райсим для fallback на Piper
        error_msg = str(e)
        if "403" in error_msg or "Forbidden" in error_msg:
            log.warning("Edge TTS blocked (403) — region/IP restriction, falling back to Piper")
        elif "timeout" in error_msg.lower():
            log.warning("Edge TTS timeout — falling back to Piper")
        else:
            log.warning("Edge TTS failed: %s — falling back to Piper", error_msg)
        raise RuntimeError(f"Edge TTS unavailable: {error_msg}") from e
