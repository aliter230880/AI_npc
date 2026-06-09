"""SQLAlchemy ORM-модели.

Минимальный набор для этапа 1-2:
- User           — учётная запись
- Character      — AI-персонаж
- Conversation   — диалоговая сессия (юзер ↔ персонаж)
- Message        — сообщение в диалоге

Этого достаточно чтобы запустить чат. Knowledge base, API-ключи,
биллинг и память — добавим в следующих этапах.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def _uuid() -> str:
    return uuid4().hex


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_adult: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)

    characters: Mapped[list["Character"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    conversations: Mapped[list["Conversation"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Character(Base):
    __tablename__ = "characters"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    owner_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True)

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Личность
    system_prompt: Mapped[str] = mapped_column(Text, default="", nullable=False)
    backstory: Mapped[str] = mapped_column(Text, default="", nullable=False)
    personality_traits: Mapped[str] = mapped_column(Text, default="", nullable=False)  # CSV или JSON-строка
    greeting: Mapped[str] = mapped_column(Text, default="", nullable=False)

    # Параметры LLM
    model: Mapped[str] = mapped_column(String(120), default="mistralai/mistral-nemo", nullable=False)
    temperature: Mapped[float] = mapped_column(Float, default=0.8, nullable=False)
    language: Mapped[str] = mapped_column(String(8), default="en", nullable=False)

    # Голос (на этапе 5)
    voice_provider: Mapped[str | None] = mapped_column(String(40), nullable=True)
    voice_id: Mapped[str | None] = mapped_column(String(120), nullable=True)

    # Видимость и теги
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    nsfw: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tags: Mapped[str] = mapped_column(Text, default="", nullable=False)  # CSV

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    owner: Mapped[User | None] = relationship(back_populates="characters")
    conversations: Mapped[list["Conversation"]] = relationship(back_populates="character", cascade="all, delete-orphan")


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    user_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True)
    character_id: Mapped[str] = mapped_column(String(32), ForeignKey("characters.id", ondelete="CASCADE"), index=True, nullable=False)

    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    user: Mapped[User | None] = relationship(back_populates="conversations")
    character: Mapped[Character] = relationship(back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    conversation_id: Mapped[str] = mapped_column(String(32), ForeignKey("conversations.id", ondelete="CASCADE"), index=True, nullable=False)

    # 'user' | 'assistant' | 'system'
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Эмоция и действие персонажа (добавлено для живости)
    emotion: Mapped[str | None] = mapped_column(String(32), nullable=True)  # happy, sad, angry, neutral, etc.
    action: Mapped[str | None] = mapped_column(String(200), nullable=True)  # *smiles*, *looks away*, etc.

    # Учёт расхода (заполняется на этапе 2)
    tokens_in: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tokens_out: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    model: Mapped[str | None] = mapped_column(String(120), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)

    conversation: Mapped[Conversation] = relationship(back_populates="messages")
