"""Seat locking, checkout, ticket emission and lock expiration tasks."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import OrderStatus, SeatStatus
from app.models.event import Event, SeatZone
from app.models.order import Order, OrderItem, Ticket, TicketCancellation
from app.models.seat import Seat
from app.schemas.booking import CheckoutItemResponse, CheckoutResponse, LockSeatsResponse, MyTicketResponse
from app.services.queue_service import ensure_queue_access, mark_queue_completed
from app.ws.connection_manager import seat_ws_manager


def _as_utc(value: datetime | None) -> datetime | None:
    """Normalize naive datetimes from DB drivers to UTC-aware values."""

    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=UTC)


async def _get_event_or_404(session: AsyncSession, event_id: int) -> Event:
    event = await session.scalar(select(Event).where(Event.id == event_id))
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


async def lock_seats(
    session: AsyncSession,
    user_id: int,
    event_id: int,
    seat_ids: list[int],
    queue_token: str | None,
) -> LockSeatsResponse:
    """Lock seats for the user with row-level locking to avoid race conditions."""

    if len(set(seat_ids)) != len(seat_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Duplicate seat ids in request")

    event = await _get_event_or_404(session, event_id)
    await ensure_queue_access(session, event, user_id, queue_token)

    now = datetime.now(UTC)
    expires_at = now + timedelta(minutes=event.hold_minutes)

    locked_ids: list[int] = []
    failed_ids: list[int] = []
    changed_seats: list[dict[str, int | str | None]] = []

    try:
        seats = list(
            await session.scalars(
                select(Seat)
                .where(Seat.event_id == event_id, Seat.id.in_(seat_ids))
                .with_for_update()
            )
        )

        found_ids = {seat.id for seat in seats}
        for seat_id in seat_ids:
            if seat_id not in found_ids:
                failed_ids.append(seat_id)

        for seat in seats:
            if seat.status == SeatStatus.SOLD:
                failed_ids.append(seat.id)
                continue

            lock_expires = _as_utc(seat.lock_expires_at)
            if seat.status == SeatStatus.LOCKED and lock_expires and lock_expires > now:
                if seat.locked_by_user_id != user_id:
                    failed_ids.append(seat.id)
                    continue

            seat.status = SeatStatus.LOCKED
            seat.locked_by_user_id = user_id
            seat.lock_expires_at = expires_at
            locked_ids.append(seat.id)
            changed_seats.append(
                {
                    "id": seat.id,
                    "status": SeatStatus.LOCKED.value,
                    "lock_expires_at": seat.lock_expires_at.isoformat(),
                    "locked_by_user_id": user_id,
                }
            )

        await session.commit()
    except Exception:
        await session.rollback()
        raise

    if changed_seats:
        await seat_ws_manager.broadcast_seat_changes(event_id=event_id, payload=changed_seats)

    return LockSeatsResponse(
        locked_seat_ids=locked_ids,
        failed_seat_ids=sorted(set(failed_ids)),
        message="Seats locked successfully" if locked_ids else "No seats were locked",
    )


async def release_seats(session: AsyncSession, user_id: int, event_id: int, seat_ids: list[int]) -> int:
    """Release seats currently locked by the same user."""

    changed_seats: list[dict[str, int | str | None]] = []

    try:
        seats = list(
            await session.scalars(
                select(Seat)
                .where(Seat.event_id == event_id, Seat.id.in_(seat_ids))
                .with_for_update()
            )
        )

        count = 0
        for seat in seats:
            if seat.status != SeatStatus.LOCKED or seat.locked_by_user_id != user_id:
                continue

            seat.status = SeatStatus.AVAILABLE
            seat.locked_by_user_id = None
            seat.lock_expires_at = None
            count += 1
            changed_seats.append(
                {
                    "id": seat.id,
                    "status": SeatStatus.AVAILABLE.value,
                    "lock_expires_at": None,
                    "locked_by_user_id": None,
                }
            )

        await session.commit()
    except Exception:
        await session.rollback()
        raise

    if changed_seats:
        await seat_ws_manager.broadcast_seat_changes(event_id=event_id, payload=changed_seats)

    return count


async def checkout_locked_seats(
    session: AsyncSession,
    user_id: int,
    event_id: int,
    queue_token: str | None,
) -> CheckoutResponse:
    """Confirm payment and convert locked seats to sold tickets atomically."""

    event = await _get_event_or_404(session, event_id)
    await ensure_queue_access(session, event, user_id, queue_token)

    now = datetime.now(UTC)
    checkout_items: list[CheckoutItemResponse] = []
    changed_seats: list[dict[str, int | str | None]] = []

    try:
        seats = list(
            await session.scalars(
                select(Seat)
                .where(
                    Seat.event_id == event_id,
                    Seat.locked_by_user_id == user_id,
                    Seat.status == SeatStatus.LOCKED,
                )
                .with_for_update()
            )
        )

        valid_seats: list[Seat] = []
        for seat in seats:
            lock_expires = _as_utc(seat.lock_expires_at)
            if lock_expires and lock_expires < now:
                seat.status = SeatStatus.AVAILABLE
                seat.locked_by_user_id = None
                seat.lock_expires_at = None
                changed_seats.append(
                    {
                        "id": seat.id,
                        "status": SeatStatus.AVAILABLE.value,
                        "lock_expires_at": None,
                        "locked_by_user_id": None,
                    }
                )
                continue
            valid_seats.append(seat)

        if not valid_seats:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid locked seats for checkout")

        zone_ids = {seat.zone_id for seat in valid_seats}
        zone_rows = (
            await session.execute(select(SeatZone.id, SeatZone.name).where(SeatZone.id.in_(zone_ids)))
            if zone_ids
            else None
        )
        zone_map = {zone_id: zone_name for zone_id, zone_name in (zone_rows.all() if zone_rows else [])}

        total_amount = sum(Decimal(str(seat.price)) for seat in valid_seats)

        order = Order(
            user_id=user_id,
            event_id=event_id,
            status=OrderStatus.PAID,
            total_amount=total_amount,
            paid_at=now,
        )
        session.add(order)
        await session.flush()

        for seat in valid_seats:
            order_item = OrderItem(order_id=order.id, seat_id=seat.id, price=seat.price)
            session.add(order_item)
            await session.flush()

            ticket_code = f"TR-{order.id}-{seat.id}-{uuid4().hex[:8].upper()}"
            qr_payload = f"ticketrush://ticket/{ticket_code}"
            session.add(
                Ticket(
                    order_item_id=order_item.id,
                    ticket_code=ticket_code,
                    qr_payload=qr_payload,
                    issued_at=now,
                )
            )

            zone_name = zone_map.get(seat.zone_id, "Unknown")
            checkout_items.append(
                CheckoutItemResponse(
                    seat_id=seat.id,
                    seat_label=seat.seat_label,
                    zone_name=zone_name,
                    price=Decimal(str(seat.price)),
                    ticket_code=ticket_code,
                    qr_payload=qr_payload,
                )
            )

            seat.status = SeatStatus.SOLD
            seat.locked_by_user_id = None
            seat.lock_expires_at = None
            changed_seats.append(
                {
                    "id": seat.id,
                    "status": SeatStatus.SOLD.value,
                    "lock_expires_at": None,
                    "locked_by_user_id": None,
                }
            )

        await mark_queue_completed(session, event_id=event_id, user_id=user_id, queue_token=queue_token)
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    if changed_seats:
        await seat_ws_manager.broadcast_seat_changes(event_id=event_id, payload=changed_seats)

    return CheckoutResponse(
        order_id=order.id,
        order_status=order.status,
        total_amount=Decimal(str(order.total_amount)),
        paid_at=order.paid_at or now,
        items=checkout_items,
    )


async def fetch_my_tickets(
    session: AsyncSession,
    user_id: int,
    search: str | None = None,
    start_from: datetime | None = None,
    end_to: datetime | None = None,
) -> list[MyTicketResponse]:
    """Return customer purchased tickets with event and seat details."""

    stmt = (
        select(Ticket, Order, Event, OrderItem, Seat, SeatZone)
        .join(OrderItem, Ticket.order_item_id == OrderItem.id)
        .join(Order, OrderItem.order_id == Order.id)
        .join(Event, Order.event_id == Event.id)
        .join(Seat, OrderItem.seat_id == Seat.id)
        .join(SeatZone, Seat.zone_id == SeatZone.id)
        .where(Order.user_id == user_id)
        .order_by(Ticket.issued_at.desc())
    )

    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(or_(Ticket.ticket_code.ilike(pattern), Event.title.ilike(pattern)))

    if start_from:
        stmt = stmt.where(Event.start_at >= start_from)

    if end_to:
        stmt = stmt.where(Event.start_at <= end_to)

    rows = (await session.execute(stmt)).all()

    return [
        MyTicketResponse(
            ticket_id=ticket.id,
            ticket_code=ticket.ticket_code,
            qr_payload=ticket.qr_payload,
            event_id=event.id,
            event_slug=event.slug,
            event_title=event.title,
            event_date=event.start_at,
            venue=event.venue,
            seat_label=seat.seat_label,
            zone_name=zone.name,
            price=Decimal(str(order_item.price)),
            order_id=order.id,
            seat_status=seat.status,
            issued_at=ticket.issued_at,
        )
        for ticket, order, event, order_item, seat, zone in rows
    ]


async def cancel_ticket(session: AsyncSession, user_id: int, ticket_id: int) -> None:
    """Delete one owned ticket and release its sold seat back to inventory."""

    row = (
        await session.execute(
            select(Ticket, OrderItem, Order, Seat)
            .join(OrderItem, Ticket.order_item_id == OrderItem.id)
            .join(Order, OrderItem.order_id == Order.id)
            .join(Seat, OrderItem.seat_id == Seat.id)
            .where(Ticket.id == ticket_id, Order.user_id == user_id)
            .with_for_update()
        )
    ).first()

    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    ticket, order_item, order, seat = row
    canceled_at = datetime.now(UTC)
    changed_seat = {
        "id": seat.id,
        "status": SeatStatus.AVAILABLE.value,
        "lock_expires_at": None,
        "locked_by_user_id": None,
    }

    try:
        seat.status = SeatStatus.AVAILABLE
        seat.locked_by_user_id = None
        seat.lock_expires_at = None

        session.add(
            TicketCancellation(
                ticket_code=ticket.ticket_code,
                user_id=order.user_id,
                event_id=order.event_id,
                order_id=order.id,
                seat_id=seat.id,
                canceled_price=order_item.price,
                canceled_at=canceled_at,
            )
        )

        await session.delete(ticket)
        await session.delete(order_item)
        await session.flush()

        total_amount = await session.scalar(
            select(func.coalesce(func.sum(OrderItem.price), 0)).where(OrderItem.order_id == order.id)
        )
        updated_total = Decimal(str(total_amount or 0))
        order.total_amount = updated_total
        if updated_total <= Decimal("0"):
            order.status = OrderStatus.CANCELLED

        await session.commit()
    except Exception:
        await session.rollback()
        raise

    await seat_ws_manager.broadcast_seat_changes(event_id=seat.event_id, payload=[changed_seat])


async def release_expired_locks(session: AsyncSession) -> dict[int, list[dict[str, int | str | None]]]:
    """Background task: release seats that exceeded lock timeout."""

    now = datetime.now(UTC)
    seats = list(
        await session.scalars(
            select(Seat)
            .where(
                Seat.status == SeatStatus.LOCKED,
                Seat.lock_expires_at.is_not(None),
                Seat.lock_expires_at < now,
            )
            .with_for_update()
        )
    )

    if not seats:
        return {}

    event_payloads: dict[int, list[dict[str, int | str | None]]] = {}

    try:
        for seat in seats:
            seat.status = SeatStatus.AVAILABLE
            seat.locked_by_user_id = None
            seat.lock_expires_at = None
            event_payloads.setdefault(seat.event_id, []).append(
                {
                    "id": seat.id,
                    "status": SeatStatus.AVAILABLE.value,
                    "lock_expires_at": None,
                    "locked_by_user_id": None,
                }
            )
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    return event_payloads
