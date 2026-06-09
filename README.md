# AI Character Platform

Платформа для создания AI-персонажей с возможностью текстового и голосового общения, аналог Convai / character.ai.

## Состояние

Этап 1: Базовая архитектура, минимальная БД, API с заглушками. **В работе.**

## Стек

- Backend: Python 3.12 + FastAPI + SQLAlchemy 2 + Pydantic v2
- DB: SQLite (dev) → Postgres (prod)
- LLM: OpenRouter (мульти-провайдер под одним API)
- TTS: Silero (локально) → ElevenLabs опционально
- STT: whisper.cpp локально
- Vector DB: Qdrant (Docker)
- Frontend: React 18 + Vite + Tailwind (позже)

## Структура

```
backend/        FastAPI приложение
  app/
    api/        HTTP роуты
    core/       config, security, deps
    db/         модели SQLAlchemy, сессия
    services/   бизнес-логика (LLM, чат, память)
    llm/        провайдеры LLM
infra/          docker-compose, Caddyfile
web/            фронтенд (позже)
.kiro/specs/    requirements / design / tasks
```

## Запуск (dev)

```cmd
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

Открыть http://localhost:8000/docs для Swagger UI.

## Контент-политика

Без NSFW-ограничений на уровне платформы. Жёсткие фильтры только на нелегальный контент (CSAM, экстремизм, насилие).
Возрастной gate 18+ обязателен.
