from fastapi import APIRouter, Depends

from app.api.deps import get_current_active_admin
from app.models.user import User
from app.schemas.site_settings import SiteSettingsPayload
from app.services.site_settings_service import load_site_settings, save_site_settings

router = APIRouter(prefix="/settings")


@router.get("/site", response_model=SiteSettingsPayload)
async def get_admin_site_settings(_: User = Depends(get_current_active_admin)) -> SiteSettingsPayload:
    return load_site_settings()


@router.put("/site", response_model=SiteSettingsPayload)
async def update_admin_site_settings(
    payload: SiteSettingsPayload,
    _: User = Depends(get_current_active_admin),
) -> SiteSettingsPayload:
    return save_site_settings(payload)
