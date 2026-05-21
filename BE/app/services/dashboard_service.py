"""Tính toán thống kê và dashboard cho admin."""

from collections import Counter
from datetime import UTC, datetime, timedelta

from sqlalchemy import case, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.sqltypes import Date

from app.core.db import AsyncSessionLocal
from app.models.enums import EventStatus, OrderStatus, QueueStatus, SeatStatus
from app.models.event import Event, Show
from app.models.order import Order, OrderItem
from app.models.queue import QueueEntry
from app.models.seat import Seat
from app.models.user import User
from app.schemas.admin import AudienceDistributionResponse, DashboardStreamResponse, DashboardSummaryResponse, RevenuePoint
from app.schemas.event import EventOccupancyResponse
from app.ws.connection_manager import admin_ws_manager


async def get_dashboard_summary(session: AsyncSession) -> DashboardSummaryResponse:
    """Trả các KPI tổng quan trên dashboard admin.

    Input:
    - `session`: phiên SQLAlchemy async dùng để đọc dữ liệu thống kê.

    Output:
    - `DashboardSummaryResponse` gồm doanh thu, số vé bán, số show live và số user đang chờ queue.

    Cách hoạt động:
    - Dùng các scalar subquery độc lập trong một câu select để giảm số round-trip tới DB.
    - Chỉ cộng doanh thu từ đơn đã `PAID`.
    - Chỉ tính show active khi show còn live và chưa bị soft-delete.
    """

    # Mỗi subquery tính một KPI riêng; gom trong một SELECT để database trả về đúng một dòng tổng hợp.
    summary_row = (
        await session.execute(
            select(
                # Tổng doanh thu chỉ lấy đơn đã thanh toán để không tính nhầm đơn đang giữ ghế.
                select(func.coalesce(func.sum(Order.total_amount), 0))
                .where(Order.status == OrderStatus.PAID)
                .scalar_subquery()
                .label("total_revenue"),
                # Mỗi `OrderItem` tương ứng một ghế/vé đã đi vào đơn hàng.
                select(func.count(OrderItem.id)).scalar_subquery().label("tickets_sold"),
                # Show active là show đang live và chưa bị soft-delete.
                select(func.count(Show.id))
                .where(Show.status == EventStatus.LIVE, Show.is_deleted.is_(False))
                .scalar_subquery()
                .label("active_events"),
                # Chỉ đếm queue của show thật; bỏ qua bản ghi cũ chưa gắn show_id.
                select(func.count(QueueEntry.id))
                .where(QueueEntry.status == QueueStatus.WAITING, QueueEntry.show_id.is_not(None))
                .scalar_subquery()
                .label("waiting_queue_users"),
            )
        )
    ).one()

    # Ép kiểu rõ ràng để schema trả JSON ổn định cho frontend, tránh Decimal/None lọt ra response.
    return DashboardSummaryResponse(
        total_revenue=float(summary_row.total_revenue or 0),
        tickets_sold=int(summary_row.tickets_sold or 0),
        active_events=int(summary_row.active_events or 0),
        waiting_queue_users=int(summary_row.waiting_queue_users or 0),
    )


async def get_revenue_series(session: AsyncSession, days: int = 14) -> list[RevenuePoint]:
    """Tổng hợp doanh thu đã thanh toán theo ngày để vẽ biểu đồ.

    Input:
    - `session`: phiên DB async.
    - `days`: số ngày gần nhất cần dựng chuỗi doanh thu, mặc định 14 ngày.

    Output:
    - Danh sách `RevenuePoint`; mỗi phần tử có `date` và `revenue`.

    Cách hoạt động:
    - Query tổng doanh thu theo ngày từ các order đã có `paid_at`.
    - Sau đó lấp các ngày không có doanh thu bằng giá trị `0` để biểu đồ không bị đứt đoạn.
    """

    # Biểu đồ lấy đến ngày hiện tại theo UTC; dữ liệu trong database cũng dùng timestamp có timezone.
    end_date = datetime.now(UTC).date()

    # Nếu `days=14`, start date là ngày đầu tiên trong 14 mốc liên tiếp.
    start_date = end_date - timedelta(days=days - 1)

    # Query chỉ trả những ngày có doanh thu; các ngày trống sẽ được lấp bằng 0 ở bước sau.
    rows = (
        await session.execute(
            select(cast(Order.paid_at, Date).label("order_date"), func.coalesce(func.sum(Order.total_amount), 0).label("revenue"))
            .where(Order.paid_at.is_not(None), cast(Order.paid_at, Date) >= start_date)
            .group_by(cast(Order.paid_at, Date))
            .order_by(cast(Order.paid_at, Date).asc())
        )
    ).all()

    # Map theo chuỗi ngày giúp tra nhanh doanh thu khi dựng đủ timeline từng ngày.
    revenue_map = {str(row.order_date): float(row.revenue) for row in rows}

    points: list[RevenuePoint] = []
    cursor = start_date
    while cursor <= end_date:
        # Ngày không có đơn thanh toán vẫn cần điểm 0 để chart không bị mất cột/mất đoạn.
        points.append(RevenuePoint(date=str(cursor), revenue=float(revenue_map.get(str(cursor), 0))))
        cursor += timedelta(days=1)

    return points


async def get_dashboard_occupancy(session: AsyncSession) -> list[EventOccupancyResponse]:
    """Trả snapshot lấp đầy ghế của từng buổi diễn cho dashboard admin."""

    rows = (
        await session.execute(
            select(
                Event.id.label("event_id"),
                Event.title.label("event_title"),
                Show.id.label("show_id"),
                Show.title.label("show_title"),
                Show.start_at.label("show_start_at"),
                Show.venue.label("venue"),
                func.count(Seat.id).label("total_seats"),
                func.sum(case((Seat.status == SeatStatus.SOLD, 1), else_=0)).label("sold_seats"),
                func.sum(case((Seat.status == SeatStatus.LOCKED, 1), else_=0)).label("locked_seats"),
            )
            .join(Show, Show.event_id == Event.id)
            .outerjoin(Seat, Seat.show_id == Show.id)
            .where(Event.is_deleted.is_(False), Show.is_deleted.is_(False))
            .group_by(Event.id, Event.title, Show.id, Show.title, Show.start_at, Show.venue)
            .order_by(Show.start_at.asc())
        )
    ).all()

    result: list[EventOccupancyResponse] = []
    for row in rows:
        total = int(row.total_seats or 0)
        sold = int(row.sold_seats or 0)
        locked = int(row.locked_seats or 0)
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
    """Build payload realtime đầy đủ cho dashboard admin."""

    return DashboardStreamResponse(
        summary=await get_dashboard_summary(session),
        revenue=await get_revenue_series(session, days=14),
        occupancy=await get_dashboard_occupancy(session),
    )


async def broadcast_dashboard_update() -> None:
    """Đọc snapshot dashboard mới nhất sau commit rồi push tới admin đang online."""

    if not admin_ws_manager.has_clients():
        return

    async with AsyncSessionLocal() as session:
        payload = await get_dashboard_stream(session)
    await admin_ws_manager.broadcast(payload.model_dump())


async def get_audience_distribution(session: AsyncSession) -> AudienceDistributionResponse:
    """Nhóm người mua theo độ tuổi và giới tính.

    Input:
    - `session`: phiên DB async.

    Output:
    - `AudienceDistributionResponse` gồm hai map: nhóm tuổi và giới tính.

    Cách hoạt động:
    - Join `users` với `orders` đã thanh toán.
    - Gom người mua vào các bucket tuổi cố định để frontend vẽ biểu đồ ổn định.
    """

    # Mỗi dòng kết quả là một nhóm tuổi/giới tính kèm số đơn đã thanh toán.
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
        # `orders_count` có thể là Decimal/int tùy driver, ép int để Counter cộng ổn định.
        count = int(orders_count or 0)

        # Các bucket cố định giúp frontend vẽ biểu đồ nhất quán dù dữ liệu tuổi rất phân tán.
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
        # Enum giới tính được stringify để response JSON chỉ còn key dạng chuỗi.
        gender_counter[str(gender)] += count

    return AudienceDistributionResponse(age_groups=dict(age_counter), gender_groups=dict(gender_counter))
