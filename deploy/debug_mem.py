"""Прямая проверка цепочки памяти на сервере, с выводом ошибок."""
import os, asyncio, logging
logging.basicConfig(level=logging.INFO)

# те же env что у сервиса
os.environ.setdefault("HOME", "/opt/character-platform/data")
os.environ.setdefault("HF_HOME", "/opt/character-platform/data/hf-cache")
os.environ.setdefault("HF_HUB_CACHE", "/opt/character-platform/data/hf-cache/hub")
os.environ.setdefault("SENTENCE_TRANSFORMERS_HOME", "/opt/character-platform/data/hf-cache")
os.environ.setdefault("XDG_CACHE_HOME", "/opt/character-platform/data/cache")

import sys
sys.path.insert(0, "/opt/character-platform/backend")

from app.memory import store
from app.memory.summarizer import summarize

async def main():
    print("1. embed test...")
    try:
        from app.memory.embedder import embed
        v = embed(["passage: test"])
        print("   embed OK, dim=", len(v[0]))
    except Exception as e:
        import traceback; traceback.print_exc()
        return

    print("2. remember test...")
    mid = store.remember("test-char", "test-user", "Viktor owns a vineyard in Crimea, dog Baron.")
    print("   remember id=", mid)

    print("3. recall test...")
    res = store.recall("test-char", "test-user", "what do you know about me?", limit=4, min_score=0.1)
    print("   recall:", [(round(m.score,3), m.text[:50]) for m in res])

    print("4. summarize test...")
    note = await summarize([("user","My name is Viktor, I have a dog Baron"),("assistant","Nice to meet you Viktor")])
    print("   summary:", note)

asyncio.run(main())
