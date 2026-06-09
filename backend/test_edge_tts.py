"""Тест Edge TTS локально — проверяем что всё работает до деплоя."""

import asyncio
import sys
from pathlib import Path

# добавляем app в path
sys.path.insert(0, str(Path(__file__).parent))

from app.voice.edge_provider import (
    EDGE_AVAILABLE,
    list_edge_voices,
    resolve_edge_voice,
    synthesize_edge_wav,
)


async def main():
    print(f"Edge TTS available: {EDGE_AVAILABLE}")
    if not EDGE_AVAILABLE:
        print("edge-tts not installed, run: pip install edge-tts==6.1.12")
        return
    
    print("\n=== Available Edge voices ===")
    voices = list_edge_voices()
    for v in voices:
        print(f"  {v.id:35s} {v.language} {v.gender:6s} {v.style:10s} {v.name}")
    
    print("\n=== Testing English female friendly ===")
    voice = resolve_edge_voice("edge_en_female_aria_friendly", "en")
    if not voice:
        print("Voice not found!")
        return
    
    print(f"Selected: {voice.name} ({voice.edge_voice_id})")
    
    # Тест 1: без эмоции
    print("\n[1] Neutral emotion...")
    text1 = "Hello there! How are you today?"
    wav1 = await synthesize_edge_wav(text1, voice, emotion=None, cache_dir=Path("./test_cache"))
    print(f"  Generated {len(wav1)} bytes")
    Path("./test_edge_neutral.wav").write_bytes(wav1)
    print("  Saved to test_edge_neutral.wav")
    
    # Тест 2: happy
    print("\n[2] Happy emotion...")
    text2 = "This is amazing! I'm so excited!"
    wav2 = await synthesize_edge_wav(text2, voice, emotion="happy", cache_dir=Path("./test_cache"))
    print(f"  Generated {len(wav2)} bytes")
    Path("./test_edge_happy.wav").write_bytes(wav2)
    print("  Saved to test_edge_happy.wav")
    
    # Тест 3: sad
    print("\n[3] Sad emotion...")
    text3 = "I'm feeling a bit down today..."
    wav3 = await synthesize_edge_wav(text3, voice, emotion="sad", cache_dir=Path("./test_cache"))
    print(f"  Generated {len(wav3)} bytes")
    Path("./test_edge_sad.wav").write_bytes(wav3)
    print("  Saved to test_edge_sad.wav")
    
    # Тест 4: Russian
    print("\n[4] Russian voice...")
    ru_voice = resolve_edge_voice("edge_ru_female_svetlana", "ru")
    if ru_voice:
        text4 = "Привет! Как дела?"
        wav4 = await synthesize_edge_wav(text4, ru_voice, emotion="cheerful", cache_dir=Path("./test_cache"))
        print(f"  Generated {len(wav4)} bytes")
        Path("./test_edge_russian.wav").write_bytes(wav4)
        print("  Saved to test_edge_russian.wav")
    
    print("\n✅ All tests passed! Check the generated .wav files.")
    print("   (Note: Edge TTS returns MP3 if pydub not installed, but browsers play both)")


if __name__ == "__main__":
    asyncio.run(main())
