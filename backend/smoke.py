"""Smoke-тест API. Запускать при поднятом сервере на 127.0.0.1:8000."""

from __future__ import annotations

import json
import sys
import uuid

import httpx

BASE = "http://127.0.0.1:8000"


def step(title: str) -> None:
    print(f"\n=== {title} ===")


def must(resp: httpx.Response, expected: int = 200) -> dict | list:
    if resp.status_code != expected:
        print(f"  FAIL {resp.status_code}: {resp.text[:400]}")
        sys.exit(1)
    if resp.headers.get("content-type", "").startswith("application/json"):
        return resp.json()
    return {"text": resp.text[:200]}


def main() -> None:
    with httpx.Client(base_url=BASE, timeout=30) as c:
        step("/health")
        print(must(c.get("/health")))

        step("/info")
        info = must(c.get("/info"))
        print(json.dumps(info, indent=2))

        step("Public characters (should have demo seed)")
        chars = must(c.get("/characters"))
        print(f"  found: {len(chars)}")
        for ch in chars[:5]:
            print(f"   - {ch['name']} (public={ch['is_public']})")

        # уникальный email чтобы повторный прогон не падал
        email = f"smoke+{uuid.uuid4().hex[:8]}@example.com"
        step(f"Register {email}")
        tok = must(c.post("/auth/register", json={
            "email": email,
            "password": "supersecret123",
            "display_name": "Smoke Tester",
            "is_adult": True,
        }), expected=201)
        access = tok["access_token"]
        h = {"Authorization": f"Bearer {access}"}
        print(f"  got tokens")

        step("/auth/me")
        me = must(c.get("/auth/me", headers=h))
        print(json.dumps(me, indent=2))

        step("Create my character")
        body = {
            "name": "Test Bot",
            "description": "A test character.",
            "system_prompt": "You are a helpful test assistant.",
            "greeting": "Hi! I'm Test Bot. What's up?",
            "is_public": False,
            "language": "en",
        }
        ch = must(c.post("/characters", json=body, headers=h), expected=201)
        char_id = ch["id"]
        print(f"  created id={char_id}")

        step("Open chat session")
        session = must(c.post("/chat/sessions", json={"character_id": char_id}, headers=h), expected=201)
        session_id = session["id"]
        print(f"  session={session_id}")

        step("List initial messages (greeting expected)")
        msgs = must(c.get(f"/chat/sessions/{session_id}/messages", headers=h))
        print(f"  initial messages: {len(msgs)}")
        for m in msgs:
            print(f"   [{m['role']}] {m['content'][:80]}")

        step("Send a message — stub LLM should reply")
        reply = must(c.post(
            f"/chat/sessions/{session_id}/messages",
            json={"content": "Hello, who are you?"},
            headers=h,
        ))
        print(f"  user: {reply['user_message']['content']}")
        print(f"  assistant: {reply['assistant_message']['content']}")

        step("SSE stream a message")
        with c.stream(
            "POST",
            f"/chat/sessions/{session_id}/stream",
            json={"content": "Tell me a one-liner joke."},
            headers=h,
        ) as resp:
            if resp.status_code != 200:
                print(f"  FAIL {resp.status_code}: {resp.read().decode()[:300]}")
                sys.exit(1)
            collected = []
            for line in resp.iter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[5:]  # без strip — внутри могут быть значимые пробелы
                if data.startswith(" "):
                    data = data[1:]
                if data == "[DONE]":
                    break
                collected.append(data.replace("\\n", "\n"))
            full = "".join(collected)
            print(f"  streamed assistant: {full[:200]}")

        step("Final message log")
        msgs = must(c.get(f"/chat/sessions/{session_id}/messages", headers=h))
        print(f"  total messages: {len(msgs)}")

    print("\nALL STEPS PASSED")


if __name__ == "__main__":
    main()
