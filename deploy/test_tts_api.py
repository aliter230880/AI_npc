import urllib.request, json, time

def synth(text, voice):
    data = json.dumps({"text": text, "voice_id": voice}).encode()
    req = urllib.request.Request(
        "http://127.0.0.1:8001/tts/synthesize",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    t = time.time()
    r = urllib.request.urlopen(req)
    b = r.read()
    print(f"  {voice}: HTTP {r.status}, {len(b)} bytes, {round(time.time()-t,1)}s, cache={r.headers.get('X-Cache')}")

print("first call (MISS expected):")
synth("Привет, путник. Присаживайся, расскажи что тебя привело.", "ru:baya")
print("second call (HIT expected):")
synth("Привет, путник. Присаживайся, расскажи что тебя привело.", "ru:baya")
print("english:")
synth("Take a seat. Tell me what kind of trouble brought you here tonight.", "en:en_0")
print("DONE")
