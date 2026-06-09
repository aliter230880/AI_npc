"""Тест Silero TTS на сервере."""
import os, sys, time
os.environ.setdefault("HOME", "/opt/character-platform/data")
os.environ.setdefault("HF_HOME", "/opt/character-platform/data/hf-cache")
os.environ.setdefault("TORCH_HOME", "/opt/character-platform/data/torch-cache")
sys.path.insert(0, "/opt/character-platform/backend")

from app.voice.silero_provider import SileroProvider

p = SileroProvider()
print("voices:", len(p.list_voices()))

print("synth RU...")
t = time.time()
r = p.synthesize("Привет! Я детектив Ария. Чем могу помочь в этот дождливый вечер?", "ru:baya")
dt = time.time() - t
print(f"  RU ok: {len(r.audio)} bytes, {dt:.1f}s, sr={r.sample_rate}")
open("/opt/character-platform/data/tts-cache/_test_ru.wav", "wb").write(r.audio)

print("synth EN...")
t = time.time()
r = p.synthesize("Take a seat. Tell me what kind of trouble brought you here.", "en:en_0")
dt = time.time() - t
print(f"  EN ok: {len(r.audio)} bytes, {dt:.1f}s")
open("/opt/character-platform/data/tts-cache/_test_en.wav", "wb").write(r.audio)
print("DONE")
