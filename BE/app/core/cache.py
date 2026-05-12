"""Small in-memory TTL cache helpers for low-volatility API responses."""

import asyncio
import json
from dataclasses import dataclass
from time import monotonic
from typing import Any

from app.core.redis_client import get_redis_client
from pydantic import BaseModel

@dataclass(slots=True)
class CacheEntry:
    """Cached value with monotonic expiration."""

    expires_at: float
    value: Any


class TTLCacheStore:
    """Async-safe cache with namespace invalidation."""

    def __init__(self) -> None:
        self._entries: dict[tuple[str, int, Any], CacheEntry] = {}
        self._namespace_versions: dict[str, int] = {}
        self._lock = asyncio.Lock()
        self._redis = get_redis_client()

    async def get(self, namespace: str, key: Any) -> Any | None:
        """Return cached value when present and not expired."""

        redis_key = f"cache:{namespace}:{key!r}"
        try:
            raw = await self._redis.get(redis_key)
            if raw is not None:
                return json.loads(raw)
        except Exception:
            pass

        async with self._lock:
            version = self._namespace_versions.get(namespace, 0)
            composite_key = (namespace, version, key)
            entry = self._entries.get(composite_key)
            if not entry:
                return None
            if entry.expires_at <= monotonic():
                self._entries.pop(composite_key, None)
                return None
            return entry.value

    async def set(self, namespace: str, key: Any, value: Any, ttl_seconds: int) -> Any:
        """Store value in cache and return it for fluent usage."""

        redis_key = f"cache:{namespace}:{key!r}"
        try:
            await self._redis.set(redis_key, json.dumps(self._jsonable(value), default=str), ex=ttl_seconds)
        except Exception:
            pass

        async with self._lock:
            version = self._namespace_versions.get(namespace, 0)
            composite_key = (namespace, version, key)
            self._entries[composite_key] = CacheEntry(expires_at=monotonic() + ttl_seconds, value=value)
            return value

    def _jsonable(self, value: Any) -> Any:
        """Convert pydantic/object values to JSON-safe primitives."""

        if isinstance(value, BaseModel):
            return value.model_dump(mode="json")
        if isinstance(value, dict):
            return {k: self._jsonable(v) for k, v in value.items()}
        if isinstance(value, list):
            return [self._jsonable(item) for item in value]
        if isinstance(value, tuple):
            return [self._jsonable(item) for item in value]
        return value

    async def invalidate_namespace(self, namespace: str) -> None:
        """Invalidate all current entries of one namespace."""

        await self.invalidate_pattern(f"cache:{namespace}:*")

        async with self._lock:
            self._namespace_versions[namespace] = self._namespace_versions.get(namespace, 0) + 1

    async def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate redis keys matching one wildcard pattern."""

        try:
            keys = await self._redis.keys(pattern)
            if not keys:
                return 0
            return int(await self._redis.delete(*keys))
        except Exception:
            return 0

    async def invalidate_patterns(self, patterns: list[str]) -> int:
        """Invalidate multiple wildcard patterns and return total deleted keys."""

        total = 0
        for pattern in patterns:
            total += await self.invalidate_pattern(pattern)
        return total


public_api_cache = TTLCacheStore()

EVENT_LIST_CACHE_NAMESPACE = "events:list"


def show_seat_cache_namespace(show_id: int) -> str:
    """Namespace for one show seat matrix cache."""

    return f"shows:seats:{show_id}"


def event_seat_cache_namespace(event_id: int) -> str:
    """Backward-compatible alias kept for older call sites during refactor."""

    return show_seat_cache_namespace(event_id)
