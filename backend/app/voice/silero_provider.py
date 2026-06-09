"""Silero TTS v4 — локальный синтез речи на CPU.

Модели тянутся из torch.hub при первом обращении и кэшируются.
Каждая языковая модель отдельная (ru_v4, en_v3 и т.д.), держим их лениво.

Голоса (на момент v4):
  RU (v4_ru): aidar(m), baya(f), kseniya(f), xenia(f), eugene(m)
  EN (v3_en): en_0..en_117 (берём пару показательных)
"""

from __future__ import annotations

import logging
import threading

from app.voice.base import TTSProvider, TTSResult, VoiceInfo

log = logging.getLogger(__name__)

SAMPLE_RATE = 48000

# Каталог голосов которые показываем юзеру. id формат: "<lang>:<speaker>"
_VOICES: list[VoiceInfo] = [
    VoiceInfo(id="ru:baya", provider="silero", language="ru", gender="female", title="Baya (RU)"),
    VoiceInfo(id="ru:kseniya", provider="silero", language="ru", gender="female", title="Kseniya (RU)"),
    VoiceInfo(id="ru:xenia", provider="silero", language="ru", gender="female", title="Xenia (RU)"),
    VoiceInfo(id="ru:aidar", provider="silero", language="ru", gender="male", title="Aidar (RU)"),
    VoiceInfo(id="ru:eugene", provider="silero", language="ru", gender="male", title="Eugene (RU)"),
    VoiceInfo(id="en:en_0", provider="silero", language="en", gender="female", title="English F1"),
    VoiceInfo(id="en:en_3", provider="silero", language="en", gender="male", title="English M1"),
    VoiceInfo(id="en:en_10", provider="silero", language="en", gender="female", title="English F2"),
]

# Параметры torch.hub для каждого языка
_LANG_MODELS = {
    "ru": {"language": "ru", "model_id": "v4_ru"},
    "en": {"language": "en", "model_id": "v3_en"},
}

_DEFAULT_SPEAKER = {"ru": "baya", "en": "en_0"}


class SileroProvider(TTSProvider):
    name = "silero"

    def __init__(self) -> None:
        self._models: dict[str, object] = {}
        self._lock = threading.Lock()

    def list_voices(self) -> list[VoiceInfo]:
        return list(_VOICES)

    def _get_model(self, lang: str):
        if lang not in _LANG_MODELS:
            lang = "en"
        if lang in self._models:
            return self._models[lang]
        with self._lock:
            if lang in self._models:
                return self._models[lang]
            import torch
            torch.set_num_threads(2)  # у нас 2 ядра
            cfg = _LANG_MODELS[lang]
            log.info("silero: loading model lang=%s id=%s", lang, cfg["model_id"])
            model, _ = torch.hub.load(
                repo_or_dir="snakers4/silero-models",
                model="silero_tts",
                language=cfg["language"],
                speaker=cfg["model_id"],
                trust_repo=True,
            )
            model.to("cpu")
            self._models[lang] = model
            return model

    def _parse_voice(self, voice_id: str | None, fallback_lang: str = "ru") -> tuple[str, str]:
        """voice_id 'ru:baya' -> ('ru','baya'). Пустой -> дефолт."""
        if voice_id and ":" in voice_id:
            lang, speaker = voice_id.split(":", 1)
            return lang, speaker
        lang = fallback_lang
        return lang, _DEFAULT_SPEAKER.get(lang, "baya")

    def synthesize(self, text: str, voice_id: str | None = None) -> TTSResult:
        text = (text or "").strip()
        if not text:
            raise ValueError("empty text")
        # ограничим длину — Silero на длинных текстах подвисает на CPU
        if len(text) > 1000:
            text = text[:1000]

        lang, speaker = self._parse_voice(voice_id)
        model = self._get_model(lang)

        import torch  # noqa
        audio_tensor = model.apply_tts(
            text=text,
            speaker=speaker,
            sample_rate=SAMPLE_RATE,
            put_accent=True,
            put_yo=True,
        )
        # audio_tensor: float32 [-1,1] -> 16-bit PCM WAV
        import io
        import wave
        import numpy as np

        pcm = (audio_tensor.numpy() * 32767).astype(np.int16)
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SAMPLE_RATE)
            w.writeframes(pcm.tobytes())
        return TTSResult(audio=buf.getvalue(), sample_rate=SAMPLE_RATE, voice_id=f"{lang}:{speaker}")
