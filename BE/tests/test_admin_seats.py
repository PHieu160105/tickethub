"""Kiểm thử điểm cuối API admin tạo ghế đơn lẻ và sinh ghế hàng loạt."""

import pytest
from fastapi import status
from httpx import AsyncClient
from sqlalchemy import select

from app.main import app
from app.models.enums import EventStatus, SeatStatus
from app.models.seat import Seat


async def mark_show_draft(db_session, sample_show) -> None:
    sample_show.status = EventStatus.DRAFT
    await db_session.commit()


@pytest.mark.asyncio
async def test_create_single_seat(db_session, admin_user, sample_event, sample_show):
    from app.api.deps import get_db_session, get_current_active_admin

    async def override_get_db():
        yield db_session

    async def override_get_admin():
        return admin_user

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_current_active_admin] = override_get_admin
    await mark_show_draft(db_session, sample_show)

    try:
        # Lấy khu vực ghế trực tiếp từ cơ sở dữ liệu để tránh tải lười ngoài phiên bất đồng bộ.
        from sqlalchemy import select
        from app.models.event import SeatZone

        zone = await db_session.scalar(select(SeatZone).where(SeatZone.show_id == sample_show.id))
        assert zone is not None

        payload = {
            "seat_label": "CUST-1",
            "x": 15.5,
            "y": 20.0,
            "rotation": 0,
            "zone_id": zone.id,
        }

        from httpx import ASGITransport
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                f"/api/admin/events/{sample_event.slug}/shows/{sample_show.id}/seats/single",
                json=payload,
            )

        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["seat_label"] == "CUST-1"
        assert float(data["x"]) == pytest.approx(15.5)

        # Kiểm tra ghế đã thật sự được lưu vào cơ sở dữ liệu.
        seats = await db_session.execute(Seat.__table__.select().where(Seat.seat_label == "CUST-1"))
        row = seats.first()
        assert row is not None
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_bulk_straight(db_session, admin_user, sample_event, sample_show):
    from app.api.deps import get_db_session, get_current_active_admin

    async def override_get_db():
        yield db_session

    async def override_get_admin():
        return admin_user

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_current_active_admin] = override_get_admin
    await mark_show_draft(db_session, sample_show)

    try:
        from sqlalchemy import select
        from app.models.event import SeatZone

        zone = await db_session.scalar(select(SeatZone).where(SeatZone.show_id == sample_show.id))
        assert zone is not None

        payload = {
            "zone_id": zone.id,
            "pattern": "straight",
            "rows": 2,
            "cols": 2,
            "gap_x": 3.0,
            "gap_y": 3.0,
            "start_x": 10.0,
            "start_y": 10.0,
            "label_prefix": "T",
        }

        from httpx import ASGITransport
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                f"/api/admin/events/{sample_event.slug}/shows/{sample_show.id}/seats/bulk",
                json=payload,
            )

        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["created_count"] >= 1
        assert any(s["seat_label"].startswith("T") for s in data["seats"])
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_bulk_arc(db_session, admin_user, sample_event, sample_show):
    from app.api.deps import get_db_session, get_current_active_admin

    async def override_get_db():
        yield db_session

    async def override_get_admin():
        return admin_user

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_current_active_admin] = override_get_admin
    await mark_show_draft(db_session, sample_show)

    try:
        from sqlalchemy import select
        from app.models.event import SeatZone

        zone = await db_session.scalar(select(SeatZone).where(SeatZone.show_id == sample_show.id))
        assert zone is not None

        payload = {
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
        }

        from httpx import ASGITransport
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                f"/api/admin/events/{sample_event.slug}/shows/{sample_show.id}/seats/bulk",
                json=payload,
            )

        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["created_count"] >= 1
        assert all("-" in s["seat_label"] or s["seat_label"].startswith("A") for s in data["seats"]) 
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_update_event_seat_admin_lock(db_session, admin_user, sample_event, sample_show):
    from app.api.deps import get_db_session, get_current_active_admin

    async def override_get_db():
        yield db_session

    async def override_get_admin():
        return admin_user

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_current_active_admin] = override_get_admin
    await mark_show_draft(db_session, sample_show)

    try:
        seat = await db_session.scalar(select(Seat).where(Seat.show_id == sample_show.id).limit(1))
        assert seat is not None

        from httpx import ASGITransport
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.patch(
                f"/api/admin/events/{sample_event.slug}/shows/{sample_show.id}/seats/{seat.id}",
                json={"is_admin_locked": True},
            )

        assert resp.status_code == status.HTTP_200_OK
        refreshed = await db_session.get(Seat, seat.id)
        assert refreshed is not None
        assert refreshed.is_admin_locked is True
        assert refreshed.status == SeatStatus.LOCKED
        assert refreshed.locked_by_user_id is None
    finally:
        app.dependency_overrides.clear()
