"""HTTP API для голоса: список голосов и синтез речи."""

from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.db.schemas import VoiceRead
from app.voice import tts

router = APIRouter(prefix="/voice", tags=["voice"])


_CYRILLIC = re.compile(r"[А-яЁё]")
_CJK = re.compile(r"[\u4e00-\u9fff]")


def _detect_lang(text: str) -> str | None:
    """Грубая детекция языка по содержимому текста — чтобы выбрать правильный голос."""
    if not text:
        return None
    if _CYRILLIC.search(text):
        return "ru"
    if _CJK.search(text):
        return "zh"
    # дефолт английский
    return "en"


def _voice_supports_lang(voice_id: str, target_lang: str) -> bool:
    v = tts.VOICES.get(voice_id)
    return bool(v and v.language == target_lang)


def _switch_voice_to_lang(voice_id: str, target_lang: str) -> str | None:
    """Если выбранный голос на другом языке — пробуем взять одного пола/стиля
    но на нужном языке. Например `en_female_calm` + ru → `ru_female_calm`."""
    src = tts.VOICES.get(voice_id)
    if not src:
        return None
    candidate = f"{target_lang}_{src.gender}_{src.style}"
    if candidate in tts.VOICES:
        return candidate
    # фолбэк — любой голос того языка с тем же полом
    for v in tts.VOICES.values():
        if v.language == target_lang and v.gender == src.gender:
            return v.id
    return None


@router.get("/voices", response_model=list[VoiceRead])
def voices() -> list[VoiceRead]:
    """Возвращает все доступные голоса: ElevenLabs → Google TTS → Edge TTS → Piper."""
    result = []
    
    # 🌟 ElevenLabs голоса (premium, лучшее качество, эмоции)
    from app.voice.elevenlabs_provider import list_elevenlabs_voices
    for v in list_elevenlabs_voices():
        result.append(
            VoiceRead(
                id=v.id,
                name=f"⭐ {v.name} (ElevenLabs Premium)",
                language=v.language,
                gender=v.gender,
                style=v.style,
            )
        )
    
    # Google Cloud TTS голоса (premium качество, бесплатно 1М/мес)
    from app.voice.google_provider import list_google_voices
    for v in list_google_voices():
        result.append(
            VoiceRead(
                id=v.id,
                name=f"{v.name} ({v.voice_type})",
                language=v.language,
                gender=v.gender,
                style=v.style,
            )
        )
    
    # Edge TTS голоса (хорошее качество, может быть заблокирован)
    from app.voice.edge_provider import list_edge_voices
    for v in list_edge_voices():
        result.append(
            VoiceRead(
                id=v.id,
                name=f"{v.name} (Edge)",
                language=v.language,
                gender=v.gender,
                style=v.style,
            )
        )
    
    # Piper голоса (fallback, базовое качество)
    for v in tts.list_voices():
        result.append(
            VoiceRead(
                id=v.id,
                name=f"{v.name} (Piper fallback)",
                language=v.language,
                gender=v.gender,
                style=v.style,
            )
        )
    
    return result


@router.get("/tts")
async def tts_get(
    text: str = Query(..., min_length=1, max_length=5000),
    voice: str | None = Query(None, description="voice_id (google_*, edge_*, or piper); иначе подберём по языку"),
    language: str | None = Query(None, description="iso2 код языка для дефолтного голоса"),
    emotion: str | None = Query(None, description="эмоция: happy, sad, angry, neutral, etc."),
) -> Response:
    """Синтез текста в audio (MP3/WAV). GET-вариант удобен для <audio src=...>
    
    Использует Google TTS (primary) → Edge TTS (secondary) → Piper (fallback).
    """
    # Очищаем текст до выбора голоса — детектим язык по реальному содержимому
    cleaned = tts.clean_text_for_tts(text)
    detected_lang = _detect_lang(cleaned)
    final_lang = detected_lang or language or "en"
    
    try:
        # Новая универсальная функция синтеза (Edge → Piper fallback)
        audio_data = await tts.synthesize_wav(
            text=cleaned,
            voice_id=voice,
            language=final_lang,
            emotion=emotion,
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS error: {e}")
    
    headers = {
        "Cache-Control": "public, max-age=86400",
        "X-Voice-Id": voice or "auto",
        "X-Detected-Lang": detected_lang or "",
        "X-Emotion": emotion or "neutral",
    }
    
    # Edge может вернуть MP3 если нет pydub, определяем по magic bytes
    media_type = "audio/wav"
    if audio_data[:3] == b"ID3" or audio_data[:2] == b"\xff\xfb":
        media_type = "audio/mpeg"
    
    return Response(content=audio_data, media_type=media_type, headers=headers)
