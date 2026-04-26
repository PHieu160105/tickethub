"""Lightweight in-memory rate limiting for sensitive endpoints."""

import asyncio
from collections import defaultdict, deque
from hashlib import sha256
from time import monotonic

from fastapi import HTTPException, Request, status


class InMemoryRateLimiter:
    """Track recent requests in-process with sliding window semantics."""

    def __init__(self) -> None:
        self._hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def check(self, scope: str, identity: str, limit: int, window_seconds: int) -> None:
        """Raise HTTP 429 when caller exceeds the configured rate."""

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
                    detail=f"Rate limit exceeded for {scope}. Try again later.",
                )

            bucket.append(now)


rate_limiter = InMemoryRateLimiter()


def _request_identity(request: Request) -> str:
    """Build a stable caller identity from IP and optional bearer token."""

    client_host = request.client.host if request.client else "unknown"
    auth_header = request.headers.get("authorization", "")
    token_hash = ""
    if auth_header.lower().startswith("bearer "):
        token_hash = sha256(auth_header[7:].encode("utf-8")).hexdigest()[:16]

    return f"{client_host}:{token_hash}" if token_hash else client_host


def rate_limit(scope: str, times: int, seconds: int):
    """Create a FastAPI dependency enforcing an in-memory rate limit."""

    async def dependency(request: Request) -> None:
        await rate_limiter.check(scope=scope, identity=_request_identity(request), limit=times, window_seconds=seconds)

    return dependency
