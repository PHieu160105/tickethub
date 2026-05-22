"""Xác thực Google OAuth token trực tiếp."""

from typing import Any

import httpx

from app.core.config import get_settings

settings = get_settings()

GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


class GoogleTokenError(Exception):
    """Được ném ra khi xác thực Google access token thất bại."""


async def verify_google_access_token(access_token: str) -> dict[str, Any]:
    """Lấy hồ sơ Google từ access token do frontend nhận qua Google Identity Services."""

    if not settings.google_client_id:
        raise GoogleTokenError("Chưa cấu hình Google Client ID")

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise GoogleTokenError("Google token không hợp lệ") from exc

    profile = response.json()
    if not profile.get("sub"):
        raise GoogleTokenError("Google token thiếu sub")

    return profile
