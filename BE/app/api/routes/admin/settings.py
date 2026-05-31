from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_system_admin
from app.core.db import get_db_session
from app.models.user import User
from app.schemas.site_settings import SiteSettingsPayload
from app.services.audit_service import add_audit_log
from app.services.site_settings_service import load_site_settings, save_site_settings

router = APIRouter(prefix="/settings")


@router.get("/site", response_model=SiteSettingsPayload)
async def get_admin_site_settings(_: User = Depends(get_current_system_admin)) -> SiteSettingsPayload:
    return load_site_settings()


@router.put("/site", response_model=SiteSettingsPayload)
async def update_admin_site_settings(
    payload: SiteSettingsPayload,
    session: AsyncSession = Depends(get_db_session),
    system_admin: User = Depends(get_current_system_admin),
) -> SiteSettingsPayload:
    old_value = load_site_settings()
    saved = save_site_settings(payload)
    add_audit_log(session, system_admin, "UPDATE_SITE_SETTINGS", "site_settings", "site", old_value=old_value.model_dump(), new_value=saved.model_dump())
    await session.commit()
    return saved
