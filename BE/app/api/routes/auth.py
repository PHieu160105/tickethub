"""Auth, profile, and social-login routes."""

import base64
import hashlib
import json
import secrets
from urllib.parse import quote, urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.db import get_db_session
from app.core.google_auth import GoogleTokenError, verify_google_access_token
from app.core.security import (
    TokenDecodeError,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)
from app.core.zalo_auth import ZaloAuthError, exchange_zalo_code, fetch_zalo_profile
from app.models.enums import UserType
from app.models.user import Customer, User
from app.schemas.auth import (
    AuthTokenResponse,
    GoogleTokenRequest,
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    UpdateProfileRequest,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()
ZALO_STATE_COOKIE = "ticketrush_zalo_oauth_state"
ZALO_VERIFIER_COOKIE = "ticketrush_zalo_code_verifier"


def _build_auth_response(user: User) -> AuthTokenResponse:
    user_id = str(user.id)
    return AuthTokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
        user=UserResponse.model_validate(user),
    )


def _frontend_auth_redirect(access_token: str, refresh_token: str, user: UserResponse) -> RedirectResponse:
    encoded_user = quote(json.dumps(user.model_dump(mode="json"), separators=(",", ":")))
    url = (
        f"{settings.frontend_app_url.rstrip('/')}/login"
        f"?access_token={quote(access_token)}"
        f"&refresh_token={quote(refresh_token)}"
        f"&user={encoded_user}"
    )
    return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)


def _frontend_auth_error_redirect(message: str) -> RedirectResponse:
    url = f"{settings.frontend_app_url.rstrip('/')}/login?oauth_error={quote(message)}"
    return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)


def _delete_zalo_oauth_cookies(response: RedirectResponse) -> RedirectResponse:
    response.delete_cookie(ZALO_STATE_COOKIE, path="/api/auth")
    response.delete_cookie(ZALO_VERIFIER_COOKIE, path="/api/auth")
    return response


def _create_code_challenge(code_verifier: str) -> str:
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


def _valid_social_fallback_email(provider: str, social_id: str) -> str:
    return f"{provider}_{social_id}@example.com"


def _repair_legacy_social_fallback_email(user: User, provider: str, social_id: str) -> None:
    if user.email.endswith(f"@{provider}.local"):
        user.email = _valid_social_fallback_email(provider, social_id)


@router.post("/register", response_model=AuthTokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, session: AsyncSession = Depends(get_db_session)) -> AuthTokenResponse:
    existing = await session.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email da ton tai")

    user = User(
        full_name=payload.full_name,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        user_type=UserType.CUSTOMER,
        gender=payload.gender,
        age=payload.age,
    )
    user.customer_profile = Customer()
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return _build_auth_response(user)


@router.post("/login", response_model=AuthTokenResponse)
async def login(payload: LoginRequest, session: AsyncSession = Depends(get_db_session)) -> AuthTokenResponse:
    user = await session.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email hoac mat khau khong dung")
    return _build_auth_response(user)


@router.post("/google-token", response_model=AuthTokenResponse)
async def google_auth(payload: GoogleTokenRequest, session: AsyncSession = Depends(get_db_session)) -> AuthTokenResponse:
    try:
        profile = await verify_google_access_token(payload.access_token)
    except GoogleTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google token khong hop le")

    google_id = str(profile.get("sub") or "").strip()
    email = str(profile.get("email") or "").strip().lower()
    name = str(profile.get("name") or email or "Google User").strip()
    email_verified = profile.get("email_verified")

    if not google_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google token thieu sub")
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google token thieu email")
    if email and email_verified is False:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email Google chua duoc xac minh")

    customer = await session.scalar(select(Customer).where(Customer.google_id == google_id))
    user = customer.user if customer else None

    if not user and email:
        user = await session.scalar(select(User).where(User.email == email, User.user_type == UserType.CUSTOMER))

    if not user:
        user = User(
            full_name=name or email or "Google User",
            email=email,
            password_hash="SOCIAL_LOGIN",
            user_type=UserType.CUSTOMER,
        )
        user.customer_profile = Customer(google_id=google_id)
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return _build_auth_response(user)

    if user.user_type != UserType.CUSTOMER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Dang nhap Google chi ap dung cho customer")

    if not user.customer_profile:
        user.customer_profile = Customer(google_id=google_id)
    elif not user.customer_profile.google_id:
        user.customer_profile.google_id = google_id
    await session.commit()
    await session.refresh(user)
    return _build_auth_response(user)


@router.get("/zalo/login")
async def zalo_login() -> RedirectResponse:
    if not settings.zalo_client_id or not settings.zalo_client_secret:
        return _frontend_auth_error_redirect("Dang nhap Zalo chua duoc cau hinh")

    state = secrets.token_urlsafe(32)
    code_verifier = secrets.token_urlsafe(48)
    params = urlencode(
        {
            "app_id": settings.zalo_client_id,
            "redirect_uri": settings.zalo_redirect_uri,
            "state": state,
            "code_challenge": _create_code_challenge(code_verifier),
            "code_challenge_method": "S256",
        }
    )
    response = RedirectResponse(url=f"https://oauth.zaloapp.com/v4/permission?{params}", status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        ZALO_STATE_COOKIE,
        state,
        max_age=600,
        httponly=True,
        samesite="lax",
        secure=settings.environment == "production",
        path="/api/auth",
    )
    response.set_cookie(
        ZALO_VERIFIER_COOKIE,
        code_verifier,
        max_age=600,
        httponly=True,
        samesite="lax",
        secure=settings.environment == "production",
        path="/api/auth",
    )
    return response


@router.get("/zalo/callback")
async def zalo_callback(
    request: Request,
    code: str | None = Query(default=None),
    oauth_code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    if error:
        return _delete_zalo_oauth_cookies(_frontend_auth_error_redirect("Nguoi dung da huy dang nhap Zalo"))

    expected_state = request.cookies.get(ZALO_STATE_COOKIE)
    code_verifier = request.cookies.get(ZALO_VERIFIER_COOKIE)
    if not state or not expected_state or not secrets.compare_digest(state, expected_state):
        return _delete_zalo_oauth_cookies(_frontend_auth_error_redirect("Phien dang nhap Zalo khong hop le"))
    if not code_verifier:
        return _delete_zalo_oauth_cookies(_frontend_auth_error_redirect("Phien dang nhap Zalo da het han"))

    authorization_code = code or oauth_code
    if not authorization_code:
        return _delete_zalo_oauth_cookies(_frontend_auth_error_redirect("Zalo khong tra authorization code"))

    try:
        token_payload = await exchange_zalo_code(authorization_code, code_verifier)
        profile = await fetch_zalo_profile(str(token_payload["access_token"]))
    except ZaloAuthError:
        return _delete_zalo_oauth_cookies(_frontend_auth_error_redirect("Dang nhap Zalo khong thanh cong"))

    zalo_id = str(profile.get("id") or "").strip()
    email = str(profile.get("email") or "").strip().lower()
    name = str(profile.get("name") or email or "Zalo User").strip()

    if not zalo_id:
        return _delete_zalo_oauth_cookies(_frontend_auth_error_redirect("Ho so Zalo thieu id"))

    user = await session.scalar(select(User).options(selectinload(User.customer_profile)).join(Customer).where(Customer.zalo_id == zalo_id))
    if not user and email:
        user = await session.scalar(
            select(User).options(selectinload(User.customer_profile)).where(User.email == email, User.user_type == UserType.CUSTOMER)
        )

    if not user:
        user = User(
            full_name=name or email or "Zalo User",
            email=email or _valid_social_fallback_email("zalo", zalo_id),
            password_hash="SOCIAL_LOGIN",
            user_type=UserType.CUSTOMER,
        )
        user.customer_profile = Customer(zalo_id=zalo_id)
        session.add(user)
        await session.commit()
        await session.refresh(user)
        auth_response = _build_auth_response(user)
        return _delete_zalo_oauth_cookies(
            _frontend_auth_redirect(auth_response.access_token, auth_response.refresh_token, auth_response.user)
        )

    if user.user_type != UserType.CUSTOMER:
        return _delete_zalo_oauth_cookies(_frontend_auth_error_redirect("Dang nhap Zalo chi ap dung cho customer"))

    _repair_legacy_social_fallback_email(user, "zalo", zalo_id)
    if not user.customer_profile:
        user.customer_profile = Customer(zalo_id=zalo_id)
    elif not user.customer_profile.zalo_id:
        user.customer_profile.zalo_id = zalo_id
    await session.commit()
    await session.refresh(user)
    auth_response = _build_auth_response(user)
    return _delete_zalo_oauth_cookies(
        _frontend_auth_redirect(auth_response.access_token, auth_response.refresh_token, auth_response.user)
    )


@router.post("/refresh", response_model=AuthTokenResponse)
async def refresh_token(payload: RefreshTokenRequest, session: AsyncSession = Depends(get_db_session)) -> AuthTokenResponse:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Refresh token khong hop le hoac da het han",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        token_payload = decode_refresh_token(payload.refresh_token)
    except TokenDecodeError as exc:
        raise credentials_exc from exc

    user_id = int(token_payload["sub"])
    user = await session.scalar(select(User).where(User.id == user_id))
    if not user:
        raise credentials_exc
    return _build_auth_response(user)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    payload: UpdateProfileRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    current_user.full_name = payload.full_name
    current_user.gender = payload.gender
    current_user.age = payload.age
    await session.commit()
    await session.refresh(current_user)
    return UserResponse.model_validate(current_user)
