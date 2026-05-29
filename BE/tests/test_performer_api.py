"""Kiem thu API performer theo show cho admin va public."""

import pytest
from fastapi import status
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.enums import EventStatus, PerformerRole
from app.schemas.performer import ShowPerformerUpsertRequest
from app.services.performer_service import update_show_performer_lineup


async def _override_admin_client(db_session, admin_user):
    from app.api.deps import get_current_active_admin, get_db_session

    async def override_get_db():
        yield db_session

    async def override_get_admin():
        return admin_user

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_current_active_admin] = override_get_admin
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_admin_can_put_and_get_show_performers(db_session, admin_user, sample_event, sample_show):
    """Admin co the luu lineup va doc lai day du main/guest/backup cho mot show draft."""

    sample_show.status = EventStatus.DRAFT
    await db_session.commit()

    async with await _override_admin_client(db_session, admin_user) as client:
        try:
            put_response = await client.put(
                f"/api/admin/shows/{sample_show.id}/performers",
                json={
                    "performers": [
                            {"stage_name": "Main One", "artist_type": "Singer", "role": "MAIN", "sort_order": 0},
                            {"stage_name": "Guest One", "artist_type": "Rapper", "role": "GUEST", "sort_order": 1},
                            {"stage_name": "Backup One", "artist_type": "Dancer", "role": "BACKUP", "sort_order": 2},
                            {"stage_name": "Backup Two", "artist_type": "Dancer", "role": "BACKUP", "sort_order": 3},
                    ]
                },
            )
            assert put_response.status_code == status.HTTP_200_OK
            get_response = await client.get(f"/api/admin/shows/{sample_show.id}/performers")
        finally:
            app.dependency_overrides.clear()

    assert get_response.status_code == status.HTTP_200_OK
    data = get_response.json()
    assert len(data) == 4
    assert any(item["role"] == "MAIN" and item["stage_name"] == "Main One" for item in data)
    assert sum(1 for item in data if item["role"] == "BACKUP") == 2


@pytest.mark.asyncio
async def test_admin_show_performer_update_allows_guest_without_backup(db_session, admin_user, sample_show):
    """Guest khong con bat buoc phai di kem backup."""

    sample_show.status = EventStatus.DRAFT
    await db_session.commit()

    async with await _override_admin_client(db_session, admin_user) as client:
        try:
            response = await client.put(
                f"/api/admin/shows/{sample_show.id}/performers",
                json={
                    "performers": [
                            {"stage_name": "Main One", "artist_type": "Singer", "role": "MAIN", "sort_order": 0},
                            {"stage_name": "Guest One", "artist_type": "Host", "role": "GUEST", "sort_order": 1},
                    ]
                },
            )
        finally:
            app.dependency_overrides.clear()

    assert response.status_code == status.HTTP_200_OK


@pytest.mark.asyncio
async def test_admin_show_performer_update_allows_no_backup_when_no_guest(db_session, admin_user, sample_show):
    """Khong co guest thi khong bat buoc phai co backup."""

    sample_show.status = EventStatus.DRAFT
    await db_session.commit()

    async with await _override_admin_client(db_session, admin_user) as client:
        try:
            response = await client.put(
                f"/api/admin/shows/{sample_show.id}/performers",
                json={
                    "performers": [
                            {"stage_name": "Main One", "artist_type": "Singer", "role": "MAIN", "sort_order": 0},
                    ]
                },
            )
        finally:
            app.dependency_overrides.clear()

    assert response.status_code == status.HTTP_200_OK


@pytest.mark.asyncio
async def test_admin_show_performer_update_rejects_when_lineup_has_no_main(db_session, admin_user, sample_show):
    """Snapshot lineup van phai co it nhat mot main."""

    sample_show.status = EventStatus.DRAFT
    await db_session.commit()

    async with await _override_admin_client(db_session, admin_user) as client:
        try:
            response = await client.put(
                f"/api/admin/shows/{sample_show.id}/performers",
                json={
                    "performers": [
                            {"stage_name": "Guest One", "artist_type": "Host", "role": "GUEST", "sort_order": 0},
                    ]
                },
            )
        finally:
            app.dependency_overrides.clear()

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "main" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_admin_cannot_change_existing_main_role(db_session, admin_user, sample_show):
    """Performer main da co khong duoc doi sang role khac qua endpoint lineup."""

    sample_show.status = EventStatus.DRAFT
    await update_show_performer_lineup(
        db_session,
        sample_show,
        [
            ShowPerformerUpsertRequest(stage_name="Main One", artist_type="Singer", role=PerformerRole.MAIN, sort_order=0),
            ShowPerformerUpsertRequest(stage_name="Backup One", artist_type="Dancer", role=PerformerRole.BACKUP, sort_order=1),
            ShowPerformerUpsertRequest(stage_name="Backup Two", artist_type="Dancer", role=PerformerRole.BACKUP, sort_order=2),
        ],
    )
    await db_session.commit()

    async with await _override_admin_client(db_session, admin_user) as client:
        try:
            lineup_response = await client.get(f"/api/admin/shows/{sample_show.id}/performers")
            main_row = next(item for item in lineup_response.json() if item["role"] == "MAIN")
            response = await client.put(
                f"/api/admin/shows/{sample_show.id}/performers",
                json={
                    "performers": [
                        {**main_row, "role": "GUEST"},
                        {"stage_name": "Backup One", "artist_type": "Dancer", "role": "BACKUP", "sort_order": 1},
                        {"stage_name": "Backup Two", "artist_type": "Dancer", "role": "BACKUP", "sort_order": 2},
                    ]
                },
            )
        finally:
            app.dependency_overrides.clear()

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "main" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_admin_can_remove_existing_main_if_snapshot_still_has_another_main(db_session, admin_user, sample_show):
    """Co the bo performer main cu khoi show neu lineup sau cung van con main."""

    sample_show.status = EventStatus.DRAFT
    await update_show_performer_lineup(
        db_session,
        sample_show,
        [
            ShowPerformerUpsertRequest(stage_name="Main One", artist_type="Singer", role=PerformerRole.MAIN, sort_order=0),
            ShowPerformerUpsertRequest(stage_name="Guest One", artist_type="Host", role=PerformerRole.GUEST, sort_order=1),
        ],
    )
    await db_session.commit()

    async with await _override_admin_client(db_session, admin_user) as client:
        try:
            lineup_response = await client.get(f"/api/admin/shows/{sample_show.id}/performers")
            guest_row = next(item for item in lineup_response.json() if item["role"] == "GUEST")
            response = await client.put(
                f"/api/admin/shows/{sample_show.id}/performers",
                json={
                    "performers": [
                        {"stage_name": "Replacement Main", "artist_type": "Singer", "role": "MAIN", "sort_order": 0},
                        guest_row,
                    ]
                },
            )
        finally:
            app.dependency_overrides.clear()

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert any(item["role"] == "MAIN" and item["stage_name"] == "Replacement Main" for item in data)
    assert all(item["stage_name"] != "Main One" for item in data)


@pytest.mark.asyncio
async def test_admin_can_readd_same_performer_after_removing_old_show_link(db_session, admin_user, sample_show):
    """Neu xoa card cu roi them lai cung performer thi update khong duoc bi unique constraint."""

    sample_show.status = EventStatus.DRAFT
    await update_show_performer_lineup(
        db_session,
        sample_show,
        [
            ShowPerformerUpsertRequest(stage_name="Main One", artist_type="Singer", role=PerformerRole.MAIN, sort_order=0),
        ],
    )
    await db_session.commit()

    async with await _override_admin_client(db_session, admin_user) as client:
        try:
            lineup_response = await client.get(f"/api/admin/shows/{sample_show.id}/performers")
            original_main = next(item for item in lineup_response.json() if item["role"] == "MAIN")
            response = await client.put(
                f"/api/admin/shows/{sample_show.id}/performers",
                json={
                    "performers": [
                        {
                            "performer_id": original_main["performer_id"],
                            "stage_name": original_main["stage_name"],
                            "artist_type": original_main["artist_type"],
                            "image_url": original_main["image_url"],
                            "role": "MAIN",
                            "sort_order": 0,
                        },
                    ]
                },
            )
        finally:
            app.dependency_overrides.clear()

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data) == 1
    assert data[0]["stage_name"] == "Main One"


@pytest.mark.asyncio
async def test_public_show_and_event_detail_hide_backup_performers(db_session, sample_event, sample_show):
    """Public event/show detail chi duoc hien thi main va guest, khong lo backup."""

    await update_show_performer_lineup(
        db_session,
        sample_show,
        [
            ShowPerformerUpsertRequest(stage_name="Main One", artist_type="Singer", role=PerformerRole.MAIN, sort_order=0),
            ShowPerformerUpsertRequest(stage_name="Guest One", artist_type="Host", role=PerformerRole.GUEST, sort_order=1),
            ShowPerformerUpsertRequest(stage_name="Backup One", artist_type="Dancer", role=PerformerRole.BACKUP, sort_order=2),
            ShowPerformerUpsertRequest(stage_name="Backup Two", artist_type="Dancer", role=PerformerRole.BACKUP, sort_order=3),
        ],
    )
    sample_show.status = EventStatus.LIVE
    sample_event.status = EventStatus.LIVE
    await db_session.commit()

    from app.api.deps import get_db_session

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db_session] = override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        try:
            event_response = await client.get(f"/api/events/{sample_event.slug}")
            show_response = await client.get(f"/api/shows/{sample_show.id}")
        finally:
            app.dependency_overrides.clear()

    assert event_response.status_code == status.HTTP_200_OK
    event_data = event_response.json()
    assert len(event_data["shows"][0]["performers"]) == 2
    assert {item["role"] for item in event_data["shows"][0]["performers"]} == {"MAIN", "GUEST"}
    assert [item["role"] for item in event_data["shows"][0]["performers"]] == ["MAIN", "GUEST"]

    assert show_response.status_code == status.HTTP_200_OK
    show_data = show_response.json()
    assert len(show_data["performers"]) == 2
    assert {item["role"] for item in show_data["performers"]} == {"MAIN", "GUEST"}
    assert [item["role"] for item in show_data["performers"]] == ["MAIN", "GUEST"]


@pytest.mark.asyncio
async def test_admin_performer_suggest_returns_saved_performer(db_session, admin_user, sample_show):
    """Autocomplete performer phai tra performer da duoc luu trong he thong."""

    sample_show.status = EventStatus.DRAFT
    await update_show_performer_lineup(
        db_session,
        sample_show,
        [
            ShowPerformerUpsertRequest(stage_name="Main Suggest", artist_type="Singer", role=PerformerRole.MAIN, sort_order=0),
            ShowPerformerUpsertRequest(stage_name="Backup Suggest One", artist_type="Dancer", role=PerformerRole.BACKUP, sort_order=1),
            ShowPerformerUpsertRequest(stage_name="Backup Suggest Two", artist_type="Dancer", role=PerformerRole.BACKUP, sort_order=2),
        ],
    )
    await db_session.commit()

    async with await _override_admin_client(db_session, admin_user) as client:
        try:
            response = await client.get("/api/admin/performers/suggest", params={"q": "Main Sug"})
        finally:
            app.dependency_overrides.clear()

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data
    assert data[0]["stage_name"] == "Main Suggest"
