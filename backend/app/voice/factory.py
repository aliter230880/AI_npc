"""Выбор TTS-провайдера. Сейчас всегда Silero; позже добавим ElevenLabs/Yandex по env."""

from __future__ import annotations

from functools import lru_cache

from app.voice.base import TTSProvider
from app.voice.silero_provider import SileroProvider


@lru_cache
def get_tts() -> TTSProvider:
    # В будущем: смотреть settings.tts_provider и возвращать нужный.
    return SileroProvider()
