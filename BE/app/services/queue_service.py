"""Runtime queue management without relational persistence."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import HTTPException, status
from redis.exceptions import RedisError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.redis_client import get_redis_client
from app.models.enums import QueueStatus
from app.models.event import Show
from app.schemas.queue import QueueJoinResponse, QueueStatusResponse

settings = get_settings()


@dataclass(slots=True)
class QueueRuntimeEntry:
    show_id: int
    user_id: int
    token: str
    status: QueueStatus
    created_at: datetime
    position_hint: int = 0
    admitted_at: datetime | None = None
    expires_at: datetime | None = None
    last_seen_at: datetime | None = None
    completed_at: datetime | None = None


_runtime_queue: dict[int, dict[str, QueueRuntimeEntry]] = {}
_queue_locks: dict[int, asyncio.Lock] = {}
_memory_active_sessions: dict[int, dict[int, datetime]] = {}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _get_show_lock(show_id: int) -> asyncio.Lock:
    lock = _queue_locks.get(show_id)
    if lock is None:
        lock = asyncio.Lock()
        _queue_locks[show_id] = lock
    return lock


def _show_entries(show_id: int) -> dict[str, QueueRuntimeEntry]:
    return _runtime_queue.setdefault(show_id, {})


def _waiting_entries(show_id: int) -> list[QueueRuntimeEntry]:
    entries = [entry for entry in _show_entries(show_id).values() if entry.status == QueueStatus.WAITING]
    entries.sort(key=lambda entry: (entry.created_at, entry.token))
    return entries


def _admitted_entries(show_id: int) -> list[QueueRuntimeEntry]:
    entries = [entry for entry in _show_entries(show_id).values() if entry.status == QueueStatus.ADMITTED]
    entries.sort(key=lambda entry: (entry.admitted_at or entry.created_at, entry.token))
    return entries


def _find_user_entry(show_id: int, user_id: int) -> QueueRuntimeEntry | None:
    candidates = [
        entry
        for entry in _show_entries(show_id).values()
        if entry.user_id == user_id and entry.status in {QueueStatus.WAITING, QueueStatus.ADMITTED, QueueStatus.COMPLETED}
    ]
    if not candidates:
        return None
    candidates.sort(key=lambda entry: entry.created_at, reverse=True)
    return candidates[0]


def _remove_entry(show_id: int, token: str) -> None:
    entries = _show_entries(show_id)
    entries.pop(token, None)
    if not entries:
        _runtime_queue.pop(show_id, None)
        _queue_locks.pop(show_id, None)


def _refresh_waiting_positions(show_id: int) -> None:
    for index, entry in enumerate(_waiting_entries(show_id), start=1):
        entry.position_hint = index


def _expire_runtime_entry(entry: QueueRuntimeEntry, now: datetime | None = None) -> None:
    now = now or _now()
    entry.status = QueueStatus.EXPIRED
    entry.expires_at = entry.expires_at or now
    entry.last_seen_at = now
    entry.position_hint = 0


def _cleanup_terminal_entries(show_id: int, cutoff: datetime) -> int:
    deleted = 0
    for token, entry in list(_show_entries(show_id).items()):
        terminal_at = entry.completed_at or entry.expires_at
        if entry.status in {QueueStatus.EXPIRED, QueueStatus.COMPLETED} and terminal_at and terminal_at < cutoff:
            _remove_entry(show_id, token)
            deleted += 1
    return deleted


def _sweep_expired_admissions(show_id: int, now: datetime | None = None) -> int:
    now = now or _now()
    expired = 0
    inactive_cutoff = now - timedelta(seconds=settings.queue_inactive_grace_seconds)
    for entry in list(_show_entries(show_id).values()):
        if entry.status != QueueStatus.ADMITTED:
            continue
        if entry.expires_at and entry.expires_at < now:
            _expire_runtime_entry(entry, now)
            expired += 1
            continue
        if entry.last_seen_at and entry.last_seen_at < inactive_cutoff:
            _expire_runtime_entry(entry, now)
            expired += 1
    if expired:
        _refresh_waiting_positions(show_id)
    return expired


def _active_admitted_count(show_id: int, now: datetime | None = None) -> int:
    now = now or _now()
    return sum(1 for entry in _admitted_entries(show_id) if entry.expires_at is None or entry.expires_at > now)


def _admit_waiting_entries(show_id: int, now: datetime | None = None) -> int:
    now = now or _now()
    _sweep_expired_admissions(show_id, now)
    available_slots = max(settings.queue_max_active_tokens_default - _active_admitted_count(show_id, now), 0)
    if available_slots <= 0:
        _refresh_waiting_positions(show_id)
        return 0

    batch_size = min(settings.queue_batch_size_default, available_slots)
    admitted = 0
    for entry in _waiting_entries(show_id)[:batch_size]:
        entry.status = QueueStatus.ADMITTED
        entry.position_hint = 0
        entry.admitted_at = now
        entry.expires_at = now + timedelta(minutes=settings.queue_admit_ttl_minutes)
        entry.last_seen_at = now
        admitted += 1

    _refresh_waiting_positions(show_id)
    return admitted


def _entry_to_status_response(entry: QueueRuntimeEntry) -> QueueStatusResponse:
    if entry.status == QueueStatus.WAITING:
        return QueueStatusResponse(
            token=entry.token,
            status=entry.status,
            position=entry.position_hint,
            message=f"Ban dang o vi tri {entry.position_hint} trong hang doi.",
        )
    if entry.status == QueueStatus.ADMITTED:
        return QueueStatusResponse(
            token=entry.token,
            status=entry.status,
            admitted_until=entry.expires_at,
            message="Da den luot cua ban. Ban co the vao man chon ghe.",
        )
    if entry.status == QueueStatus.COMPLETED:
        return QueueStatusResponse(
            token=entry.token,
            status=entry.status,
            message="Phien dat ve da hoan tat.",
        )
    return QueueStatusResponse(
        token=entry.token,
        status=entry.status,
        message="Token hang doi da het han. Vui long tham gia lai.",
    )


def _show_active_users_key(show_id: int) -> str:
    return f"queue:show:{show_id}:active-users"


def _show_active_user_session_key(show_id: int, user_id: int) -> str:
    return f"queue:show:{show_id}:active-user:{user_id}"


async def track_show_active_user(show_id: int, user_id: int) -> None:
    redis = get_redis_client()
    ttl_seconds = settings.queue_active_user_ttl_seconds
    set_key = _show_active_users_key(show_id)
    session_key = _show_active_user_session_key(show_id, user_id)
    try:
        await redis.sadd(set_key, str(user_id))
        await redis.set(session_key, "1", ex=ttl_seconds)
        await redis.expire(set_key, ttl_seconds * 2)
    except RedisError:
        _memory_active_sessions.setdefault(show_id, {})[user_id] = _now() + timedelta(seconds=ttl_seconds)


async def get_show_active_user_count(show_id: int) -> int:
    redis = get_redis_client()
    set_key = _show_active_users_key(show_id)
    try:
        members = await redis.smembers(set_key)
    except RedisError:
        now = _now()
        sessions = _memory_active_sessions.get(show_id, {})
        alive = {user_id: expires_at for user_id, expires_at in sessions.items() if expires_at > now}
        _memory_active_sessions[show_id] = alive
        return len(alive)

    alive_count = 0
    for raw_user_id in members:
        try:
            user_id = int(raw_user_id)
        except (TypeError, ValueError):
            await redis.srem(set_key, raw_user_id)
            continue
        session_key = _show_active_user_session_key(show_id, user_id)
        try:
            exists = await redis.exists(session_key)
        except RedisError:
            return alive_count
        if exists:
            alive_count += 1
        else:
            await redis.srem(set_key, raw_user_id)
    return alive_count


async def get_queue_requirement_details(
    session: AsyncSession,
    show: Show,
    user_id: int | None = None,
) -> tuple[bool, int, int]:
    _ = session
    threshold = settings.queue_active_threshold_default
    now = _now()
    if user_id is not None and has_valid_admitted_queue_token(show.id, user_id, None, now=now):
        return False, await get_show_active_user_count(show.id), threshold
    if user_id is not None:
        await track_show_active_user(show.id, user_id)
    active_users = await get_show_active_user_count(show.id)
    waiting_count = len(_waiting_entries(show.id))
    required = active_users >= threshold or waiting_count > 0
    return required, active_users, threshold


async def is_show_queue_required(session: AsyncSession, show: Show, user_id: int | None = None) -> bool:
    required, _, _ = await get_queue_requirement_details(session, show, user_id)
    return required


def has_valid_admitted_queue_token(
    show_id: int,
    user_id: int,
    token: str | None,
    *,
    now: datetime | None = None,
) -> bool:
    now = now or _now()
    entries = _show_entries(show_id)
    if token:
        entry = entries.get(token)
        if not entry or entry.user_id != user_id or entry.status != QueueStatus.ADMITTED:
            return False
        return entry.expires_at is None or entry.expires_at > now
    return any(
        entry.user_id == user_id
        and entry.status == QueueStatus.ADMITTED
        and (entry.expires_at is None or entry.expires_at > now)
        for entry in entries.values()
    )


async def join_show_queue(session: AsyncSession, show: Show, user_id: int) -> QueueJoinResponse:
    _ = session
    now = _now()
    async with _get_show_lock(show.id):
        _sweep_expired_admissions(show.id, now)
        existing = _find_user_entry(show.id, user_id)
        if existing:
            if existing.status == QueueStatus.WAITING:
                _refresh_waiting_positions(show.id)
            elif existing.status == QueueStatus.ADMITTED and existing.expires_at and existing.expires_at < now:
                _expire_runtime_entry(existing, now)
            else:
                status_response = _entry_to_status_response(existing)
                return QueueJoinResponse(
                    token=status_response.token,
                    status=status_response.status,
                    position=status_response.position or 0,
                    message=status_response.message,
                    admitted_until=status_response.admitted_until,
                )

        entry = QueueRuntimeEntry(
            show_id=show.id,
            user_id=user_id,
            token=uuid4().hex,
            status=QueueStatus.WAITING,
            created_at=now,
        )
        _show_entries(show.id)[entry.token] = entry

        if not _waiting_entries(show.id)[:-1] and _active_admitted_count(show.id, now) < settings.queue_max_active_tokens_default:
            entry.status = QueueStatus.ADMITTED
            entry.admitted_at = now
            entry.last_seen_at = now
            entry.expires_at = now + timedelta(minutes=settings.queue_admit_ttl_minutes)
        else:
            _refresh_waiting_positions(show.id)

        response = _entry_to_status_response(entry)
        return QueueJoinResponse(
            token=response.token,
            status=response.status,
            position=response.position or 0,
            message=response.message,
            admitted_until=response.admitted_until,
        )


async def get_queue_status(session: AsyncSession, show_id: int, token: str, user_id: int) -> QueueStatusResponse:
    _ = session
    now = _now()
    async with _get_show_lock(show_id):
        entry = _show_entries(show_id).get(token)
        if not entry or entry.user_id != user_id:
            return QueueStatusResponse(
                token=token,
                status=QueueStatus.EXPIRED,
                message="Token hang doi da het han. Vui long tham gia lai.",
            )
        if entry.status == QueueStatus.ADMITTED and entry.expires_at and entry.expires_at < now:
            _expire_runtime_entry(entry, now)
            _admit_waiting_entries(show_id, now)
        if entry.status == QueueStatus.WAITING:
            _refresh_waiting_positions(show_id)
        return _entry_to_status_response(entry)


async def heartbeat_queue_token(session: AsyncSession, show_id: int, token: str, user_id: int) -> QueueRuntimeEntry:
    _ = session
    now = _now()
    async with _get_show_lock(show_id):
        entry = _show_entries(show_id).get(token)
        if not entry or entry.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay luot hang doi")
        if entry.status != QueueStatus.ADMITTED:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Luot hang doi chua duoc cap quyen vao")
        if entry.expires_at and entry.expires_at < now:
            _expire_runtime_entry(entry, now)
            _admit_waiting_entries(show_id, now)
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Quyen vao tu hang doi da het han")
        entry.last_seen_at = now
        return entry


async def leave_queue_token(session: AsyncSession, show_id: int, token: str, user_id: int) -> bool:
    _ = session
    now = _now()
    async with _get_show_lock(show_id):
        entry = _show_entries(show_id).get(token)
        if not entry or entry.user_id != user_id or entry.status not in {QueueStatus.WAITING, QueueStatus.ADMITTED}:
            return False
        _expire_runtime_entry(entry, now)
        _admit_waiting_entries(show_id, now)
        return True


async def ensure_queue_access(session: AsyncSession, show: Show, user_id: int, queue_token: str | None) -> None:
    _ = session
    if not queue_token:
        return
    now = _now()
    async with _get_show_lock(show.id):
        entry = _show_entries(show.id).get(queue_token)
        if not entry or entry.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token hang doi khong hop le")
        if entry.status != QueueStatus.ADMITTED:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Ban van dang o phong cho")
        if entry.expires_at and entry.expires_at < now:
            _expire_runtime_entry(entry, now)
            _admit_waiting_entries(show.id, now)
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Token hang doi da het han")
        entry.last_seen_at = now


async def mark_queue_completed(session: AsyncSession, show_id: int, user_id: int, queue_token: str | None) -> None:
    _ = session
    if not queue_token:
        return
    async with _get_show_lock(show_id):
        entry = _show_entries(show_id).get(queue_token)
        if not entry or entry.user_id != user_id:
            return
        entry.status = QueueStatus.COMPLETED
        entry.completed_at = _now()
        entry.position_hint = 0


async def process_virtual_queue(session: AsyncSession) -> int:
    _ = session
    admitted = 0
    now = _now()
    for show_id in list(_runtime_queue.keys()):
        async with _get_show_lock(show_id):
            _sweep_expired_admissions(show_id, now)
            admitted += _admit_waiting_entries(show_id, now)
    return admitted


async def expire_inactive_admitted_tokens(session: AsyncSession) -> int:
    _ = session
    expired = 0
    now = _now()
    for show_id in list(_runtime_queue.keys()):
        async with _get_show_lock(show_id):
            expired += _sweep_expired_admissions(show_id, now)
    return expired


async def cleanup_expired_queue_entries(session: AsyncSession) -> int:
    _ = session
    cutoff = _now() - timedelta(hours=24)
    deleted = 0
    for show_id in list(_runtime_queue.keys()):
        async with _get_show_lock(show_id):
            deleted += _cleanup_terminal_entries(show_id, cutoff)
    return deleted


def get_waiting_queue_user_count() -> int:
    return sum(1 for show_entries in _runtime_queue.values() for entry in show_entries.values() if entry.status == QueueStatus.WAITING)


async def expire_active_show_queue_entries(show_id: int) -> int:
    now = _now()
    async with _get_show_lock(show_id):
        affected = 0
        for entry in _show_entries(show_id).values():
            if entry.status in {QueueStatus.WAITING, QueueStatus.ADMITTED}:
                _expire_runtime_entry(entry, now)
                affected += 1
        _admit_waiting_entries(show_id, now)
        return affected
