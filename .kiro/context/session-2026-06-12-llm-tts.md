# Session 2026-06-12: LLM & TTS Improvements

## Дата: 12 июня 2026, 14:00-15:00 MSK

---

## ЗАДАЧИ:

### 1. ✅ Переключение LLM на стабильную модель
**Проблема:** Бесплатные модели на OpenRouter rate-limited (429), Gemini блокирует РФ IP

**Решение:** GPT-4o-mini через OpenRouter
- Модель: `openai/gpt-4o-mini`
- Стоимость: $0.15 за 1M токенов
- Баланс: $4.72 (~4,800 диалогов)
- Статус: ✅ Работает стабильно

**Что пробовали:**
- ❌ `google/gemini-2.0-flash-exp:free` — shut down June 1, 2026
- ❌ `google/gemini-3.5-flash` (direct API) — блокирует РФ IP
- ❌ `meta-llama/llama-3.3-70b-instruct:free` — 429 rate-limited
- ❌ `qwen/qwen-2.5-72b-instruct:free` — недоступна бесплатно
- ✅ `openai/gpt-4o-mini` — стабильная платная модель

**Файлы:**
- `backend/app/llm/gemini_provider.py` — создан (готов на будущее)
- `backend/app/llm/openrouter_provider.py` — работает
- `backend/.env` — LLM_DEFAULT_MODEL=openai/gpt-4o-mini

---

### 2. ✅ Очистка голосов от механических

**Убрано из выпадающего списка:**
- Piper голоса (12 шт) — слишком механические, остались как fallback в коде
- Google Standard голоса (4 шт) — хуже чем Neural2/WaveNet

**Осталось в UI: 24 качественных голоса**
- ⭐ ElevenLabs (7) — premium, эмоции
- 🎙️ Google Neural2/WaveNet (9) — 1M chars/month free
- 🔊 Edge TTS Neural (8) — unlimited free

**Файлы:**
- `backend/app/api/voice.py` — скрыл Piper из `/voice/voices`
- `backend/app/voice/google_provider.py` — удалил 4 Standard голоса

---

### 3. ✅ Yandex SpeechKit добавлен

**Добавлено: 6 русских голосов**
- 🇷🇺 Алёна — нейтральная / добрая (female)
- 🇷🇺 Джейн — нейтральная (female)
- 🇷🇺 Филипп — нейтральный (male)
- 🇷🇺 Ермил — нейтральный / добрый (male)

**Интеграция:**
- Приоритет #1 для русского языка
- Fallback chain: Yandex (RU) → ElevenLabs → Google → Edge → Piper
- Поддержка эмоций через роли (neutral/good/evil)
- API key: `AQVNyg***` (trial grant активен)

**Файлы:**
- `backend/app/voice/yandex_provider.py` — NEW, полная реализация
- `backend/app/voice/tts.py` — обновлён fallback chain
- `backend/app/api/voice.py` — добавлены Yandex голоса в список
- `backend/app/core/config.py` — yandex_api_key параметр
- `backend/.env` — YANDEX_API_KEY добавлен

**Статус:** ✅ Работает на проде

---

## COMMITS:

```
c9e948d - Add Yandex SpeechKit TTS: premium Russian voices with emotions
40b15df - Remove mechanical voices from UI: hide Piper and Google Standard voices
1b74dbe - Fix Gemini model: switch to gemini-3.5-flash (2.0 shut down June 2026)
9ed78e9 - Add Google Gemini API direct provider (free tier)
9121c65 - Add ElevenLabs TTS: 7 premium voices with native emotions support
74d5cb4 - Fix voice preview gender: female say rada, male say rad
82af7dc - Improve voice quality: stronger emotion params, more RU voices, quality rules
```

---

## ТЕКУЩАЯ КОНФИГУРАЦИЯ:

### LLM (Backend)
```env
OPENROUTER_API_KEY=sk-or-v1-***
LLM_DEFAULT_MODEL=openai/gpt-4o-mini
```

### TTS (Backend)
```env
GOOGLE_TTS_API_KEY=AIzaSy***
ELEVENLABS_API_KEY=91702***
YANDEX_API_KEY=AQVNyg***
```

### Fallback Chain:
1. **Yandex SpeechKit** (RU only, trial grant) — для русского языка
2. **ElevenLabs** (10k chars/month) — если ключ и лимит есть
3. **Google TTS** (1M chars/month) — если ключ есть
4. **Edge TTS** (unlimited) — всегда
5. **Piper** (unlimited local) — последний fallback (скрыт из UI)

**Итого в UI: 30 качественных голосов**
- 🇷🇺 Yandex: 6 (premium RU)
- ⭐ ElevenLabs: 7 (premium EN+RU)
- 🎙️ Google Neural2/WaveNet: 9 (premium EN+RU)
- 🔊 Edge TTS Neural: 8 (good EN+RU)

---

## РАСХОДЫ:

### OpenRouter:
- Баланс: $4.72
- GPT-4o-mini: $0.15 / 1M токенов
- ~31k токенов на диалог
- Хватит на ~4,800 сообщений

### ElevenLabs:
- Free tier: 10k characters/month
- ~50 коротких сообщений

### Google TTS:
- Free tier: 1M characters/month (Neural2/WaveNet)
- ~3,000-5,000 сообщений

---

## PRODUCTION:

**URL:** https://ai.aliterra.space/
**VPS:** 168.222.143.103
**Статус:** ✅ Работает (GPT-4o-mini + ElevenLabs/Google/Edge TTS)

**Соседи на VPS (не трогать):**
- web3.aliterra.space
- trade.aliterra.space
- autoposter (pm2)
- web3gram-relay (docker)
- grid-bot (docker)
- cp-qdrant (docker)

---

## СЛЕДУЮЩИЕ ШАГИ:

1. ✅ Получить Yandex Cloud API key — DONE
2. ✅ Добавить Yandex SpeechKit провайдер — DONE
3. ✅ Интегрировать в fallback chain (приоритет для RU) — DONE
4. ✅ Тестирование на проде — DONE
5. ⏳ Мониторинг trial grant Yandex
6. ⏳ Тестирование качества русских голосов пользователем

---

## ЗАМЕТКИ:

- Gemini API работает только вне РФ (геоблок)
- OpenRouter free models нестабильны (rate-limiting)
- Платная модель $0.15/1M — оптимальный выбор
- Voice quality chain работает отлично (ElevenLabs → Google → Edge)
- Piper оставлен как safety fallback, но скрыт из UI
