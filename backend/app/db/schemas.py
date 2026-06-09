"""Pydantic-схемы для request/response API.

Раздельные схемы Create / Update / Read.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# ---------- Auth ----------

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=120)
    is_adult: bool = Field(default=False, description="Подтверждение 18+ обязательно")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    display_name: str | None
    is_active: bool
    is_adult: bool
    created_at: datetime


# ---------- Character ----------

class CharacterBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    avatar_url: str | None = None
    system_prompt: str = ""
    backstory: str = ""
    personality_traits: str = ""
    greeting: str = ""
    model: str = "mistralai/mistral-nemo"
    temperature: float = Field(default=0.8, ge=0.0, le=2.0)
    language: str = Field(default="en", max_length=8)
    voice_provider: str | None = None
    voice_id: str | None = None
    is_public: bool = False
    nsfw: bool = False
    tags: str = ""


class CharacterCreate(CharacterBase):
    pass


class CharacterUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    avatar_url: str | None = None
    system_prompt: str | None = None
    backstory: str | None = None
    personality_traits: str | None = None
    greeting: str | None = None
    model: str | None = None
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    language: str | None = None
    voice_provider: str | None = None
    voice_id: str | None = None
    is_public: bool | None = None
    nsfw: bool | None = None
    tags: str | None = None


class CharacterRead(CharacterBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str | None
    created_at: datetime
    updated_at: datetime


# ---------- Conversation / Message ----------

class ConversationCreate(BaseModel):
    character_id: str
    title: str | None = None


class ConversationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str | None
    character_id: str
    title: str | None
    created_at: datetime
    updated_at: datetime


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=8000)


class MessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    conversation_id: str
    role: Literal["user", "assistant", "system"]
    content: str
    emotion: str | None = None
    action: str | None = None
    tokens_in: int
    tokens_out: int
    model: str | None
    created_at: datetime


class ChatResponse(BaseModel):
    """Не-стрим ответ, удобно для отладки и SDK."""
    user_message: MessageRead
    assistant_message: MessageRead


# ---------- Voice ----------

class VoiceRead(BaseModel):
    id: str
    name: str
    language: str
    gender: str
    style: str = "calm"
