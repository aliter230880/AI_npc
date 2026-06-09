"""Бьём в наш API так же как фронт — через /chat/sessions + /chat/sessions/.../stream."""
import httpx, uuid, json

BASE = "http://127.0.0.1:8001"

with httpx.Client(base_url=BASE, timeout=120) as c:
    email = f"probe+{uuid.uuid4().hex[:6]}@e.com"
    tok = c.post("/auth/register", json={"email": email, "password": "12345678", "is_adult": True}).json()
    h = {"Authorization": f"Bearer {tok['access_token']}"}

    aria = next(x for x in c.get("/characters").json() if "Aria" in x["name"])
    sess = c.post("/chat/sessions", json={"character_id": aria["id"]}, headers=h).json()

    # 1. через POST /messages (не-стрим, удобно отлаживать)
    print("=== /messages (sync) ===")
    r = c.post(f"/chat/sessions/{sess['id']}/messages", json={"content": "привет"}, headers=h)
    if r.status_code != 200:
        print("FAIL", r.status_code, r.text[:500]); raise SystemExit(1)
    am = r.json()["assistant_message"]
    print("model:", am.get("model"))
    print("content:", repr(am["content"])[:600])
    print()

    # 2. через стрим
    print("=== /stream (SSE) ===")
    sess2 = c.post("/chat/sessions", json={"character_id": aria["id"]}, headers=h).json()
    chunks = []
    with c.stream("POST", f"/chat/sessions/{sess2['id']}/stream",
                  json={"content": "hi"}, headers=h) as resp:
        if resp.status_code != 200:
            print("FAIL", resp.status_code); raise SystemExit(1)
        for line in resp.iter_lines():
            if line.startswith("data: "):
                data = line[6:]
                if data == "[DONE]":
                    break
                chunks.append(data)
    full = "".join(chunks).replace("\\n", "\n")
    print("chunks_count:", len(chunks))
    print("first chunk:", repr(chunks[0])[:200] if chunks else "<empty>")
    print("full content:", repr(full)[:600])
