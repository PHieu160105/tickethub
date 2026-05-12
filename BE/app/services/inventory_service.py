"""Enhanced inventory service with coordinate-based seat map support."""

from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import SeatStatus
from app.models.event import Event, Show
from app.models.seat import Seat
from app.models.venue import Polygon, Section, Venue


def _as_utc(value: datetime | None) -> datetime | None:
    """Normalize naive datetimes from DB drivers to UTC-aware values."""

    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=UTC)


async def _get_show_or_404(session: AsyncSession, show_id: int) -> Show:
    show = await session.scalar(select(Show).where(Show.id == show_id, Show.is_deleted.is_(False)))
    if not show:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Show not found")
    return show


async def get_seatmap(
    session: AsyncSession,
    show_id: int,
    current_user_id: int | None = None,
) -> dict[str, Any]:
    """Get full seat map with coordinates for frontend rendering."""

    show = await _get_show_or_404(session, show_id)
    event = await session.get(Event, show.event_id)
    venue: Venue | None = await session.get(Venue, show.venue_id) if show.venue_id else None

    sections: list[Section] = []
    if show.venue_layout_id:
        sections = list(
            await session.scalars(
                select(Section)
                .where(Section.venue_layout_id == show.venue_layout_id)
                .order_by(Section.sort_order.asc())
            )
        )

    polygons: list[Polygon] = []
    if show.venue_layout_id:
        polygons = list(
            await session.scalars(
                select(Polygon)
                .where(Polygon.venue_layout_id == show.venue_layout_id)
                .order_by(Polygon.id.asc())
            )
        )

    seats = list(await session.scalars(select(Seat).where(Seat.show_id == show_id).order_by(Seat.section_id, Seat.seat_label)))
    now = datetime.now(UTC)

    section_map = {
        s.id: {
            "id": s.id,
            "name": s.name,
            "code": s.code,
            "color": s.color,
            "price_base": float(s.price_base),
        }
        for s in sections
    }

    seat_responses = []
    for seat in seats:
        normalized_status = SeatStatus.LOCKED if seat.is_admin_locked and seat.status != SeatStatus.SOLD else seat.status
        lock_expires = _as_utc(seat.lock_expires_at)
        if seat.status == SeatStatus.LOCKED and lock_expires and lock_expires < now:
            normalized_status = SeatStatus.AVAILABLE

        seat_responses.append(
            {
                "id": seat.id,
                "label": seat.seat_label,
                "x": float(seat.x_coord) if seat.x_coord is not None else None,
                "y": float(seat.y_coord) if seat.y_coord is not None else None,
                "rotation": float(seat.rotation) if seat.rotation is not None else 0,
                "section_id": seat.section_id,
                "section_name": section_map.get(seat.section_id, {}).get("name"),
                "price": float(seat.price),
                "status": normalized_status.value,
                "lock_expires_at": seat.lock_expires_at.isoformat() if seat.lock_expires_at else None,
                "is_locked_by_me": seat.locked_by_user_id == current_user_id,
                "is_admin_locked": seat.is_admin_locked,
            }
        )

    return {
        "show_id": show.id,
        "show_title": show.title,
        "event_id": show.event_id,
        "event_slug": event.slug if event else "",
        "event_title": event.title if event else show.title,
        "venue_name": show.venue,
        "queue_enabled": show.queue_enabled,
        "background": {
            "source": venue.background_source if venue else None,
            "type": venue.background_type if venue else None,
            "width": venue.width if venue else None,
            "height": venue.height if venue else None,
        }
        if venue
        else None,
        "sections": [section_map[s.id] for s in sections],
        "polygons": [
            {
                "id": polygon.id,
                "section_id": polygon.section_id,
                "section_name": section_map.get(polygon.section_id, {}).get("name"),
                "label": polygon.label,
                "points": polygon.points,
            }
            for polygon in polygons
        ],
        "seats": seat_responses,
        "seat_count": len(seats),
    }
