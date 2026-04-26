"""Admin analytics computations."""

from collections import Counter
from datetime import UTC, datetime, timedelta

from sqlalchemy import cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.sqltypes import Date

from app.models.enums import EventStatus, OrderStatus, QueueStatus
from app.models.event import Event
from app.models.order import Order, OrderItem, TicketCancellation
from app.models.queue import QueueEntry
from app.models.user import User
from app.schemas.admin import AudienceDistributionResponse, DashboardSummaryResponse, RevenuePoint


async def get_dashboard_summary(session: AsyncSession) -> DashboardSummaryResponse:
    """Return headline dashboard metrics."""

    summary_row = (
        await session.execute(
            select(
                select(func.coalesce(func.sum(Order.total_amount), 0))
                .where(Order.status == OrderStatus.PAID)
                .scalar_subquery()
                .label("total_revenue"),
                select(func.count(OrderItem.id)).scalar_subquery().label("tickets_sold"),
                select(func.count(TicketCancellation.id)).scalar_subquery().label("cancelled_tickets"),
                select(func.count(Event.id))
                .where(Event.status == EventStatus.LIVE, Event.is_deleted.is_(False))
                .scalar_subquery()
                .label("active_events"),
                select(func.count(QueueEntry.id))
                .where(QueueEntry.status == QueueStatus.WAITING)
                .scalar_subquery()
                .label("waiting_queue_users"),
            )
        )
    ).one()

    return DashboardSummaryResponse(
        total_revenue=float(summary_row.total_revenue or 0),
        tickets_sold=int(summary_row.tickets_sold or 0),
        cancelled_tickets=int(summary_row.cancelled_tickets or 0),
        active_events=int(summary_row.active_events or 0),
        waiting_queue_users=int(summary_row.waiting_queue_users or 0),
    )


async def get_revenue_series(session: AsyncSession, days: int = 14) -> list[RevenuePoint]:
    """Aggregate paid revenue by date for chart widgets."""

    end_date = datetime.now(UTC).date()
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


async def get_audience_distribution(session: AsyncSession) -> AudienceDistributionResponse:
    """Group buyers by age buckets and gender."""

    rows = (
        await session.execute(
            select(User.age, User.gender, func.count(Order.id).label("orders_count"))
            .join(Order, Order.user_id == User.id)
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
