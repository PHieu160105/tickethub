"""Shared async test fixtures."""

from collections.abc import AsyncGenerator
from datetime import UTC, datetime, time, timedelta

import pytest_asyncio
from redis.exceptions import RedisError
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.redis_client import get_redis_client
from app.core.security import hash_password
from app.models import Base
from app.models.enums import EventCategory, EventStatus, Gender, SeatStatus, UserRole
from app.models.event import Event, TicketTier, Show
from app.models.order import Ticket
from app.models.user import Customer, EventStaff, User
from app.schemas.event import EventCreateRequest, TicketTierCreate, ShowCreateRequest
from app.services.event_service import create_event, create_show_with_inventory
from app.services.queue_service import _memory_active_sessions, _runtime_queue


@pytest_asyncio.fixture(autouse=True)
async def clean_queue_runtime_state() -> AsyncGenerator[None, None]:
    _memory_active_sessions.clear()
    _runtime_queue.clear()
    try:
        redis = get_redis_client()
        keys = [key async for key in redis.scan_iter("queue:show:*")]
        if keys:
            await redis.delete(*keys)
    except RedisError:
        pass

    yield
    _memory_active_sessions.clear()
    _runtime_queue.clear()


@pytest_asyncio.fixture()
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)

    @event.listens_for(engine.sync_engine, "connect")
    def attach_ticket_rush_schema(dbapi_connection, _) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("ATTACH DATABASE ':memory:' AS ticket_rush")
        cursor.close()

    session_maker = async_sessionmaker(bind=engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with session_maker() as session:
        yield session

    await engine.dispose()


@pytest_asyncio.fixture()
async def admin_user(db_session: AsyncSession) -> User:
    admin = User(
        full_name="Admin",
        email="admin@test.local",
        password_hash=hash_password("Admin@123"),
        role=UserRole.EVENT_STAFF,
        gender=Gender.OTHER,
        age=30,
    )
    admin.event_staff_profile = EventStaff(staff_code="TEST-STAFF-001", is_active=True)
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)
    return admin


@pytest_asyncio.fixture()
async def customer_users(db_session: AsyncSession) -> tuple[User, User]:
    user1 = User(
        full_name="User One",
        email="u1@test.local",
        password_hash=hash_password("Pass@1234"),
        role=UserRole.CUSTOMER,
        gender=Gender.FEMALE,
        age=22,
    )
    user1.customer_profile = Customer()
    user2 = User(
        full_name="User Two",
        email="u2@test.local",
        password_hash=hash_password("Pass@1234"),
        role=UserRole.CUSTOMER,
        gender=Gender.MALE,
        age=28,
    )
    user2.customer_profile = Customer()
    db_session.add_all([user1, user2])
    await db_session.commit()
    await db_session.refresh(user1)
    await db_session.refresh(user2)
    return user1, user2


@pytest_asyncio.fixture()
async def sample_event_with_show(db_session: AsyncSession, admin_user: User) -> tuple[Event, Show]:
    show_date = (datetime.now(UTC) + timedelta(days=1)).date()
    event_payload = EventCreateRequest(
        title="Test Event",
        description="Event for testing seat lock and checkout lifecycle.",
        category=EventCategory.MUSIC,
        start_date=show_date,
        end_date=show_date,
        cover_image_url="",
        status=EventStatus.LIVE,
    )
    show_payload = ShowCreateRequest(
        title="Test Show",
        description="Show inventory used by backend test fixtures.",
        location="Test Venue",
        show_date=show_date,
        start_time=time(hour=19, minute=0),
        end_time=time(hour=21, minute=30),
        status=EventStatus.LIVE,
        hold_minutes=10,
        ticket_tiers=[TicketTierCreate(code="VIP", name="VIP", base_price=100.0, color="#024ddf")],
    )

    event = await create_event(db_session, admin_user.id, event_payload)
    show = await create_show_with_inventory(db_session, event, admin_user.id, show_payload)
    tier = await db_session.scalar(select(TicketTier).where(TicketTier.show_id == show.id))
    assert tier is not None
    for row_index, row_label in enumerate(("A", "B"), start=1):
        for seat_number in range(1, 4):
            db_session.add(
                Ticket(
                    show_id=show.id,
                    ticket_tier_id=tier.id,
                    label=f"{row_label}{seat_number}",
                    row_label=row_label,
                    seat_number=seat_number,
                    price=float(tier.base_price),
                    status=SeatStatus.AVAILABLE,
                    is_staff_locked=False,
                )
            )
    await db_session.commit()
    await db_session.refresh(event)
    await db_session.refresh(show)
    return event, show


@pytest_asyncio.fixture()
async def sample_event(sample_event_with_show: tuple[Event, Show]) -> Event:
    event, _ = sample_event_with_show
    return event


@pytest_asyncio.fixture()
async def sample_show(sample_event_with_show: tuple[Event, Show]) -> Show:
    _, show = sample_event_with_show
    return show
