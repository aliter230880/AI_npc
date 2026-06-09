# 🚀 Deploy Checklist — Google TTS + Emotions

## ✅ Pre-Deploy (Локально)
- [x] Google TTS провайдер реализован (`google_provider.py`)
- [x] Edge TTS провайдер реализован (`edge_provider.py`)
- [x] 3-level fallback в `tts.py`
- [x] Emotion support в LLM output (`openrouter_provider.py`)
- [x] Database migration применена (emotion + action columns)
- [x] Frontend обновлён (Builder.tsx + Chat.tsx)
- [x] API ключ добавлен в `.env`
- [x] Dependencies в `requirements.txt`
- [x] Локальное тестирование пройдено

## 🔧 Deploy Steps

### 1. Push to Git
```bash
cd e:\AI\AI_folder\character-platform
git status
git add backend/app/voice/google_provider.py
git add backend/app/voice/edge_provider.py
git add backend/app/voice/tts.py
git add backend/app/llm/openrouter_provider.py
git add backend/app/db/models.py
git add backend/app/db/schemas.py
git add backend/app/services/chat.py
git add backend/app/api/voice.py
git add backend/requirements.txt
git add backend/.env.example  # если хочешь добавить пример с GOOGLE_TTS_API_KEY
git add web/src/pages/Builder.tsx
git add web/src/pages/Chat.tsx
git add web/src/lib/types.ts
git commit -m "feat: Google Cloud TTS + Edge TTS + Emotion support

- 3-level fallback: Google (primary) → Edge → Piper
- Emotion support in LLM structured output
- 9 Google voices (Neural2/WaveNet) + 4 Edge voices
- Database schema updated: emotion + action fields
- Frontend: voice selection UI + emotion display
- Free tier: 1M chars/month Google TTS
"
git push
```

### 2. Deploy to VPS
```bash
# SSH в VPS
ssh user@168.222.143.103

# Pull latest
cd /root/character-platform
git pull

# Install new dependencies
cd backend
source .venv/bin/activate
pip install -r requirements.txt

# Check что установились
pip list | grep -E "(google-cloud-texttospeech|edge-tts|pydub)"

# Add API Key to .env
nano .env
# Добавить строку:
# GOOGLE_TTS_API_KEY=AIzaSyAskP4AZB4mSStP96vak3HXE7Gapt4ZZw8

# Apply database migration (если не применена)
python -c "import sqlite3; conn = sqlite3.connect('character_platform.db'); conn.execute('ALTER TABLE messages ADD COLUMN emotion VARCHAR(32)'); conn.execute('ALTER TABLE messages ADD COLUMN action VARCHAR(200)'); conn.commit(); print('Migration applied')"

# Build frontend (если изменения в web/)
cd ../web
npm run build
cd ..

# Restart service
sudo systemctl restart character-platform
sudo systemctl status character-platform

# Check logs
sudo journalctl -u character-platform -f --lines 50
```

### 3. Verify Deployment
```bash
# Test voices endpoint
curl https://ai.aliterra.space/voice/voices | jq '. | length'
# Ожидаем: 17+ голосов (9 Google + 4 Edge + 4 Piper)

# Test Google TTS synthesis
curl "https://ai.aliterra.space/voice/tts?text=Hello%20world&voice=google_en_female_neural2_a&emotion=happy" --output test.mp3
# Проверить размер файла
ls -lh test.mp3
```

### 4. Web UI Test
1. Открыть https://ai.aliterra.space
2. Зайти в Builder → Create New Character
3. В разделе Voice выбрать **"Neural2 A — warm & friendly (Neural2)"**
4. Создать персонажа
5. Начать чат
6. Отправить сообщение
7. **Проверить:**
   - Аудио воспроизводится
   - Качество голоса высокое (как ElevenLabs)
   - В сообщении показывается эмоция (если LLM вернул)

---

## 🐛 Troubleshooting

### Ошибка: "Google TTS unavailable: 403"
**Причина:** API Key не работает или достигнут quota  
**Решение:**
1. Проверить что API Key в `.env` правильный
2. Проверить quota в Google Cloud Console
3. Проверить что Text-to-Speech API enabled

### Ошибка: "google-cloud-texttospeech not installed"
**Причина:** Пакет не установлен в venv  
**Решение:**
```bash
cd backend
source .venv/bin/activate
pip install google-cloud-texttospeech==2.17.2
```

### Голоса не появляются в UI
**Причина:** Backend не вернул голоса или frontend не обновлён  
**Решение:**
1. Проверить `curl https://ai.aliterra.space/voice/voices`
2. Если пустой список — проверить логи backend
3. Если голоса есть, но не в UI — rebuild frontend (`npm run build`)

### Аудио не воспроизводится
**Причина:** CORS или неправильный MIME type  
**Решение:**
1. Проверить что Caddy правильно проксирует `/voice/*`
2. Проверить Network tab в DevTools — статус 200?
3. Проверить Content-Type в ответе (должно быть `audio/mpeg` или `audio/wav`)

---

## ⚠️ Post-Deploy

### 1. Rotate API Key
После первого публичного теста — ротировать API ключ:
1. https://console.cloud.google.com/apis/credentials?project=my-npc-tts
2. Regenerate "Character Platform TTS" key
3. Обновить `.env` на VPS
4. Restart service

### 2. Monitor Usage
Следить за quota в Google Cloud Console:
- https://console.cloud.google.com/apis/api/texttospeech.googleapis.com/quotas?project=my-npc-tts
- Free tier: 1M chars/month
- Если close к лимиту — fallback на Edge TTS срабатывает автоматически

### 3. Add Rate Limiting (Optional)
Если много запросов — добавить rate limiting в `voice.py`:
```python
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address)

@router.get("/tts")
@limiter.limit("100/minute")
async def tts_get(...):
    ...
```

---

## 📝 Next Phase: Unity Integration

После успешного деплоя на веб — интегрировать в Unity NPC:

```csharp
// UnityNPCVoice.cs
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;

public class UnityNPCVoice : MonoBehaviour
{
    public AudioSource audioSource;
    private const string TTS_API = "https://ai.aliterra.space/voice/tts";
    
    public IEnumerator SpeakAsync(string text, string emotion = "neutral")
    {
        string voice = "google_en_female_neural2_a";
        string url = $"{TTS_API}?text={UnityWebRequest.EscapeURL(text)}&voice={voice}&emotion={emotion}";
        
        using (UnityWebRequest www = UnityWebRequestMultimedia.GetAudioClip(url, AudioType.MPEG))
        {
            yield return www.SendWebRequest();
            
            if (www.result == UnityWebRequest.Result.Success)
            {
                AudioClip clip = DownloadHandlerAudioClip.GetContent(www);
                audioSource.PlayOneShot(clip);
            }
            else
            {
                Debug.LogError($"TTS failed: {www.error}");
            }
        }
    }
}
```

---

## ✅ Done!

После выполнения всех шагов:
- ✅ Google TTS работает в production
- ✅ Эмоции отображаются и передаются в голос
- ✅ Fallback на Edge → Piper при проблемах с Google
- ✅ Готово к интеграции в Unity NPC

**Следующая фаза:** Knowledge Base, WebSocket streaming, Unity SDK
