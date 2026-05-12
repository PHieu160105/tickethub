"""Virtual queue algorithm and access checks."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import and_, delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.enums import EventStatus, QueueStatus
from app.models.event import Show
from app.models.queue import QueueEntry
from app.schemas.queue import QueueJoinResponse, QueueStatusResponse

settings = get_settings()


def _as_utc(value: datetime | None) -> datetime | None:
    """Normalize naive datetimes to UTC-aware for safe comparisons."""

    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=UTC)


async def _queue_position(session: AsyncSession, entry: QueueEntry) -> int:
    """Calculate live waiting position for one queue entry."""

    if entry.status != QueueStatus.WAITING:
        return 0

    position = await session.scalar(
        select(func.count(QueueEntry.id)).where(
            QueueEntry.show_id == entry.show_id,
            QueueEntry.status == QueueStatus.WAITING,
            or_(
                QueueEntry.created_at < entry.created_at,
                and_(QueueEntry.created_at == entry.created_at, QueueEntry.id <= entry.id),
            ),
        )
    )
    return int(position or 0)


async def join_show_queue(session: AsyncSession, show: Show, user_id: int) -> QueueJoinResponse:
    """Put user into queue, reusing existing token when possible."""

    if not show.queue_enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Queue is not enabled for this show")

    now = datetime.now(UTC)
    existing = await session.scalar(
        select(QueueEntry)
        .where(
            QueueEntry.show_id == show.id,
            QueueEntry.user_id == user_id,
            QueueEntry.status.in_([QueueStatus.WAITING, QueueStatus.ADMITTED]),
        )
        .order_by(QueueEntry.created_at.desc())
    )

    if existing:
        existing_expires = _as_utc(existing.expires_at)
        if existing.status == QueueStatus.ADMITTED and existing_expires and existing_expires > now:
            return QueueJoinResponse(
                token=existing.token,
                status=existing.status,
                position=0,
                message="You are admitted. Proceed to seat booking.",
                admitted_until=existing_expires,
            )
        if existing.status == QueueStatus.WAITING:
            return QueueJoinResponse(
                token=existing.token,
                status=existing.status,
                position=await _queue_position(session, existing),
                message="You are in the waiting room.",
            )

    waiting_count = await session.scalar(
        select(func.count(QueueEntry.id)).where(
            QueueEntry.show_id == show.id,
            QueueEntry.status == QueueStatus.WAITING,
        )
    )
    waiting_count = int(waiting_count or 0)

    active_admitted_count = await session.scalar(
        select(func.count(QueueEntry.id)).where(
            QueueEntry.show_id == show.id,
            QueueEntry.status == QueueStatus.ADMITTED,
            QueueEntry.expires_at.is_not(None),
            QueueEntry.expires_at > now,
        )
    )
    active_admitted_count = int(active_admitted_count or 0)

    entry = QueueEntry(
        event_id=show.event_id,
        show_id=show.id,
        user_id=user_id,
        token=str(uuid4()),
        status=QueueStatus.WAITING,
        position_hint=waiting_count + 1,
    )

    if active_admitted_count < show.max_active_queue_tokens and waiting_count == 0:
        entry.status = QueueStatus.ADMITTED
        entry.admitted_at = now
        entry.expires_at = now + timedelta(minutes=settings.queue_admit_ttl_minutes)
        entry.last_seen_at = now

    session.add(entry)
    await session.commit()
    await session.refresh(entry)

    if entry.status == QueueStatus.ADMITTED:
        return QueueJoinResponse(
            token=entry.token,
            status=entry.status,
            position=0,
            message="You are admitted immediately.",
            admitted_until=entry.expires_at,
        )

    return QueueJoinResponse(
        token=entry.token,
        status=entry.status,
        position=entry.position_hint,
        message="Traffic is high. Please wait for your turn.",
    )


async def get_queue_status(session: AsyncSession, show_id: int, token: str, user_id: int) -> QueueStatusResponse:
    """Get latest queue status for waiting room polling."""

    entry = await session.scalar(
        select(QueueEntry).where(QueueEntry.show_id == show_id, QueueEntry.token == token, QueueEntry.user_id == user_id)
    )
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Queue entry not found")

    now = datetime.now(UTC)
    entry_expires = _as_utc(entry.expires_at)
    if entry.status == QueueStatus.ADMITTED and entry_expires and entry_expires < now:
        entry.status = QueueStatus.EXPIRED
        await session.commit()

    if entry.status == QueueStatus.WAITING:
        position = await _queue_position(session, entry)
        return QueueStatusResponse(
            token=entry.token,
            status=entry.status,
            position=position,
            message=f"You are position {position} in line. Please do not refresh this page.",
        )

    if entry.status == QueueStatus.ADMITTED:
        return QueueStatusResponse(
            token=entry.token,
            status=entry.status,
            admitted_until=entry_expires,
            message="It is your turn. You can now enter seat booking.",
        )

    if entry.status == QueueStatus.COMPLETED:
        return QueueStatusResponse(token=entry.token, status=entry.status, message="Your booking access session is complete.")

    return QueueStatusResponse(
        token=entry.token,
        status=entry.status,
        message="Your queue token has expired. Please rejoin the waiting room.",
    )


async def heartbeat_queue_token(session: AsyncSession, show_id: int, token: str, user_id: int) -> QueueEntry:
    """Refresh last-seen timestamp for admitted users."""

    entry = await session.scalar(
        select(QueueEntry).where(QueueEntry.show_id == show_id, QueueEntry.token == token, QueueEntry.user_id == user_id)
    )
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Queue entry not found")
    if entry.status != QueueStatus.ADMITTED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Queue entry is not admitted")

    now = datetime.now(UTC)
    entry_expires = _as_utc(entry.expires_at)
    if entry_expires and entry_expires < now:
        entry.status = QueueStatus.EXPIRED
        await session.commit()
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Queue admission expired")

    entry.last_seen_at = now
    await session.commit()
    await session.refresh(entry)
    entry.expires_at = entry_expires
    return entry


async def ensure_queue_access(session: AsyncSession, show: Show, user_id: int, queue_token: str | None) -> None:
    """Gate seat operations behind a valid admitted queue token when enabled."""

    if not show.queue_enabled:
        return
    if not queue_token:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Queue token is required for this show")

    entry = await session.scalar(
        select(QueueEntry).where(QueueEntry.show_id == show.id, QueueEntry.token == queue_token, QueueEntry.user_id == user_id)
    )
    if not entry:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid queue token")

    now = datetime.now(UTC)
    if entry.status != QueueStatus.ADMITTED:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="You are still in waiting room")
    entry_expires = _as_utc(entry.expires_at)
    if entry_expires and entry_expires < now:
        entry.status = QueueStatus.EXPIRED
        await session.commit()
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Queue token expired")

    entry.last_seen_at = now


async def mark_queue_completed(session: AsyncSession, show_id: int, user_id: int, queue_token: str | None) -> None:
    """Mark queue entry as completed after successful checkout."""

    if not queue_token:
        return

    entry = await session.scalar(
        select(QueueEntry).where(QueueEntry.show_id == show_id, QueueEntry.token == queue_token, QueueEntry.user_id == user_id)
    )
    if not entry:
        return

    entry.status = QueueStatus.COMPLETED
    entry.expires_at = datetime.now(UTC)


async def process_virtual_queue(session: AsyncSession) -> int:
    """Periodic worker: admit waiting users in configurable batches."""

    now = datetime.now(UTC)
    updated_entries = 0
    shows = list(
        await session.scalars(
            select(Show).where(
                Show.queue_enabled.is_(True),
                Show.is_deleted.is_(False),
                Show.status.in_([EventStatus.LIVE, EventStatus.DRAFT]),
            )
        )
    )

    for show in shows:
        expired_result = await session.execute(
            update(QueueEntry)
            .where(
                QueueEntry.show_id == show.id,
                QueueEntry.status == QueueStatus.ADMITTED,
                QueueEntry.expires_at.is_not(None),
                QueueEntry.expires_at < now,
            )
            .values(status=QueueStatus.EXPIRED)
        )
        updated_entries += expired_result.rowcount or 0

        active_admitted_count = await session.scalar(
            select(func.count(QueueEntry.id)).where(
                QueueEntry.show_id == show.id,
                QueueEntry.status == QueueStatus.ADMITTED,
                QueueEntry.expires_at.is_not(None),
                QueueEntry.expires_at > now,
            )
        )
        active_admitted_count = int(active_admitted_count or 0)

        available_slots = max(show.max_active_queue_tokens - active_admitted_count, 0)
        batch_size = min(show.queue_release_batch, available_slots)
        if batch_size <= 0:
            continue

        waiting_entries = list(
            await session.scalars(
                select(QueueEntry)
                .where(QueueEntry.show_id == show.id, QueueEntry.status == QueueStatus.WAITING)
                .order_by(QueueEntry.created_at.asc())
                .limit(batch_size)
            )
        )

        for index, entry in enumerate(waiting_entries, start=1):
            entry.status = QueueStatus.ADMITTED
            entry.admitted_at = now
            entry.expires_at = now + timedelta(minutes=settings.queue_admit_ttl_minutes)
            entry.last_seen_at = now
            entry.position_hint = index
            updated_entries += 1

        remaining_waiting = list(
            await session.scalars(
                select(QueueEntry)
                .where(QueueEntry.show_id == show.id, QueueEntry.status == QueueStatus.WAITING)
                .order_by(QueueEntry.created_at.asc())
            )
        )
        for pos, waiting_entry in enumerate(remaining_waiting, start=1):
            waiting_entry.position_hint = pos

    await session.commit()
    return updated_entries


async def cleanup_expired_queue_entries(session: AsyncSession) -> int:
    """Delete stale queue rows long after their admission/expiry window."""

    cutoff = datetime.now(UTC) - timedelta(hours=24)
    result = await session.execute(delete(QueueEntry).where(QueueEntry.expires_at.is_not(None), QueueEntry.expires_at < cutoff))
    await session.commit()
    return result.rowcount or 0
