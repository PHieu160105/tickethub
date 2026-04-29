"""Pytest fixtures for async database-backed service tests."""

from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import sqlalchemy as sa

from app.core.security import hash_password
from app.models import Base
from app.models.enums import EventStatus, Gender, UserRole
from app.models.user import User
from app.schemas.event import EventCreateRequest, SeatZoneCreate
from app.services.event_service import create_event_with_matrix


@pytest_asyncio.fixture()
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Create isolated sqlite database per test."""

    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    session_maker = async_sessionmaker(bind=engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.execute(sa.text("ATTACH DATABASE ':memory:' AS ticket_rush"))
        await conn.run_sync(Base.metadata.create_all)

    async with session_maker() as session:
        yield session

    await engine.dispose()


@pytest_asyncio.fixture()
async def admin_user(db_session: AsyncSession) -> User:
    """Persist one admin account for tests."""

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
    """Persist two customer accounts for seat lock race-path tests."""

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
async def sample_event(db_session: AsyncSession, admin_user: User):
    """Create event with one zone and deterministic small seat matrix."""

    payload = EventCreateRequest(
        title="Test Event",
        description="Event for testing seat lock and checkout lifecycle.",
        category="Concert",
        venue="Test Venue",
        start_at=datetime.now(UTC) + timedelta(days=1),
        end_at=datetime.now(UTC) + timedelta(days=1, hours=3),
        cover_image_url="",
        status=EventStatus.LIVE,
        hold_minutes=10,
        queue_enabled=False,
        queue_release_batch=50,
        max_active_queue_tokens=100,
        zones=[SeatZoneCreate(code="VIP", name="VIP", row_count=2, seats_per_row=3, price=100.0, color="#024ddf")],
    )

    event = await create_event_with_matrix(db_session, admin_user.id, payload)
    await db_session.commit()
    await db_session.refresh(event)
    return event
