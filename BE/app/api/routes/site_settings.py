"""Public and admin APIs for lightweight site settings."""

from fastapi import APIRouter, Depends

from app.api.deps import get_current_active_admin
from app.models.user import User
from app.schemas.site_settings import SiteSettingsPayload
from app.services.site_settings_service import load_site_settings, save_site_settings


public_router = APIRouter(prefix="/settings", tags=["settings"])
admin_router = APIRouter(prefix="/admin/settings", tags=["admin-settings"])


@public_router.get("/site", response_model=SiteSettingsPayload)
async def get_public_site_settings() -> SiteSettingsPayload:
    """Return public-facing site settings for customer pages."""

    return load_site_settings()


@admin_router.get("/site", response_model=SiteSettingsPayload)
async def get_admin_site_settings(_: User = Depends(get_current_active_admin)) -> SiteSettingsPayload:
    """Return editable site settings for admin forms."""

    return load_site_settings()


@admin_router.put("/site", response_model=SiteSettingsPayload)
async def update_admin_site_settings(
    payload: SiteSettingsPayload,
    _: User = Depends(get_current_active_admin),
) -> SiteSettingsPayload:
    """Overwrite site settings stored in the backend JSON file."""

    return save_site_settings(payload)

