"""Smoke tests for the simplified admin venue API."""

import pytest
from fastapi import status
from httpx import AsyncClient
from sqlalchemy import select

from app.main import app
from app.models.seat import Seat
from app.models.venue import Venue


async def _override_admin_client(db_session, admin_user):
    from app.api.deps import get_current_active_admin, get_db_session

    async def override_get_db():
        yield db_session

    async def override_get_admin():
        return admin_user

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_current_active_admin] = override_get_admin


@pytest.mark.asyncio
async def test_create_and_list_venues(db_session, admin_user):
    await _override_admin_client(db_session, admin_user)

    try:
        from httpx import ASGITransport

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            create_response = await client.post(
                "/api/admin/venues",
                json={
                    "name": "Test Arena",
                    "address": "123 Main St",
                    "is_active": True,
                },
            )
            list_response = await client.get("/api/admin/venues")

        assert create_response.status_code == status.HTTP_200_OK
        created = create_response.json()
        assert created["name"] == "Test Arena"
        assert created["address"] == "123 Main St"
        assert created["is_active"] is True
        assert "city" not in created
        assert "venue_type" not in created

        assert list_response.status_code == status.HTTP_200_OK
        items = list_response.json()
        assert any(item["name"] == "Test Arena" for item in items)
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_layout_and_seat_template(db_session, admin_user):
    venue = Venue(name="Template Venue", address="123 Layout St", created_by_staff_id=admin_user.id)
    db_session.add(venue)
    await db_session.commit()
    await db_session.refresh(venue)

    await _override_admin_client(db_session, admin_user)

    try:
        from httpx import ASGITransport

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            layout_response = await client.post(
                f"/api/admin/venues/{venue.id}/layouts",
                json={"name": "Main Floor", "description": "Primary layout"},
            )
            layout = layout_response.json()

            seat_response = await client.post(
                f"/api/admin/venues/{venue.id}/seats/single",
                json={
                    "layout_id": layout["id"],
                    "label": "A1",
                    "x": 25,
                    "y": 35,
                },
            )

        assert layout_response.status_code == status.HTTP_200_OK
        assert layout["name"] == "Main Floor"
        assert "svg_data" not in layout
        assert "sort_order" not in layout

        assert seat_response.status_code == status.HTTP_200_OK
        seat = seat_response.json()
        assert seat["label"] == "A1"
        assert "row_label" not in seat
        assert "seat_number" not in seat
        assert "section_id" not in seat

        stored_seat = await db_session.scalar(select(Seat).where(Seat.id == seat["id"]))
        assert stored_seat is not None
        assert stored_seat.venue_layout_id == layout["id"]
        assert stored_seat.row_label == "A"
        assert stored_seat.seat_number == 1
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_upload_raster_background_returns_derived_dimensions(db_session, admin_user):
    venue = Venue(name="Raster Upload Venue", address="Raster Upload St", created_by_staff_id=admin_user.id)
    db_session.add(venue)
    await db_session.commit()
    await db_session.refresh(venue)

    await _override_admin_client(db_session, admin_user)

    try:
        from httpx import ASGITransport

        png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8 + (320).to_bytes(4, "big") + (180).to_bytes(4, "big")
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            upload_response = await client.post(
                f"/api/admin/venues/{venue.id}/upload-background",
                files={"file": ("layout.png", png, "image/png")},
            )
            detail_response = await client.get(f"/api/admin/venues/{venue.id}")

        assert upload_response.status_code == status.HTTP_200_OK
        assert detail_response.status_code == status.HTTP_200_OK
        detail = detail_response.json()
        assert detail["background_source"].startswith("data:image/png;base64,")
        assert detail["background_type"] == "raster"
        assert detail["width"] == 320
        assert detail["height"] == 180
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_upload_svg_background_keeps_existing_dimensions_without_parsing(db_session, admin_user):
    venue = Venue(
        name="SVG Upload Venue",
        address="SVG Upload St",
        width=1000,
        height=600,
        created_by_staff_id=admin_user.id,
    )
    db_session.add(venue)
    await db_session.commit()
    await db_session.refresh(venue)

    await _override_admin_client(db_session, admin_user)

    try:
        from httpx import ASGITransport

        svg = b'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"></svg>'
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            upload_response = await client.post(
                f"/api/admin/venues/{venue.id}/upload-background",
                files={"file": ("layout.svg", svg, "image/svg+xml")},
            )
            detail_response = await client.get(f"/api/admin/venues/{venue.id}")

        assert upload_response.status_code == status.HTTP_200_OK
        uploaded = upload_response.json()
        assert uploaded["background_type"] == "svg"
        assert uploaded["width"] == 1000
        assert uploaded["height"] == 600

        assert detail_response.status_code == status.HTTP_200_OK
        detail = detail_response.json()
        assert detail["background_source"].startswith("data:image/svg+xml;base64,")
        assert detail["background_type"] == "svg"
        assert detail["width"] == 1000
        assert detail["height"] == 600
    finally:
        app.dependency_overrides.clear()
