"""Быстрый тест Google Cloud TTS с API Key."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.voice.google_provider import (
    GOOGLE_TTS_AVAILABLE,
    list_google_voices,
    resolve_google_voice,
    synthesize_google_wav,
)


async def main():
    print(f"✓ Google TTS available: {GOOGLE_TTS_AVAILABLE}")
    if not GOOGLE_TTS_AVAILABLE:
        print("❌ google-cloud-texttospeech not installed")
        print("   Run: pip install google-cloud-texttospeech")
        return
    
    print("\n=== Available Google voices ===")
    voices = list_google_voices()
    for v in voices:
        print(f"  {v.id:40s} {v.language} {v.gender:6s} {v.name}")
    
    print("\n=== Testing English Neural2-A (warm & friendly) ===")
    voice = resolve_google_voice("google_en_female_neural2_a", "en")
    if not voice:
        print("❌ Voice not found!")
        return
    
    text = "Hello! This is a test of Google Cloud Text to Speech. The quality is amazing, almost like Eleven Labs!"
    print(f"📝 Text: {text}")
    print(f"🎤 Voice: {voice.name} ({voice.voice_type})")
    
    try:
        print("\n🔄 Synthesizing...")
        audio = await synthesize_google_wav(text, voice, emotion="happy", cache_dir=Path("./test_cache"))
        print(f"✅ Success! Generated {len(audio):,} bytes")
        
        output_file = Path("./test_google_tts.mp3")
        output_file.write_bytes(audio)
        print(f"💾 Saved to: {output_file.absolute()}")
        print("\n🎵 Play the file to check quality!")
        
    except Exception as e:
        print(f"❌ Failed: {e}")
        print("\n🔍 Troubleshooting:")
        print("  1. Check GOOGLE_TTS_API_KEY in .env")
        print("  2. Verify API Key has 'Cloud Text-to-Speech API' restriction")
        print("  3. Check Text-to-Speech API is enabled in Google Cloud Console")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
