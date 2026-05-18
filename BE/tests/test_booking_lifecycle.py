"""Kiểm thử vòng đời đặt vé: giữ ghế, thanh toán, phát hành vé và mở khóa."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import OrderStatus, SeatStatus
from app.models.seat import Seat
from app.services.booking_service import checkout_locked_seats, fetch_my_tickets, lock_seats, release_expired_locks


@pytest.mark.asyncio
async def test_seat_lock_prevents_second_user(
    db_session: AsyncSession,
    sample_show,
    customer_users,
):
    """Khách thứ nhất giữ ghế thành công thì khách thứ hai bị từ chối trên cùng ghế."""

    user1, user2 = customer_users
    seat = await db_session.scalar(select(Seat).where(Seat.show_id == sample_show.id).order_by(Seat.id.asc()))
    assert seat is not None

    first_result = await lock_seats(db_session, user_id=user1.id, show_id=sample_show.id, seat_ids=[seat.id], queue_token=None)
    second_result = await lock_seats(db_session, user_id=user2.id, show_id=sample_show.id, seat_ids=[seat.id], queue_token=None)

    assert first_result.locked_seat_ids == [seat.id]
    assert second_result.locked_seat_ids == []
    assert seat.id in second_result.failed_seat_ids


@pytest.mark.asyncio
async def test_locked_seat_without_expiry_still_blocks_other_user(
    db_session: AsyncSession,
    sample_show,
    customer_users,
):
    """Ghế đang khóa bởi người khác nhưng thiếu hạn khóa vẫn không được cấp cho user mới."""

    user1, user2 = customer_users
    seat = await db_session.scalar(select(Seat).where(Seat.show_id == sample_show.id).order_by(Seat.id.asc()))
    assert seat is not None

    seat.status = SeatStatus.LOCKED
    seat.locked_by_user_id = user2.id
    seat.lock_expires_at = None
    await db_session.commit()

    result = await lock_seats(db_session, user_id=user1.id, show_id=sample_show.id, seat_ids=[seat.id], queue_token=None)

    assert result.locked_seat_ids == []
    assert result.failed_seat_ids == [seat.id]


@pytest.mark.asyncio
async def test_checkout_marks_seat_sold_and_generates_ticket(
    db_session: AsyncSession,
    sample_show,
    customer_users,
):
    """Thanh toán chuyển ghế đang giữ sang đã bán và trả dữ liệu vé điện tử."""

    user1, _ = customer_users
    seat = await db_session.scalar(select(Seat).where(Seat.show_id == sample_show.id).order_by(Seat.id.asc()))
    assert seat is not None

    await lock_seats(db_session, user_id=user1.id, show_id=sample_show.id, seat_ids=[seat.id], queue_token=None)
    checkout = await checkout_locked_seats(db_session, user_id=user1.id, show_id=sample_show.id, queue_token=None)

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
    sample_show,
    customer_users,
):
    """Worker nền phải mở khóa các ghế đã hết hạn giữ."""

    user1, _ = customer_users
    seat = await db_session.scalar(select(Seat).where(Seat.show_id == sample_show.id).order_by(Seat.id.asc()))
    assert seat is not None

    await lock_seats(db_session, user_id=user1.id, show_id=sample_show.id, seat_ids=[seat.id], queue_token=None)

    seat.lock_expires_at = datetime.now(UTC) - timedelta(minutes=1)
    await db_session.commit()

    released = await release_expired_locks(db_session)
    assert sample_show.id in released

    refreshed_seat = await db_session.scalar(select(Seat).where(Seat.id == seat.id))
    assert refreshed_seat is not None
    assert refreshed_seat.status == SeatStatus.AVAILABLE


@pytest.mark.asyncio
async def test_my_ticket_search_supports_code_event_and_time(
    db_session: AsyncSession,
    sample_event,
    sample_show,
    customer_users,
):
    """Danh sách vé hỗ trợ tìm theo mã vé, tên sự kiện và khoảng thời gian."""

    user1, _ = customer_users
    seat = await db_session.scalar(select(Seat).where(Seat.show_id == sample_show.id).order_by(Seat.id.asc()))
    assert seat is not None

    await lock_seats(db_session, user_id=user1.id, show_id=sample_show.id, seat_ids=[seat.id], queue_token=None)
    await checkout_locked_seats(db_session, user_id=user1.id, show_id=sample_show.id, queue_token=None)

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
        end_to=sample_show.start_at - timedelta(days=5),
    )
    assert before_event == []
