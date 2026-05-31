"""Kiem thu tach quyen system admin va event staff."""

import pytest
from fastapi import status
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.enums import Gender, UserType
from app.models.user import SystemAdmin, User


@pytest.mark.asyncio
async def test_system_admin_can_create_and_deactivate_event_staff(db_session):
    from app.api.deps import get_current_system_admin, get_db_session

    system_admin = User(
        full_name="System Admin",
        email="system@test.local",
        password_hash="hashed",
        user_type=UserType.SYSTEM_ADMIN,
        gender=Gender.OTHER,
        age=30,
    )
    system_admin.system_admin_profile = SystemAdmin(admin_code="SYS-TEST-001")
    db_session.add(system_admin)
    await db_session.commit()
    await db_session.refresh(system_admin)

    async def override_db():
        yield db_session

    async def override_system_admin():
        return system_admin

    app.dependency_overrides[get_db_session] = override_db
    app.dependency_overrides[get_current_system_admin] = override_system_admin
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            created_response = await client.post(
                "/api/admin/staff",
                json={
                    "full_name": "Event Staff New",
                    "email": "staff-new@example.com",
                    "password": "Staff@123",
                    "staff_code": "STAFF-NEW",
                    "gender": "OTHER",
                    "age": 24,
                },
            )
            assert created_response.status_code == status.HTTP_201_CREATED, created_response.text
            staff_user_id = created_response.json()["user_id"]
            status_response = await client.patch(f"/api/admin/staff/{staff_user_id}/status", json={"is_active": False})
    finally:
        app.dependency_overrides.clear()

    assert created_response.status_code == status.HTTP_201_CREATED
    assert created_response.json()["is_active"] is True
    assert status_response.status_code == status.HTTP_200_OK
    assert status_response.json()["is_active"] is False


@pytest.mark.asyncio
async def test_system_admin_cannot_create_event(db_session):
    from app.api.deps import get_current_active_admin, get_db_session

    system_admin = User(
        full_name="System Admin",
        email="system-event@test.local",
        password_hash="hashed",
        user_type=UserType.SYSTEM_ADMIN,
        gender=Gender.OTHER,
        age=30,
    )
    system_admin.system_admin_profile = SystemAdmin(admin_code="SYS-TEST-002")
    db_session.add(system_admin)
    await db_session.commit()
    await db_session.refresh(system_admin)

    async def override_db():
        yield db_session

    async def override_admin():
        return system_admin

    app.dependency_overrides[get_db_session] = override_db
    app.dependency_overrides[get_current_active_admin] = override_admin
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/admin/events",
                json={
                    "title": "Forbidden Event",
                    "description": "System admin must not create operational events.",
                    "category": "MUSIC",
                    "start_date": "2026-06-01",
                    "end_date": "2026-06-02",
                    "status": "DRAFT",
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == status.HTTP_403_FORBIDDEN
