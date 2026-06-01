"""Booking flows backed by show ticket inventory."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import public_api_cache, show_seat_cache_namespace, user_ticket_cache_namespace
from app.core.db import AsyncSessionLocal
from app.core.search import build_ilike_pattern
from app.models.enums import EventStatus, OrderStatus, SeatStatus
from app.models.event import Event, TicketTier, Show
from app.models.order import Order, Ticket
from app.models.seat import Seat
from app.schemas.booking import CheckoutItemResponse, CheckoutResponse, LockSeatsResponse, MyTicketResponse
from app.services.dashboard_service import broadcast_dashboard_update
from app.services.event_inventory_service import sync_show_ticket_inventory
from app.services.queue_service import ensure_queue_access, mark_queue_completed, process_virtual_queue
from app.ws.connection_manager import seat_ws_manager

logger = logging.getLogger(__name__)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


async def _get_show_or_404(session: AsyncSession, show_id: int) -> Show:
    show = await session.scalar(
        select(Show)
        .join(Event, Show.event_id == Event.id)
        .where(
            Show.id == show_id,
            Show.is_deleted.is_(False),
            Show.status == EventStatus.LIVE,
            Event.is_deleted.is_(False),
            Event.status == EventStatus.LIVE,
        )
    )
    if not show:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy buổi diễn")
    return show


def _ticket_change_payload(ticket: Ticket) -> dict[str, int | str | None]:
    return {
        "id": ticket.id,
        "status": ticket.status.value,
        "lock_expires_at": ticket.lock_expires_at.isoformat() if ticket.lock_expires_at else None,
        "locked_by_user_id": ticket.locked_by_customer_id,
    }


def _sync_legacy_seat_from_ticket(ticket: Ticket) -> None:
    _ = ticket


async def _release_expired_locks_at(expires_at: datetime) -> None:
    delay = max((_as_utc(expires_at) - datetime.now(timezone.utc)).total_seconds(), 0) if expires_at else 0
    await asyncio.sleep(delay)

    try:
        async with AsyncSessionLocal() as session:
            released_by_show = await release_expired_locks(session)

        for released_show_id, payload in released_by_show.items():
            await public_api_cache.invalidate_namespace(show_seat_cache_namespace(released_show_id))
            await seat_ws_manager.broadcast_seat_changes(show_id=released_show_id, payload=payload)

        if released_by_show:
            await broadcast_dashboard_update()
    except Exception:
        logger.exception("Không thể mở vé hết hạn theo lịch realtime")


def _schedule_lock_expiration(expires_at: datetime) -> None:
    asyncio.create_task(_release_expired_locks_at(expires_at))


async def _process_queue_after_checkout(queue_token: str | None) -> None:
    if not queue_token:
        return

    async with AsyncSessionLocal() as session:
        await process_virtual_queue(session)


async def lock_seats(
    session: AsyncSession,
    user_id: int,
    show_id: int,
    seat_ids: list[int],
    queue_token: str | None,
) -> LockSeatsResponse:
    if len(set(seat_ids)) != len(seat_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Danh sách vé gửi lên bị trùng mã")

    show = await _get_show_or_404(session, show_id)
    await sync_show_ticket_inventory(session, show)
    await ensure_queue_access(session, show, user_id, queue_token)

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=show.hold_minutes)

    locked_ids: list[int] = []
    failed_ids: list[int] = []
    changed_tickets: list[dict[str, int | str | None]] = []

    try:
        tickets = list(
            await session.scalars(
                select(Ticket)
                .where(Ticket.show_id == show_id, Ticket.id.in_(seat_ids))
                .order_by(Ticket.id.asc())
                .with_for_update()
            )
        )
        found_ids = {ticket.id for ticket in tickets}
        for seat_id in seat_ids:
            if seat_id not in found_ids:
                failed_ids.append(seat_id)

        for ticket in tickets:
            if ticket.is_admin_locked or ticket.status == SeatStatus.SOLD:
                failed_ids.append(ticket.id)
                continue

            lock_expires = _as_utc(ticket.lock_expires_at)
            if (
                ticket.status == SeatStatus.LOCKED
                and ticket.locked_by_customer_id != user_id
                and (lock_expires is None or lock_expires > now)
            ):
                failed_ids.append(ticket.id)
                continue

            ticket.status = SeatStatus.LOCKED
            ticket.locked_by_customer_id = user_id
            ticket.lock_expires_at = expires_at
            _sync_legacy_seat_from_ticket(ticket)
            locked_ids.append(ticket.id)
            changed_tickets.append(_ticket_change_payload(ticket))

        await session.commit()
    except Exception:
        await session.rollback()
        raise

    if changed_tickets:
        await public_api_cache.invalidate_namespace(show_seat_cache_namespace(show_id))
        await seat_ws_manager.broadcast_seat_changes(show_id=show_id, payload=changed_tickets)
        await broadcast_dashboard_update()
        _schedule_lock_expiration(expires_at)

    return LockSeatsResponse(
        locked_seat_ids=locked_ids,
        failed_seat_ids=sorted(set(failed_ids)),
        message="Đã giữ vé thành công" if locked_ids else "Không có vé nào được giữ",
    )


async def release_seats(session: AsyncSession, user_id: int, show_id: int, seat_ids: list[int]) -> int:
    changed_tickets: list[dict[str, int | str | None]] = []
    try:
        tickets = list(
            await session.scalars(
                select(Ticket)
                .where(Ticket.show_id == show_id, Ticket.id.in_(seat_ids))
                .order_by(Ticket.id.asc())
                .with_for_update()
            )
        )

        count = 0
        for ticket in tickets:
            if ticket.status != SeatStatus.LOCKED or ticket.locked_by_customer_id != user_id:
                continue
            ticket.status = SeatStatus.AVAILABLE
            ticket.locked_by_customer_id = None
            ticket.lock_expires_at = None
            ticket.order_id = None
            _sync_legacy_seat_from_ticket(ticket)
            count += 1
            changed_tickets.append(_ticket_change_payload(ticket))

        await session.commit()
    except Exception:
        await session.rollback()
        raise

    if changed_tickets:
        await public_api_cache.invalidate_namespace(show_seat_cache_namespace(show_id))
        await seat_ws_manager.broadcast_seat_changes(show_id=show_id, payload=changed_tickets)
        await broadcast_dashboard_update()

    return count


async def checkout_locked_seats(
    session: AsyncSession,
    user_id: int,
    show_id: int,
    queue_token: str | None,
    discount_code: str | None = None,
) -> CheckoutResponse:
    show = await _get_show_or_404(session, show_id)
    await sync_show_ticket_inventory(session, show)
    await ensure_queue_access(session, show, user_id, queue_token)

    now = datetime.now(timezone.utc)
    checkout_items: list[CheckoutItemResponse] = []
    changed_tickets: list[dict[str, int | str | None]] = []

    try:
        tickets = list(
            await session.scalars(
                select(Ticket)
                .where(
                    Ticket.show_id == show_id,
                    Ticket.locked_by_customer_id == user_id,
                    Ticket.status == SeatStatus.LOCKED,
                )
                .order_by(Ticket.id.asc())
                .with_for_update()
            )
        )

        valid_tickets: list[Ticket] = []
        for ticket in tickets:
            lock_expires = _as_utc(ticket.lock_expires_at)
            if lock_expires and lock_expires < now:
                ticket.status = SeatStatus.AVAILABLE
                ticket.locked_by_customer_id = None
                ticket.lock_expires_at = None
                _sync_legacy_seat_from_ticket(ticket)
                changed_tickets.append(_ticket_change_payload(ticket))
                continue
            valid_tickets.append(ticket)

        if not valid_tickets:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không có vé đang giữ hợp lệ để thanh toán")

        tier_ids = {ticket.ticket_tier_id for ticket in valid_tickets if ticket.ticket_tier_id is not None}
        tier_rows = await session.execute(select(TicketTier.id, TicketTier.name).where(TicketTier.id.in_(tier_ids))) if tier_ids else None
        tier_map = {ticket_tier_id: ticket_tier_name for ticket_tier_id, ticket_tier_name in (tier_rows.all() if tier_rows else [])}

        subtotal_amount = sum(Decimal(str(ticket.price)) for ticket in valid_tickets)
        discount_amount = Decimal("0")
        total_amount = subtotal_amount - discount_amount

        order = Order(
            customer_id=user_id,
            show_id=show_id,
            order_code=f"ORD-{now.strftime('%Y%m%d')}-{uuid4().hex[:10].upper()}",
            status=OrderStatus.PAID,
            total_amount=total_amount,
            paid_at=now,
        )
        session.add(order)
        await session.flush()

        for ticket in valid_tickets:
            ticket_code = f"TR-{now.strftime('%Y%m%d')}-{uuid4().hex[:12].upper()}"
            qr_payload = f"ticketrush://ticket/{ticket_code}"

            ticket.order_id = order.id
            ticket.ticket_code = ticket_code
            ticket.qr_payload = qr_payload
            ticket.issued_at = now
            ticket.status = SeatStatus.SOLD
            ticket.locked_by_customer_id = None
            ticket.lock_expires_at = None
            _sync_legacy_seat_from_ticket(ticket)
            changed_tickets.append(_ticket_change_payload(ticket))

            checkout_items.append(
                CheckoutItemResponse(
                    seat_id=ticket.id,
                    seat_label=ticket.seat_label or f"Ticket #{ticket.id}",
                    ticket_tier_name=tier_map.get(ticket.ticket_tier_id, "Chưa phân hạng"),
                    price=Decimal(str(ticket.price)),
                    ticket_code=ticket_code,
                    qr_payload=qr_payload,
                )
            )

        await mark_queue_completed(session, show_id=show_id, user_id=user_id, queue_token=queue_token)
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    if changed_tickets:
        await public_api_cache.invalidate_namespace(show_seat_cache_namespace(show_id))
        await seat_ws_manager.broadcast_seat_changes(show_id=show_id, payload=changed_tickets)
        await _process_queue_after_checkout(queue_token)
        await broadcast_dashboard_update()
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
    active_stmt = (
        select(Ticket, Order, Event, Show, TicketTier, Seat)
        .join(Order, Ticket.order_id == Order.id)
        .join(Show, Order.show_id == Show.id)
        .join(Event, Show.event_id == Event.id)
        .outerjoin(TicketTier, Ticket.ticket_tier_id == TicketTier.id)
        .outerjoin(Seat, Ticket.seat_id == Seat.id)
        .where(Order.customer_id == user_id, Ticket.ticket_code.is_not(None))
        .order_by(Ticket.issued_at.desc())
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

    if start_from:
        active_stmt = active_stmt.where(Show.start_at >= start_from)
    if end_to:
        active_stmt = active_stmt.where(Show.start_at <= end_to)

    active_rows = (await session.execute(active_stmt.limit(limit).offset(offset))).all()

    return [
        MyTicketResponse(
            ticket_id=ticket.id,
            ticket_code=ticket.ticket_code or "",
            qr_payload=ticket.qr_payload,
            event_id=event.id,
            event_slug=event.slug,
            event_title=event.title,
            show_id=show.id,
            show_title=show.title,
            show_start_at=show.start_at,
            show_end_at=show.end_at,
            event_cover_image_url=event.cover_image_url,
            venue=show.location,
            seat_label=ticket.seat_label or (seat.seat_label if seat else f"Ticket #{ticket.id}"),
            ticket_tier_name=tier.name if tier else "Khu vực chung",
            price=Decimal(str(ticket.price)),
            order_id=order.id,
            seat_status=ticket.status,
            ticket_status="active",
            issued_at=ticket.issued_at,
        )
        for ticket, order, event, show, tier, seat in active_rows
    ]


async def release_expired_locks(session: AsyncSession) -> dict[int, list[dict[str, int | str | None]]]:
    now = datetime.now(timezone.utc)
    tickets = list(
        await session.scalars(
            select(Ticket)
            .where(
                Ticket.show_id.is_not(None),
                Ticket.status == SeatStatus.LOCKED,
                Ticket.lock_expires_at.is_not(None),
                Ticket.lock_expires_at < now,
            )
            .with_for_update()
        )
    )

    if not tickets:
        return {}

    show_payloads: dict[int, list[dict[str, int | str | None]]] = {}
    try:
        for ticket in tickets:
            ticket.status = SeatStatus.AVAILABLE
            ticket.locked_by_customer_id = None
            ticket.lock_expires_at = None
            ticket.order_id = None
            _sync_legacy_seat_from_ticket(ticket)
            show_payloads.setdefault(ticket.show_id or 0, []).append(_ticket_change_payload(ticket))
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    return {show_id: payload for show_id, payload in show_payloads.items() if show_id}
