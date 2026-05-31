"""Admin dashboard statistics backed by schema v2 ticket inventory."""

from collections import Counter
from datetime import datetime, timedelta, timezone

from sqlalchemy import case, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.sqltypes import Date

from app.core.db import AsyncSessionLocal
from app.models.enums import EventStatus, OrderStatus, SeatStatus
from app.models.event import Event, Show
from app.models.order import Order, Ticket
from app.models.user import User
from app.schemas.admin import AudienceDistributionResponse, DashboardStreamResponse, DashboardSummaryResponse, RevenuePoint
from app.schemas.event import EventOccupancyResponse
from app.services.queue_service import get_waiting_queue_user_count
from app.ws.connection_manager import admin_ws_manager


async def get_dashboard_summary(session: AsyncSession) -> DashboardSummaryResponse:
    summary_row = (
        await session.execute(
            select(
                select(func.coalesce(func.sum(Order.total_amount), 0))
                .where(Order.status == OrderStatus.PAID)
                .scalar_subquery()
                .label("total_revenue"),
                select(func.count(Ticket.id))
                .where(Ticket.status == SeatStatus.SOLD)
                .scalar_subquery()
                .label("tickets_sold"),
                select(func.count(Show.id))
                .where(Show.status == EventStatus.LIVE, Show.is_deleted.is_(False))
                .scalar_subquery()
                .label("active_events"),
            )
        )
    ).one()

    return DashboardSummaryResponse(
        total_revenue=float(summary_row.total_revenue or 0),
        tickets_sold=int(summary_row.tickets_sold or 0),
        active_events=int(summary_row.active_events or 0),
        waiting_queue_users=get_waiting_queue_user_count(),
    )


async def get_revenue_series(session: AsyncSession, days: int = 14) -> list[RevenuePoint]:
    end_date = datetime.now(timezone.utc).date()
    start_date = end_date - timedelta(days=days - 1)

    rows = (
        await session.execute(
            select(cast(Order.paid_at, Date).label("order_date"), func.coalesce(func.sum(Order.total_amount), 0).label("revenue"))
            .where(Order.paid_at.is_not(None), cast(Order.paid_at, Date) >= start_date)
            .group_by(cast(Order.paid_at, Date))
            .order_by(cast(Order.paid_at, Date).asc())
        )
    ).all()

    revenue_map = {str(row.order_date): float(row.revenue) for row in rows}

    points: list[RevenuePoint] = []
    cursor = start_date
    while cursor <= end_date:
        points.append(RevenuePoint(date=str(cursor), revenue=float(revenue_map.get(str(cursor), 0))))
        cursor += timedelta(days=1)

    return points


async def get_dashboard_occupancy(session: AsyncSession) -> list[EventOccupancyResponse]:
    rows = (
        await session.execute(
            select(
                Event.id.label("event_id"),
                Event.title.label("event_title"),
                Show.id.label("show_id"),
                Show.title.label("show_title"),
                Show.start_at.label("show_start_at"),
                Show.venue.label("venue"),
                func.count(Ticket.id).label("total_tickets"),
                func.sum(case((Ticket.status == SeatStatus.SOLD, 1), else_=0)).label("sold_tickets"),
                func.sum(case((Ticket.status == SeatStatus.LOCKED, 1), else_=0)).label("locked_tickets"),
            )
            .join(Show, Show.event_id == Event.id)
            .outerjoin(Ticket, Ticket.show_id == Show.id)
            .where(Event.is_deleted.is_(False), Show.is_deleted.is_(False))
            .group_by(Event.id, Event.title, Show.id, Show.title, Show.start_at, Show.venue)
            .order_by(Show.start_at.asc())
        )
    ).all()

    result: list[EventOccupancyResponse] = []
    for row in rows:
        total = int(row.total_tickets or 0)
        sold = int(row.sold_tickets or 0)
        locked = int(row.locked_tickets or 0)
        result.append(
            EventOccupancyResponse(
                event_id=row.event_id,
                event_title=row.event_title,
                show_id=row.show_id,
                show_title=row.show_title,
                show_start_at=row.show_start_at,
                venue=row.venue,
                total_seats=total,
                sold_seats=sold,
                locked_seats=locked,
                occupancy_rate=round((sold / total) * 100, 2) if total else 0,
            )
        )

    return result


async def get_dashboard_stream(session: AsyncSession) -> DashboardStreamResponse:
    return DashboardStreamResponse(
        summary=await get_dashboard_summary(session),
        revenue=await get_revenue_series(session, days=14),
        occupancy=await get_dashboard_occupancy(session),
    )


def dump_dashboard_stream(payload: DashboardStreamResponse) -> dict:
    return payload.model_dump(mode="json")


async def broadcast_dashboard_update() -> None:
    if not admin_ws_manager.has_clients():
        return

    async with AsyncSessionLocal() as session:
        payload = await get_dashboard_stream(session)
    await admin_ws_manager.broadcast(dump_dashboard_stream(payload))


async def get_audience_distribution(session: AsyncSession) -> AudienceDistributionResponse:
    rows = (
        await session.execute(
            select(User.age, User.gender, func.count(Order.id).label("orders_count"))
            .join(Order, Order.customer_id == User.id)
            .where(Order.status == OrderStatus.PAID)
            .group_by(User.age, User.gender)
        )
    ).all()

    age_counter: Counter[str] = Counter()
    gender_counter: Counter[str] = Counter()

    for age, gender, orders_count in rows:
        count = int(orders_count or 0)
        if age < 18:
            bucket = "<18"
        elif age <= 24:
            bucket = "18-24"
        elif age <= 34:
            bucket = "25-34"
        elif age <= 44:
            bucket = "35-44"
        else:
            bucket = "45+"

        age_counter[bucket] += count
        gender_counter[str(gender)] += count

    return AudienceDistributionResponse(age_groups=dict(age_counter), gender_groups=dict(gender_counter))
