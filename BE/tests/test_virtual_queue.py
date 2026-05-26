"""Kiểm thử thuật toán hàng đợi ảo."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import EventStatus, QueueStatus
from app.models.queue import QueueEntry
from app.schemas.event import EventCreateRequest, SeatZoneCreate, ShowCreateRequest
from app.services.event_service import create_event, create_show_with_inventory
from app.services.queue_service import get_queue_status, join_show_queue, process_virtual_queue


@pytest.mark.asyncio
async def test_virtual_queue_batches_users(
    db_session: AsyncSession,
    admin_user,
    customer_users,
):
    """Khách thứ hai phải chờ đến khi slot đã cấp cho khách thứ nhất hết hạn."""

    user1, user2 = customer_users

    show_date = (datetime.now(UTC) + timedelta(days=1)).date()
    event_payload = EventCreateRequest(
        title="Sự kiện kiểm thử hàng đợi",
        description="Sự kiện dùng để kiểm thử hàng đợi khi truy cập cao.",
        category="Âm nhạc",
        start_date=show_date,
        end_date=show_date,
        cover_image_url="",
        status=EventStatus.LIVE,
    )
    show_payload = ShowCreateRequest(
        title="Buổi diễn kiểm thử hàng đợi",
        description="Buổi diễn bật hàng đợi để kiểm thử phòng chờ.",
        venue="Nhà thi đấu kiểm thử",
        show_date=show_date,
        start_time=datetime.now(UTC).time().replace(hour=18, minute=0, second=0, microsecond=0),
        end_time=datetime.now(UTC).time().replace(hour=20, minute=0, second=0, microsecond=0),
        status=EventStatus.LIVE,
        hold_minutes=10,
        queue_enabled=True,
        zones=[SeatZoneCreate(code="GA", name="Khu phổ thông", row_count=1, seats_per_row=2, price=500_000, color="#024ddf")],
    )

    event = await create_event(db_session, admin_user.id, event_payload)
    show = await create_show_with_inventory(db_session, event, admin_user.id, show_payload)
    show.max_active_queue_tokens = 1
    show.queue_release_batch = 1
    await db_session.commit()

    first_join = await join_show_queue(db_session, show=show, user_id=user1.id)
    second_join = await join_show_queue(db_session, show=show, user_id=user2.id)

    assert first_join.status == QueueStatus.ADMITTED
    assert first_join.token
    assert second_join.status == QueueStatus.WAITING
    assert second_join.position == 1
    assert "vị trí thứ 1" in second_join.message

    second_status = await get_queue_status(db_session, show_id=show.id, token=second_join.token, user_id=user2.id)
    assert second_status.status == QueueStatus.WAITING
    assert second_status.position == 1
    assert "vị trí thứ 1" in second_status.message

    await process_virtual_queue(db_session)

    second_status_after = await get_queue_status(db_session, show_id=show.id, token=second_join.token, user_id=user2.id)
    assert second_status_after.status == QueueStatus.ADMITTED


@pytest.mark.asyncio
async def test_virtual_queue_releases_exact_batch_of_fifty(
    db_session: AsyncSession,
    admin_user,
    customer_users,
):
    """Worker chỉ cấp tối đa 50 người mỗi lượt và giữ lại vị trí đúng cho người còn chờ."""

    user1, user2 = customer_users
    show_date = (datetime.now(UTC) + timedelta(days=1)).date()
    event_payload = EventCreateRequest(
        title="Sự kiện kiểm thử batch 50",
        description="Sự kiện dùng để kiểm thử số lượng user được cấp lượt mỗi batch.",
        category="Âm nhạc",
        start_date=show_date,
        end_date=show_date,
        cover_image_url="",
        status=EventStatus.LIVE,
    )
    show_payload = ShowCreateRequest(
        title="Buổi diễn kiểm thử batch 50",
        description="Buổi diễn bật hàng đợi với batch 50 người mỗi lượt.",
        venue="Nhà thi đấu kiểm thử",
        show_date=show_date,
        start_time=datetime.now(UTC).time().replace(hour=18, minute=0, second=0, microsecond=0),
        end_time=datetime.now(UTC).time().replace(hour=20, minute=0, second=0, microsecond=0),
        status=EventStatus.LIVE,
        hold_minutes=10,
        queue_enabled=True,
        zones=[SeatZoneCreate(code="GA", name="Khu phổ thông", row_count=1, seats_per_row=2, price=500_000, color="#024ddf")],
    )

    event = await create_event(db_session, admin_user.id, event_payload)
    show = await create_show_with_inventory(db_session, event, admin_user.id, show_payload)

    created_base = datetime.now(UTC) - timedelta(minutes=10)
    waiting_entries = [
        QueueEntry(
            event_id=event.id,
            show_id=show.id,
            user_id=user1.id if index % 2 == 0 else user2.id,
            token=f"batch-50-token-{index}",
            status=QueueStatus.WAITING,
            position_hint=index + 1,
            created_at=created_base + timedelta(seconds=index),
            updated_at=created_base + timedelta(seconds=index),
        )
        for index in range(60)
    ]
    db_session.add_all(waiting_entries)
    await db_session.commit()

    changed_count = await process_virtual_queue(db_session)

    admitted_entries = list(
        await db_session.scalars(
            select(QueueEntry)
            .where(QueueEntry.show_id == show.id, QueueEntry.status == QueueStatus.ADMITTED)
            .order_by(QueueEntry.created_at.asc())
        )
    )
    remaining_entries = list(
        await db_session.scalars(
            select(QueueEntry)
            .where(QueueEntry.show_id == show.id, QueueEntry.status == QueueStatus.WAITING)
            .order_by(QueueEntry.created_at.asc())
        )
    )

    assert changed_count == 50
    assert len(admitted_entries) == 50
    assert len(remaining_entries) == 10
    assert admitted_entries[0].token == "batch-50-token-0"
    assert admitted_entries[-1].token == "batch-50-token-49"
    assert [entry.position_hint for entry in remaining_entries] == list(range(1, 11))


@pytest.mark.asyncio
async def test_existing_admitted_token_does_not_force_queue_when_below_threshold(
    db_session: AsyncSession,
    admin_user,
    customer_users,
):
    """Token đã được cấp lượt không được tự kích hoạt phòng chờ nếu active user chưa chạm ngưỡng."""

    user1, user2 = customer_users
    show_date = (datetime.now(UTC) + timedelta(days=1)).date()
    event_payload = EventCreateRequest(
        title="Sự kiện kiểm thử admitted không ép queue",
        description="Sự kiện dùng để kiểm thử token admitted không tự bật phòng chờ.",
        category="Âm nhạc",
        start_date=show_date,
        end_date=show_date,
        cover_image_url="",
        status=EventStatus.LIVE,
    )
    show_payload = ShowCreateRequest(
        title="Buổi diễn kiểm thử admitted không ép queue",
        description="Buổi diễn bật hàng đợi nhưng chưa chạm ngưỡng active user.",
        venue="Nhà thi đấu kiểm thử",
        show_date=show_date,
        start_time=datetime.now(UTC).time().replace(hour=18, minute=0, second=0, microsecond=0),
        end_time=datetime.now(UTC).time().replace(hour=20, minute=0, second=0, microsecond=0),
        status=EventStatus.LIVE,
        hold_minutes=10,
        queue_enabled=True,
        zones=[SeatZoneCreate(code="GA", name="Khu phổ thông", row_count=1, seats_per_row=2, price=500_000, color="#024ddf")],
    )

    event = await create_event(db_session, admin_user.id, event_payload)
    show = await create_show_with_inventory(db_session, event, admin_user.id, show_payload)
    db_session.add(
        QueueEntry(
            event_id=event.id,
            show_id=show.id,
            user_id=user1.id,
            token="existing-admitted-token",
            status=QueueStatus.ADMITTED,
            position_hint=0,
            admitted_at=datetime.now(UTC),
            expires_at=datetime.now(UTC) + timedelta(minutes=15),
            last_seen_at=datetime.now(UTC),
        )
    )
    await db_session.commit()

    second_join = await join_show_queue(db_session, show=show, user_id=user2.id)

    assert second_join.status == QueueStatus.ADMITTED
    assert second_join.position == 0


@pytest.mark.asyncio
async def test_missing_queue_token_returns_expired_status_instead_of_404(
    db_session: AsyncSession,
    sample_show,
    customer_users,
):
    """Polling bằng token cũ phải trả trạng thái hết hạn có thể tự phục hồi."""

    user1, _ = customer_users

    status_payload = await get_queue_status(
        db_session,
        show_id=sample_show.id,
        token="stale-token-from-session-storage",
        user_id=user1.id,
    )

    assert status_payload.status == QueueStatus.EXPIRED
    assert status_payload.token == "stale-token-from-session-storage"
