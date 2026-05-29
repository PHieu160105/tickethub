"""Fixture pytest cho các kiểm thử dịch vụ bất đồng bộ có dùng cơ sở dữ liệu."""

from collections.abc import AsyncGenerator
from datetime import UTC, datetime, time, timedelta

import pytest
import pytest_asyncio
from redis.exceptions import RedisError
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import sqlalchemy as sa

from app.core.redis_client import get_redis_client
from app.core.security import hash_password
from app.models import Base
from app.models.enums import EventCategory, EventStatus, Gender, UserRole
from app.models.user import User
from app.models.event import Event, Show
from app.schemas.event import EventCreateRequest, SeatZoneCreate, ShowCreateRequest
from app.services.event_service import create_event, create_show_with_inventory
from app.services.queue_service import _memory_active_sessions


@pytest_asyncio.fixture(autouse=True)
async def clean_queue_runtime_state() -> AsyncGenerator[None, None]:
    """Dọn trạng thái Redis/memory của hàng đợi để mỗi test chạy độc lập."""

    _memory_active_sessions.clear()
    try:
        redis = get_redis_client()
        keys = [key async for key in redis.scan_iter("queue:show:*")]
        if keys:
            await redis.delete(*keys)
    except RedisError:
        pass

    yield

    _memory_active_sessions.clear()


@pytest_asyncio.fixture()
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Tạo cơ sở dữ liệu SQLite cô lập cho từng test."""

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
    """Tạo sẵn một tài khoản admin cho test."""

    admin = User(
        full_name="Admin",
        email="admin@test.local",
        password_hash=hash_password("Admin@123"),
        role=UserRole.ADMIN,
        gender=Gender.OTHER,
        age=30,
    )
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)
    return admin


@pytest_asyncio.fixture()
async def customer_users(db_session: AsyncSession) -> tuple[User, User]:
    """Tạo sẵn hai tài khoản khách hàng để kiểm thử tranh chấp giữ ghế."""

    user1 = User(
        full_name="User One",
        email="u1@test.local",
        password_hash=hash_password("Pass@1234"),
        role=UserRole.CUSTOMER,
        gender=Gender.FEMALE,
        age=22,
    )
    user2 = User(
        full_name="User Two",
        email="u2@test.local",
        password_hash=hash_password("Pass@1234"),
        role=UserRole.CUSTOMER,
        gender=Gender.MALE,
        age=28,
    )
    db_session.add_all([user1, user2])
    await db_session.commit()
    await db_session.refresh(user1)
    await db_session.refresh(user2)
    return user1, user2


@pytest_asyncio.fixture()
async def sample_event_with_show(db_session: AsyncSession, admin_user: User) -> tuple[Event, Show]:
    """Tạo một sự kiện cha và một buổi diễn bán vé với ma trận ghế nhỏ."""

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
        zones=[SeatZoneCreate(code="VIP", name="VIP", row_count=2, seats_per_row=3, price=100.0, color="#024ddf")],
    )

    event = await create_event(db_session, admin_user.id, event_payload)
    show = await create_show_with_inventory(db_session, event, admin_user.id, show_payload)
    await db_session.commit()
    await db_session.refresh(event)
    await db_session.refresh(show)
    return event, show


@pytest_asyncio.fixture()
async def sample_event(sample_event_with_show: tuple[Event, Show]) -> Event:
    """Trả fixture sự kiện cha cho test chỉ cần thông tin mô tả sự kiện."""

    event, _ = sample_event_with_show
    return event


@pytest_asyncio.fixture()
async def sample_show(sample_event_with_show: tuple[Event, Show]) -> Show:
    """Trả fixture buổi diễn bán vé cho test đặt vé và hàng đợi."""

    _, show = sample_event_with_show
    return show
