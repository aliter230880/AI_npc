# Деплой: Google TTS + Edge TTS + Эмоции (2026-06-08)

## Что сделано

### ✅ 1. Google Cloud TTS интеграция (PREMIUM, 1 млн/мес бесплатно!)
- **8 премиум голосов**: Neural2 (EN) + WaveNet (RU)
- **Качество 4.5/5** (сопоставимо с ElevenLabs)
- **1 млн символов/мес бесплатно** = ~5000 сообщений
- Поддержка эмоций через SSML (pitch, rate)
- Стабильно, не блокируют (в отличие от Edge TTS)
- После лимита: $16/млн (дёшево)

### ✅ 2. Edge TTS интеграция (secondary, бесплатно)
- **8 премиум голосов**: 2♀+2♂ × EN+RU × calm/cheerful
- Microsoft Neural voices (en-US-AriaNeural, ru-RU-SvetlanaNeural, etc.)
- Поддержка эмоций через SSML (pitch, rate динамически под emotion)
- Автоматический fallback на Piper если Edge недоступен (403, timeout)

### ✅ 2. Эмоции в ответах персонажей
- LLM возвращает structured output: `{text, emotion, action}`
- Эмоции: neutral, happy, sad, angry, surprised, confused, flirty, scared
- Действия: краткие ремарки (*smiles*, *looks away*, *sighs*)
- БД расширена: `messages.emotion`, `messages.action`
- Фронт отображает эмоции курсивом + эмодзи

### ✅ 3. Fallback система (3 уровня защиты!)
- **Primary**: Google Cloud TTS (премиум, 1 млн/мес бесплатно)
- **Secondary**: Edge TTS (бесплатно, может быть заблокирован)
- **Fallback**: Piper (локально, базовое качество, всегда работает)
- **Browser fallback**: Web Speech API если все недоступны

## Файлы изменены

### Backend
```
backend/
├── app/
│   ├── voice/
│   │   ├── google_provider.py      [NEW] Google Cloud TTS провайдер
│   │   ├── edge_provider.py        [NEW] Edge TTS провайдер
│   │   └── tts.py                  [MODIFIED] fallback Google → Edge → Piper
│   ├── llm/
│   │   ├── base.py                 [MODIFIED] ChatCompletion + emotion/action
│   │   └── openrouter_provider.py  [MODIFIED] парсинг JSON structured output
│   ├── db/
│   │   ├── models.py               [MODIFIED] Message + emotion/action
│   │   └── schemas.py              [MODIFIED] MessageRead + emotion/action
│   ├── services/
│   │   └── chat.py                 [MODIFIED] system_prompt с инструкцией для JSON, сохранение эмоций
│   └── api/
│       └── voice.py                [MODIFIED] /voices + /tts с emotion parameter
├── alembic/versions/
│   └── 20260608_2339_add_emotions.py [NEW] миграция БД
├── requirements.txt                [MODIFIED] +google-cloud-texttospeech +edge-tts +pydub
├── test_google_tts.py              [NEW] тест Google TTS
├── test_edge_tts.py                [NEW] тест Edge TTS
└── test_tts_fallback.py            [NEW] тест fallback логики
```

### Frontend
```
web/src/
├── lib/
│   └── types.ts                    [MODIFIED] Message + emotion/action
└── pages/
    ├── Chat.tsx                    [MODIFIED] отображение эмоций, передача в TTS
    └── Builder.tsx                 [MODIFIED] выбор Edge TTS голосов
```

## Деплой на VPS

### Шаг 1: Обновить код

```bash
# Локально
cd e:\AI\AI_folder\character-platform

# Бэкенд
cd backend
# (опц.) активировать venv если есть
pip install -r requirements.txt

# Применить миграцию БД (добавит emotion, action в messages)
alembic upgrade head

# Фронтенд
cd ../web
npm install  # если изменились deps
npm run build

# Запаковать
cd ..
python deploy/deploy.py  # или вручную создать tar.gz
```

### Шаг 2: Залить на VPS

```cmd
cd e:\AI\AI_folder\character-platform\deploy

# Загрузить бэкенд
scpk.cmd backend.tar.gz root@168.222.143.103:/tmp/

# Загрузить фронт
scpk.cmd web.tar.gz root@168.222.143.103:/tmp/

# SSH на VPS
sshk.cmd
```

### Шаг 3: Развернуть на VPS

```bash
# На VPS

# === Бэкенд ===
cd /opt/character-platform
tar -xzf /tmp/backend.tar.gz
source backend/venv/bin/activate  # если есть venv
pip install -r backend/requirements.txt

# Применить миграцию БД
cd backend
alembic upgrade head
cd ..

# Рестарт сервиса
systemctl restart character-platform
systemctl status character-platform

# Проверка логов
journalctl -u character-platform -n 50

# === Фронтенд ===
cd /opt/character-platform
tar -xzf /tmp/web.tar.gz
# Caddy подхватит автоматически

# Очистка
rm /tmp/backend.tar.gz /tmp/web.tar.gz
```

### Шаг 4: Проверка

```bash
# Healthcheck
curl http://127.0.0.1:8001/health
curl http://127.0.0.1:8001/info

# Список голосов (должны быть edge_*)
curl http://127.0.0.1:8001/api/voice/voices | jq

# Тест TTS
curl "http://127.0.0.1:8001/api/voice/tts?text=Hello&emotion=happy" --output test.wav
```

```bash
# Публичная проверка
curl https://ai.aliterra.space/api/voice/voices
```

## Известные проблемы и решения

### 🔴 Edge TTS 403 (blocked)

**Проблема:** Microsoft блокирует некоторые регионы/IP (в т.ч. РФ)

**Решение:** Автоматический fallback на Piper. На VPS reg.ru (Нидерланды) Edge TTS скорее всего будет работать. Если нет — Piper подхватит.

**Проверка на VPS:**
```bash
python3 -c "
import asyncio
import edge_tts

async def test():
    c = edge_tts.Communicate('Test', 'en-US-AriaNeural')
    async for chunk in c.stream():
        if chunk['type'] == 'audio':
            print('✅ Edge TTS works!')
            return
    print('❌ No audio')

asyncio.run(test())
"
```

### 🔴 pydub не конвертирует MP3 → WAV

**Проблема:** pydub требует ffmpeg для конвертации

**Решение:** Если pydub/ffmpeg нет — отдаём MP3 напрямую (браузеры играют и MP3)

**Установка ffmpeg на VPS (опционально):**
```bash
apt update && apt install -y ffmpeg
```

### 🟡 LLM не возвращает JSON

**Проблема:** Некоторые модели игнорируют инструкцию про JSON format

**Решение:** В `_parse_structured_response()` есть fallback — если не JSON, возвращаем текст как есть. Работает с любой моделью.

**Лучшие модели для structured output:**
- `openai/gpt-4o-mini` (платно, но дёшево)
- `anthropic/claude-3-haiku` (платно)
- `meta-llama/llama-3.1-8b-instruct:free` (бесплатно, иногда следует формату)

## Безопасность для соседей на VPS

✅ **Всё безопасно:**
- Только код в `/opt/character-platform/`
- Только systemd unit `character-platform.service`
- Никаких изменений в Caddyfile (голосовые эндпоинты уже есть)
- Никаких новых портов
- Никаких глобальных пакетов (всё в venv)

⚠️ **Что НЕ трогаем:**
- `/var/www/web3*` (web3.aliterra.space)
- `/root/autoposter/` (autoposter на :3000)
- Docker контейнеры `web3gram-relay`, `grid-bot`
- Другие секции Caddyfile

## Что дальше (опционально)

### Улучшения голоса:
- [ ] WebSocket streaming TTS (снижает latency до <1 сек)
- [ ] ElevenLabs для премиум-тира (платно, $10-20/мес)
- [ ] XTTS-v2 voice cloning (требует апгрейд VPS до 4 ГБ)

### Улучшения эмоций:
- [ ] Больше эмоций (bored, excited, nervous, etc.)
- [ ] Визуализация эмоций (цветовая подсветка сообщений)
- [ ] Анимация аватаров по эмоциям

### Следующие этапы:
- [ ] **Блок 3**: Knowledge Base (загрузка PDF/MD → RAG)
- [ ] **Блок 5**: Биллинг и лимиты
- [ ] **Блок 7**: Unity SDK

## Контакты

Вопросы/проблемы пишите в чат. Если Edge TTS не работает на VPS — не страшно, Piper подхватит.

---

**Статус:** ✅ Готово к деплою
**Дата:** 2026-06-08
**Версия:** MVP v0.3 (голос + эмоции)
