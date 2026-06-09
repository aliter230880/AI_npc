"""FastAPI app entrypoint."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.api import auth, characters, chat, system, voice
from app.core.config import get_settings
from app.db.session import SessionLocal, init_db
from app.llm.openrouter_provider import OpenRouterError
from app.services.seed import seed_demo_characters

# Настраиваем логирование чтобы наши app.* логгеры писались в journald.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logging.getLogger("app").setLevel(logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # На старте: создаём таблицы и сидим демо-персонажей.
    init_db()
    db = SessionLocal()
    try:
        seed_demo_characters(db)
    finally:
        db.close()
    yield


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(
        title="AI Character Platform",
        version="0.1.0",
        debug=s.app_debug,
        lifespan=lifespan,
    )

    # Со звёздочкой allow_credentials=False (требование браузеров)
    allow_creds = "*" not in s.cors_origins_list
    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.cors_origins_list,
        allow_credentials=allow_creds,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(system.router)
    app.include_router(auth.router)
    app.include_router(characters.router)
    app.include_router(chat.router)
    app.include_router(voice.router)
    app.include_router(voice.router)

    @app.exception_handler(OpenRouterError)
    async def _llm_error_handler(request, exc: OpenRouterError):
        # 502 — сервер апстрима ответил ошибкой; для неавторизованного ключа 401.
        status = 502
        if exc.status_code in (401, 403):
            status = 502  # юзеру всё равно это не его проблема, скрываем как upstream
        return JSONResponse(
            status_code=status,
            content={
                "detail": f"LLM error ({exc.status_code}): {exc.message}",
                "model": exc.model,
            },
        )

    # Playground UI: голый HTML-файл, чтобы можно было пощупать без npm.
    static_dir = Path(__file__).parent / "static"
    if static_dir.exists():
        app.mount("/playground", StaticFiles(directory=static_dir, html=True), name="playground")

    @app.get("/", include_in_schema=False)
    def root():
        return RedirectResponse(url="/playground/")

    return app


app = create_app()
