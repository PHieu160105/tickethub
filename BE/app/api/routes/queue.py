"""Virtual queue endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db_session
from app.models.user import User
from app.schemas.queue import QueueHeartbeatResponse, QueueJoinResponse, QueueStatusResponse
from app.services.event_service import get_event_by_slug_or_id
from app.services.queue_service import get_queue_status, heartbeat_queue_token, join_event_queue

router = APIRouter(prefix="/events/{event_key}/queue", tags=["queue"])


@router.post("/join", response_model=QueueJoinResponse)
async def join_queue(
    event_key: str,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> QueueJoinResponse:
    """Join queue for one event and get waiting/admitted token."""

    event = await get_event_by_slug_or_id(session, event_key)
    return await join_event_queue(session, event=event, user_id=current_user.id)


@router.get("/status/{token}", response_model=QueueStatusResponse)
async def queue_status(
    event_key: str,
    token: str,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> QueueStatusResponse:
    """Poll current queue status and position."""

    event = await get_event_by_slug_or_id(session, event_key)
    return await get_queue_status(session, event_id=event.id, token=token, user_id=current_user.id)


@router.post("/heartbeat/{token}", response_model=QueueHeartbeatResponse)
async def queue_heartbeat(
    event_key: str,
    token: str,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> QueueHeartbeatResponse:
    """Refresh admitted queue token last-seen timestamp."""

    event = await get_event_by_slug_or_id(session, event_key)
    entry = await heartbeat_queue_token(session, event_id=event.id, token=token, user_id=current_user.id)
    return QueueHeartbeatResponse(token=entry.token, status=entry.status, admitted_until=entry.expires_at)
