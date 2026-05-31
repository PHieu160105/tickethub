"""Kiểm thử thuật toán hàng đợi ảo."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import EventCategory, EventStatus, QueueStatus
from app.schemas.event import EventCreateRequest, SeatZoneCreate, ShowCreateRequest
from app.services import queue_service
from app.services.event_service import create_event, create_show_with_inventory
from app.services.queue_service import QueueRuntimeEntry, _runtime_queue, get_queue_status, join_show_queue, process_virtual_queue


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
        category=EventCategory.MUSIC,
        start_date=show_date,
        end_date=show_date,
        cover_image_url="",
        status=EventStatus.LIVE,
    )
    show_payload = ShowCreateRequest(
        title="Buổi diễn kiểm thử hàng đợi",
        description="Buổi diễn bật hàng đợi để kiểm thử phòng chờ.",
        location="Nhà thi đấu kiểm thử",
        show_date=show_date,
        start_time=datetime.now(UTC).time().replace(hour=18, minute=0, second=0, microsecond=0),
        end_time=datetime.now(UTC).time().replace(hour=20, minute=0, second=0, microsecond=0),
        status=EventStatus.LIVE,
        hold_minutes=10,
        zones=[SeatZoneCreate(code="GA", name="Khu phổ thông", base_price=500_000, color="#024ddf")],
    )

    event = await create_event(db_session, admin_user.id, event_payload)
    show = await create_show_with_inventory(db_session, event, admin_user.id, show_payload)
    await db_session.commit()

    previous_max_active = queue_service.settings.queue_max_active_tokens_default
    previous_batch_size = queue_service.settings.queue_batch_size_default
    queue_service.settings.queue_max_active_tokens_default = 1
    queue_service.settings.queue_batch_size_default = 1

    first_join = await join_show_queue(db_session, show=show, user_id=user1.id)
    second_join = await join_show_queue(db_session, show=show, user_id=user2.id)

    assert first_join.status == QueueStatus.ADMITTED
    assert first_join.token
    assert second_join.status == QueueStatus.WAITING
    assert second_join.position == 1

    second_status = await get_queue_status(db_session, show_id=show.id, token=second_join.token, user_id=user2.id)
    assert second_status.status == QueueStatus.WAITING
    assert second_status.position == 1

    first_entry = _runtime_queue[show.id][first_join.token]
    first_entry.expires_at = datetime.now(UTC) - timedelta(seconds=1)

    await process_virtual_queue(db_session)
    queue_service.settings.queue_max_active_tokens_default = previous_max_active
    queue_service.settings.queue_batch_size_default = previous_batch_size

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
        category=EventCategory.MUSIC,
        start_date=show_date,
        end_date=show_date,
        cover_image_url="",
        status=EventStatus.LIVE,
    )
    show_payload = ShowCreateRequest(
        title="Buổi diễn kiểm thử batch 50",
        description="Buổi diễn bật hàng đợi với batch 50 người mỗi lượt.",
        location="Nhà thi đấu kiểm thử",
        show_date=show_date,
        start_time=datetime.now(UTC).time().replace(hour=18, minute=0, second=0, microsecond=0),
        end_time=datetime.now(UTC).time().replace(hour=20, minute=0, second=0, microsecond=0),
        status=EventStatus.LIVE,
        hold_minutes=10,
        zones=[SeatZoneCreate(code="GA", name="Khu phổ thông", base_price=500_000, color="#024ddf")],
    )

    event = await create_event(db_session, admin_user.id, event_payload)
    show = await create_show_with_inventory(db_session, event, admin_user.id, show_payload)

    created_base = datetime.now(UTC) - timedelta(minutes=10)
    entries = _runtime_queue.setdefault(show.id, {})
    for index in range(60):
        token = f"batch-50-token-{index}"
        entries[token] = QueueRuntimeEntry(
            show_id=show.id,
            user_id=10_000 + index,
            token=token,
            status=QueueStatus.WAITING,
            position_hint=index + 1,
            created_at=created_base + timedelta(seconds=index),
        )

    previous_max_active = queue_service.settings.queue_max_active_tokens_default
    previous_batch_size = queue_service.settings.queue_batch_size_default
    queue_service.settings.queue_max_active_tokens_default = 50
    queue_service.settings.queue_batch_size_default = 50
    changed_count = await process_virtual_queue(db_session)
    queue_service.settings.queue_max_active_tokens_default = previous_max_active
    queue_service.settings.queue_batch_size_default = previous_batch_size

    admitted_entries = sorted(
        [entry for entry in _runtime_queue[show.id].values() if entry.status == QueueStatus.ADMITTED],
        key=lambda entry: entry.created_at,
    )
    remaining_entries = sorted(
        [entry for entry in _runtime_queue[show.id].values() if entry.status == QueueStatus.WAITING],
        key=lambda entry: entry.created_at,
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
        category=EventCategory.MUSIC,
        start_date=show_date,
        end_date=show_date,
        cover_image_url="",
        status=EventStatus.LIVE,
    )
    show_payload = ShowCreateRequest(
        title="Buổi diễn kiểm thử admitted không ép queue",
        description="Buổi diễn bật hàng đợi nhưng chưa chạm ngưỡng active user.",
        location="Nhà thi đấu kiểm thử",
        show_date=show_date,
        start_time=datetime.now(UTC).time().replace(hour=18, minute=0, second=0, microsecond=0),
        end_time=datetime.now(UTC).time().replace(hour=20, minute=0, second=0, microsecond=0),
        status=EventStatus.LIVE,
        hold_minutes=10,
        zones=[SeatZoneCreate(code="GA", name="Khu phổ thông", base_price=500_000, color="#024ddf")],
    )

    event = await create_event(db_session, admin_user.id, event_payload)
    show = await create_show_with_inventory(db_session, event, admin_user.id, show_payload)
    _runtime_queue.setdefault(show.id, {})["existing-admitted-token"] = QueueRuntimeEntry(
        show_id=show.id,
        user_id=user1.id,
        token="existing-admitted-token",
        status=QueueStatus.ADMITTED,
        position_hint=0,
        created_at=datetime.now(UTC),
        admitted_at=datetime.now(UTC),
        expires_at=datetime.now(UTC) + timedelta(minutes=15),
        last_seen_at=datetime.now(UTC),
    )

    previous_max_active = queue_service.settings.queue_max_active_tokens_default
    queue_service.settings.queue_max_active_tokens_default = 50
    second_join = await join_show_queue(db_session, show=show, user_id=user2.id)
    queue_service.settings.queue_max_active_tokens_default = previous_max_active

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
