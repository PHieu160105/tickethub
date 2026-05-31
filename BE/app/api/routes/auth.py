"""Auth, profile, and social-login routes."""

import json
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
    if email and email_verified is False:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email Google chua duoc xac minh")

    customer = await session.scalar(select(Customer).where(Customer.google_id == google_id))
    user = customer.user if customer else None

    if not user and email:
        user = await session.scalar(select(User).where(User.email == email, User.user_type == UserType.CUSTOMER))

    if not user:
        user = User(
            full_name=name or email or "Google User",
            email=email or f"google_{google_id}@google.local",
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
    return _frontend_auth_error_redirect("Dang nhap Zalo se duoc bo sung o phase tiep theo")


@router.get("/zalo/callback")
async def zalo_callback() -> RedirectResponse:
    return _frontend_auth_error_redirect("Dang nhap Zalo chua san sang tren backend")


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
