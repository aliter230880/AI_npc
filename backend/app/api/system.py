"""Системные эндпоинты: health, info, seed."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.llm.factory import get_llm
from app.services.seed import seed_demo_characters

router = APIRouter(tags=["system"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/info")
def info() -> dict:
    s = get_settings()
    llm = get_llm()
    # быстрый ping Qdrant без падения если он недоступен
    memory_ok = False
    if s.memory_enabled:
        try:
            import httpx
            r = httpx.get(f"{s.qdrant_url}/readyz", timeout=2.0)
            memory_ok = r.status_code == 200
        except Exception:
            memory_ok = False
    return {
        "app": s.app_name,
        "env": s.app_env,
        "llm_provider": llm.name,
        "default_model": s.llm_default_model,
        "openrouter_configured": bool(s.openrouter_api_key),
        "memory_enabled": s.memory_enabled,
        "memory_online": memory_ok,
    }


@router.post("/seed")
def run_seed(db: Session = Depends(get_db)) -> dict:
    """Создаёт демо-персонажей. Идемпотентно."""
    n = seed_demo_characters(db)
    return {"added": n}
