"""Enhanced inventory service with coordinate-based seat map support."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import OrderStatus, SeatStatus
from app.models.event import Event
from app.models.order import Order, OrderItem, Ticket
from app.models.seat import Seat
from app.models.venue import Section, VenueLayout
from app.schemas.booking import CheckoutItemResponse, CheckoutResponse, LockSeatsResponse
from app.services.queue_service import ensure_queue_access, mark_queue_completed
from app.ws.connection_manager import seat_ws_manager


def _as_utc(value: datetime | None) -> datetime | None:
    """Normalize naive datetimes from DB drivers to UTC-aware values."""
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=UTC)


async def _get_event_or_404(session: AsyncSession, event_id: int) -> Event:
    event = await session.scalar(select(Event).where(Event.id == event_id, Event.is_deleted.is_(False)))
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


async def get_seatmap(
    session: AsyncSession,
    event_id: int,
    current_user_id: int | None = None,
    include_user_details: bool = False,
) -> dict[str, Any]:
    """Get full seat map with coordinates for frontend rendering."""

    event = await _get_event_or_404(session, event_id)

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
            select(Seat).where(Seat.event_id == event_id).order_by(Seat.section_id, Seat.seat_label)
        )
    )

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
        normalized_status = seat.status
        lock_expires = _as_utc(seat.lock_expires_at)
        if seat.status == SeatStatus.LOCKED and lock_expires and lock_expires < now:
            normalized_status = SeatStatus.AVAILABLE

        seat_responses.append({
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
        })

    return {
        "event_id": event_id,
        "event_title": event.title,
        "venue_name": event.venue,
        "sections": [section_map[s.id] for s in sections],
        "seats": seat_responses,
        "seat_count": len(seats),
    }


async def lock_seats_by_label(
    session: AsyncSession,
    event_id: int,
    user_id: int,
    seat_labels: list[str],
    queue_token: str | None = None,
) -> LockSeatsResponse:
    """Lock seats by label (for coordinate-based seat map)."""

    if len(set(seat_labels)) != len(seat_labels):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Duplicate seat labels in request")

    event = await _get_event_or_404(session, event_id)
    await ensure_queue_access(session, event, user_id, queue_token)

    now = datetime.now(UTC)
    expires_at = now + timedelta(minutes=event.hold_minutes)

    seats = list(
        await session.scalars(
            select(Seat).where(
                Seat.event_id == event_id,
                Seat.seat_label.in_(seat_labels),
            ).with_for_update()
        )
    )

    found_labels = {s.seat_label for s in seats}
    not_found = [label for label in seat_labels if label not in found_labels]

    locked_ids: list[int] = []
    failed_ids: list[str] = list(not_found)
    changed_seats: list[dict[str, Any]] = []

    for seat in seats:
        if seat.status == SeatStatus.SOLD:
            failed_ids.append(seat.seat_label)
            continue

        lock_expires = _as_utc(seat.lock_expires_at)
        if seat.status == SeatStatus.LOCKED and lock_expires and lock_expires > now:
            if seat.locked_by_user_id != user_id:
                failed_ids.append(seat.seat_label)
                continue

        seat.status = SeatStatus.LOCKED
        seat.locked_by_user_id = user_id
        seat.lock_expires_at = expires_at
        locked_ids.append(seat.id)
        changed_seats.append({
            "id": seat.id,
            "status": SeatStatus.LOCKED.value,
            "lock_expires_at": expires_at.isoformat(),
            "locked_by_user_id": user_id,
        })

    await session.commit()

    if changed_seats:
        await seat_ws_manager.broadcast_seat_changes(event_id, changed_seats)

    return LockSeatsResponse(
        locked_seat_ids=locked_ids,
        failed_seat_ids=sorted(set(failed_ids)),
        message=f"Locked {len(locked_ids)} seats" if locked_ids else "No seats locked",
    )
