"""Seat map and coordinate-based seat browsing routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_customer, get_optional_current_user
from app.core.cache import event_seat_cache_namespace, public_api_cache
from app.core.db import get_db_session
from app.models.enums import UserRole
from app.models.event import Event
from app.models.seat import Seat
from app.models.user import User
from app.models.venue import Section, VenueLayout
from app.schemas.seatmap import SeatMapResponse, SeatMapSeatResponse, SeatMapSectionResponse
from app.services.event_service import get_event_by_slug_or_id

router = APIRouter(prefix="/events", tags=["seatmap"])


@router.get("/{event_key}/seatmap", response_model=SeatMapResponse)
async def event_seatmap(
    event_key: str,
    session: AsyncSession = Depends(get_db_session),
    current_user: User | None = Depends(get_optional_current_user),
) -> SeatMapResponse:
    """Get full seat map with coordinates for frontend rendering."""

    event = await get_event_by_slug_or_id(session, event_key)

    if current_user is None:
        cached = await public_api_cache.get(event_seat_cache_namespace(event.id), "seatmap_anonymous")
        if cached is not None:
            return cached

    # Get sections for this event's layout (if linked)
    sections: list[Section] = []
    if event.venue_layout_id:
        sections = list(
            await session.scalars(
                select(Section)
                .where(Section.venue_layout_id == event.venue_layout_id)
                .order_by(Section.sort_order.asc())
            )
        )

    # Get all seats with coordinates
    seats = list(
        await session.scalars(
            select(Seat).where(Seat.event_id == event.id).order_by(Seat.section_id, Seat.seat_label)
        )
    )

    from datetime import UTC, datetime

    now = datetime.now(UTC)
    section_map = {
        s.id: SeatMapSectionResponse(
            id=s.id,
            name=s.name,
            code=s.code,
            color=s.color,
            price_base=float(s.price_base),
        )
        for s in sections
    }

    seat_responses: list[SeatMapSeatResponse] = []
    for seat in seats:
        # Handle expired locks
        normalized_status = seat.status
        lock_expires = seat.lock_expires_at
        if lock_expires and lock_expires.tzinfo is None:
            lock_expires = lock_expires.replace(tzinfo=UTC)
        if seat.status.value == "locked" and lock_expires and lock_expires < now:
            normalized_status = "available"

        seat_responses.append(
            SeatMapSeatResponse(
                id=seat.id,
                label=seat.seat_label,
                x=float(seat.x_coord) if seat.x_coord is not None else None,
                y=float(seat.y_coord) if seat.y_coord is not None else None,
                rotation=float(seat.rotation) if seat.rotation is not None else 0,
                section_id=seat.section_id,
                section_name=section_map.get(seat.section_id).name if seat.section_id in section_map else None,
                price=float(seat.price),
                status=str(normalized_status.value if hasattr(normalized_status, "value") else normalized_status),
                lock_expires_at=seat.lock_expires_at.isoformat() if seat.lock_expires_at else None,
                is_locked_by_me=seat.locked_by_user_id == (current_user.id if current_user else None),
            )
        )

    response = SeatMapResponse(
        event_id=event.id,
        event_title=event.title,
        venue_name=event.venue,
        sections=list(section_map.values()),
        seats=seat_responses,
        seat_count=len(seats),
    )

    if current_user is None:
        return await public_api_cache.set(
            event_seat_cache_namespace(event.id), "seatmap_anonymous", response, ttl_seconds=30
        )
    return response


@router.get("/{event_key}/sections", response_model=list[SeatMapSectionResponse])
async def event_sections(
    event_key: str,
    session: AsyncSession = Depends(get_db_session),
) -> list[SeatMapSectionResponse]:
    """Get section list with prices for an event."""

    event = await get_event_by_slug_or_id(session, event_key)

    if not event.venue_layout_id:
        return []

    sections = list(
        await session.scalars(
            select(Section)
            .where(Section.venue_layout_id == event.venue_layout_id)
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
