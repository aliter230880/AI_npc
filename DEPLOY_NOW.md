# 🚀 Деплой на VPS — Готовые Команды

## Вариант 1: Автоматический Деплой (Рекомендуется)

```bash
# SSH в VPS
ssh user@168.222.143.103

# Скачать и запустить скрипт деплоя
cd ~
curl -O https://raw.githubusercontent.com/aliter230880/AI_npc/main/deploy/SAFE_DEPLOY.sh
bash SAFE_DEPLOY.sh
```

Скрипт автоматически:
- ✅ Склонирует/обновит репозиторий
- ✅ Сделает backup базы данных
- ✅ Установит зависимости
- ✅ Добавит Google TTS API Key в .env
- ✅ Применит database migration
- ✅ Пересоберёт frontend
- ✅ Рестартует сервис
- ✅ Проверит что всё работает

---

## Вариант 2: Ручной Деплой (Пошагово)

### Шаг 1: SSH в VPS
```bash
ssh user@168.222.143.103
```

### Шаг 2: Clone/Pull репозитория
```bash
# Если директория НЕ существует:
cd /root
git clone https://github.com/aliter230880/AI_npc.git character-platform
cd character-platform

# Если директория УЖЕ существует:
cd /root/character-platform
git pull origin main
```

### Шаг 3: Backup базы данных
```bash
cd backend
cp character_platform.db character_platform.db.backup_$(date +%Y%m%d_%H%M%S)
```

### Шаг 4: Установить зависимости
```bash
source .venv/bin/activate
pip install -r requirements.txt
```

### Шаг 5: Добавить Google API Key в .env
```bash
nano .env

# Добавить строку:
GOOGLE_TTS_API_KEY=AIzaSyAskP4AZB4mSStP96vak3HXE7Gapt4ZZw8

# Ctrl+X, Y, Enter для сохранения
```

### Шаг 6: Применить миграцию базы данных
```bash
python3 -c "import sqlite3; conn = sqlite3.connect('character_platform.db'); conn.execute('ALTER TABLE messages ADD COLUMN emotion VARCHAR(32)'); conn.execute('ALTER TABLE messages ADD COLUMN action VARCHAR(200)'); conn.commit(); print('✅ Migration applied')"
```

### Шаг 7: Пересобрать frontend
```bash
cd ../web
npm run build
```

### Шаг 8: Рестарт сервиса
```bash
cd ..
sudo systemctl restart character-platform
sudo systemctl status character-platform
```

### Шаг 9: Проверка логов
```bash
sudo journalctl -u character-platform -f --lines 50
# Ctrl+C для выхода
```

---

## ✅ Проверка Работы

### 1. Проверка API
```bash
# Список голосов (должно быть 17+)
curl http://localhost:8000/voice/voices | python3 -m json.tool | grep '"id"' | wc -l

# Тест Google TTS
curl "http://localhost:8000/voice/tts?text=Hello%20world&voice=google_en_female_neural2_a" --output /tmp/test.mp3
ls -lh /tmp/test.mp3
```

### 2. Проверка через браузер
- Открой https://ai.aliterra.space
- Создай нового персонажа
- Выбери голос **"Neural2 A — warm & friendly (Neural2)"**
- Начни чат
- Отправь сообщение
- Проверь что голос воспроизводится с высоким качеством

### 3. Проверка соседей на VPS
```bash
# Убедись что другие сайты работают:
curl -I https://web3.aliterra.space | head -1
curl -I https://trade.aliterra.space | head -1
```

---

## ⚠️ Если Что-то Пошло Не Так

### Ошибка: "google-cloud-texttospeech not installed"
```bash
cd /root/character-platform/backend
source .venv/bin/activate
pip install google-cloud-texttospeech==2.17.2
sudo systemctl restart character-platform
```

### Ошибка: "Google TTS unavailable: 403"
```bash
# Проверь что API Key правильный:
cd /root/character-platform/backend
grep GOOGLE_TTS_API_KEY .env

# Проверь что Text-to-Speech API enabled в Google Cloud Console
```

### Откат к предыдущей версии (если всё сломалось)
```bash
cd /root/character-platform/backend

# Restore database
cp character_platform.db.backup_YYYYMMDD_HHMMSS character_platform.db

# Откат git
cd ..
git reset --hard HEAD~1

# Рестарт
sudo systemctl restart character-platform
```

---

## 🎮 Unity Integration

После успешного деплоя можешь подключить к Unity NPC:

```csharp
string apiUrl = "https://ai.aliterra.space/voice/tts";
string text = "Hello, traveler!";
string voice = "google_en_female_neural2_a";
string emotion = "friendly";

string url = $"{apiUrl}?text={UnityWebRequest.EscapeURL(text)}&voice={voice}&emotion={emotion}";

using (UnityWebRequest www = UnityWebRequestMultimedia.GetAudioClip(url, AudioType.MPEG))
{
    yield return www.SendWebRequest();
    
    if (www.result == UnityWebRequest.Result.Success)
    {
        AudioClip clip = DownloadHandlerAudioClip.GetContent(www);
        audioSource.PlayOneShot(clip);
    }
}
```

---

## 📞 Нужна Помощь?

Если что-то не работает — скинь логи:

```bash
sudo journalctl -u character-platform -n 100 --no-pager > /tmp/deploy_logs.txt
cat /tmp/deploy_logs.txt
```

И я помогу разобраться!
