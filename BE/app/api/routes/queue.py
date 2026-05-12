"""Virtual queue endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db_session
from app.core.rate_limit import rate_limit
from app.models.user import User
from app.schemas.queue import QueueHeartbeatResponse, QueueJoinResponse, QueueStatusResponse
from app.services.event_service import get_show_by_id
from app.services.queue_service import get_queue_status, heartbeat_queue_token, join_show_queue

router = APIRouter(prefix="/shows/{show_id}/queue", tags=["queue"])


@router.post("/join", response_model=QueueJoinResponse, dependencies=[Depends(rate_limit("queue-join", times=5, seconds=60))])
async def join_queue(
    show_id: int,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> QueueJoinResponse:
    """Join queue for one show and get waiting/admitted token."""

    show = await get_show_by_id(session, show_id)
    return await join_show_queue(session, show=show, user_id=current_user.id)


@router.get("/status/{token}", response_model=QueueStatusResponse, dependencies=[Depends(rate_limit("queue-status", times=60, seconds=60))])
async def queue_status(
    show_id: int,
    token: str,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> QueueStatusResponse:
    """Poll current queue status and position."""

    return await get_queue_status(session, show_id=show_id, token=token, user_id=current_user.id)


@router.post("/heartbeat/{token}", response_model=QueueHeartbeatResponse, dependencies=[Depends(rate_limit("queue-heartbeat", times=30, seconds=60))])
async def queue_heartbeat(
    show_id: int,
    token: str,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> QueueHeartbeatResponse:
    """Refresh admitted queue token last-seen timestamp."""

    entry = await heartbeat_queue_token(session, show_id=show_id, token=token, user_id=current_user.id)
    return QueueHeartbeatResponse(token=entry.token, status=entry.status, admitted_until=entry.expires_at)
