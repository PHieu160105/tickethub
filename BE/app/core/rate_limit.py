"""Cung cấp rate limit nhẹ cho các endpoint nhạy cảm bằng Redis hoặc bộ nhớ tiến trình."""

import asyncio
from collections import defaultdict, deque
from hashlib import sha256
from time import monotonic

from fastapi import HTTPException, Request, status
from redis.exceptions import RedisError

from app.core.redis_client import get_redis_client


class InMemoryRateLimiter:
    """Theo dõi tần suất request gần đây bằng sliding window.

    Input:
    - Scope logic, định danh caller, giới hạn số lần và số giây của cửa sổ.

    Output:
    - Không trả dữ liệu; sẽ ném `HTTPException 429` nếu vượt ngưỡng.

    Cách hoạt động:
    - Ưu tiên Redis để rate limit ổn định giữa nhiều tiến trình.
    - Nếu Redis lỗi, fallback về bộ nhớ trong tiến trình hiện tại.
    """

    def __init__(self) -> None:
        self._hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()
        self._redis = get_redis_client()

    async def check(self, scope: str, identity: str, limit: int, window_seconds: int) -> None:
        """Ném lỗi HTTP 429 khi caller vượt quá giới hạn đã cấu hình.

        Input:
        - `scope`: tên nhóm nghiệp vụ cần giới hạn, ví dụ `queue-join`.
        - `identity`: định danh caller đã chuẩn hóa từ IP/token.
        - `limit`: số request tối đa được phép trong cửa sổ thời gian.
        - `window_seconds`: độ dài cửa sổ thời gian tính bằng giây.

        Output:
        - Không trả dữ liệu nếu request còn hợp lệ.
        - Ném `HTTPException 429` nếu caller vượt giới hạn.

        Cách hoạt động:
        - Redis dùng counter có TTL để chia sẻ giới hạn giữa nhiều process.
        - Nếu Redis lỗi, fallback sang deque trong RAM theo sliding window.
        """

        redis_key = f"ratelimit:{scope}:{identity}"
        try:
            current = await self._redis.incr(redis_key)
            if current == 1:
                await self._redis.expire(redis_key, window_seconds)
            if current > limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Bạn đã vượt giới hạn truy cập cho {scope}. Vui lòng thử lại sau.",
                )
            return
        except RedisError:
            pass

        now = monotonic()
        window_start = now - window_seconds
        bucket_key = (scope, identity)

        async with self._lock:
            bucket = self._hits[bucket_key]
            while bucket and bucket[0] <= window_start:
                bucket.popleft()

            if len(bucket) >= limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Bạn đã vượt giới hạn truy cập cho {scope}. Vui lòng thử lại sau.",
                )

            bucket.append(now)


rate_limiter = InMemoryRateLimiter()


def _request_identity(request: Request) -> str:
    """Tạo định danh ổn định cho caller từ IP và bearer token nếu có.

    Input:
    - `request`: request FastAPI hiện tại.

    Output:
    - Chuỗi định danh caller. Nếu có bearer token thì gồm IP + hash token.

    Cách hoạt động:
    - Hash token thay vì lưu token thô để log/bộ nhớ không chứa credential nhạy cảm.
    - Nếu request không có token thì fallback về IP client.
    """

    client_host = request.client.host if request.client else "unknown"
    auth_header = request.headers.get("authorization", "")
    token_hash = ""
    if auth_header.lower().startswith("bearer "):
        token_hash = sha256(auth_header[7:].encode("utf-8")).hexdigest()[:16]

    return f"{client_host}:{token_hash}" if token_hash else client_host


def rate_limit(scope: str, times: int, seconds: int):
    """Tạo dependency FastAPI để áp rate limit cho endpoint.

    Input:
    - `scope`: tên nhóm limit.
    - `times`: số lần tối đa.
    - `seconds`: thời gian áp limit.

    Output:
    - Một dependency async có thể gắn vào `Depends(...)` của route.

    Cách hoạt động:
    - Dependency lấy identity từ request.
    - Sau đó gọi `rate_limiter.check` để quyết định cho đi tiếp hay trả 429.
    """

    async def dependency(request: Request) -> None:
        await rate_limiter.check(scope=scope, identity=_request_identity(request), limit=times, window_seconds=seconds)

    return dependency
