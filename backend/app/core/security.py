"""Хэш паролей и работа с JWT.

Используем напрямую модуль `bcrypt` 5.x. passlib не подходит — у него
проблемы с bcrypt>=5 и он давно не развивается.
"""

from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.core.config import get_settings

# bcrypt не принимает пароли длиннее 72 байт — обрезаем сами как делают
# почти все production-системы.
_BCRYPT_MAX = 72


def _truncate(password: str) -> bytes:
    return password.encode("utf-8")[:_BCRYPT_MAX]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_truncate(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(_truncate(password), password_hash.encode("utf-8"))
    except ValueError:
        return False


def _create_token(subject: str, ttl: timedelta, token_type: str) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + ttl).timestamp()),
    }
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


def create_access_token(subject: str) -> str:
    s = get_settings()
    return _create_token(subject, timedelta(minutes=s.jwt_access_ttl_min), "access")


def create_refresh_token(subject: str) -> str:
    s = get_settings()
    return _create_token(subject, timedelta(days=s.jwt_refresh_ttl_days), "refresh")


def decode_token(token: str) -> dict[str, Any] | None:
    s = get_settings()
    try:
        return jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])
    except JWTError:
        return None
