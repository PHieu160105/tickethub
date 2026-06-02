"""Kiểm thử quy ước xác thực."""

import pytest
from fastapi import HTTPException
from starlette.requests import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes import auth as auth_routes
from app.api.routes.auth import google_auth, login
from app.core import google_auth as google_auth_module
from app.core.google_auth import GoogleTokenError
from app.models.enums import UserType
from app.models.user import Customer, User
from app.schemas.auth import GoogleTokenRequest, LoginRequest


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


@pytest.mark.asyncio
async def test_google_auth_rejects_profile_without_email(monkeypatch, db_session: AsyncSession):
    """Google login trong frontend xin scope email, nên backend không tạo email giả."""

    async def fake_verify_google_access_token(_: str) -> dict[str, str]:
        return {"sub": "google-user-id", "name": "Google User"}

    monkeypatch.setattr(auth_routes, "verify_google_access_token", fake_verify_google_access_token)

    with pytest.raises(HTTPException) as exc_info:
        await google_auth(payload=GoogleTokenRequest(access_token="google-access-token"), session=db_session)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Google token thieu email"


@pytest.mark.asyncio
async def test_zalo_login_redirects_to_permission_with_pkce(monkeypatch):
    """Zalo login phải chuyển người dùng sang authorization endpoint với state và PKCE."""

    monkeypatch.setattr(auth_routes.settings, "zalo_client_id", "123456")
    monkeypatch.setattr(auth_routes.settings, "zalo_client_secret", "secret")
    monkeypatch.setattr(auth_routes.settings, "zalo_redirect_uri", "http://localhost:8000/api/auth/zalo/callback")

    response = await auth_routes.zalo_login()

    assert response.status_code == 302
    location = response.headers["location"]
    assert location.startswith("https://oauth.zaloapp.com/v4/permission?")
    assert "app_id=123456" in location
    assert "code_challenge=" in location
    set_cookie_headers = [value.decode() for key, value in response.raw_headers if key == b"set-cookie"]
    assert sum("ticketrush_zalo_" in header for header in set_cookie_headers) == 2


@pytest.mark.asyncio
async def test_zalo_callback_creates_customer_and_redirects(monkeypatch, db_session: AsyncSession):
    """Callback Zalo thành công phải tạo/link customer và trả token về frontend."""

    async def fake_exchange_zalo_code(code: str, code_verifier: str) -> dict[str, str]:
        assert code == "oauth-code"
        assert code_verifier == "verifier"
        return {"access_token": "zalo-access-token"}

    async def fake_fetch_zalo_profile(access_token: str) -> dict[str, str]:
        assert access_token == "zalo-access-token"
        return {"id": "zalo-user-id", "name": "Zalo User", "email": "zalo@example.com"}

    monkeypatch.setattr(auth_routes, "exchange_zalo_code", fake_exchange_zalo_code)
    monkeypatch.setattr(auth_routes, "fetch_zalo_profile", fake_fetch_zalo_profile)
    monkeypatch.setattr(auth_routes.settings, "frontend_app_url", "http://localhost:5173")

    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/auth/zalo/callback",
            "headers": [
                (
                    b"cookie",
                    (
                        f"{auth_routes.ZALO_STATE_COOKIE}=state;"
                        f" {auth_routes.ZALO_VERIFIER_COOKIE}=verifier"
                    ).encode(),
                )
            ],
        }
    )

    response = await auth_routes.zalo_callback(
        request=request,
        code="oauth-code",
        oauth_code=None,
        state="state",
        error=None,
        session=db_session,
    )

    assert response.status_code == 302
    location = response.headers["location"]
    assert location.startswith("http://localhost:5173/login?")
    assert "access_token=" in location
    assert "refresh_token=" in location
    assert "zalo%40example.com" in location


@pytest.mark.asyncio
async def test_zalo_callback_uses_valid_fallback_email_when_profile_has_no_email(monkeypatch, db_session: AsyncSession):
    """Zalo không luôn trả email, fallback vẫn phải hợp lệ với UserResponse EmailStr."""

    async def fake_exchange_zalo_code(_: str, __: str) -> dict[str, str]:
        return {"access_token": "zalo-access-token"}

    async def fake_fetch_zalo_profile(_: str) -> dict[str, str]:
        return {"id": "1830879403604473031", "name": "Zalo User"}

    monkeypatch.setattr(auth_routes, "exchange_zalo_code", fake_exchange_zalo_code)
    monkeypatch.setattr(auth_routes, "fetch_zalo_profile", fake_fetch_zalo_profile)
    monkeypatch.setattr(auth_routes.settings, "frontend_app_url", "http://localhost:5173")

    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/auth/zalo/callback",
            "headers": [
                (
                    b"cookie",
                    (
                        f"{auth_routes.ZALO_STATE_COOKIE}=state;"
                        f" {auth_routes.ZALO_VERIFIER_COOKIE}=verifier"
                    ).encode(),
                )
            ],
        }
    )

    response = await auth_routes.zalo_callback(
        request=request,
        code="oauth-code",
        oauth_code=None,
        state="state",
        error=None,
        session=db_session,
    )

    assert response.status_code == 302
    assert "zalo_1830879403604473031%40example.com" in response.headers["location"]


@pytest.mark.asyncio
async def test_zalo_callback_repairs_legacy_local_fallback_email(monkeypatch, db_session: AsyncSession):
    """User Zalo đã lỡ lưu email `.local` phải được sửa để response không còn fail validation."""

    legacy_user = User(
        full_name="Legacy Zalo User",
        email="zalo_1830879403604473031@zalo.local",
        password_hash="SOCIAL_LOGIN",
        user_type=UserType.CUSTOMER,
    )
    legacy_user.customer_profile = Customer(zalo_id="1830879403604473031")
    db_session.add(legacy_user)
    await db_session.commit()

    async def fake_exchange_zalo_code(_: str, __: str) -> dict[str, str]:
        return {"access_token": "zalo-access-token"}

    async def fake_fetch_zalo_profile(_: str) -> dict[str, str]:
        return {"id": "1830879403604473031", "name": "Zalo User"}

    monkeypatch.setattr(auth_routes, "exchange_zalo_code", fake_exchange_zalo_code)
    monkeypatch.setattr(auth_routes, "fetch_zalo_profile", fake_fetch_zalo_profile)
    monkeypatch.setattr(auth_routes.settings, "frontend_app_url", "http://localhost:5173")

    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/auth/zalo/callback",
            "headers": [
                (
                    b"cookie",
                    (
                        f"{auth_routes.ZALO_STATE_COOKIE}=state;"
                        f" {auth_routes.ZALO_VERIFIER_COOKIE}=verifier"
                    ).encode(),
                )
            ],
        }
    )

    response = await auth_routes.zalo_callback(
        request=request,
        code="oauth-code",
        oauth_code=None,
        state="state",
        error=None,
        session=db_session,
    )

    assert response.status_code == 302
    assert "zalo_1830879403604473031%40example.com" in response.headers["location"]
