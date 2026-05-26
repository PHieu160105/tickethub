"""Cung cấp bộ nhớ đệm TTL trong RAM kèm Redis cho các API ít biến động."""

import asyncio
import json
from dataclasses import dataclass
from time import monotonic
from typing import Any

from app.core.redis_client import get_redis_client
from pydantic import BaseModel

@dataclass(slots=True)
class CacheEntry:
    """Đại diện cho một mục cache kèm thời điểm hết hạn theo đồng hồ monotonic."""

    expires_at: float
    value: Any


class TTLCacheStore:
    """Bộ nhớ đệm an toàn cho môi trường async, hỗ trợ xóa theo namespace.

    Input:
    - Namespace, key, value và TTL của từng mục cache.

    Output:
    - Dữ liệu đã cache trong Redis và/hoặc bộ nhớ cục bộ trong tiến trình.

    Cách hoạt động:
    - Ưu tiên đọc Redis trước để tận dụng cache liên tiến trình.
    - Nếu Redis lỗi hoặc không sẵn sàng, hệ thống tự fallback về cache trong RAM.
    - Namespace version giúp vô hiệu hóa nhanh toàn bộ key liên quan mà không phải duyệt hết RAM.
    """

    def __init__(self) -> None:
        self._entries: dict[tuple[str, int, Any], CacheEntry] = {}
        self._namespace_versions: dict[str, int] = {}
        self._lock = asyncio.Lock()
        self._redis = get_redis_client()

    async def get(self, namespace: str, key: Any) -> Any | None:
        """Lấy giá trị cache nếu còn tồn tại và chưa hết hạn."""

        async with self._lock:
            version = self._namespace_versions.get(namespace, 0)
            composite_key = (namespace, version, key)
            entry = self._entries.get(composite_key)
            if entry and entry.expires_at > monotonic():
                return entry.value
            if entry:
                self._entries.pop(composite_key, None)
    
        redis_key = f"cache:{namespace}:{key!r}"
        try:
            raw = await self._redis.get(redis_key)
            if raw is not None:
                value = json.loads(raw)
                async with self._lock:
                    version = self._namespace_versions.get(namespace, 0)
                    self._entries[(namespace, version, key)] = CacheEntry(expires_at=monotonic() + 1, value=value)
                return value
        except Exception:
            pass

        return None

    async def set(self, namespace: str, key: Any, value: Any, ttl_seconds: int) -> Any:
        """Ghi giá trị vào cache rồi trả lại chính giá trị đó để caller dùng tiếp."""

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
        """Chuyển dữ liệu về dạng an toàn để serialize JSON."""

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
        """Vô hiệu hóa toàn bộ mục cache của một namespace."""

        await self.invalidate_pattern(f"cache:{namespace}:*")

        async with self._lock:
            self._namespace_versions[namespace] = self._namespace_versions.get(namespace, 0) + 1

    async def invalidate_pattern(self, pattern: str) -> int:
        """Xóa các key Redis khớp với một pattern wildcard."""

        try:
            keys = await self._redis.keys(pattern)
            if not keys:
                return 0
            return int(await self._redis.delete(*keys))
        except Exception:
            return 0

    async def invalidate_patterns(self, patterns: list[str]) -> int:
        """Xóa nhiều pattern cache và trả về tổng số key đã bị xóa."""

        total = 0
        for pattern in patterns:
            total += await self.invalidate_pattern(pattern)
        return total


public_api_cache = TTLCacheStore()

EVENT_LIST_CACHE_NAMESPACE = "events:list"
EVENT_DETAIL_CACHE_NAMESPACE = "events:detail"
SHOW_DETAIL_CACHE_NAMESPACE = "shows:detail"


def show_seat_cache_namespace(show_id: int) -> str:
    """Sinh namespace cache cho seat matrix của một show."""

    return f"shows:seats:{show_id}"


def event_seat_cache_namespace(event_id: int) -> str:
    """Alias tương thích ngược cho các call site cũ đang truyền `event_id`."""

    return show_seat_cache_namespace(event_id)


def user_ticket_cache_namespace(user_id: int) -> str:
    """Sinh namespace cache cho danh sách vé của một người dùng."""

    return f"users:{user_id}:tickets"
