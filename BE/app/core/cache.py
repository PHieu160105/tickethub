"""Small in-memory TTL cache helpers for low-volatility API responses."""

import asyncio
from dataclasses import dataclass
from time import monotonic
from typing import Any


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

    async def get(self, namespace: str, key: Any) -> Any | None:
        """Return cached value when present and not expired."""

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

        async with self._lock:
            version = self._namespace_versions.get(namespace, 0)
            composite_key = (namespace, version, key)
            self._entries[composite_key] = CacheEntry(expires_at=monotonic() + ttl_seconds, value=value)
            return value

    async def invalidate_namespace(self, namespace: str) -> None:
        """Invalidate all current entries of one namespace."""

        async with self._lock:
            self._namespace_versions[namespace] = self._namespace_versions.get(namespace, 0) + 1


public_api_cache = TTLCacheStore()

EVENT_LIST_CACHE_NAMESPACE = "events:list"


def event_seat_cache_namespace(event_id: int) -> str:
    """Namespace for one event seat matrix cache."""

    return f"events:seats:{event_id}"
