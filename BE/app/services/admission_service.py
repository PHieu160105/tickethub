"""Admission control cho Waiting Room tự động của luồng đặt vé."""

from __future__ import annotations

from datetime import timezone, datetime
from time import perf_counter
from typing import Literal

from fastapi import HTTPException, Request, status
from redis.exceptions import RedisError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.redis_client import get_redis_client
from app.models.enums import UserType
from app.models.event import Show
from app.models.user import User
from app.services.queue_service import expire_inactive_admitted_tokens, has_valid_admitted_queue_token

settings = get_settings()
redis_client = get_redis_client()

WaitingRoomState = Literal["normal", "waiting_room", "recovery"]

STATE_KEY = "waiting_room:state"
STATE_CHANGED_AT_KEY = "waiting_room:state_changed_at"
DB_ERROR_KEY = "waiting_room:db_errors"
PROTECTED_REQUEST_KEY = "waiting_room:protected_requests"
QUEUE_URL_TEMPLATE = "/queue?showId={show_id}"


def _now_ts() -> int:
    return int(datetime.now(timezone.utc).timestamp())


async def get_waiting_room_state() -> WaitingRoomState:
    """Đọc trạng thái Waiting Room hiện tại; Redis lỗi thì cho hệ thống chạy bình thường."""

    try:
        raw = await redis_client.get(STATE_KEY)
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8")
        if raw in {"normal", "waiting_room", "recovery"}:
            return raw  # type: ignore[return-value]
    except RedisError:
        return "normal"
    except Exception:
        return "normal"
    return "normal"


async def _set_waiting_room_state(state: WaitingRoomState) -> None:
    try:
        await redis_client.set(STATE_KEY, state)
        await redis_client.set(STATE_CHANGED_AT_KEY, str(_now_ts()))
    except Exception:
        pass


async def record_protected_route_hit() -> int:
    """Ghi nhận request vào route cần admission để phục vụ quan sát tải."""

    try:
        current = await redis_client.incr(PROTECTED_REQUEST_KEY)
        if current == 1:
            await redis_client.expire(PROTECTED_REQUEST_KEY, 60)
        return int(current)
    except Exception:
        return 0


async def record_db_error() -> None:
    """Ghi nhận lỗi DB gần đây cho worker health-check."""

    try:
        current = await redis_client.incr(DB_ERROR_KEY)
        if current == 1:
            await redis_client.expire(DB_ERROR_KEY, 60)
    except Exception:
        pass


def _waiting_room_required(show_id: int) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "code": "WAITING_ROOM_REQUIRED",
            "show_id": show_id,
            "queue_url": QUEUE_URL_TEMPLATE.format(show_id=show_id),
            "message": "Hệ thống đang nhiều lượt truy cập. Vui lòng vào phòng chờ để nhận lượt đặt vé.",
        },
    )


def read_queue_token(request: Request, explicit_token: str | None = None) -> str | None:
    """Lấy queue token từ body/query hoặc header `X-Queue-Token`."""

    header_token = request.headers.get("x-queue-token")
    return explicit_token or header_token or request.query_params.get("queue_token")


async def _has_admitted_queue_token(session: AsyncSession, show_id: int, user_id: int, token: str | None) -> bool:
    _ = session
    return has_valid_admitted_queue_token(show_id, user_id, token, now=datetime.now(timezone.utc))


async def ensure_admission_for_show(
    session: AsyncSession,
    show: Show,
    current_user: User | None,
    queue_token: str | None,
    *,
    record_hit: bool = True,
) -> None:
    """Chặn route nặng khi Waiting Room đang bật và user chưa có token admitted."""

    hit_count = await record_protected_route_hit() if record_hit else 0
    state = await get_waiting_room_state()
    if state == "normal" and hit_count >= settings.waiting_room_request_threshold:
        await _set_waiting_room_state("waiting_room")
        state = "waiting_room"
    if state == "normal":
        return

    if not current_user:
        raise _waiting_room_required(show.id)
    if current_user.user_type in {UserType.EVENT_STAFF, UserType.SYSTEM_ADMIN}:
        return

    if not await _has_admitted_queue_token(session, show.id, current_user.id, queue_token):
        raise _waiting_room_required(show.id)


async def reject_before_show_lookup_if_waiting_room(
    show_id: int,
    current_user: User | None,
    queue_token: str | None,
) -> None:
    """Chặn request chắc chắn chưa qua queue trước khi lookup show/event trong DB."""

    hit_count = await record_protected_route_hit()
    state = await get_waiting_room_state()
    if state == "normal" and hit_count >= settings.waiting_room_request_threshold:
        await _set_waiting_room_state("waiting_room")
        state = "waiting_room"
    if state == "normal":
        return

    if not current_user:
        raise _waiting_room_required(show_id)
    if current_user.user_type in {UserType.EVENT_STAFF, UserType.SYSTEM_ADMIN}:
        return
    if not queue_token:
        raise _waiting_room_required(show_id)


async def evaluate_waiting_room_health(session: AsyncSession) -> WaitingRoomState:
    """Worker gọi định kỳ để tự bật/tắt Waiting Room dựa trên DB health."""

    started = perf_counter()
    unhealthy = False
    try:
        await session.execute(text("SELECT 1"))
        latency_ms = int((perf_counter() - started) * 1000)
        unhealthy = latency_ms >= settings.waiting_room_db_latency_ms
    except Exception:
        await record_db_error()
        unhealthy = True

    try:
        error_count_raw = await redis_client.get(DB_ERROR_KEY)
        error_count = int(error_count_raw or 0)
    except Exception:
        error_count = 0

    try:
        protected_request_raw = await redis_client.get(PROTECTED_REQUEST_KEY)
        protected_request_count = int(protected_request_raw or 0)
    except Exception:
        protected_request_count = 0

    if error_count >= settings.waiting_room_error_threshold:
        unhealthy = True
    if protected_request_count >= settings.waiting_room_request_threshold:
        unhealthy = True

    current = await get_waiting_room_state()
    if unhealthy:
        if current != "waiting_room":
            await _set_waiting_room_state("waiting_room")
        return "waiting_room"

    if current == "waiting_room":
        await _set_waiting_room_state("recovery")
        return "recovery"

    if current == "recovery":
        try:
            changed_raw = await redis_client.get(STATE_CHANGED_AT_KEY)
            changed_at = int(changed_raw or _now_ts())
        except Exception:
            changed_at = _now_ts()
        if _now_ts() - changed_at >= settings.waiting_room_recovery_seconds:
            await _set_waiting_room_state("normal")
            return "normal"
        return "recovery"

    return "normal"


