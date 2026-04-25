"""Virtual queue algorithm tests."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import EventStatus, QueueStatus
from app.models.queue import QueueEntry
from app.schemas.event import EventCreateRequest, SeatZoneCreate
from app.services.event_service import create_event_with_matrix
from app.services.queue_service import get_queue_status, join_event_queue, process_virtual_queue


@pytest.mark.asyncio
async def test_virtual_queue_batches_users(
    db_session: AsyncSession,
    admin_user,
    customer_users,
):
    """Second user should wait until first admitted slot expires."""

    user1, user2 = customer_users

    payload = EventCreateRequest(
        title="Queue Event",
        description="Queue stress test event.",
        category="Concert",
        venue="Queue Arena",
        start_at=datetime.now(UTC) + timedelta(days=1),
        end_at=datetime.now(UTC) + timedelta(days=1, hours=2),
        cover_image_url="",
        status=EventStatus.LIVE,
        hold_minutes=10,
        queue_enabled=True,
        queue_release_batch=1,
        max_active_queue_tokens=1,
        zones=[SeatZoneCreate(code="GA", name="General", row_count=1, seats_per_row=2, price=50.0, color="#024ddf")],
    )

    event = await create_event_with_matrix(db_session, admin_user.id, payload)
    await db_session.commit()

    first_join = await join_event_queue(db_session, event=event, user_id=user1.id)
    second_join = await join_event_queue(db_session, event=event, user_id=user2.id)

    assert first_join.status == QueueStatus.ADMITTED
    assert second_join.status == QueueStatus.WAITING

    second_status = await get_queue_status(db_session, event_id=event.id, token=second_join.token, user_id=user2.id)
    assert second_status.status == QueueStatus.WAITING
    assert (second_status.position or 0) >= 1

    # Force first user token to expire then run queue worker.
    first_entry = await db_session.scalar(select(QueueEntry).where(QueueEntry.token == first_join.token))
    assert first_entry is not None
    first_entry.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    await db_session.commit()

    await process_virtual_queue(db_session)

    second_status_after = await get_queue_status(db_session, event_id=event.id, token=second_join.token, user_id=user2.id)
    assert second_status_after.status == QueueStatus.ADMITTED
