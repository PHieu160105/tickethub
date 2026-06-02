"""Zalo OAuth helpers for Social API login."""

from typing import Any

import httpx

from app.core.config import get_settings

settings = get_settings()

ZALO_TOKEN_URL = "https://oauth.zaloapp.com/v4/access_token"
ZALO_USERINFO_URL = "https://graph.zalo.me/v2.0/me"


class ZaloAuthError(Exception):
    """Raised when Zalo OAuth exchange or profile lookup fails."""


async def exchange_zalo_code(code: str, code_verifier: str) -> dict[str, Any]:
    """Exchange Zalo authorization code for user access token."""

    if not settings.zalo_client_id or not settings.zalo_client_secret:
        raise ZaloAuthError("Chưa cấu hình Zalo OAuth")

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.post(
                ZALO_TOKEN_URL,
                data={
                    "code": code,
                    "app_id": settings.zalo_client_id,
                    "grant_type": "authorization_code",
                    "code_verifier": code_verifier,
                },
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "secret_key": settings.zalo_client_secret,
                },
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise ZaloAuthError("Không đổi được Zalo authorization code") from exc

    token_payload = response.json()
    if not token_payload.get("access_token"):
        raise ZaloAuthError("Zalo không trả access token")
    return token_payload


async def fetch_zalo_profile(access_token: str) -> dict[str, Any]:
    """Fetch Zalo Social API profile from a user access token."""

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(
                ZALO_USERINFO_URL,
                params={"access_token": access_token, "accesstoken": access_token, "fields": "id,name,picture,email"},
                headers={"access_token": access_token},
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise ZaloAuthError("Không lấy được hồ sơ Zalo") from exc

    profile = response.json()
    if profile.get("error"):
        raise ZaloAuthError("Zalo trả lỗi hồ sơ người dùng")
    if not profile.get("id"):
        raise ZaloAuthError("Hồ sơ Zalo thiếu id")
    return profile
