"""Nạp và chuẩn hóa cấu hình chạy ứng dụng từ biến môi trường."""

import json
from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Tập trung toàn bộ cấu hình runtime của backend TicketRush.

    Input:
    - Biến môi trường từ file `.env` và môi trường shell hiện tại.

    Output:
    - Một đối tượng cấu hình đã được chuẩn hóa kiểu dữ liệu để toàn bộ backend dùng chung.

    Cách hoạt động:
    - Ưu tiên giá trị do môi trường cung cấp.
    - Nếu thiếu một số biến tổng hợp như `REDIS_URL`, lớp này sẽ tự dựng từ host/port phụ trợ.
    """

    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    app_name: str = "TicketRush API"
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = True

    backend_host: str = "0.0.0.0"
    backend_port: int = 8000

    database_url: str = Field(validation_alias="DATABASE_URL")
    database_pool_size: int = Field(default=10, validation_alias="DATABASE_POOL_SIZE")
    database_max_overflow: int = Field(default=20, validation_alias="DATABASE_MAX_OVERFLOW")
    database_pool_timeout: int = Field(default=30, validation_alias="DATABASE_POOL_TIMEOUT")

    secret_key: str = "change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    refresh_token_expire_minutes: int = 10080

    # pydantic-settings v2 có thể tự parse kiểu phức tạp theo JSON.
    # Ở đây giữ chuỗi gốc để chấp nhận cả định dạng danh sách cách nhau bằng dấu phẩy.
    allowed_origins_raw: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174",
        validation_alias="ALLOWED_ORIGINS",
    )

    hold_minutes_default: int = 10
    queue_batch_size_default: int = 50
    queue_admit_ttl_minutes: int = 15
    waiting_room_db_latency_ms: int = Field(default=500, validation_alias="WAITING_ROOM_DB_LATENCY_MS")
    waiting_room_error_threshold: int = Field(default=5, validation_alias="WAITING_ROOM_ERROR_THRESHOLD")
    waiting_room_request_threshold: int = Field(default=200, validation_alias="WAITING_ROOM_REQUEST_THRESHOLD")
    waiting_room_recovery_seconds: int = Field(default=60, validation_alias="WAITING_ROOM_RECOVERY_SECONDS")
    queue_release_batch_default: int = Field(default=50, validation_alias="QUEUE_RELEASE_BATCH_DEFAULT")
    queue_max_active_tokens_default: int = Field(default=200, validation_alias="QUEUE_MAX_ACTIVE_TOKENS_DEFAULT")
    queue_inactive_grace_seconds: int = Field(default=90, validation_alias="QUEUE_INACTIVE_GRACE_SECONDS")
    redis_url: str | None = Field(default=None, validation_alias="REDIS_URL")
    redis_host: str = Field(default="127.0.0.1", validation_alias="REDIS_HOST")
    redis_port: int = Field(default=6380, validation_alias="REDIS_PORT")
    redis_password: str = Field(default="", validation_alias="REDIS_PASSWORD")

    google_client_id: str = ""
    google_client_secret: str = ""
    frontend_app_url: str = "http://localhost:5173"
    discord_client_id: str = ""
    discord_client_secret: str = ""
    discord_redirect_uri: str = "http://localhost:8000/api/auth/discord/callback"

    @property
    def allowed_origins(self) -> list[str]:
        """Trả về danh sách origin CORS hợp lệ."""
        raw = self.allowed_origins_raw.strip()
        if not raw:
            return ["http://localhost:5173"]

        # Chấp nhận cả định dạng JSON array nếu người dùng khai báo theo kiểu đó.
        if raw.startswith("["):
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    return [str(origin).strip() for origin in parsed if str(origin).strip()]
            except json.JSONDecodeError:
                pass

        # Nếu không phải JSON array thì tách theo dấu phẩy.
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    @property
    def allowed_origin_regex(self) -> str | None:
        """Cho phép frontend local đổi port trong môi trường phát triển mà không vỡ CORS."""

        if self.environment == "production":
            return None
        return r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"

    @property
    def resolved_redis_url(self) -> str:
        """Trả về Redis URL cuối cùng mà backend sẽ sử dụng.

        Input:
        - Có thể có hoặc không có `REDIS_URL` đầy đủ trong môi trường.

        Output:
        - Chuỗi kết nối Redis hợp lệ.

        Cách hoạt động:
        - Nếu `REDIS_URL` đã được khai báo thì dùng nguyên giá trị đó.
        - Nếu chưa có thì tự ghép từ `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`.
        """

        if self.redis_url and self.redis_url.strip():
            return self.redis_url.strip()

        auth_segment = ""
        if self.redis_password:
            auth_segment = f":{self.redis_password}@"

        return f"redis://{auth_segment}{self.redis_host}:{self.redis_port}/0"

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value: object) -> bool:
        """Chuẩn hóa biến DEBUG từ nhiều kiểu chuỗi khác nhau về boolean."""

        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in {"1", "true", "yes", "on", "debug", "development"}
        return bool(value)


@lru_cache
def get_settings() -> Settings:
    """Trả về đối tượng cấu hình đã cache để tránh parse lại môi trường nhiều lần."""

    return Settings()
