"""FastAPI-зависимости.

`get_current_user` опциональный: на этапе 1 многие эндпоинты можно
использовать без авторизации (для отладки UI). Когда добавим строгую
авторизацию, превратим в обязательный.
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db import models
from app.db.session import get_db

_bearer = HTTPBearer(auto_error=False)


def get_optional_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> models.User | None:
    if creds is None:
        return None
    payload = decode_token(creds.credentials)
    if not payload or payload.get("type") != "access":
        return None
    user = db.get(models.User, payload.get("sub"))
    if not user or not user.is_active:
        return None
    return user


def get_current_user(
    user: models.User | None = Depends(get_optional_user),
) -> models.User:
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return user
