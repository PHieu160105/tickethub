"""Kiểm thử payload sự kiện có trả giá ghế lớn nhất để FE lọc khoảng giá."""

import pytest
from fastapi import status
from httpx import ASGITransport, AsyncClient

from app.main import app


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
