"""Booking lifecycle tests: lock -> checkout -> ticket."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import OrderStatus, SeatStatus
from app.models.seat import Seat
from app.services.booking_service import cancel_ticket, checkout_locked_seats, fetch_my_tickets, lock_seats, release_expired_locks


@pytest.mark.asyncio
async def test_seat_lock_prevents_second_user(
    db_session: AsyncSession,
    sample_event,
    customer_users,
):
    """First customer gets lock; second customer gets rejected for same seat."""

    user1, user2 = customer_users
    seat = await db_session.scalar(select(Seat).where(Seat.event_id == sample_event.id).order_by(Seat.id.asc()))
    assert seat is not None

    first_result = await lock_seats(db_session, user_id=user1.id, event_id=sample_event.id, seat_ids=[seat.id], queue_token=None)
    second_result = await lock_seats(db_session, user_id=user2.id, event_id=sample_event.id, seat_ids=[seat.id], queue_token=None)

    assert first_result.locked_seat_ids == [seat.id]
    assert second_result.locked_seat_ids == []
    assert seat.id in second_result.failed_seat_ids


@pytest.mark.asyncio
async def test_checkout_marks_seat_sold_and_generates_ticket(
    db_session: AsyncSession,
    sample_event,
    customer_users,
):
    """Checkout transitions locked seats to sold and returns ticket data."""

    user1, _ = customer_users
    seat = await db_session.scalar(select(Seat).where(Seat.event_id == sample_event.id).order_by(Seat.id.asc()))
    assert seat is not None

    await lock_seats(db_session, user_id=user1.id, event_id=sample_event.id, seat_ids=[seat.id], queue_token=None)
    checkout = await checkout_locked_seats(db_session, user_id=user1.id, event_id=sample_event.id, queue_token=None)

    assert checkout.order_status == OrderStatus.PAID
    assert len(checkout.items) == 1
    assert checkout.items[0].seat_id == seat.id
    assert checkout.items[0].ticket_code.startswith("TR-")

    refreshed_seat = await db_session.scalar(select(Seat).where(Seat.id == seat.id))
    assert refreshed_seat is not None
    assert refreshed_seat.status == SeatStatus.SOLD


@pytest.mark.asyncio
async def test_expired_lock_worker_releases_seat(
    db_session: AsyncSession,
    sample_event,
    customer_users,
):
    """Background worker should release outdated locks."""

    user1, _ = customer_users
    seat = await db_session.scalar(select(Seat).where(Seat.event_id == sample_event.id).order_by(Seat.id.asc()))
    assert seat is not None

    await lock_seats(db_session, user_id=user1.id, event_id=sample_event.id, seat_ids=[seat.id], queue_token=None)

    seat.lock_expires_at = datetime.now(UTC) - timedelta(minutes=1)
    await db_session.commit()

    released = await release_expired_locks(db_session)
    assert sample_event.id in released

    refreshed_seat = await db_session.scalar(select(Seat).where(Seat.id == seat.id))
    assert refreshed_seat is not None
    assert refreshed_seat.status == SeatStatus.AVAILABLE


@pytest.mark.asyncio
async def test_user_can_cancel_ticket_and_release_sold_seat(
    db_session: AsyncSession,
    sample_event,
    customer_users,
):
    """Customer deletes one ticket and seat returns to available inventory."""

    user1, _ = customer_users
    seat = await db_session.scalar(select(Seat).where(Seat.event_id == sample_event.id).order_by(Seat.id.asc()))
    assert seat is not None

    await lock_seats(db_session, user_id=user1.id, event_id=sample_event.id, seat_ids=[seat.id], queue_token=None)
    checkout = await checkout_locked_seats(db_session, user_id=user1.id, event_id=sample_event.id, queue_token=None)
    ticket_id = (await fetch_my_tickets(db_session, user_id=user1.id))[0].ticket_id

    await cancel_ticket(db_session, user_id=user1.id, ticket_id=ticket_id)

    refreshed_seat = await db_session.scalar(select(Seat).where(Seat.id == seat.id))
    assert refreshed_seat is not None
    assert refreshed_seat.status == SeatStatus.AVAILABLE
    assert await fetch_my_tickets(db_session, user_id=user1.id) == []
    assert checkout.items[0].ticket_code.startswith("TR-")


@pytest.mark.asyncio
async def test_my_ticket_search_supports_code_event_and_time(
    db_session: AsyncSession,
    sample_event,
    customer_users,
):
    """Ticket list supports searching by ticket code, event title and time range."""

    user1, _ = customer_users
    seat = await db_session.scalar(select(Seat).where(Seat.event_id == sample_event.id).order_by(Seat.id.asc()))
    assert seat is not None

    await lock_seats(db_session, user_id=user1.id, event_id=sample_event.id, seat_ids=[seat.id], queue_token=None)
    await checkout_locked_seats(db_session, user_id=user1.id, event_id=sample_event.id, queue_token=None)

    all_tickets = await fetch_my_tickets(db_session, user_id=user1.id)
    assert len(all_tickets) == 1
    first = all_tickets[0]

    by_code = await fetch_my_tickets(db_session, user_id=user1.id, search=first.ticket_code)
    assert len(by_code) == 1

    by_event = await fetch_my_tickets(db_session, user_id=user1.id, search=sample_event.title)
    assert len(by_event) == 1

    before_event = await fetch_my_tickets(
        db_session,
        user_id=user1.id,
        end_to=sample_event.start_at - timedelta(days=5),
    )
    assert before_event == []
