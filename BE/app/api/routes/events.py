"""Public routes for browsing events and shows."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import EVENT_DETAIL_CACHE_NAMESPACE, EVENT_LIST_CACHE_NAMESPACE, SHOW_DETAIL_CACHE_NAMESPACE, public_api_cache
from app.core.db import get_db_session
from app.models.enums import EventStatus
from app.schemas.event import EventCardResponse, EventDetailResponse, ShowDetailResponse
from app.services.event_query_service import (
    build_event_card_response,
    build_event_detail_response,
    build_show_detail_response,
    get_event_by_slug_or_id,
    get_show_by_id,
    list_event_max_prices_for_event_ids,
    list_shows_for_event_ids,
    list_live_events,
)

router = APIRouter(tags=["events"])
event_router = APIRouter(prefix="/events", tags=["events"])
show_router = APIRouter(prefix="/shows", tags=["shows"])


@event_router.get("", response_model=list[EventCardResponse])
async def list_events(
    search: str | None = Query(default=None, max_length=120),
    category: str | None = Query(default=None, max_length=80),
    start_from: datetime | None = Query(default=None),
    end_to: datetime | None = Query(default=None),
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db_session),
) -> list[EventCardResponse]:
    """List live events with search and time filters."""

    events = await list_live_events(session, search=search, category=category, start_from=start_from, end_to=end_to, limit=limit, offset=offset)
    shows_by_event_id = await list_shows_for_event_ids(session, [event.id for event in events], live_only=True)
    max_prices_by_event_id = await list_event_max_prices_for_event_ids(session, [event.id for event in events], live_only=True)
    return [
        await build_event_card_response(
            session,
            event,
            shows=shows_by_event_id.get(event.id, []),
            max_price=max_prices_by_event_id.get(event.id, 0),
        )
        for event in events
    ]


@event_router.get("/{event_key}", response_model=EventDetailResponse)
async def event_detail(event_key: str, session: AsyncSession = Depends(get_db_session)) -> EventDetailResponse:
    """Fetch event detail by slug or numeric id."""

    event = await get_event_by_slug_or_id(session, event_key)
    if event.status != EventStatus.LIVE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy sự kiện")

    return await build_event_detail_response(session, event)


@show_router.get("/{show_id}", response_model=ShowDetailResponse)
async def show_detail(show_id: int, session: AsyncSession = Depends(get_db_session)) -> ShowDetailResponse:
    """Fetch a public show detail by id."""

    show = await get_show_by_id(session, show_id)
    event = await get_event_by_slug_or_id(session, str(show.event_id))
    if show.status != EventStatus.LIVE or event.status != EventStatus.LIVE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy buổi diễn")

    return ShowDetailResponse(**(await build_show_detail_response(session, show)))
