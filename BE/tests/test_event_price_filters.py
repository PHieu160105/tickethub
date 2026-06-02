"""Kiểm thử payload sự kiện có trả giá ghế lớn nhất để FE lọc khoảng giá."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from fastapi import status
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.main import app
from app.models.enums import EventStatus, OrderStatus, QueueStatus, SeatStatus
from app.models.order import Order, Ticket
from app.services.queue_service import QueueRuntimeEntry, _runtime_queue


@pytest.mark.asyncio
async def test_public_event_list_includes_max_price(db_session, sample_event):
    from app.api.deps import get_db_session

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db_session] = override_get_db

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/events")

        assert response.status_code == status.HTTP_200_OK
        payload = response.json()
        event = next(item for item in payload if item["id"] == sample_event.id)
        assert event["max_price"] == pytest.approx(100.0)
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_admin_event_list_includes_max_price(db_session, admin_user, sample_event):
    from app.api.deps import get_current_active_admin, get_db_session

    async def override_get_db():
        yield db_session

    async def override_get_admin():
        return admin_user

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_current_active_admin] = override_get_admin

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/admin/events")

        assert response.status_code == status.HTTP_200_OK
        payload = response.json()
        event = next(item for item in payload if item["id"] == sample_event.id)
        assert event["max_price"] == pytest.approx(100.0)
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_public_event_list_hides_draft_events(db_session, sample_event):
    from app.api.deps import get_db_session

    sample_event.status = EventStatus.DRAFT
    await db_session.commit()

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db_session] = override_get_db

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            public_response = await client.get("/api/events")
            detail_response = await client.get(f"/api/events/{sample_event.slug}")

        assert public_response.status_code == status.HTTP_200_OK
        assert all(item["id"] != sample_event.id for item in public_response.json())
        assert detail_response.status_code == status.HTTP_404_NOT_FOUND
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_public_event_detail_hides_draft_shows(db_session, sample_event, sample_show):
    from app.api.deps import get_db_session

    sample_show.status = EventStatus.DRAFT
    await db_session.commit()

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db_session] = override_get_db

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            event_response = await client.get(f"/api/events/{sample_event.slug}")
            show_response = await client.get(f"/api/shows/{sample_show.id}")

        assert event_response.status_code == status.HTTP_200_OK
        assert event_response.json()["shows"] == []
        assert show_response.status_code == status.HTTP_404_NOT_FOUND
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_admin_can_see_draft_events_and_shows(db_session, admin_user, sample_event, sample_show):
    from app.api.deps import get_current_active_admin, get_db_session

    sample_event.status = EventStatus.DRAFT
    sample_show.status = EventStatus.DRAFT
    await db_session.commit()

    async def override_get_db():
        yield db_session

    async def override_get_admin():
        return admin_user

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_current_active_admin] = override_get_admin

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            list_response = await client.get("/api/admin/events")
            detail_response = await client.get(f"/api/admin/events/{sample_event.slug}")

        assert list_response.status_code == status.HTTP_200_OK
        assert any(item["id"] == sample_event.id for item in list_response.json())
        assert detail_response.status_code == status.HTTP_200_OK
        assert detail_response.json()["shows"][0]["id"] == sample_show.id
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_admin_show_live_must_be_drafted_before_edit_or_delete(db_session, admin_user, sample_event, sample_show):
    from app.api.deps import get_current_active_admin, get_db_session

    async def override_get_db():
        yield db_session

    async def override_get_admin():
        return admin_user

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_current_active_admin] = override_get_admin

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            edit_response = await client.patch(
                f"/api/admin/events/{sample_event.slug}/shows/{sample_show.id}",
                json={"title": "Changed title"},
            )
            delete_response = await client.delete(f"/api/admin/events/{sample_event.slug}/shows/{sample_show.id}")
            draft_response = await client.patch(
                f"/api/admin/events/{sample_event.slug}/shows/{sample_show.id}",
                json={"status": "DRAFT"},
            )

        assert edit_response.status_code == status.HTTP_400_BAD_REQUEST
        assert delete_response.status_code == status.HTTP_400_BAD_REQUEST
        assert draft_response.status_code == status.HTTP_200_OK
        assert draft_response.json()["status"] == "DRAFT"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_admin_cannot_delete_draft_show_with_booking_history(db_session, admin_user, customer_users, sample_event, sample_show):
    from app.api.deps import get_current_active_admin, get_db_session

    customer, _ = customer_users
    sample_show.status = EventStatus.DRAFT
    db_session.add(
        Order(
            customer_id=customer.id,
            show_id=sample_show.id,
            order_code="ORD-REFUND-BLOCK",
            status=OrderStatus.PAID,
            total_amount=100,
            payment_provider="VNPAY",
            paid_at=datetime.now(UTC),
        )
    )
    await db_session.commit()

    async def override_get_db():
        yield db_session

    async def override_get_admin():
        return admin_user

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_current_active_admin] = override_get_admin

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            delete_response = await client.delete(f"/api/admin/events/{sample_event.slug}/shows/{sample_show.id}")

        assert delete_response.status_code == status.HTTP_400_BAD_REQUEST
        assert "lich su giao dich" in delete_response.json()["detail"]
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_admin_can_draft_live_show_even_if_show_date_outside_event_range(db_session, admin_user, sample_event, sample_show):
    from app.api.deps import get_current_active_admin, get_db_session

    sample_event.start_date = sample_show.start_at.date() + timedelta(days=1)
    sample_event.end_date = sample_show.start_at.date() + timedelta(days=2)
    await db_session.commit()

    async def override_get_db():
        yield db_session

    async def override_get_admin():
        return admin_user

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_current_active_admin] = override_get_admin

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.patch(
                f"/api/admin/events/{sample_event.slug}/shows/{sample_show.id}",
                json={"status": "DRAFT"},
            )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["status"] == "DRAFT"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_admin_drafting_live_show_interrupts_active_booking_sessions(db_session, admin_user, customer_users, sample_event, sample_show):
    from app.api.deps import get_current_active_admin, get_current_customer, get_current_user, get_db_session

    customer, _ = customer_users
    seats = list(await db_session.scalars(select(Ticket).where(Ticket.show_id == sample_show.id).order_by(Ticket.id.asc()).limit(3)))
    assert len(seats) == 3

    user_locked_seat = seats[0]
    admin_locked_seat = seats[1]
    sold_seat = seats[2]

    user_locked_seat.status = SeatStatus.LOCKED
    user_locked_seat.locked_by_customer_id = customer.id
    user_locked_seat.lock_expires_at = datetime.now(UTC) + timedelta(minutes=10)
    user_locked_seat.is_admin_locked = False

    admin_locked_seat.status = SeatStatus.LOCKED
    admin_locked_seat.locked_by_customer_id = None
    admin_locked_seat.lock_expires_at = None
    admin_locked_seat.is_admin_locked = True

    sold_seat.status = SeatStatus.SOLD
    sold_seat.locked_by_customer_id = None
    sold_seat.lock_expires_at = None
    sold_seat.is_admin_locked = False

    _runtime_queue.setdefault(sample_show.id, {})["waiting-token"] = QueueRuntimeEntry(
        show_id=sample_show.id,
        user_id=customer.id,
        token="waiting-token",
        status=QueueStatus.WAITING,
        created_at=datetime.now(UTC),
    )
    _runtime_queue[sample_show.id]["admitted-token"] = QueueRuntimeEntry(
        show_id=sample_show.id,
        user_id=customer.id,
        token="admitted-token",
        status=QueueStatus.ADMITTED,
        created_at=datetime.now(UTC),
        admitted_at=datetime.now(UTC),
        expires_at=datetime.now(UTC) + timedelta(minutes=5),
    )

    async def override_get_db():
        yield db_session

    async def override_get_admin():
        return admin_user

    async def override_get_customer():
        return customer

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_current_active_admin] = override_get_admin
    app.dependency_overrides[get_current_user] = override_get_customer
    app.dependency_overrides[get_current_customer] = override_get_customer

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            draft_response = await client.patch(
                f"/api/admin/events/{sample_event.slug}/shows/{sample_show.id}",
                json={"status": "DRAFT"},
            )
            lock_response = await client.post(
                "/api/bookings/lock",
                json={"show_id": sample_show.id, "seat_ids": [user_locked_seat.id]},
            )
            queue_response = await client.get(f"/api/shows/{sample_show.id}/queue/status/waiting-token")

        assert draft_response.status_code == status.HTTP_200_OK
        assert lock_response.status_code == status.HTTP_404_NOT_FOUND
        assert queue_response.status_code == status.HTTP_404_NOT_FOUND

        await db_session.refresh(user_locked_seat)
        await db_session.refresh(admin_locked_seat)
        await db_session.refresh(sold_seat)
        assert user_locked_seat.status == SeatStatus.AVAILABLE
        assert user_locked_seat.locked_by_customer_id is None
        assert user_locked_seat.lock_expires_at is None

        assert admin_locked_seat.status == SeatStatus.LOCKED
        assert admin_locked_seat.is_admin_locked is True
        assert admin_locked_seat.locked_by_customer_id is None

        assert sold_seat.status == SeatStatus.SOLD
        assert _runtime_queue[sample_show.id]["waiting-token"].status == QueueStatus.EXPIRED
        assert _runtime_queue[sample_show.id]["admitted-token"].status == QueueStatus.EXPIRED
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_admin_seat_planner_mutations_require_draft_show(db_session, admin_user, sample_event, sample_show):
    from app.api.deps import get_current_active_admin, get_db_session

    async def override_get_db():
        yield db_session

    async def override_get_admin():
        return admin_user

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_current_active_admin] = override_get_admin

    tier_payload = {
        "code": "GEN",
        "name": "General",
        "description": "General admission",
        "base_price": "120.00",
        "color": "#024ddf",
        "is_active": True,
    }

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            live_response = await client.post(
                f"/api/admin/events/{sample_event.slug}/shows/{sample_show.id}/ticket-tiers",
                json=tier_payload,
            )
            await client.patch(
                f"/api/admin/events/{sample_event.slug}/shows/{sample_show.id}",
                json={"status": "DRAFT"},
            )
            draft_response = await client.post(
                f"/api/admin/events/{sample_event.slug}/shows/{sample_show.id}/ticket-tiers",
                json=tier_payload,
            )

        assert live_response.status_code == status.HTTP_400_BAD_REQUEST
        assert draft_response.status_code == status.HTTP_201_CREATED
        created_tier = draft_response.json()
        assert created_tier["description"] == "General admission"
        assert Decimal(str(created_tier["base_price"])) == Decimal("120.00")
        assert created_tier["is_active"] is True
        assert "row_count" not in created_tier
        assert "seats_per_row" not in created_tier
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_admin_event_delete_requires_draft(db_session, admin_user, sample_event):
    from app.api.deps import get_current_active_admin, get_db_session

    async def override_get_db():
        yield db_session

    async def override_get_admin():
        return admin_user

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_current_active_admin] = override_get_admin

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            live_delete_response = await client.delete(f"/api/admin/events/{sample_event.slug}")
            await client.patch(f"/api/admin/events/{sample_event.slug}", json={"status": "DRAFT"})
            draft_delete_response = await client.delete(f"/api/admin/events/{sample_event.slug}")

        assert live_delete_response.status_code == status.HTTP_400_BAD_REQUEST
        assert draft_delete_response.status_code == status.HTTP_200_OK
    finally:
        app.dependency_overrides.clear()
