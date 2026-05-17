"""Tiện ích seed dữ liệu demo cho môi trường phát triển local."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.enums import EventStatus, Gender, UserRole
from app.models.event import Event
from app.models.user import User
from app.schemas.event import EventCreateRequest, SeatZoneCreate, ShowCreateRequest
from app.services.event_service import create_event, create_show_with_inventory


async def seed_demo_data(session: AsyncSession) -> None:
    """Tạo tài khoản admin/customer demo và một sự kiện đang mở nếu database còn trống."""

    # Luôn đảm bảo tài khoản demo tồn tại với domain hợp lệ để email validator chấp nhận.
    admin = await session.scalar(select(User).where(User.email == "admin@ticketrush.com"))
    if not admin:
        admin = User(
            full_name="Quản trị TicketRush",
            email="admin@ticketrush.com",
            role=UserRole.ADMIN,
            gender=Gender.OTHER,
            age=30,
        )
        session.add(admin)
    admin.full_name = "Quản trị TicketRush"
    admin.password_hash = hash_password("Admin@123")
    admin.role = UserRole.ADMIN
    admin.gender = Gender.OTHER
    admin.age = 30

    customer = await session.scalar(select(User).where(User.email == "customer@ticketrush.com"))
    if not customer:
        customer = User(
            full_name="Khách hàng demo",
            email="customer@ticketrush.com",
            role=UserRole.CUSTOMER,
            gender=Gender.FEMALE,
            age=24,
        )
        session.add(customer)
    customer.full_name = "Khách hàng demo"
    customer.password_hash = hash_password("Customer@123")
    customer.role = UserRole.CUSTOMER
    customer.gender = Gender.FEMALE
    customer.age = 24

    await session.commit()

    existing_events = await session.scalar(select(func.count(Event.id)))
    if int(existing_events or 0) > 0:
        return

    admin_user = await session.scalar(select(User).where(User.role == UserRole.ADMIN))
    if not admin_user:
        return

    event_payload = EventCreateRequest(
        title="Lễ hội âm nhạc Vanguard 2026",
        description="Đại nhạc hội có bán vé flash-sale, hàng đợi ảo và sơ đồ ghế thời gian thực.",
        category="Âm nhạc",
        start_date=(datetime.now(UTC) + timedelta(days=20)).date(),
        end_date=(datetime.now(UTC) + timedelta(days=20)).date(),
        cover_image_url="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80",
        status=EventStatus.LIVE,
    )

    event = await create_event(session, admin_user.id, event_payload)

    show_payload = ShowCreateRequest(
        title="Đêm diễn chính ngày 1",
        description="Đại nhạc hội có bán vé flash-sale, hàng đợi ảo và sơ đồ ghế thời gian thực.",
        venue="Sân vận động Quốc gia Mỹ Đình",
        show_date=(datetime.now(UTC) + timedelta(days=20)).date(),
        start_time=(datetime.now(UTC) + timedelta(days=20)).time().replace(hour=19, minute=0, second=0, microsecond=0),
        end_time=(datetime.now(UTC) + timedelta(days=20)).time().replace(hour=23, minute=0, second=0, microsecond=0),
        status=EventStatus.LIVE,
        hold_minutes=10,
        queue_enabled=True,
        queue_release_batch=50,
        max_active_queue_tokens=200,
        zones=[
            SeatZoneCreate(code="VIP", name="Khu VIP", row_count=8, seats_per_row=12, price=1_490_000, color="#024ddf"),
            SeatZoneCreate(code="A", name="Khu cao cấp A", row_count=10, seats_per_row=15, price=990_000, color="#3569f9"),
            SeatZoneCreate(code="B", name="Khu tiêu chuẩn B", row_count=12, seats_per_row=18, price=590_000, color="#799dd6"),
        ],
    )

    await create_show_with_inventory(session, event, admin_user.id, show_payload)
    await session.commit()
