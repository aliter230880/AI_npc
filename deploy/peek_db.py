"""Достать последние 20 сообщений из БД, чтобы увидеть что говорят персонажи."""
import sqlite3
DB = "/opt/character-platform/data/character_platform.db"
c = sqlite3.connect(DB)
rows = c.execute(
    "SELECT m.role, substr(m.content, 1, 600), m.created_at, ch.name "
    "FROM messages m "
    "JOIN conversations conv ON conv.id = m.conversation_id "
    "JOIN characters ch ON ch.id = conv.character_id "
    "ORDER BY m.created_at DESC LIMIT 20"
).fetchall()
for r in rows:
    role, txt, ts, name = r
    print(f"--- [{ts}] {name} :: {role.upper()} ---")
    print(txt)
    print()
