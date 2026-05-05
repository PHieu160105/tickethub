"""Application configuration loaded from environment variables."""

import json
from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralized runtime settings for the TicketRush backend."""

    model_config = SettingsConfigDict(env_file="../.env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "TicketRush API"
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = True

    backend_host: str = "0.0.0.0"
    backend_port: int = 8000

    database_url: str = Field(env="DATABASE_URL")

    secret_key: str = "change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    # pydantic-settings v2 auto-parses env values for complex types via json.loads.
    # To accept a plain comma-separated string, keep the raw value as str and
    # expose it as a list via a property.
    allowed_origins_raw: str = Field(
        default="http://localhost:5173", validation_alias="ALLOWED_ORIGINS"
    )

    hold_minutes_default: int = 10
    queue_batch_size_default: int = 50
    queue_admit_ttl_minutes: int = 15
    game_secret: str = Field(default="change-game-secret", validation_alias="GAME_SECRET")
    redis_url: str = Field(default="redis://127.0.0.1:6379/0", validation_alias="REDIS_URL")

    @property
    def allowed_origins(self) -> list[str]:
        """CORS origins as a list."""
        raw = self.allowed_origins_raw.strip()
        if not raw:
            return ["http://localhost:5173"]

        # Accept JSON array format from env, e.g. ["http://localhost:5173","http://127.0.0.1:5173"].
        if raw.startswith("["):
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    return [str(origin).strip() for origin in parsed if str(origin).strip()]
            except json.JSONDecodeError:
                pass

        # Fallback to comma-separated string format.
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value: object) -> bool:
        """Parse DEBUG env from non-boolean strings such as 'release'."""

        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in {"1", "true", "yes", "on", "debug", "development"}
        return bool(value)


@lru_cache
def get_settings() -> Settings:
    """Return a cached settings object to avoid reparsing env variables."""

    return Settings()
