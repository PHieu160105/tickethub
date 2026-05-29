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

    cache_key = (
        search or "",
        category or "",
        start_from.isoformat() if start_from else "",
        end_to.isoformat() if end_to else "",
        limit,
        offset,
    )
    cached = await public_api_cache.get(EVENT_LIST_CACHE_NAMESPACE, cache_key)
    if cached is not None and isinstance(cached, list) and (not cached or isinstance(cached[0], dict)):
        return cached

    events = await list_live_events(session, search=search, category=category, start_from=start_from, end_to=end_to, limit=limit, offset=offset)
    shows_by_event_id = await list_shows_for_event_ids(session, [event.id for event in events], live_only=True)
    max_prices_by_event_id = await list_event_max_prices_for_event_ids(session, [event.id for event in events], live_only=True)
    response = [
        await build_event_card_response(
            session,
            event,
            shows=shows_by_event_id.get(event.id, []),
            max_price=max_prices_by_event_id.get(event.id, 0),
        )
        for event in events
    ]
    return await public_api_cache.set(EVENT_LIST_CACHE_NAMESPACE, cache_key, response, ttl_seconds=300)


@event_router.get("/{event_key}", response_model=EventDetailResponse)
async def event_detail(event_key: str, session: AsyncSession = Depends(get_db_session)) -> EventDetailResponse:
    """Fetch event detail by slug or numeric id."""

    cached = await public_api_cache.get(EVENT_DETAIL_CACHE_NAMESPACE, event_key)
    if cached is not None:
        return cached

    event = await get_event_by_slug_or_id(session, event_key)
    if event.status != EventStatus.LIVE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay su kien")

    response = await build_event_detail_response(session, event)
    await public_api_cache.set(EVENT_DETAIL_CACHE_NAMESPACE, event_key, response, ttl_seconds=180)
    if event.slug != event_key:
        await public_api_cache.set(EVENT_DETAIL_CACHE_NAMESPACE, event.slug, response, ttl_seconds=180)
    return response


@show_router.get("/{show_id}", response_model=ShowDetailResponse)
async def show_detail(show_id: int, session: AsyncSession = Depends(get_db_session)) -> ShowDetailResponse:
    """Fetch a public show detail by id."""

    cached = await public_api_cache.get(SHOW_DETAIL_CACHE_NAMESPACE, show_id)
    if cached is not None:
        return cached

    show = await get_show_by_id(session, show_id)
    event = await get_event_by_slug_or_id(session, str(show.event_id))
    if show.status != EventStatus.LIVE or event.status != EventStatus.LIVE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay buoi dien")

    response = ShowDetailResponse(**(await build_show_detail_response(session, show)))
    return await public_api_cache.set(SHOW_DETAIL_CACHE_NAMESPACE, show_id, response, ttl_seconds=120)
