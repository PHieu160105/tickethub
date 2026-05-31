"""Kiểm thử payload và trigger realtime dashboard admin."""

import json

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Ticket
from app.services import booking_service
from app.services.booking_service import checkout_locked_seats, lock_seats
from app.services.dashboard_service import dump_dashboard_stream, get_dashboard_stream


@pytest.mark.asyncio
async def test_dashboard_stream_contains_summary_revenue_and_occupancy(
    db_session: AsyncSession,
    sample_show,
):
    payload = await get_dashboard_stream(db_session)

    assert payload.summary.active_events >= 1
    assert len(payload.revenue) == 14
    assert any(item.show_id == sample_show.id for item in payload.occupancy)


@pytest.mark.asyncio
async def test_dashboard_stream_dump_is_websocket_json_serializable(
    db_session: AsyncSession,
    sample_show,
):
    payload = await get_dashboard_stream(db_session)
    dumped = dump_dashboard_stream(payload)

    json.dumps({"type": "dashboard_update", "payload": dumped})
    occupancy = next(item for item in dumped["occupancy"] if item["show_id"] == sample_show.id)
    assert isinstance(occupancy["show_start_at"], str)


@pytest.mark.asyncio
async def test_checkout_triggers_dashboard_broadcast_after_commit(
    db_session: AsyncSession,
    sample_show,
    customer_users,
    monkeypatch: pytest.MonkeyPatch,
):
    broadcast_calls = 0

    async def fake_broadcast_dashboard_update() -> None:
        nonlocal broadcast_calls
        broadcast_calls += 1

    monkeypatch.setattr(booking_service, "broadcast_dashboard_update", fake_broadcast_dashboard_update)
    monkeypatch.setattr(booking_service, "_schedule_lock_expiration", lambda _: None)

    user1, _ = customer_users
    ticket = await db_session.scalar(select(Ticket).where(Ticket.show_id == sample_show.id).order_by(Ticket.id.asc()))
    assert ticket is not None

    await lock_seats(db_session, user_id=user1.id, show_id=sample_show.id, seat_ids=[ticket.id], queue_token=None)
    broadcast_calls = 0

    await checkout_locked_seats(db_session, user_id=user1.id, show_id=sample_show.id, queue_token=None)

    assert broadcast_calls == 1
    payload = await get_dashboard_stream(db_session)
    assert payload.summary.tickets_sold == 1
    assert any(item.show_id == sample_show.id and item.sold_seats == 1 for item in payload.occupancy)
