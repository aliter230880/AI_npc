"""SQLAlchemy engine + session factory.

Для SQLite включаем check_same_thread=False, потому что FastAPI
использует разные потоки. Для Postgres эта опция игнорируется.
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


_settings = get_settings()
_connect_args = {"check_same_thread": False} if _settings.database_url.startswith("sqlite") else {}

engine = create_engine(
    _settings.database_url,
    echo=False,
    future=True,
    connect_args=_connect_args,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Создаёт все таблицы из моделей. Используется на старте dev-окружения.

    В проде этим занимается Alembic.
    """
    # импортируем здесь чтобы избежать циклических импортов
    from app.db import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
