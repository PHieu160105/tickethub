"""Public event browsing and seat matrix routes."""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_optional_current_user
from app.core.cache import EVENT_LIST_CACHE_NAMESPACE, event_seat_cache_namespace, public_api_cache
from app.core.db import get_db_session
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.event import EventCardResponse, EventDetailResponse, SeatMatrixResponse
from app.services.event_service import get_event_by_slug_or_id, get_event_seat_matrix, list_live_events

router = APIRouter(prefix="/events", tags=["events"])


@router.get("", response_model=list[EventCardResponse])
async def list_events(
    search: str | None = Query(default=None, max_length=120),
    category: str | None = Query(default=None, max_length=80),
    start_from: datetime | None = Query(default=None),
    end_to: datetime | None = Query(default=None),
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db_session),
) -> list[EventCardResponse]:
    """List events with optional search and category filters."""

    cache_key = (
        search or "",
        category or "",
        start_from.isoformat() if start_from else "",
        end_to.isoformat() if end_to else "",
        limit,
        offset,
    )
    cached = await public_api_cache.get(EVENT_LIST_CACHE_NAMESPACE, cache_key)
    if cached is not None:
        return cached

    events = await list_live_events(session, search=search, category=category, start_from=start_from, end_to=end_to, limit=limit, offset=offset)
    response = [EventCardResponse.model_validate(event) for event in events]
    return await public_api_cache.set(EVENT_LIST_CACHE_NAMESPACE, cache_key, response, ttl_seconds=300)


@router.get("/{event_key}", response_model=EventDetailResponse)
async def event_detail(event_key: str, session: AsyncSession = Depends(get_db_session)) -> EventDetailResponse:
    """Get event details by slug or id."""

    event = await get_event_by_slug_or_id(session, event_key)
    zones, _ = await get_event_seat_matrix(session, event.id)
    return EventDetailResponse(
        id=event.id,
        slug=event.slug,
        title=event.title,
        description=event.description,
        category=event.category,
        venue=event.venue,
        start_at=event.start_at,
        end_at=event.end_at,
        cover_image_url=event.cover_image_url,
        status=event.status,
        queue_enabled=event.queue_enabled,
        hold_minutes=event.hold_minutes,
        queue_release_batch=event.queue_release_batch,
        max_active_queue_tokens=event.max_active_queue_tokens,
        zones=zones,
    )


@router.get("/{event_key}/seats", response_model=SeatMatrixResponse)
async def event_seat_matrix(
    event_key: str,
    session: AsyncSession = Depends(get_db_session),
    current_user: User | None = Depends(get_optional_current_user),
) -> SeatMatrixResponse:
    """Return full seat matrix for booking UI."""

    event = await get_event_by_slug_or_id(session, event_key)
    if current_user is None:
        cached = await public_api_cache.get(event_seat_cache_namespace(event.id), "anonymous")
        if cached is not None:
            return cached

    zones, seats = await get_event_seat_matrix(
        session,
        event.id,
        current_user_id=current_user.id if current_user else None,
        include_user_details=bool(current_user and current_user.role == UserRole.ADMIN),
    )
    response = SeatMatrixResponse(event_id=event.id, event_slug=event.slug, queue_enabled=event.queue_enabled, zones=zones, seats=seats)
    if current_user is None:
        return await public_api_cache.set(event_seat_cache_namespace(event.id), "anonymous", response, ttl_seconds=30)
    return response
