"""Seat map and coordinate-based seat browsing routes."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_optional_current_user
from app.core.cache import public_api_cache, show_seat_cache_namespace
from app.core.db import get_db_session
from app.models.event import Event
from app.models.user import User
from app.models.venue import Section
from app.schemas.event import SeatMatrixResponse
from app.schemas.seatmap import SeatMapResponse, SeatMapSectionResponse
from app.services.event_service import get_show_by_id, get_show_seat_matrix
from app.services.inventory_service import get_seatmap

router = APIRouter(prefix="/shows", tags=["seatmap"])


@router.get("/{show_id}/seats", response_model=SeatMatrixResponse)
async def show_seat_matrix(
    show_id: int,
    session: AsyncSession = Depends(get_db_session),
    current_user: User | None = Depends(get_optional_current_user),
) -> SeatMatrixResponse:
    """Return full seat matrix for booking UI."""

    show = await get_show_by_id(session, show_id)
    if current_user is None:
        cached = await public_api_cache.get(show_seat_cache_namespace(show.id), "anonymous")
        if cached is not None:
            return cached

    zones, seats = await get_show_seat_matrix(
        session,
        show.id,
        current_user_id=current_user.id if current_user else None,
        include_user_details=bool(current_user and getattr(current_user.role, "value", str(current_user.role)) == "admin"),
    )
    event = await session.get(Event, show.event_id)
    response = SeatMatrixResponse(
        show_id=show.id,
        show_title=show.title,
        event_id=show.event_id,
        event_slug=event.slug if event else "",
        event_title=event.title if event else show.title,
        queue_enabled=show.queue_enabled,
        zones=zones,
        seats=seats,
    )
    if current_user is None:
        return await public_api_cache.set(show_seat_cache_namespace(show.id), "anonymous", response, ttl_seconds=30)
    return response


@router.get("/{show_id}/seatmap", response_model=SeatMapResponse)
async def show_seatmap(
    show_id: int,
    session: AsyncSession = Depends(get_db_session),
    current_user: User | None = Depends(get_optional_current_user),
) -> SeatMapResponse:
    """Get full seat map with coordinates for frontend rendering."""

    show = await get_show_by_id(session, show_id)
    if current_user is None:
        cached = await public_api_cache.get(show_seat_cache_namespace(show.id), "seatmap_anonymous")
        if cached is not None:
            return cached

    response = SeatMapResponse.model_validate(
        await get_seatmap(
            session,
            show.id,
            current_user_id=current_user.id if current_user else None,
        )
    )
    if current_user is None:
        return await public_api_cache.set(show_seat_cache_namespace(show.id), "seatmap_anonymous", response, ttl_seconds=10)
    return response


@router.get("/{show_id}/sections", response_model=list[SeatMapSectionResponse])
async def show_sections(
    show_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> list[SeatMapSectionResponse]:
    """Get section list with prices for a show."""

    show = await get_show_by_id(session, show_id)
    if not show.venue_layout_id:
        return []

    sections = list(
        await session.scalars(
            select(Section)
            .where(Section.venue_layout_id == show.venue_layout_id)
            .order_by(Section.sort_order.asc())
        )
    )

    return [
        SeatMapSectionResponse(
            id=s.id,
            name=s.name,
            code=s.code,
            color=s.color,
            price_base=float(s.price_base),
        )
        for s in sections
    ]
