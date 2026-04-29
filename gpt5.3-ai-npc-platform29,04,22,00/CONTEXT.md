# PROJECT CONTEXT: AI NPC Platform

## 1) Цель проекта
Собрать сервис уровня Convai-подобной платформы:
- 7-8 готовых AI-персонажей из коробки.
- Конструктор новых персонажей по параметрам пользователя.
- Текстовое и голосовое общение в реальном времени.
- API/SDK для интеграции NPC в игровые движки и приложения.

## 2) Текущий статус (на момент фиксации)
- Репозиторий: базовый React + Vite + Tailwind шаблон.
- Бизнес-логика NPC пока не реализована.
- Принято решение стартовать с бесплатного/opensource стека для MVP.

## 3) Выбранный MVP-пайплайн (free-first)
1. STT: faster-whisper (локально/на сервере).
2. LLM: Ollama (локально) или бесплатные модели через OpenRouter.
3. TTS: Piper TTS (локально) или браузерный SpeechSynthesis как временный fallback.
4. Транспорт: WebSocket для двустороннего realtime-стриминга.

## 4) Базовая архитектура
- Frontend (React):
  - Character Hub (выбор персонажа)
  - Character Builder (создание NPC)
  - Chat Studio (текст/голос)
  - API Console (токены, примеры запросов)

- Backend API:
  - Auth + Projects + Characters + Sessions
  - /chat/text, /chat/voice, /chat/stream
  - /actions/execute (функции NPC)

- Runtime сервисы:
  - STT service
  - LLM Orchestrator (prompting, память, guardrails)
  - TTS service
  - Session Manager (state machine, interruptions)

- Data layer:
  - PostgreSQL: пользователи, персонажи, конфиги, диалоги
  - Redis: сессии realtime, кэш контекста
  - Object Storage: голосовые файлы, документы knowledge base

## 5) Модель персонажа (MVP)
Обязательные поля:
- name, role, tone, goals
- backstory
- behavior_rules
- forbidden_topics
- response_style
- voice_id
- language

Память:
- short-term memory: последние N реплик сессии
- long-term memory: факты и персональные настройки

## 6) API контур (черновик)
- POST /v1/sessions
- POST /v1/messages/text
- POST /v1/messages/audio
- GET /v1/messages/stream/:sessionId
- POST /v1/characters
- GET /v1/characters
- POST /v1/actions/execute

## 7) План этапов
Этап 1 (MVP base):
- 8 преднастроенных персонажей
- текстовый чат
- конструктор персонажа (без голоса)

Этап 2 (Voice + Memory):
- STT/TTS pipeline
- realtime streaming
- краткосрочная/долгосрочная память

Этап 3 (Platform):
- API keys, лимиты, логирование
- SDK starter для Unity/JS
- мониторинг latency/cost/error rates

## 8) Лог шагов
2026-04-29:
- Проанализирован текущий репозиторий: обнаружен стартовый шаблон без реализации продукта.
- Проанализирован сайт Convai и ключевые capability-блоки.
- Согласована стратегия free-first для STT -> LLM -> TTS.
- Создан этот context-файл для фиксации архитектуры, шагов, ошибок и планов.
- Реализован frontend MVP runtime:
  - 8 готовых NPC-пресетов.
  - Character Builder для пользовательских NPC.
  - Chat Studio с потоковой отрисовкой ответа.
  - Runtime config: provider (preview/ollama/openrouter), transport (http/websocket), STT/TTS modes.
  - Browser STT fallback через SpeechRecognition API.
  - Browser TTS fallback через SpeechSynthesis.
- Добавлен runtime сервис `src/services/runtime.ts`:
  - HTTP-запросы к Ollama и OpenRouter.
  - WebSocket transport c `assistant_chunk`/`assistant_final` протоколом и fallback.
  - Preview fallback при недоступности провайдера.
- Реализован полностью рабочий preview UI авторизации:
  - login/registration формы в `src/App.tsx`.
  - mock auth storage в `src/services/authMock.ts` (localStorage users + session).
  - защищенный runtime dashboard после входа.
  - logout flow и восстановление сессии при перезагрузке.
- Добавлен auth bridge `src/services/authApi.ts`:
  - режим `mock | api` через `VITE_AUTH_MODE`.
  - поддержка `VITE_API_BASE_URL` для реального backend auth.
  - методы restore/login/register/logout с fallback на mock.
  - API режим сохраняет access/refresh токены и использует `/v1/auth/me`, `/v1/auth/refresh`.
- Обновлен `src/App.tsx` для работы через auth bridge:
  - асинхронный bootstrap сессии.
  - индикатор auth mode на login экране.
  - единый UI без переписывания при переключении между preview и live backend.
- Реализован Backend Foundation `backend/server.mjs`:
  - Fastify + CORS + WebSocket runtime gateway.
  - Auth API: register/login/me/refresh/logout (JWT access+refresh).
  - Characters API: list/create (8 seed NPC + custom NPC).
  - Sessions/Messages API: создание сессий и текстовый чат.
  - Realtime WS `/v1/realtime` с `assistant_chunk` -> `assistant_final`.
  - Free-first LLM adapters: Ollama/OpenRouter + preview fallback.
  - Voice adapters: `/v1/stt` (faster-whisper URL), `/v1/tts` (piper URL).
- Добавлены инфраструктурные файлы:
  - `backend/.env.example`
  - `BACKEND_QUICKSTART.md`
  - `.env.example` (frontend auth mode / api base)
- Реализован frontend E2E runtime bridge к backend:
  - `src/services/backendRuntime.ts` для `/v1/sessions`, `/v1/messages`, `WS /v1/realtime`.
  - новый режим `VITE_RUNTIME_MODE=direct|backend` (по умолчанию direct).
  - в `src/App.tsx` добавлено создание backend session per character и отправка сообщений через backend.
  - в backend режиме создание NPC отправляется в `POST /v1/characters`.
- Добавлены улучшения для стабильного тестирования прямо в preview:
  - runtime mode сохраняется в localStorage.
  - backend mode автоматически отключается, если не включен `auth api + api base`.
  - добавлен вход одной кнопкой как demo пользователь.
  - добавлен reset preview data (сброс auth/session/custom NPC/runtime mode).
- Улучшено качество голоса в preview TTS:
  - добавлен выбор нескольких системных голосов (SpeechSynthesis voices list).
  - добавлена авто-выборка более естественных голосов (ru + natural/enhanced/google/microsoft приоритет).
  - добавлены настройки rate/pitch и кнопка тестового прослушивания.
- Улучшен блок микрофона/STT в preview:
  - проверки secure context (`https/localhost`) и `getUserMedia`.
  - явные сообщения о причинах, почему голосовой ввод не стартует.
  - проверка разрешения микрофона перед запуском SpeechRecognition.
  - переключатель языка STT (`ru-RU` / `en-US`).
- Добавлен `VOICES_SETUP.md`:
  - инструкция по скачиванию более естественных Piper-голосов.
  - структура файлов и подключение через `PIPER_URL`.
- Подключены mp3 voice references из `AI_npc/voice` в UI:
  - `src/data/voiceReferences.ts` со списком референсов.
  - selector reference-голоса в Runtime Config.
  - кнопка прослушивания reference-голоса.
  - режим `TTS: Reference sample (mp3)` для быстрого выбора голоса в preview.
- Реализован качественный backend TTS engine слой (Piper/XTTS/API):
  - backend route `GET /v1/tts/voices` (каталог доступных голосов).
  - backend route `POST /v1/tts/synthesize` (генерация аудио base64).
  - backward alias `POST /v1/tts` сохранен.
  - провайдеры: `piper`, `xtts`, `openai`, `elevenlabs`.
  - добавлен provider routing и unified audio response (`audioBase64`, `mimeType`).
- Frontend Runtime Config расширен для backend-engine TTS:
  - выбор provider + voice + speed.
  - воспроизведение сгенерированного аудио из backend.
  - browser SpeechSynthesis и reference mp3 сохранены как fallback/testing modes.
- Исправлен сценарий "один голос на всех NPC":
  - добавлен per-character voice mapping для backend TTS и browser SpeechSynthesis.
  - при переключении NPC автоматически выбирается отдельный голос по стабильному хешу.
  - ручной выбор голоса сохраняется для конкретного NPC.
- Обновлены конфиги и документация:
  - `backend/.env.example` (XTTS/OpenAI/ElevenLabs vars).
  - `BACKEND_QUICKSTART.md` с новыми TTS route и провайдерами.

## 9) Лог ошибок и блокеров
- TypeScript типизация browser speech API:
  - Ошибка: `SpeechRecognition` тип отсутствует в глобальных типах.
  - Решение: введены локальные типы `RecognitionInstance`/`RecognitionCtor` в `src/App.tsx`.

## 10) Следующие действия
1. Реализовать UI MVP: Character Hub + Builder + Chat Studio (mock runtime).
2. Поднять backend-заглушку с сессиями и текстовым ответом.
3. Подключить локальный Ollama как первый LLM provider.
4. Подключить faster-whisper + Piper как voice pipeline.