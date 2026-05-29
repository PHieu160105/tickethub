"""Utilities to seed local demo data."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.enums import EventCategory, EventStatus, Gender, UserRole
from app.models.event import Event
from app.models.user import User
from app.schemas.event import EventCreateRequest, SeatZoneCreate, ShowCreateRequest
from app.services.event_lifecycle_service import create_event, create_show_with_inventory


async def seed_demo_data(session: AsyncSession) -> None:
    """Create demo admin/customer accounts and one live event for local development."""

    admin = await session.scalar(select(User).where(User.email == "admin@ticketrush.com"))
    if not admin:
        admin = User(
            full_name="Quan tri TicketRush",
            email="admin@ticketrush.com",
            role=UserRole.ADMIN,
            gender=Gender.OTHER,
            age=30,
        )
        session.add(admin)
    admin.full_name = "Quan tri TicketRush"
    admin.password_hash = hash_password("Admin@123")
    admin.role = UserRole.ADMIN
    admin.gender = Gender.OTHER
    admin.age = 30

    customer = await session.scalar(select(User).where(User.email == "customer@ticketrush.com"))
    if not customer:
        customer = User(
            full_name="Khach hang demo",
            email="customer@ticketrush.com",
            role=UserRole.CUSTOMER,
            gender=Gender.FEMALE,
            age=24,
        )
        session.add(customer)
    customer.full_name = "Khach hang demo"
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
        title="Le hoi am nhac Vanguard 2026",
        description="Dai nhac hoi co ban ve flash-sale, hang doi ao va so do ghe thoi gian thuc.",
        category=EventCategory.MUSIC,
        start_date=(datetime.now(timezone.utc) + timedelta(days=20)).date(),
        end_date=(datetime.now(timezone.utc) + timedelta(days=20)).date(),
        cover_image_url="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80",
        status=EventStatus.LIVE,
    )

    event = await create_event(session, admin_user.id, event_payload)

    show_payload = ShowCreateRequest(
        title="Dem dien chinh ngay 1",
        description="Dai nhac hoi co ban ve flash-sale, hang doi ao va so do ghe thoi gian thuc.",
        location="San van dong Quoc gia My Dinh",
        show_date=(datetime.now(timezone.utc) + timedelta(days=20)).date(),
        start_time=(datetime.now(timezone.utc) + timedelta(days=20)).time().replace(hour=19, minute=0, second=0, microsecond=0),
        end_time=(datetime.now(timezone.utc) + timedelta(days=20)).time().replace(hour=23, minute=0, second=0, microsecond=0),
        status=EventStatus.LIVE,
        hold_minutes=10,
        zones=[
            SeatZoneCreate(code="VIP", name="Khu VIP", row_count=8, seats_per_row=12, price=1_490_000, color="#024ddf"),
            SeatZoneCreate(code="A", name="Khu cao cap A", row_count=10, seats_per_row=15, price=990_000, color="#3569f9"),
            SeatZoneCreate(code="B", name="Khu tieu chuan B", row_count=12, seats_per_row=18, price=590_000, color="#799dd6"),
        ],
    )

    await create_show_with_inventory(session, event, admin_user.id, show_payload)
    await session.commit()
