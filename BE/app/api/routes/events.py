"""Public event browsing and show detail routes."""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.cache import EVENT_LIST_CACHE_NAMESPACE, public_api_cache
from app.core.db import get_db_session
from app.models.review import EventReview
from app.models.user import User
from app.schemas.event import EventCardResponse, EventDetailResponse, ShowDetailResponse
from app.schemas.review import EventReviewCreateRequest, EventReviewResponse
from app.services.event_service import (
    build_event_card_response,
    build_event_detail_response,
    build_show_detail_response,
    get_event_by_slug_or_id,
    get_show_by_id,
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
        if isinstance(cached, list) and (not cached or isinstance(cached[0], dict)):
            return cached

    events = await list_live_events(session, search=search, category=category, start_from=start_from, end_to=end_to, limit=limit, offset=offset)
    response = [await build_event_card_response(session, event) for event in events]
    return await public_api_cache.set(EVENT_LIST_CACHE_NAMESPACE, cache_key, response, ttl_seconds=300)


@event_router.get("/{event_key}", response_model=EventDetailResponse)
async def event_detail(event_key: str, session: AsyncSession = Depends(get_db_session)) -> EventDetailResponse:
    """Get event details by slug or id."""

    event = await get_event_by_slug_or_id(session, event_key)
    return await build_event_detail_response(session, event)


@show_router.get("/{show_id}", response_model=ShowDetailResponse)
async def show_detail(show_id: int, session: AsyncSession = Depends(get_db_session)) -> ShowDetailResponse:
    """Get one show details by id."""

    show = await get_show_by_id(session, show_id)
    return ShowDetailResponse(**(await build_show_detail_response(session, show)))


@event_router.get("/{event_key}/reviews", response_model=list[EventReviewResponse])
async def list_event_reviews(
    event_key: str,
    limit: int = Query(default=10, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db_session),
) -> list[EventReviewResponse]:
    """Return newest reviews of one event."""

    event = await get_event_by_slug_or_id(session, event_key)
    rows = list(
        await session.scalars(
            select(EventReview)
            .where(EventReview.event_id == event.id)
            .order_by(EventReview.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    )
    return [
        EventReviewResponse(
            id=row.id,
            event_id=row.event_id,
            user_id=row.user_id,
            reviewer_name=row.reviewer_name,
            rating=row.rating,
            content=row.content,
            image_url=row.image_url,
            created_at=row.created_at,
        )
        for row in rows
    ]


@event_router.post("/{event_key}/reviews", response_model=EventReviewResponse)
async def create_event_review(
    event_key: str,
    payload: EventReviewCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> EventReviewResponse:
    """Create one customer review for an event."""

    event = await get_event_by_slug_or_id(session, event_key)
    review = EventReview(
        event_id=event.id,
        user_id=current_user.id,
        reviewer_name=current_user.full_name,
        rating=payload.rating,
        content=payload.content.strip(),
        image_url=payload.image_url,
    )
    session.add(review)
    await session.commit()
    await session.refresh(review)
    return EventReviewResponse(
        id=review.id,
        event_id=review.event_id,
        user_id=review.user_id,
        reviewer_name=review.reviewer_name,
        rating=review.rating,
        content=review.content,
        image_url=review.image_url,
        created_at=review.created_at,
    )
