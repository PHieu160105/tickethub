"""Tests for venue management API routes."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi import status
from httpx import AsyncClient
from sqlalchemy import select

from app.main import app
from app.models.venue import Section, Venue, VenueLayout
from app.schemas.venue import VenueCreateRequest


@pytest.mark.asyncio
async def test_create_venue(db_session, admin_user):
    """Test creating a venue."""
    from app.api.deps import get_db_session

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db_session] = override_get_db

    from app.api.deps import get_current_active_admin

    async def override_get_admin():
        return admin_user

    app.dependency_overrides[get_current_active_admin] = override_get_admin

    try:
        from httpx import ASGITransport
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/admin/venues",
                json={
                    "name": "Test Arena",
                    "address": "123 Main St",
                    "city": "New York",
                    "venue_type": "arena",
                    "capacity": 5000,
                    "width": 1200,
                    "height": 800,
                },
            )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Test Arena"
        assert data["city"] == "New York"
        assert data["venue_type"] == "arena"
        assert data["capacity"] == 5000
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_list_venues(db_session, admin_user):
    """Test listing venues."""
    from app.api.deps import get_db_session, get_current_active_admin

    venue = Venue(
        name="Test Theater",
        venue_type="theater",
        city="Los Angeles",
        created_by_user_id=admin_user.id,
    )
    db_session.add(venue)
    await db_session.commit()

    async def override_get_db():
        yield db_session

    async def override_get_admin():
        return admin_user

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_current_active_admin] = override_get_admin

    try:
        from httpx import ASGITransport
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/admin/venues")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) >= 1
        assert any(v["name"] == "Test Theater" for v in data)
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_layout(db_session, admin_user):
    """Test creating a layout for a venue."""
    from app.api.deps import get_db_session, get_current_active_admin

    venue = Venue(
        name="Test Stadium",
        venue_type="stadium",
        created_by_user_id=admin_user.id,
    )
    db_session.add(venue)
    await db_session.commit()
    await db_session.refresh(venue)

    async def override_get_db():
        yield db_session

    async def override_get_admin():
        return admin_user

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_current_active_admin] = override_get_admin

    try:
        from httpx import ASGITransport
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                f"/api/admin/venues/{venue.id}/layouts",
                json={
                    "name": "Main Floor",
                    "description": "Ground level seating",
                    "sort_order": 1,
                },
            )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Main Floor"
        assert data["venue_id"] == venue.id
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_section(db_session, admin_user):
    """Test creating a section within a layout."""
    from app.api.deps import get_db_session, get_current_active_admin

    venue = Venue(
        name="Test Arena",
        venue_type="arena",
        created_by_user_id=admin_user.id,
    )
    db_session.add(venue)
    await db_session.commit()
    await db_session.refresh(venue)

    layout = VenueLayout(
        venue_id=venue.id,
        name="Main Floor",
    )
    db_session.add(layout)
    await db_session.commit()
    await db_session.refresh(layout)

    async def override_get_db():
        yield db_session

    async def override_get_admin():
        return admin_user

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_current_active_admin] = override_get_admin

    try:
        from httpx import ASGITransport
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                f"/api/admin/layouts/{layout.id}/sections",
                json={
                    "name": "VIP",
                    "code": "VIP",
                    "color": "#ff0000",
                    "price_base": 500.00,
                    "sort_order": 1,
                },
            )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "VIP"
        assert data["code"] == "VIP"
        from decimal import Decimal
        assert Decimal(str(data["price_base"])) == Decimal("500.00")
        assert data["venue_layout_id"] == layout.id
    finally:
        app.dependency_overrides.clear()
