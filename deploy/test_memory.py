"""Тест долговременной памяти против прод-сервера.

Сценарий:
1. Регистрируемся
2. Открываем сессию с Aria, ведём диалог где сообщаем факты о себе
3. Набираем >= memory_summarize_every сообщений (8) чтобы сработала суммаризация
4. Ждём фоновую суммаризацию
5. Открываем НОВУЮ сессию, спрашиваем про факт → персонаж должен вспомнить
"""

import time
import uuid
import httpx

BASE = "https://ai.aliterra.space/api"

def main():
    with httpx.Client(base_url=BASE, timeout=120) as c:
        email = f"memtest+{uuid.uuid4().hex[:8]}@example.com"
        tok = c.post("/auth/register", json={
            "email": email, "password": "supersecret123", "is_adult": True
        }).json()
        h = {"Authorization": f"Bearer {tok['access_token']}"}
        print(f"registered {email}")

        chars = c.get("/characters").json()
        aria = next(x for x in chars if "Aria" in x["name"])
        print(f"using {aria['name']} ({aria['id']})")

        # --- Сессия 1: сообщаем факты ---
        s1 = c.post("/chat/sessions", json={"character_id": aria["id"]}, headers=h).json()
        print(f"session1 {s1['id']}")

        facts = [
            "My name is Viktor and I run a small vineyard in Crimea.",
            "My dog's name is Baron, a huge black Newfoundland.",
            "I'm investigating who stole three barrels of my best wine last week.",
            "I suspect my neighbor Grigory, he was jealous of my gold medal.",
            "Also, I'm terrified of the sea even though I live near it.",
        ]
        for i, f in enumerate(facts, 1):
            r = c.post(f"/chat/sessions/{s1['id']}/messages", json={"content": f}, headers=h)
            if r.status_code != 200:
                print(f"  msg {i} FAIL {r.status_code}: {r.text[:200]}")
                return
            reply = r.json()["assistant_message"]["content"]
            print(f"  [{i}] sent fact, reply: {reply[:70]}...")

        print("waiting 12s for background summarization...")
        time.sleep(12)

        # --- Сессия 2: проверяем память ---
        s2 = c.post("/chat/sessions", json={"character_id": aria["id"]}, headers=h).json()
        print(f"session2 {s2['id']} (fresh)")

        probe = "Hey, do you remember anything about me? My name, my dog, my problem?"
        r = c.post(f"/chat/sessions/{s2['id']}/messages", json={"content": probe}, headers=h)
        ans = r.json()["assistant_message"]["content"]
        print("\n=== PROBE ANSWER ===")
        print(ans)
        print("====================\n")

        low = ans.lower()
        hits = [w for w in ["viktor", "baron", "wine", "vineyard", "grigory", "crimea", "sea"] if w in low]
        print(f"recalled keywords: {hits}")
        print("MEMORY WORKS" if len(hits) >= 2 else "MEMORY WEAK/FAILED — check logs")


if __name__ == "__main__":
    main()
