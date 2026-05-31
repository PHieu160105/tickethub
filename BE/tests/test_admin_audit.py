"""Contract tests for internal audit logging and system-admin log queries."""

import pytest
from fastapi import status
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_system_admin, get_db_session
from app.main import app
from app.models.enums import Gender, UserType
from app.models.user import SystemAdmin, User
from app.services.audit_service import MAX_AUDIT_STRING_LENGTH, add_audit_log, serialize_audit_value


def test_audit_serialization_truncates_large_embedded_payloads():
    serialized = serialize_audit_value({"image_url": "x" * (MAX_AUDIT_STRING_LENGTH + 20)})

    assert serialized is not None
    assert "<truncated 20 chars>" in serialized
    assert len(serialized) < MAX_AUDIT_STRING_LENGTH + 100


@pytest.mark.asyncio
async def test_system_admin_can_query_event_staff_audit_logs(db_session, admin_user):
    system_admin = User(
        full_name="Audit System Admin",
        email="audit-system@test.local",
        password_hash="hashed",
        user_type=UserType.SYSTEM_ADMIN,
        gender=Gender.OTHER,
        age=30,
    )
    system_admin.system_admin_profile = SystemAdmin(admin_code="SYS-AUDIT-001")
    db_session.add(system_admin)
    await db_session.flush()
    add_audit_log(
        db_session,
        admin_user,
        "UPDATE_EVENT",
        "events",
        42,
        old_value={"status": "DRAFT"},
        new_value={"status": "LIVE"},
    )
    await db_session.commit()

    async def override_db():
        yield db_session

    async def override_system_admin():
        return system_admin

    app.dependency_overrides[get_db_session] = override_db
    app.dependency_overrides[get_current_system_admin] = override_system_admin
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/admin/audit-logs", params={"action": "update_event", "target_table": "events"})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["actor_user_id"] == admin_user.id
    assert body["items"][0]["actor_user_type"] == "EVENT_STAFF"
    assert body["items"][0]["target_id"] == "42"
    assert body["items"][0]["old_value"] == '{"status": "DRAFT"}'
    assert body["items"][0]["new_value"] == '{"status": "LIVE"}'


@pytest.mark.asyncio
async def test_event_staff_cannot_query_audit_logs(db_session, admin_user):
    async def override_db():
        yield db_session

    async def override_system_admin():
        from fastapi import HTTPException

        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chi system admin moi duoc truy cap")

    app.dependency_overrides[get_db_session] = override_db
    app.dependency_overrides[get_current_system_admin] = override_system_admin
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/admin/audit-logs")
    finally:
        app.dependency_overrides.clear()

    assert admin_user.user_type == UserType.EVENT_STAFF
    assert response.status_code == status.HTTP_403_FORBIDDEN
