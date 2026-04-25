"""Seed helper for local development demo data."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.enums import EventStatus, Gender, UserRole
from app.models.event import Event
from app.models.user import User
from app.schemas.event import EventCreateRequest, SeatZoneCreate
from app.services.event_service import create_event_with_matrix


async def seed_demo_data(session: AsyncSession) -> None:
    """Populate admin/customer accounts and one live event if empty."""

    # Always ensure demo credentials exist using real domain names accepted by email validator.
    admin = await session.scalar(select(User).where(User.email == "admin@ticketrush.com"))
    if not admin:
        session.add(
            User(
                full_name="TicketRush Admin",
                email="admin@ticketrush.com",
                password_hash=hash_password("Admin@123"),
                role=UserRole.ADMIN,
                gender=Gender.OTHER,
                age=30,
            )
        )

    customer = await session.scalar(select(User).where(User.email == "customer@ticketrush.com"))
    if not customer:
        session.add(
            User(
                full_name="Demo Customer",
                email="customer@ticketrush.com",
                password_hash=hash_password("Customer@123"),
                role=UserRole.CUSTOMER,
                gender=Gender.FEMALE,
                age=24,
            )
        )

    if not admin or not customer:
        await session.commit()

    existing_events = await session.scalar(select(func.count(Event.id)))
    if int(existing_events or 0) > 0:
        return

    admin_user = await session.scalar(select(User).where(User.role == UserRole.ADMIN))
    if not admin_user:
        return

    payload = EventCreateRequest(
        title="Vanguard Music Festival 2026",
        description="Mega concert with flash-sale ticketing and real-time seat map.",
        category="Concert",
        venue="My Dinh National Stadium",
        start_at=datetime.now(UTC) + timedelta(days=20),
        end_at=datetime.now(UTC) + timedelta(days=20, hours=4),
        cover_image_url="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80",
        status=EventStatus.LIVE,
        hold_minutes=10,
        queue_enabled=True,
        queue_release_batch=50,
        max_active_queue_tokens=200,
        zones=[
            SeatZoneCreate(code="VIP", name="VIP Zone", row_count=8, seats_per_row=12, price=149.0, color="#024ddf"),
            SeatZoneCreate(code="A", name="Premium A", row_count=10, seats_per_row=15, price=99.0, color="#3569f9"),
            SeatZoneCreate(code="B", name="Standard B", row_count=12, seats_per_row=18, price=59.0, color="#799dd6"),
        ],
    )

    await create_event_with_matrix(session, admin_user.id, payload)
    await session.commit()
