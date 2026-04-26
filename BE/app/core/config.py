"""Application configuration loaded from environment variables."""

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

    @property
    def allowed_origins(self) -> list[str]:
        """CORS origins as a list."""
        return [origin.strip() for origin in self.allowed_origins_raw.split(",") if origin.strip()]

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value: object) -> bool:
        """Parse DEBUG env from non-boolean strings such as 'release'."""

        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in {"1", "true", "yes", "on", "debug", "development"}
        return bool(value)

        if isinstance(value, list):
            return value
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    """Return a cached settings object to avoid reparsing env variables."""

    return Settings()
