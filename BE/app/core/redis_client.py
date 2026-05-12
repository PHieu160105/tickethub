"""Redis client helpers with graceful fallback when Redis is unavailable."""

from __future__ import annotations

from redis.asyncio import Redis

from app.core.config import get_settings

settings = get_settings()

_redis_client: Redis | None = None


def get_redis_client() -> Redis:
    global _redis_client
    if _redis_client is None:
        redis_url = getattr(settings, "redis_url", "redis://127.0.0.1:6379/0")
        _redis_client = Redis.from_url(redis_url, decode_responses=True)
    return _redis_client

