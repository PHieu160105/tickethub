from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import EVENT_DETAIL_CACHE_NAMESPACE, EVENT_LIST_CACHE_NAMESPACE, SHOW_DETAIL_CACHE_NAMESPACE, public_api_cache, show_seat_cache_namespace
from app.models.enums import OrderStatus, QueueStatus, SeatStatus, EventStatus
from app.models.event import Event, SeatZone, Show, ShowPolygon
from app.models.order import OrderItem, Ticket
from app.models.queue import QueueEntry
from app.models.seat import Seat
from app.schemas.admin import EventDetailStatsResponse, EventZoneStatsResponse
from app.schemas.event import ShowPolygonResponse
from app.services.event_service import get_event_by_slug_or_id, get_show_by_id


def _apply_admin_lock_state(seat: Seat, is_admin_locked: bool) -> None:
    if seat.status == SeatStatus.SOLD and is_admin_locked != seat.is_admin_locked:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Khong the doi khoa admin cua ghe da ban")

    seat.is_admin_locked = is_admin_locked
    if is_admin_locked:
        seat.status = SeatStatus.LOCKED
        seat.locked_by_user_id = None
        seat.lock_expires_at = None
        return

    if seat.status == SeatStatus.LOCKED and seat.locked_by_user_id is None:
        seat.status = SeatStatus.AVAILABLE
        seat.lock_expires_at = None


async def _invalidate_show_cache(show_id: int) -> None:
    await public_api_cache.invalidate_namespace(show_seat_cache_namespace(show_id))
    await public_api_cache.invalidate_namespace(SHOW_DETAIL_CACHE_NAMESPACE)
    await public_api_cache.invalidate_namespace(EVENT_LIST_CACHE_NAMESPACE)
    await public_api_cache.invalidate_namespace(EVENT_DETAIL_CACHE_NAMESPACE)


async def _interrupt_active_show_sessions(session: AsyncSession, show: Show) -> tuple[list[dict[str, int | str | None]], int]:
    locked_seats = list(
        await session.scalars(
            select(Seat)
            .where(
                Seat.show_id == show.id,
                Seat.status == SeatStatus.LOCKED,
                Seat.locked_by_user_id.is_not(None),
            )
            .order_by(Seat.id.asc())
            .with_for_update()
        )
    )
    changed_seats: list[dict[str, int | str | None]] = []
    for seat in locked_seats:
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

    active_entries = list(
        await session.scalars(
            select(QueueEntry)
            .where(
                QueueEntry.show_id == show.id,
                QueueEntry.status.in_([QueueStatus.WAITING, QueueStatus.ADMITTED]),
            )
            .order_by(QueueEntry.id.asc())
            .with_for_update()
        )
    )
    now = datetime.now(UTC)
    for entry in active_entries:
        entry.status = QueueStatus.EXPIRED
        entry.expires_at = now

    return changed_seats, len(active_entries)


async def _build_event_or_404_show(session: AsyncSession, event_key: str, show_id: int) -> tuple[Event, Show]:
    event = await get_event_by_slug_or_id(session, event_key)
    show = await get_show_by_id(session, show_id)
    if show.event_id != event.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay buoi dien thuoc su kien nay")
    return event, show


def _ensure_show_is_draft(show: Show) -> None:
    if show.status != EventStatus.DRAFT:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Seat Planner chi duoc chinh sua show o trang thai draft")


def _validate_unique_ids(values: list[int], detail: str) -> None:
    if len(values) != len(set(values)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def _validate_unique_labels(values: list[str], detail: str) -> None:
    normalized = [value.strip() for value in values]
    if len(normalized) != len(set(normalized)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def _show_polygon_response_from_model(polygon: ShowPolygon, zone_name: str | None = None) -> ShowPolygonResponse:
    return ShowPolygonResponse(
        id=polygon.id,
        show_id=polygon.show_id,
        zone_id=polygon.zone_id,
        zone_name=zone_name,
        label=polygon.label,
        points=polygon.points,
        created_at=polygon.created_at,
        updated_at=polygon.updated_at,
    )


async def _build_show_stats_response(session: AsyncSession, show: Show, event: Event | None = None) -> EventDetailStatsResponse:
    event = event or await session.get(Event, show.event_id)
    totals_row = (
        await session.execute(
            select(
                func.count(Seat.id).label("total_seats"),
                func.sum(case((Seat.status == SeatStatus.SOLD, 1), else_=0)).label("sold_seats"),
                func.sum(case((Seat.status == SeatStatus.LOCKED, 1), else_=0)).label("locked_seats"),
            ).where(Seat.show_id == show.id)
        )
    ).one()

    total_seats = int(totals_row.total_seats or 0)
    sold_seats = int(totals_row.sold_seats or 0)
    locked_seats = int(totals_row.locked_seats or 0)
    available_seats = max(total_seats - sold_seats - locked_seats, 0)
    occupancy_rate = round((sold_seats / total_seats) * 100, 2) if total_seats else 0

    ticket_count = int(
        (
            await session.scalar(
                select(func.count(Ticket.id))
                .join(OrderItem, Ticket.order_item_id == OrderItem.id)
                .join(Seat, OrderItem.seat_id == Seat.id)
                .where(Seat.show_id == show.id)
            )
        )
        or 0
    )

    total_revenue = float(
        (
            await session.scalar(
                select(func.sum(OrderItem.price))
                .join(Ticket, Ticket.order_item_id == OrderItem.id)
                .join(Seat, OrderItem.seat_id == Seat.id)
                .where(
                    Seat.show_id == show.id,
                    OrderItem.order.has(status=OrderStatus.PAID),
                )
            )
        )
        or 0
    )

    zone_rows = (
        await session.execute(
            select(
                SeatZone.id,
                SeatZone.name,
                func.count(Seat.id).label("total_seats"),
                func.sum(case((Seat.status == SeatStatus.SOLD, 1), else_=0)).label("sold_seats"),
                func.sum(case((Seat.status == SeatStatus.LOCKED, 1), else_=0)).label("locked_seats"),
                func.min(Seat.price).label("price_min"),
                func.max(Seat.price).label("price_max"),
            )
            .join(Seat, Seat.zone_id == SeatZone.id)
            .where(SeatZone.show_id == show.id)
            .group_by(SeatZone.id, SeatZone.name)
            .order_by(SeatZone.id.asc())
        )
    ).all()
    zone_stats = [
        EventZoneStatsResponse(
            zone_id=row.id,
            zone_name=row.name,
            total_seats=int(row.total_seats or 0),
            sold_seats=int(row.sold_seats or 0),
            locked_seats=int(row.locked_seats or 0),
            available_seats=max(int(row.total_seats or 0) - int(row.sold_seats or 0) - int(row.locked_seats or 0), 0),
            price_min=float(row.price_min or 0),
            price_max=float(row.price_max or 0),
        )
        for row in zone_rows
    ]

    return EventDetailStatsResponse(
        event_id=show.event_id,
        event_title=event.title if event else "",
        show_id=show.id,
        show_title=show.title,
        show_start_at=show.start_at.isoformat(),
        show_end_at=show.end_at.isoformat(),
        total_seats=total_seats,
        sold_seats=sold_seats,
        locked_seats=locked_seats,
        available_seats=available_seats,
        occupancy_rate=occupancy_rate,
        tickets_issued=ticket_count,
        total_revenue=total_revenue,
        zone_stats=zone_stats,
    )
