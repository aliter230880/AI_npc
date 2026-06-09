"""Application settings loaded from environment.

Все настройки идут через .env, разруливаются Pydantic Settings.
В проде значения подаются переменными окружения контейнера.
"""

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "character-platform"
    app_env: str = "dev"
    app_debug: bool = True
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    # Security
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_ttl_min: int = 15
    jwt_refresh_ttl_days: int = 30

    # DB
    database_url: str = "sqlite:///./character_platform.db"

    # LLM
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    llm_default_model: str = "mistralai/mistral-nemo"
    openrouter_http_referer: str = "https://character.local"
    openrouter_app_title: str = "Character Platform"

    # Memory (Qdrant + sentence-transformers)
    qdrant_url: str = "http://127.0.0.1:6333"
    memory_enabled: bool = True
    # Сколько последних реплик берём в одну сводку
    memory_summarize_window: int = 10
    # Делать сводку каждые N сообщений (счёт от старта диалога)
    memory_summarize_every: int = 4
    # Сколько релевантных воспоминаний подмешиваем в новый запрос
    memory_recall_k: int = 4
    memory_recall_min_score: float = 0.55

    # Voice / TTS
    tts_enabled: bool = True
    tts_cache_dir: str = "/opt/character-platform/data/tts-cache"

    # Memory
    qdrant_url: str = "http://127.0.0.1:6333"
    memory_enabled: bool = True
    # каждый раз когда у юзера накопилось N новых сообщений (user+assistant вместе) —
    # запускаем суммаризацию последних N и кладём в Qdrant
    memory_summary_every: int = 6
    # сколько воспоминаний максимум подмешиваем в system prompt
    memory_recall_top_k: int = 4
    # модель-сводчик: дешёвая, быстрая. Если пусто — берётся llm_default_model
    memory_summary_model: str = ""

    # CORS-белый список. Звёздочка — разрешить всем (для тестового туннеля).
    # На проде заменить на конкретный домен.
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        v = self.cors_origins.strip()
        if v == "*":
            return ["*"]
        return [s.strip() for s in v.split(",") if s.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
