"""Authentication routes."""

from datetime import UTC, datetime, timedelta
import json
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.db import get_db_session
from app.core.firebase import FirebaseTokenError, verify_firebase_token
from app.core.security import create_access_token, hash_password, verify_password
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import AuthTokenResponse, FirebaseTokenRequest, LoginRequest, RegisterRequest, UpdateProfileRequest, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()
DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"
DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize"
DISCORD_ME_URL = "https://discord.com/api/users/@me"


def _create_discord_state() -> str:
    payload = {
        "purpose": "discord_oauth",
        "exp": datetime.now(UTC) + timedelta(minutes=10),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def _verify_discord_state(state: str) -> None:
    try:
        payload = jwt.decode(state, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Discord OAuth state") from exc

    if payload.get("purpose") != "discord_oauth":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Discord OAuth state")


def _frontend_auth_redirect(access_token: str, user: UserResponse) -> RedirectResponse:
    encoded_user = quote(json.dumps(user.model_dump(mode="json"), separators=(",", ":")))
    url = f"{settings.frontend_app_url.rstrip('/')}/login?access_token={quote(access_token)}&user={encoded_user}"
    return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)


def _frontend_auth_error_redirect(message: str) -> RedirectResponse:
    url = f"{settings.frontend_app_url.rstrip('/')}/login?oauth_error={quote(message)}"
    return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)


@router.post("/register", response_model=AuthTokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, session: AsyncSession = Depends(get_db_session)) -> AuthTokenResponse:
    """Register a new customer account and return JWT token."""

    existing = await session.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")

    user = User(
        full_name=payload.full_name,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role=UserRole.CUSTOMER,
        gender=payload.gender,
        age=payload.age,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    token = create_access_token(str(user.id))
    return AuthTokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=AuthTokenResponse)
async def login(payload: LoginRequest, session: AsyncSession = Depends(get_db_session)) -> AuthTokenResponse:
    """Authenticate user with email/password and return JWT token."""

    user = await session.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    token = create_access_token(str(user.id))
    return AuthTokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/firebase-token", response_model=AuthTokenResponse)
async def firebase_auth(payload: FirebaseTokenRequest, session: AsyncSession = Depends(get_db_session)) -> AuthTokenResponse:
    """Verify Firebase ID token and return JWT for TicketRush."""
    try:
        claims = verify_firebase_token(payload.id_token)
    except FirebaseTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Firebase token")

    firebase_uid: str | None = claims.get("uid")
    email: str | None = claims.get("email")
    name: str | None = claims.get("name")

    if not firebase_uid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Firebase token: missing uid")

    user = await session.scalar(select(User).where(User.firebase_uid == firebase_uid))

    if not user and email:
        user = await session.scalar(select(User).where(User.email == email.lower()))

    if not user:
        user = User(
            full_name=name or email or "User",
            email=(email or f"{firebase_uid}@firebase").lower(),
            password_hash="SOCIAL_LOGIN",
            firebase_uid=firebase_uid,
            role=UserRole.CUSTOMER,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
    elif not user.firebase_uid:
        user.firebase_uid = firebase_uid
        await session.commit()
        await session.refresh(user)

    jwt_token = create_access_token(str(user.id))
    return AuthTokenResponse(access_token=jwt_token, user=UserResponse.model_validate(user))


@router.get("/discord/login")
async def discord_login() -> RedirectResponse:
    """Start Discord OAuth login flow."""

    if not settings.discord_client_id or not settings.discord_client_secret:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Discord OAuth is not configured")

    state = _create_discord_state()
    params = {
        "client_id": settings.discord_client_id,
        "response_type": "code",
        "redirect_uri": settings.discord_redirect_uri,
        "scope": "identify email",
        "prompt": "consent",
        "state": state,
    }
    query = "&".join(f"{key}={quote(str(value), safe='')}" for key, value in params.items())
    return RedirectResponse(url=f"{DISCORD_AUTHORIZE_URL}?{query}", status_code=status.HTTP_302_FOUND)


@router.get("/discord/callback")
async def discord_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    """Handle Discord OAuth callback, then redirect back to frontend with TicketRush JWT."""

    if error:
        return _frontend_auth_error_redirect(f"Discord login failed: {error}")
    if not code or not state:
        return _frontend_auth_error_redirect("Discord login failed: missing code or state")

    try:
        _verify_discord_state(state)
    except HTTPException:
        return _frontend_auth_error_redirect("Discord login failed: invalid state")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            token_response = await client.post(
                DISCORD_TOKEN_URL,
                data={
                    "client_id": settings.discord_client_id,
                    "client_secret": settings.discord_client_secret,
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": settings.discord_redirect_uri,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            token_response.raise_for_status()
            token_payload = token_response.json()
            access_token = token_payload.get("access_token")
            if not access_token:
                return _frontend_auth_error_redirect("Discord login failed: missing access token")

            profile_response = await client.get(
                DISCORD_ME_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            profile_response.raise_for_status()
            profile = profile_response.json()
    except httpx.HTTPError:
        return _frontend_auth_error_redirect("Discord login failed while contacting Discord")

    discord_id = str(profile.get("id") or "").strip()
    email = str(profile.get("email") or "").strip().lower()
    display_name = str(profile.get("global_name") or profile.get("username") or email or "Discord User").strip()
    if not discord_id:
        return _frontend_auth_error_redirect("Discord login failed: missing account id")

    user = await session.scalar(select(User).where(User.discord_id == discord_id))
    if not user and email:
        user = await session.scalar(select(User).where(User.email == email))

    if not user:
        user = User(
            full_name=display_name,
            email=email or f"discord_{discord_id}@discord.local",
            password_hash="SOCIAL_LOGIN",
            discord_id=discord_id,
            role=UserRole.CUSTOMER,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
    else:
        updates = False
        if not user.discord_id:
            user.discord_id = discord_id
            updates = True
        if not user.full_name and display_name:
            user.full_name = display_name
            updates = True
        if updates:
            await session.commit()
            await session.refresh(user)

    jwt_token = create_access_token(str(user.id))
    return _frontend_auth_redirect(jwt_token, UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    """Return currently authenticated user profile."""

    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    payload: UpdateProfileRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Allow authenticated user to edit personal profile information."""

    current_user.full_name = payload.full_name
    current_user.gender = payload.gender
    current_user.age = payload.age

    await session.commit()
    await session.refresh(current_user)
    return UserResponse.model_validate(current_user)
