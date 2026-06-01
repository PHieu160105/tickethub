"""API public/admin cho cấu hình website dạng JSON nhẹ."""

from fastapi import APIRouter, Depends

from app.api.deps import get_current_system_admin
from app.models.user import User
from app.schemas.site_settings import SiteSettingsPayload
from app.services.site_settings_service import load_site_settings, save_site_settings


public_router = APIRouter(prefix="/settings", tags=["settings"])
admin_router = APIRouter(prefix="/admin/settings", tags=["admin-settings"])


@public_router.get("/site", response_model=SiteSettingsPayload)
async def get_public_site_settings() -> SiteSettingsPayload:
    """Trả cấu hình public cho các trang khách hàng."""

    return load_site_settings()


@admin_router.get("/site", response_model=SiteSettingsPayload)
async def get_admin_site_settings(_: User = Depends(get_current_system_admin)) -> SiteSettingsPayload:
    """Trả cấu hình có thể chỉnh sửa cho form admin."""

    return load_site_settings()


@admin_router.put("/site", response_model=SiteSettingsPayload)
async def update_admin_site_settings(
    payload: SiteSettingsPayload,
    _: User = Depends(get_current_system_admin),
) -> SiteSettingsPayload:
    """Ghi đè cấu hình website đang lưu trong file JSON backend."""

    return save_site_settings(payload)

