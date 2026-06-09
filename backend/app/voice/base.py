"""Абстракция TTS-провайдера.

Один интерфейс под Silero (локально, сейчас) и ElevenLabs/Yandex (API, потом).
Возвращаем WAV-байты + sample rate; конвертацию в ogg/mp3 делает слой выше при нужде.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class VoiceInfo:
    id: str            # внутренний id голоса, напр. "silero:ru:baya"
    provider: str      # "silero" | "elevenlabs" | ...
    language: str      # "ru", "en", ...
    gender: str        # "female" | "male" | "neutral"
    title: str         # человекочитаемое имя


@dataclass
class TTSResult:
    audio: bytes       # WAV PCM bytes
    sample_rate: int
    voice_id: str
    format: str = "wav"


class TTSProvider(ABC):
    name: str = "base"

    @abstractmethod
    def list_voices(self) -> list[VoiceInfo]:
        ...

    @abstractmethod
    def synthesize(self, text: str, voice_id: str | None = None) -> TTSResult:
        """Синхронный синтез (Silero — CPU-bound, гоняем в threadpool на уровне API)."""
        ...

    def default_voice(self, language: str) -> str:
        voices = [v for v in self.list_voices() if v.language == language]
        if voices:
            return voices[0].id
        all_voices = self.list_voices()
        return all_voices[0].id if all_voices else ""
