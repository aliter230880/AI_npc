# 🚀 Quick Deploy Summary

## Что добавили сегодня (2026-06-08)

### 🎙️ Голосовая система (3 уровня)
1. **Google Cloud TTS** (primary) — премиум качество, 1 млн/мес бесплатно
2. **Edge TTS** (secondary) — хорошее качество, бесплатно, но может быть заблокирован
3. **Piper** (fallback) — локальный, базовое качество, всегда работает

### 😊 Эмоции персонажей
- LLM возвращает `{text, emotion, action}`
- Эмоции влияют на голос (pitch, rate в SSML)
- Отображаются в чате с эмодзи

---

## Минимальный деплой (без Google TTS)

Если не хотите настраивать Google Cloud сейчас — всё работает на Edge + Piper:

```bash
# Локально
cd e:\AI\AI_folder\character-platform\backend
pip install -r requirements.txt
alembic upgrade head  # добавит emotion, action в БД

cd ../web
npm install
npm run build

# Деплой (ваш обычный процесс)
# ...

# На VPS
systemctl restart character-platform
```

**Работает!** Edge TTS (если доступен) → Piper fallback

---

## Полный деплой (с Google TTS — рекомендуется)

### 1. Настроить Google Cloud (5 минут)

Следовать инструкции: **`GOOGLE_TTS_SETUP.md`**

Коротко:
1. Google Cloud Console → создать проект
2. Включить Text-to-Speech API
3. Создать Service Account → скачать JSON ключ
4. Добавить в `.env`:
   ```env
   GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
   ```

### 2. Установить зависимости

```bash
cd e:\AI\AI_folder\character-platform\backend
pip install google-cloud-texttospeech==2.17.2
```

### 3. Тест локально

```bash
python test_google_tts.py
# Должно создаться test_google.mp3
```

### 4. Деплой на VPS

```bash
# Залить код (как обычно)
# ...

# На VPS
cd /opt/character-platform/backend

# Добавить Google credentials в .env
nano .env
# Вставить GOOGLE_SERVICE_ACCOUNT_JSON=...

# Установить библиотеку
source venv/bin/activate
pip install google-cloud-texttospeech==2.17.2

# Рестарт
systemctl restart character-platform

# Проверка
curl http://127.0.0.1:8001/api/voice/voices | jq
# Должны быть google_* голоса
```

---

## Проверка что всё работает

### Локально

```bash
# 1. Запустить бэкенд
cd backend
uvicorn app.main:app --reload

# 2. Список голосов
curl http://localhost:8000/api/voice/voices

# 3. TTS тест
curl "http://localhost:8000/api/voice/tts?text=Hello%20world&emotion=happy" --output test.mp3

# 4. Запустить фронт
cd ../web
npm run dev
# Открыть http://localhost:5173
```

### На VPS

```bash
# Публичный API
curl https://ai.aliterra.space/api/voice/voices

# TTS
curl "https://ai.aliterra.space/api/voice/tts?text=Test&emotion=happy" --output test.mp3

# Открыть в браузере
# https://ai.aliterra.space
```

---

## Структура голосов в Builder

В Builder пользователь увидит:

```
Server voice:
  ├─ 🌟 Google Cloud TTS (premium, 1M chars/month free)
  │   ├─ ♀ Neural2 A — warm & friendly (Neural2) — English
  │   ├─ ♀ Neural2 C — professional (Neural2) — English
  │   ├─ ♂ Neural2 D — confident (Neural2) — English
  │   ├─ ♀ WaveNet A — спокойная (WaveNet) — Русский
  │   └─ ...
  ├─ 🎙️ Edge TTS (good quality, free, may be blocked in some regions)
  │   ├─ ♀ Aria — friendly & warm — English
  │   ├─ ♀ Светлана — спокойная — Русский
  │   └─ ...
  └─ 🔧 Piper (local fallback, basic quality)
      ├─ ♀ Amy — calm
      └─ ...
```

---

## FAQ

**Q: Нужно ли настраивать Google TTS обязательно?**  
A: Нет. Без Google TTS работает Edge → Piper fallback. Но Google даёт лучшее качество бесплатно.

**Q: Что если Edge TTS заблокирован (403)?**  
A: Автоматически fallback на Piper. Или Google если настроен.

**Q: Сколько стоит Google TTS после free tier?**  
A: $16 за 1 млн символов = $0.016/1k. Для 100k сообщений/мес = ~$320/мес (приемлемо при масштабе).

**Q: Работают ли эмоции без Google/Edge?**  
A: Да! Эмоции работают в LLM (structured output) и отображаются в чате. Piper не меняет голос по эмоции, но Edge и Google меняют через SSML.

**Q: Что если не хочу Paris/регистрации в Google Cloud?**  
A: Используй Edge TTS + Piper. Бесплатно навсегда, работает (если Edge не заблокирован в вашем регионе).

---

## Бенчмарк качества

| Провайдер | Качество | Эмоции | Цена | Блокировки |
|---|---|---|---|---|
| Google TTS | ⭐⭐⭐⭐½ | ✅ SSML | 1 млн/мес FREE | ❌ |
| Edge TTS | ⭐⭐⭐⭐ | ✅ SSML | ∞ FREE | ⚠️ РФ/CN |
| Piper | ⭐⭐⭐ | ❌ | ∞ FREE | ❌ |
| ElevenLabs | ⭐⭐⭐⭐⭐ | ✅ Native | $100/млн | ❌ |

**Вывод:** Google TTS — лучший выбор по соотношению цена/качество/надёжность.

---

## Next steps (опционально)

- [ ] WebSocket streaming TTS (снизит latency до <1 сек)
- [ ] ElevenLabs для премиум-тира ($22/мес подписка)
- [ ] XTTS-v2 voice cloning (требует апгрейд VPS до 4 ГБ)
- [ ] Knowledge Base (загрузка PDF → RAG)
- [ ] Биллинг и лимиты

---

**Готово к деплою!** 🎉

Если нужна помощь с Google Cloud setup — см. **`GOOGLE_TTS_SETUP.md`**
