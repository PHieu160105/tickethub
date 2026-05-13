"""Seat locking, checkout, ticket emission and lock expiration tasks."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import public_api_cache, show_seat_cache_namespace, user_ticket_cache_namespace
from app.core.search import build_ilike_pattern
from app.models.enums import OrderStatus, SeatStatus
from app.models.event import Event, SeatZone, Show
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


async def _get_show_or_404(session: AsyncSession, show_id: int) -> Show:
    show = await session.scalar(select(Show).where(Show.id == show_id, Show.is_deleted.is_(False)))
    if not show:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Show not found")
    return show


async def lock_seats(
    session: AsyncSession,
    user_id: int,
    show_id: int,
    seat_ids: list[int],
    queue_token: str | None,
) -> LockSeatsResponse:
    """Lock seats for the user with row-level locking to avoid race conditions."""

    if len(set(seat_ids)) != len(seat_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Duplicate seat ids in request")

    show = await _get_show_or_404(session, show_id)
    await ensure_queue_access(session, show, user_id, queue_token)

    now = datetime.now(UTC)
    expires_at = now + timedelta(minutes=show.hold_minutes)
    locked_ids: list[int] = []
    failed_ids: list[int] = []
    changed_seats: list[dict[str, int | str | None]] = []

    try:
        seats = list(
            await session.scalars(
                select(Seat)
                .where(Seat.show_id == show_id, Seat.id.in_(seat_ids))
                .order_by(Seat.id.asc())
                .with_for_update()
            )
        )

        found_ids = {seat.id for seat in seats}
        for seat_id in seat_ids:
            if seat_id not in found_ids:
                failed_ids.append(seat_id)

        for seat in seats:
            if seat.is_admin_locked or seat.status == SeatStatus.SOLD:
                failed_ids.append(seat.id)
                continue

            lock_expires = _as_utc(seat.lock_expires_at)
            if seat.status == SeatStatus.LOCKED and lock_expires and lock_expires > now and seat.locked_by_user_id != user_id:
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
        await public_api_cache.invalidate_namespace(show_seat_cache_namespace(show_id))
        await seat_ws_manager.broadcast_seat_changes(show_id=show_id, payload=changed_seats)

    return LockSeatsResponse(
        locked_seat_ids=locked_ids,
        failed_seat_ids=sorted(set(failed_ids)),
        message="Seats locked successfully" if locked_ids else "No seats were locked",
    )


async def release_seats(session: AsyncSession, user_id: int, show_id: int, seat_ids: list[int]) -> int:
    """Release seats currently locked by the same user."""

    changed_seats: list[dict[str, int | str | None]] = []
    try:
        seats = list(
            await session.scalars(
                select(Seat)
                .where(Seat.show_id == show_id, Seat.id.in_(seat_ids))
                .order_by(Seat.id.asc())
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
        await public_api_cache.invalidate_namespace(show_seat_cache_namespace(show_id))
        await seat_ws_manager.broadcast_seat_changes(show_id=show_id, payload=changed_seats)

    return count


async def checkout_locked_seats(
    session: AsyncSession,
    user_id: int,
    show_id: int,
    queue_token: str | None,
    discount_code: str | None = None,
) -> CheckoutResponse:
    """Confirm payment and convert locked seats to sold tickets atomically."""

    show = await _get_show_or_404(session, show_id)
    await ensure_queue_access(session, show, user_id, queue_token)

    now = datetime.now(UTC)
    checkout_items: list[CheckoutItemResponse] = []
    changed_seats: list[dict[str, int | str | None]] = []

    try:
        seats = list(
            await session.scalars(
                select(Seat)
                .where(
                    Seat.show_id == show_id,
                    Seat.locked_by_user_id == user_id,
                    Seat.status == SeatStatus.LOCKED,
                )
                .order_by(Seat.id.asc())
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

        zone_ids = {seat.zone_id for seat in valid_seats if seat.zone_id is not None}
        zone_rows = await session.execute(select(SeatZone.id, SeatZone.name).where(SeatZone.id.in_(zone_ids))) if zone_ids else None
        zone_map = {zone_id: zone_name for zone_id, zone_name in (zone_rows.all() if zone_rows else [])}

        subtotal_amount = sum(Decimal(str(seat.price)) for seat in valid_seats)
        discount_amount = Decimal("0")
        total_amount = subtotal_amount

        order = Order(
            user_id=user_id,
            event_id=show.event_id,
            show_id=show_id,
            status=OrderStatus.PAID,
            total_amount=total_amount,
            paid_at=now,
        )
        session.add(order)
        await session.flush()

        order_items = [OrderItem(order_id=order.id, seat_id=seat.id, price=seat.price) for seat in valid_seats]
        session.add_all(order_items)
        await session.flush()

        tickets: list[Ticket] = []
        for seat, order_item in zip(valid_seats, order_items, strict=False):
            ticket_code = f"TR-{now.strftime('%Y%m%d')}-{uuid4().hex[:12].upper()}"
            qr_payload = f"ticketrush://ticket/{ticket_code}"
            tickets.append(
                Ticket(
                    order_item_id=order_item.id,
                    ticket_code=ticket_code,
                    qr_payload=qr_payload,
                    issued_at=now,
                )
            )

            checkout_items.append(
                CheckoutItemResponse(
                    seat_id=seat.id,
                    seat_label=seat.seat_label,
                    zone_name=zone_map.get(seat.zone_id, "Unknown"),
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

        session.add_all(tickets)

        await mark_queue_completed(session, show_id=show_id, user_id=user_id, queue_token=queue_token)
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    if changed_seats:
        await public_api_cache.invalidate_namespace(show_seat_cache_namespace(show_id))
        await seat_ws_manager.broadcast_seat_changes(show_id=show_id, payload=changed_seats)
    await public_api_cache.invalidate_namespace(user_ticket_cache_namespace(user_id))

    return CheckoutResponse(
        order_id=order.id,
        order_status=order.status,
        total_amount=Decimal(str(order.total_amount)),
        discount_amount=discount_amount,
        discount_code=discount_code,
        paid_at=order.paid_at or now,
        items=checkout_items,
    )


async def fetch_my_tickets(
    session: AsyncSession,
    user_id: int,
    search: str | None = None,
    start_from: datetime | None = None,
    end_to: datetime | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[MyTicketResponse]:
    """Return customer purchased tickets and cancellation history."""

    active_stmt = (
        select(Ticket, Order, Event, Show, OrderItem, Seat, SeatZone)
        .join(OrderItem, Ticket.order_item_id == OrderItem.id)
        .join(Order, OrderItem.order_id == Order.id)
        .join(Show, Order.show_id == Show.id)
        .join(Event, Show.event_id == Event.id)
        .join(Seat, OrderItem.seat_id == Seat.id)
        .outerjoin(SeatZone, Seat.zone_id == SeatZone.id)
        .where(Order.user_id == user_id)
        .order_by(Ticket.issued_at.desc())
    )

    cancelled_stmt = (
        select(TicketCancellation, Event, Show, Seat, SeatZone)
        .join(Show, TicketCancellation.show_id == Show.id)
        .join(Event, Show.event_id == Event.id)
        .join(Seat, TicketCancellation.seat_id == Seat.id)
        .outerjoin(SeatZone, Seat.zone_id == SeatZone.id)
        .where(TicketCancellation.user_id == user_id)
        .order_by(TicketCancellation.canceled_at.desc())
    )

    pattern = build_ilike_pattern(search)
    if pattern:
        active_stmt = active_stmt.where(
            or_(
                Ticket.ticket_code.ilike(pattern, escape="\\"),
                Event.title.ilike(pattern, escape="\\"),
                Show.title.ilike(pattern, escape="\\"),
            )
        )
        cancelled_stmt = cancelled_stmt.where(
            or_(
                TicketCancellation.ticket_code.ilike(pattern, escape="\\"),
                Event.title.ilike(pattern, escape="\\"),
                Show.title.ilike(pattern, escape="\\"),
            )
        )

    if start_from:
        active_stmt = active_stmt.where(Show.start_at >= start_from)
        cancelled_stmt = cancelled_stmt.where(Show.start_at >= start_from)

    if end_to:
        active_stmt = active_stmt.where(Show.start_at <= end_to)
        cancelled_stmt = cancelled_stmt.where(Show.start_at <= end_to)

    active_rows = (await session.execute(active_stmt.limit(limit).offset(offset))).all()
    cancelled_rows = (await session.execute(cancelled_stmt.limit(limit).offset(offset))).all()

    active_tickets = [
        MyTicketResponse(
            ticket_id=ticket.id,
            ticket_code=ticket.ticket_code,
            qr_payload=ticket.qr_payload,
            event_id=event.id,
            event_slug=event.slug,
            event_title=event.title,
            show_id=show.id,
            show_title=show.title,
            show_start_at=show.start_at,
            show_end_at=show.end_at,
            event_cover_image_url=event.cover_image_url,
            venue=show.venue,
            seat_label=seat.seat_label,
            zone_name=zone.name if zone else "General",
            price=Decimal(str(order_item.price)),
            order_id=order.id,
            seat_status=seat.status,
            ticket_status="active",
            issued_at=ticket.issued_at,
        )
        for ticket, order, event, show, order_item, seat, zone in active_rows
    ]

    cancelled_tickets = [
        MyTicketResponse(
            cancellation_id=cancel.id,
            ticket_code=cancel.ticket_code,
            qr_payload=None,
            event_id=event.id,
            event_slug=event.slug,
            event_title=event.title,
            show_id=show.id,
            show_title=show.title,
            show_start_at=show.start_at,
            show_end_at=show.end_at,
            event_cover_image_url=event.cover_image_url,
            venue=show.venue,
            seat_label=seat.seat_label,
            zone_name=zone.name if zone else "General",
            price=Decimal(str(cancel.canceled_price)),
            order_id=cancel.order_id,
            seat_status=seat.status,
            ticket_status="cancelled",
            canceled_at=cancel.canceled_at,
        )
        for cancel, event, show, seat, zone in cancelled_rows
    ]

    combined = active_tickets + cancelled_tickets
    return sorted(
        combined,
        key=lambda item: item.canceled_at or item.issued_at or datetime.fromtimestamp(0),
        reverse=True,
    )


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
                show_id=order.show_id,
                order_id=order.id,
                seat_id=seat.id,
                canceled_price=order_item.price,
                canceled_at=canceled_at,
            )
        )

        await session.delete(ticket)
        await session.delete(order_item)
        await session.flush()

        total_amount = await session.scalar(select(func.coalesce(func.sum(OrderItem.price), 0)).where(OrderItem.order_id == order.id))
        updated_total = Decimal(str(total_amount or 0))
        order.total_amount = updated_total
        if updated_total <= Decimal("0"):
            order.status = OrderStatus.CANCELLED

        await session.commit()
    except Exception:
        await session.rollback()
        raise

    await public_api_cache.invalidate_namespace(user_ticket_cache_namespace(user_id))
    await seat_ws_manager.broadcast_seat_changes(show_id=seat.show_id or 0, payload=[changed_seat])
    await public_api_cache.invalidate_namespace(show_seat_cache_namespace(seat.show_id or 0))


async def release_expired_locks(session: AsyncSession) -> dict[int, list[dict[str, int | str | None]]]:
    """Background task: release seats that exceeded lock timeout."""

    now = datetime.now(UTC)
    seats = list(
        await session.scalars(
            select(Seat)
            .where(
                Seat.show_id.is_not(None),
                Seat.status == SeatStatus.LOCKED,
                Seat.lock_expires_at.is_not(None),
                Seat.lock_expires_at < now,
            )
            .with_for_update()
        )
    )

    if not seats:
        return {}

    show_payloads: dict[int, list[dict[str, int | str | None]]] = {}
    try:
        for seat in seats:
            seat.status = SeatStatus.AVAILABLE
            seat.locked_by_user_id = None
            seat.lock_expires_at = None
            show_payloads.setdefault(seat.show_id or 0, []).append(
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

    return {show_id: payload for show_id, payload in show_payloads.items() if show_id}
