"""Проверить что у демо-персонажей прописаны Piper-голоса."""
import sqlite3
DB = "/opt/character-platform/data/character_platform.db"
c = sqlite3.connect(DB)
rows = c.execute(
    "SELECT name, voice_provider, voice_id, substr(greeting, 1, 100) "
    "FROM characters WHERE owner_id IS NULL"
).fetchall()
for r in rows:
    print(r)
