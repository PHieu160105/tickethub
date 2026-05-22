"""Kiểm thử quy ước xác thực."""

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import login
from app.core import google_auth as google_auth_module
from app.core.google_auth import GoogleTokenError
from app.schemas.auth import LoginRequest


@pytest.mark.asyncio
async def test_login_returns_auth_error_instead_of_validation_error_for_bad_credentials(db_session: AsyncSession):
    """Đăng nhập phải chuẩn hóa thông tin sai định dạng và thất bại qua logic xác thực."""

    payload = LoginRequest(email="  not-an-email  ", password="x")

    with pytest.raises(HTTPException) as exc_info:
        await login(payload=payload, session=db_session)

    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_google_verify_rejects_failed_userinfo(monkeypatch):
    """Lỗi Google userinfo phải được chuẩn hóa để route auth trả 401."""

    class FakeResponse:
        def raise_for_status(self) -> None:
            raise google_auth_module.httpx.HTTPStatusError(
                "bad google token",
                request=google_auth_module.httpx.Request("GET", google_auth_module.GOOGLE_USERINFO_URL),
                response=google_auth_module.httpx.Response(401),
            )

    class FakeClient:
        def __init__(self, *_: object, **__: object) -> None:
            pass

        async def __aenter__(self) -> "FakeClient":
            return self

        async def __aexit__(self, *_: object) -> None:
            pass

        async def get(self, *_: object, **__: object) -> FakeResponse:
            return FakeResponse()

    monkeypatch.setattr(google_auth_module.httpx, "AsyncClient", FakeClient)

    with pytest.raises(GoogleTokenError):
        await google_auth_module.verify_google_access_token("bad-token")
