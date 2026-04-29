# AI_NPC Project Context

## 1) Что уже сделано в этом репозитории
- Проведен аудит текущего состояния проекта: это базовый шаблон Vite + React + Tailwind без backend-логики NPC.
- Выполнен анализ референса Convai (позиционирование продукта, структура фич, модель интеграции в игровые движки и API-подход).
- Реализована первая продуктовая страница в `src/App.tsx` как стартовый каркас платформы:
  - full-bleed hero с позиционированием сервиса;
  - секция MVP-возможностей;
  - интерактивный прототип каталога NPC (переключение персонажей, профиль/тон/черты/пример ответа);
  - секция API (REST + WebSocket) для интеграции в игровых персонажей;
  - roadmap реализации на 6 недель.
- Добавлены анимации интерфейса через Framer Motion.
- Установлена зависимость `framer-motion`.
- Добавлен backend-скелет API в `backend/server.mjs` (Fastify + CORS) с маршрутами:
  - `GET /v1/characters`
  - `POST /v1/sessions`
  - `GET /v1/sessions/:sessionId/messages`
  - `POST /v1/messages`
- Обновлен сервисный слой `src/services/npcApi.ts`:
  - поддержка remote API через `VITE_API_BASE_URL`,
  - fallback на локальный runtime при недоступном backend,
  - сохранена потоковая отрисовка ответа NPC в UI.
- Добавлен deployment-гайд `DEPLOY_WEB3_ALITERRA.md`.
- Backend переведен на Postgres-режим через `DATABASE_URL` с автоматической инициализацией таблиц и seed персонажей.
- Добавлен fallback memory-store, если `DATABASE_URL` не задан.
- Добавлен rate limiting на API (`@fastify/rate-limit`).
- Добавлен WebSocket endpoint `WS /v1/realtime` с потоковой отправкой ответа (`chunk` -> `final`).
- Добавлена API key защита на `/v1/*` через заголовок `x-api-key` (активируется при заданном `API_KEY`).
- Frontend API клиент отправляет `x-api-key` при заданной переменной `VITE_API_KEY`.
- Frontend переключен на реальный WS-стриминг в `sendMessage` (с fallback на REST и local runtime).
- Для браузерного WS при включенном API key добавлена поддержка query-параметра `api_key`.
- Добавлены realtime voice-like события в WS: `transcript`, `npc_action`, `audio_chunk` (интеграционный mock для подготовки voice pipeline).
- UI показывает realtime event feed для отладки канала.
- UI получил голосовой ввод через Web Speech API (кнопка "Голос") с отправкой в WS как `user_voice`.
- `npc_action` расширен структурой `params` для интеграции с игровыми хуками.
- Добавлена опциональная интеграция реального TTS в backend через OpenAI (`OPENAI_API_KEY`), с отправкой mp3 `audio_chunk` в WS.
- На frontend добавлено воспроизведение mp3 из realtime-чанков после завершения ответа NPC.
- Добавлен слой игровых обработчиков `src/services/gameHooks.ts` для `move_to | start_quest | offer_trade | lore_hint`.
- Добавлен контракт интеграции `GAME_ACTION_CONTRACT.md` для Web/Unity mapping.
- Добавлен `src/sdk/WebNpcSdk.ts` - минимальный Web SDK клиент для REST + Realtime WS интеграции.
- Добавлен `SDK_USAGE.md` с примером подключения и обработки `npc_action`.
- Добавлен Unity стартовый пакет:
  - `unity-sdk/UnityNpcClient.cs` (REST),
  - `unity-sdk/UnityNpcRealtimeExample.cs` (WS),
  - `UNITY_SDK_USAGE.md` (инструкция запуска).
- Реализована полноценная auth-модель v1:
  - backend: `POST /v1/auth/register`, `POST /v1/auth/login`, `GET /v1/auth/me`,
  - JWT (7d), bcrypt hashing, users storage (Postgres/memory),
  - frontend: форма входа/регистрации, сохранение токена и кнопка выхода.
- Добавлен LLM-слой ответов в backend (OpenAI Chat, model через `OPENAI_CHAT_MODEL`) с fallback на rule-based.
- Добавлена долговременная память NPC (`memories`) с retrieval при генерации ответа.
- Добавлены API для операционного управления персонажами:
  - `GET /v1/characters/:characterId`,
  - `PATCH /v1/characters/:characterId/config` (tone/opening/systemPrompt/behavior),
  - `GET /v1/characters/:characterId/memories`,
  - `DELETE /v1/characters/:characterId/memories`.
- Добавлена UI-админка в `src/App.tsx`:
  - редактирование tone/opening/systemPrompt/behavior,
  - сохранение конфига активного NPC,
  - просмотр и очистка долгосрочной памяти персонажа.
- Добавлен runtime probe на фронте (`checkRuntimeStatus`) и индикатор режима: live API vs preview fallback.
- Добавлен `GO_LIVE_CHECKLIST.md` для перехода с preview на рабочую версию.
- Добавлен server-side STT endpoint `POST /v1/stt` (OpenAI transcription) и fallback voice capture через MediaRecorder на фронтенде.
- Усилена auth-модель с ролями:
  - роли `admin | user` в JWT и профиле пользователя,
  - bootstrap admin через env (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`),
  - admin-only доступ к конфигу/памяти NPC в API,
  - UI-админка видна только пользователям с ролью `admin`.
- Добавлена diagnostics-панель в UI: проверки `API`, `AUTH`, `WS`, `STT`, `TTS` одной кнопкой.
- Усилен auth-security блок:
  - access/refresh token flow (`/auth/refresh`),
  - logout all sessions (`/auth/logout-all`) через `token_version` invalidation,
  - ограничения попыток входа по IP/email (anti-bruteforce).
- Реализован RAG foundation v1:
  - загрузка документов в knowledge store (`POST /v1/characters/:characterId/knowledge`),
  - хранение knowledge chunks,
  - retrieval top chunks и подмешивание в LLM prompt.
- Реализован Memory rules v2:
  - поля `priority`, `pinned`, `expiresAt`,
  - CRUD endpoints для отдельных memory,
  - сортировка и фильтрация с учетом приоритета и TTL.
- UI админки расширен:
  - ручное добавление memory (priority/pinned),
  - pin/unpin и delete memory,
  - загрузка и удаление knowledge документов.
- Подготовлен Docker-стек:
  - `Dockerfile.backend`,
  - `Dockerfile.frontend`,
  - `docker-compose.yml`,
  - `docker/nginx/default.conf`,
  - `DOCKER_QUICKSTART.md`.
- Подготовлен production docker deploy под домены:
  - `docker-compose.prod.yml`,
  - `docker/Caddyfile.prod` (TLS + reverse proxy),
  - `.env.prod.example`,
  - `PROD_DEPLOY_WEB3.md`.
- Выполнена проверка сборки: `npm run build` завершился успешно.

## 2) Какие файлы были изменены
- `src/App.tsx`
  - Полностью заменен шаблонный экран на продуктовую страницу MVP.
- `src/services/npcApi.ts`
  - реализован API-совместимый клиент и fallback runtime.
- `backend/server.mjs`
  - добавлен API backend foundation, Postgres storage, rate limiting.
- `DEPLOY_WEB3_ALITERRA.md`
  - инструкция по выкладке на `web3.aliterra.space` и `api.web3.aliterra.space`.
- `.env.example`
  - env-шаблон для frontend (`VITE_API_BASE_URL`, `VITE_API_KEY`).
- `backend/.env.example`
  - env-шаблон для backend (`DATABASE_URL`, `PG_SSL`, `API_KEY`).
- `package-lock.json`
  - Обновлен автоматически после установки `framer-motion`, `fastify`, `@fastify/cors`.

## 3) Ошибки и риски, которые уже закрыты
- Блокер по анимациям: для использования motion-компонентов была нужна зависимость `framer-motion`; установлена и подключена.
- Техническая валидация после изменений: подтверждена успешной production-сборкой.
- Явных runtime-ошибок в текущей итерации не обнаружено.

## 4) Архитектура целевого сервиса (уровень Convai-like)

### 4.1 Product-модули
- Character Studio: создание и настройка множества NPC (личность, стиль речи, правила, цели).
- Conversation Engine: текст + голос в real-time, контекстные диалоги.
- Memory Engine: краткосрочная, эпизодическая и долговременная память NPC.
- Knowledge Layer (RAG): загрузка документов и поиск релевантного контекста.
- Integrations: API/SDK для внедрения NPC в Web/Unity/Unreal и др.

### 4.2 Технические компоненты
- Frontend: React + Tailwind (кабинет, чат, управление персонажами, документация API).
- Backend API: Node.js (рекомендуется Fastify/Nest), REST + WebSocket.
- LLM Orchestration: маршрутизация запросов по профилю NPC и сценарию.
- Voice Pipeline:
  - STT (распознавание входящего голоса),
  - TTS (генерация речи NPC),
  - streaming аудио-чанков в realtime.
- Data Layer:
  - Postgres: пользователи, персонажи, сессии, сообщения,
  - Redis: realtime-state, очереди и кэш,
  - Vector DB (например, pgvector/Qdrant): память и RAG-поиск,
  - Object Storage: документы/медиа для KB.

### 4.3 Контракт API (v1)
- `POST /v1/characters` / `GET /v1/characters` - управление NPC.
- `POST /v1/sessions` - старт диалоговой сессии пользователя с NPC.
- `POST /v1/messages` - текстовый запрос/ответ с учетом памяти.
- `WS /v1/realtime` - потоковые события: transcript, audio_chunk, npc_action.

## 5) Что еще не реализовано (gap)
- Backend-сервисы подняты как foundation, но пока in-memory (без Postgres).
- Backend поддерживает Postgres (основной режим) и memory fallback.
- Расширенная промпт-оркестрация и маршрутизация по нескольким моделям.
- Голосовой пайплайн STT/TTS.
- Полноценный RAG на документах проекта (сейчас только базовая долговременная память в таблице memories).
- SDK для игровых движков.
- Авторизация, биллинг, rate limiting, observability.

## 6) План работ (следующие шаги)

### Этап A (ближайший, приоритет)
- Поднять backend-скелет (REST + WS).
- Спроектировать и создать БД-схему (characters/sessions/messages/memories).
- Подключить frontend к реальным API (вместо локальных mock-данных).

### Этап B
- Добавить LLM-слой с системными промптами из профиля NPC.
- Реализовать memory retrieval и базовые guardrails.
- Включить текстовый production-flow end-to-end.

### Этап C
- Внедрить realtime voice (STT/TTS + streaming).
- Реализовать RAG по документам мира/проекта.

### Этап D
- Добавить API-ключи, лимиты, аудит, метрики.
- Подготовить Web SDK и минимальный Unity-клиент.
- Нагрузочное тестирование и staging/release.

## 7) Текущее состояние проекта
- Frontend: есть стартовая продуктовая страница и UX-каркас.
- Backend: еще не начат.
- Build status: успешный.

## 8) Рекомендация на следующий запуск
- Начать с backend foundation: создать API и БД, затем сразу подключить текущий UI к живым данным.
