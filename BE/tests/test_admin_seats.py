"""Kiem thu API admin tao va cap nhat ghe theo inventory ticket cua show."""

import pytest
from fastapi import status
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.main import app
from app.models.enums import EventStatus, SeatStatus
from app.models.event import SeatZone
from app.models.order import Ticket


async def mark_show_draft(db_session, sample_show) -> None:
    sample_show.status = EventStatus.DRAFT
    await db_session.commit()


async def _override_admin_client(db_session, admin_user) -> AsyncClient:
    from app.api.deps import get_current_active_admin, get_db_session

    async def override_get_db():
        yield db_session

    async def override_get_admin():
        return admin_user

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_current_active_admin] = override_get_admin
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _get_default_zone(db_session, sample_show):
    zone = await db_session.scalar(select(SeatZone).where(SeatZone.show_id == sample_show.id))
    assert zone is not None
    return zone


@pytest.mark.asyncio
async def test_create_single_seat(db_session, admin_user, sample_event, sample_show):
    await mark_show_draft(db_session, sample_show)
    zone = await _get_default_zone(db_session, sample_show)

    try:
        client = await _override_admin_client(db_session, admin_user)
        async with client:
            resp = await client.post(
                f"/api/admin/events/{sample_event.slug}/shows/{sample_show.id}/seats/single",
                json={
                    "seat_label": "CUST-1",
                    "x": 15.5,
                    "y": 20.0,
                    "rotation": 0,
                    "zone_id": zone.id,
                },
            )

        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["seat_label"] == "CUST-1"
        assert float(data["x"]) == pytest.approx(15.5)

        ticket = await db_session.get(Ticket, data["id"])
        assert ticket is not None
        assert ticket.show_id == sample_show.id
        assert ticket.seat_label == "CUST-1"
        assert ticket.row_label is None
        assert ticket.seat_number is None
        assert ticket.status == SeatStatus.AVAILABLE
        assert ticket.is_staff_locked is False
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_bulk_straight(db_session, admin_user, sample_event, sample_show):
    await mark_show_draft(db_session, sample_show)
    zone = await _get_default_zone(db_session, sample_show)

    try:
        client = await _override_admin_client(db_session, admin_user)
        async with client:
            resp = await client.post(
                f"/api/admin/events/{sample_event.slug}/shows/{sample_show.id}/seats/bulk",
                json={
                    "zone_id": zone.id,
                    "pattern": "straight",
                    "rows": 2,
                    "cols": 2,
                    "gap_x": 3.0,
                    "gap_y": 3.0,
                    "start_x": 10.0,
                    "start_y": 10.0,
                    "label_prefix": "T",
                },
            )

        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["created_count"] >= 1
        assert any(seat["seat_label"].startswith("T") for seat in data["seats"])

        rows = await db_session.execute(select(Ticket).where(Ticket.show_id == sample_show.id, Ticket.seat_label.like("T%")))
        assert rows.scalars().first() is not None
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_bulk_arc(db_session, admin_user, sample_event, sample_show):
    await mark_show_draft(db_session, sample_show)
    zone = await _get_default_zone(db_session, sample_show)

    try:
        client = await _override_admin_client(db_session, admin_user)
        async with client:
            resp = await client.post(
                f"/api/admin/events/{sample_event.slug}/shows/{sample_show.id}/seats/bulk",
                json={
                    "zone_id": zone.id,
                    "pattern": "arc",
                    "rows": 1,
                    "cols": 3,
                    "gap_x": 0,
                    "gap_y": 5,
                    "start_x": 50,
                    "start_y": 50,
                    "label_prefix": "A",
                    "arc_config": {"center_x": 50, "center_y": 50, "radius": 20, "start_angle": -45, "end_angle": 45},
                },
            )

        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["created_count"] >= 1
        assert all(seat["seat_label"].startswith("A") or "-" in seat["seat_label"] for seat in data["seats"])
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_update_event_seat_admin_lock(db_session, admin_user, sample_event, sample_show):
    await mark_show_draft(db_session, sample_show)
    zone = await _get_default_zone(db_session, sample_show)

    try:
        client = await _override_admin_client(db_session, admin_user)
        async with client:
            create_resp = await client.post(
                f"/api/admin/events/{sample_event.slug}/shows/{sample_show.id}/seats/single",
                json={
                    "seat_label": "LOCK-1",
                    "x": 25.0,
                    "y": 30.0,
                    "zone_id": zone.id,
                },
            )
            assert create_resp.status_code == status.HTTP_200_OK
            seat_id = create_resp.json()["id"]

            resp = await client.patch(
                f"/api/admin/events/{sample_event.slug}/shows/{sample_show.id}/seats/{seat_id}",
                json={"is_admin_locked": True},
            )

        assert resp.status_code == status.HTTP_200_OK
        refreshed = await db_session.get(Ticket, seat_id)
        assert refreshed is not None
        assert refreshed.is_staff_locked is True
        assert refreshed.status == SeatStatus.LOCKED
        assert refreshed.locked_by_customer_id is None
    finally:
        app.dependency_overrides.clear()
