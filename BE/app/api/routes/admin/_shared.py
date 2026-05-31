from fastapi import HTTPException, status
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import EVENT_DETAIL_CACHE_NAMESPACE, EVENT_LIST_CACHE_NAMESPACE, SHOW_DETAIL_CACHE_NAMESPACE, public_api_cache, show_seat_cache_namespace
from app.models.enums import EventStatus, OrderStatus, SeatStatus
from app.models.event import Event, SeatZone, Show
from app.models.order import Order, Ticket
from app.schemas.admin import EventDetailStatsResponse, EventZoneStatsResponse
from app.services.event_query_service import get_event_by_slug_or_id, get_show_by_id
from app.services.queue_service import expire_active_show_queue_entries


async def _invalidate_show_cache(show_id: int) -> None:
    await public_api_cache.invalidate_namespace(show_seat_cache_namespace(show_id))
    await public_api_cache.invalidate_namespace(SHOW_DETAIL_CACHE_NAMESPACE)
    await public_api_cache.invalidate_namespace(EVENT_LIST_CACHE_NAMESPACE)
    await public_api_cache.invalidate_namespace(EVENT_DETAIL_CACHE_NAMESPACE)


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
    normalized = [value.strip().lower() for value in values]
    if len(normalized) != len(set(normalized)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


async def _interrupt_active_show_sessions(session: AsyncSession, show: Show) -> tuple[list[dict[str, int | str | None]], int]:
    locked_tickets = list(
        await session.scalars(
            select(Ticket)
            .where(
                Ticket.show_id == show.id,
                Ticket.status == SeatStatus.LOCKED,
                Ticket.locked_by_customer_id.is_not(None),
            )
            .order_by(Ticket.id.asc())
            .with_for_update()
        )
    )
    changed_seats: list[dict[str, int | str | None]] = []
    for ticket in locked_tickets:
        ticket.status = SeatStatus.AVAILABLE
        ticket.locked_by_customer_id = None
        ticket.lock_expires_at = None
        changed_seats.append(
            {
                "id": ticket.id,
                "status": SeatStatus.AVAILABLE.value,
                "lock_expires_at": None,
                "locked_by_user_id": None,
            }
        )

    expired_queue_count = await expire_active_show_queue_entries(show.id)
    return changed_seats, expired_queue_count


async def _build_show_stats_response(session: AsyncSession, show: Show, event: Event | None = None) -> EventDetailStatsResponse:
    event = event or await session.get(Event, show.event_id)
    totals_row = (
        await session.execute(
            select(
                func.count(Ticket.id).label("total_seats"),
                func.sum(case((Ticket.status == SeatStatus.SOLD, 1), else_=0)).label("sold_seats"),
                func.sum(case((Ticket.status == SeatStatus.LOCKED, 1), else_=0)).label("locked_seats"),
            ).where(Ticket.show_id == show.id)
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
                select(func.count(Ticket.id)).where(
                    Ticket.show_id == show.id,
                    Ticket.status == SeatStatus.SOLD,
                )
            )
        )
        or 0
    )

    total_revenue = float(
        (
            await session.scalar(
                select(func.sum(Ticket.price))
                .join(Order, Ticket.order_id == Order.id)
                .where(
                    Ticket.show_id == show.id,
                    Order.status == OrderStatus.PAID,
                )
            )
        )
        or 0
    )

    zone_rows = (
        await session.execute(
            select(
                SeatZone.id,
                SeatZone.code,
                SeatZone.name,
                SeatZone.color,
                func.count(Ticket.id).label("total_seats"),
                func.sum(case((Ticket.status == SeatStatus.SOLD, 1), else_=0)).label("sold_seats"),
                func.sum(case((Ticket.status == SeatStatus.LOCKED, 1), else_=0)).label("locked_seats"),
                func.min(Ticket.price).label("price_min"),
                func.max(Ticket.price).label("price_max"),
            )
            .outerjoin(Ticket, Ticket.ticket_tier_id == SeatZone.id)
            .where(SeatZone.show_id == show.id)
            .group_by(SeatZone.id, SeatZone.code, SeatZone.name, SeatZone.color)
            .order_by(SeatZone.id.asc())
        )
    ).all()
    zone_stats = [
        EventZoneStatsResponse(
            zone_id=row.id,
            zone_code=row.code,
            zone_name=row.name,
            color=row.color,
            total_seats=int(row.total_seats or 0),
            sold_seats=int(row.sold_seats or 0),
            locked_seats=int(row.locked_seats or 0),
            available_seats=max(int(row.total_seats or 0) - int(row.sold_seats or 0) - int(row.locked_seats or 0), 0),
            occupancy_rate=round((int(row.sold_seats or 0) / int(row.total_seats or 0)) * 100, 2) if int(row.total_seats or 0) else 0,
            min_price=float(row.price_min or 0),
            max_price=float(row.price_max or 0),
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
