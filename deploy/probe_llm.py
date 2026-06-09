"""Прямая проверка: что отдаёт OpenRouter на простой запрос. Бьём минуя весь наш стек."""
import os, json, httpx

key = os.environ.get("OPENROUTER_API_KEY") or open("/opt/character-platform/backend/.env").read().split("OPENROUTER_API_KEY=")[1].split("\n")[0].strip()
model = "openai/gpt-oss-120b:free"

def ask(messages, m=model):
    r = httpx.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"model": m, "messages": messages, "temperature": 0.8, "max_tokens": 200},
        timeout=60,
    )
    print(f"=== {m} ===")
    print(f"http={r.status_code}")
    if r.status_code != 200:
        print(r.text[:500]); return
    d = r.json()
    msg = d["choices"][0]["message"]
    print("content:", repr(msg.get("content", ""))[:500])
    if msg.get("reasoning"):
        print("reasoning:", repr(msg["reasoning"])[:200])
    print()

# 1. Голый промпт — без персонажа
ask([{"role":"user","content":"Say hi in one short sentence."}])

# 2. С system-prompt как в Aria
ask([
    {"role":"system","content":"You are Aria the Detective. Hard-boiled noir style. Keep replies short."},
    {"role":"user","content":"hi"},
])

# 3. То что на самом деле собирает наш сервис (с памятью и greeting)
ask([
    {"role":"system","content":"You are Aria the Detective.\n\nAbout you: A sharp-witted private investigator from 1940s noir New York.\n\nPersonality traits: sharp, cynical, observant\n\nBackstory: Former NYPD\n\nYou speak with a hard-boiled noir style. Cynical but with a hidden moral code. Reference 1940s NYC details when natural. Keep replies short and punchy unless the user asks for more. Avoid stage directions in asterisks; describe action through dialogue.\n\nStay in character at all times. Respond in the user's language. Do not break the fourth wall by mentioning that you are an AI model."},
    {"role":"assistant","content":"Take a seat. Tell me what kind of trouble brought you to my door."},
    {"role":"user","content":"привет"},
])

# 4. альтернативная модель — чтобы понять, дело в модели или промпте
ask([{"role":"user","content":"Say hi in one short sentence."}], m="z-ai/glm-4.5-air:free")
ask([{"role":"user","content":"Say hi in one short sentence."}], m="meta-llama/llama-3.3-70b-instruct:free")
