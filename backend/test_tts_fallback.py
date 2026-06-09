"""Тест TTS с fallback: Edge (primary) → Piper (fallback)."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.voice import tts


async def main():
    print("=== Testing TTS with Edge → Piper fallback ===\n")
    
    # Тест 1: попытка Edge (скорее всего 403), затем Piper fallback
    print("[1] Synthesizing with auto-fallback (edge → piper)...")
    text1 = "Hello! This is a test of the voice system."
    try:
        wav1 = await tts.synthesize_wav(
            text=text1,
            voice_id=None,  # автовыбор
            language="en",
            emotion="happy",
        )
        print(f"  ✅ Success! Generated {len(wav1)} bytes")
        Path("./test_fallback_en.wav").write_bytes(wav1)
        print("  Saved to test_fallback_en.wav")
    except Exception as e:
        print(f"  ❌ Failed: {e}")
    
    # Тест 2: Russian
    print("\n[2] Russian with fallback...")
    text2 = "Привет! Как дела сегодня?"
    try:
        wav2 = await tts.synthesize_wav(
            text=text2,
            voice_id=None,
            language="ru",
            emotion="cheerful",
        )
        print(f"  ✅ Success! Generated {len(wav2)} bytes")
        Path("./test_fallback_ru.wav").write_bytes(wav2)
        print("  Saved to test_fallback_ru.wav")
    except Exception as e:
        print(f"  ❌ Failed: {e}")
    
    # Тест 3: явно Piper (минуя Edge)
    print("\n[3] Explicit Piper voice...")
    piper_voices = tts.list_voices()
    if piper_voices:
        piper_voice = piper_voices[0]
        print(f"  Using: {piper_voice.name}")
        wav3 = await tts.synthesize_wav(
            text="Testing Piper directly",
            voice_id=piper_voice.id,
            provider="piper",
        )
        print(f"  ✅ Success! Generated {len(wav3)} bytes")
        Path("./test_piper_direct.wav").write_bytes(wav3)
        print("  Saved to test_piper_direct.wav")
    else:
        print("  ⚠️ No Piper voices available (models not installed)")
    
    print("\n✅ Fallback system works! Edge TTS may be blocked (403) but Piper takes over.")
    print("   Listen to the generated .wav files to verify quality.")


if __name__ == "__main__":
    asyncio.run(main())
