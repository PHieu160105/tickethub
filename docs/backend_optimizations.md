# Backend Optimizations & Bug Fixes

## 1. Centralized Error Handling

**Priority**: Medium

**Issue**: Không có global exception handler - các lỗi không mong muốn trả về generic 500 error không có format nhất quán.

**Fix**: Thêm exception handlers trong `main.py`:

```python
from fastapi import Request, status
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"}
    )

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": str(exc)}
    )
```

---

## 2. Rate Limiting

**Priority**: High

**Issue**: Không có rate limiting - dễ bị tấn công DDoS hoặc abuse API trong flash sale.

**Fix**: Thêm rate limiting middleware:

```python
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter

# Trong main.py
await FastAPILimiter.init(redis)

# Áp dụng cho các endpoint sensitive
@router.post("/bookings/lock", dependencies=[Depends(RateLimiter(times=5, seconds=60))])
```

Hoặc sử dụng `slowapi`:

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/bookings/lock")
@limiter.limit("5/minute")
async def lock_seats(...):
```

---

## 3. Input Sanitization

**Priority**: Medium

**Issue**: Một số endpoint có thể bị NoSQL injection hoặc XSS nếu search params được reflect trong response.

**Fix**: Đảm bảo search params được validate:

```python
# Trong events.py
if search:
    if len(search) > 120:
        raise HTTPException(status_code=400, detail="Search query too long")
    # Pattern đã có sẵn nhưng cần escape special chars
```

---

## 4. Health Check Enhancement

**Priority**: Low

**Issue**: `/health` endpoint hiện tại chỉ trả về static response, không kiểm tra database.

**Fix**: Thêm database check:

```python
@app.get("/health")
async def health():
    from sqlalchemy import text
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))
    return {"status": "ok", "db": "connected"}
```

---

## 5. Admin Event Deletion - Soft Delete

**Priority**: High

**Issue**: `DELETE /api/admin/events/{event_key}` xóa cứng (hard delete) - có thể mất dữ liệu thống kê.

**Fix**: Chuyển thành soft delete:

```python
# Trong models/event.py
is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

# Trong admin.py - thay vì xóa
event.is_deleted = True
await session.commit()
```

Đồng thời cập nhật queries để filter `is_deleted=False`.

---

## 6. Queue Token Expiration Cleanup

**Priority**: Medium

**Issue**: Queue entries không có cleanup job - có thể tích lũy stale tokens trong database.

**Fix**: Thêm background task trong `workers/tasks.py`:

```python
async def cleanup_expired_queue_entries(session: AsyncSession):
    """Delete expired queue entries."""
    from datetime import timedelta
    cutoff = datetime.now(UTC) - timedelta(hours=24)
    await session.execute(
        delete(QueueEntry)
        .where(QueueEntry.expires_at < cutoff)
    )
```

---

## 7. WebSocket Connection Limits

**Priority**: Medium

**Issue**: Không giới hạn số WebSocket connections per user - có thể bị abuse.

**Fix**: Trong `connection_manager.py`:

```python
MAX_CONNECTIONS_PER_USER = 5

async def connect(self, websocket: WebSocket, user_id: int):
    user_connections = self.active_connections.get(user_id, [])
    if len(user_connections) >= self.MAX_CONNECTIONS_PER_USER:
        await websocket.close(code=4004, reason="Too many connections")
        return
```

---

## 8. Ticket Code Generation - Uniqueness

**Priority**: High

**Issue**: Ticket code format `TR-{order.id}-{seat.id}` có thể trùng lặp nếu seat_id/order_id reset.

**Fix**: Sử dụng UUID hoặc thêm timestamp:

```python
ticket_code = f"TR-{uuid4().hex[:12].upper()}"
# Hoặc
ticket_code = f"TR-{datetime.now(UTC).strftime('%Y%m%d')}-{uuid4().hex[:8].upper()}"
```

---

## 9. Pagination for My Tickets

**Priority**: Medium

**Issue**: `GET /api/bookings/my-tickets` không có pagination - nếu user mua nhiều vé sẽ trả về huge response.

**Fix**: Thêm limit/offset params:

```python
@router.get("/my-tickets", response_model=list[MyTicketResponse])
async def my_tickets(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    ...
):
    stmt = stmt.limit(limit).offset(offset)
```

---

## 10. API Response Caching

**Priority**: Low

**Issue**: Event list và seat matrix được fetch nhiều lần nhưng không cache.

**Fix**: Thêm cache cho public endpoints:

```python
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend

# Áp dụng cho các endpoint ít thay đổi
@router.get("", response_model=list[EventCardResponse])
@cache(expire=300)  # 5 minutes
async def list_events(...):
```

---

## Summary

| # | Issue | Priority | Effort |
|---|-------|----------|--------|
| 1 | Centralized Error Handling | Medium | Low |
| 2 | Rate Limiting | High | Medium |
| 3 | Input Sanitization | Medium | Low |
| 4 | Health Check Enhancement | Low | Low |
| 5 | Soft Delete for Events | High | Medium |
| 6 | Queue Cleanup Job | Medium | Low |
| 7 | WebSocket Limits | Medium | Low |
| 8 | Ticket Code Uniqueness | High | Low |
| 9 | Pagination for My Tickets | Medium | Low |
| 10 | Response Caching | Low | Medium |