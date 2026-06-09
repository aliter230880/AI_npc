"""Боевой тест с настоящим LLM. Один цикл: выбираем Aria, шлём вопрос, печатаем ответ."""

import json
import sys
import httpx

BASE = "http://127.0.0.1:8000"

with httpx.Client(base_url=BASE, timeout=120) as c:
    info = c.get("/info").json()
    print("provider:", info["llm_provider"], "model:", info["default_model"])

    chars = c.get("/characters").json()
    aria = next((x for x in chars if "Aria" in x["name"]), chars[0])
    print(f"chatting with: {aria['name']}")

    sess = c.post("/chat/sessions", json={"character_id": aria["id"]}).json()
    print(f"session: {sess['id']}")

    question = "I'm looking for someone who disappeared three nights ago. Where do we start?"
    print(f"\n>>> me: {question}\n")

    r = c.post(f"/chat/sessions/{sess['id']}/messages", json={"content": question})
    if r.status_code != 200:
        print("FAIL", r.status_code, r.text[:600])
        sys.exit(1)
    data = r.json()
    print(f"<<< {aria['name']}:")
    print(data["assistant_message"]["content"])
    print(f"\n[tokens in={data['assistant_message']['tokens_in']} out={data['assistant_message']['tokens_out']} model={data['assistant_message']['model']}]")
