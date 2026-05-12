"""Authentication routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db_session
from app.core.firebase import FirebaseTokenError, verify_firebase_token
from app.core.security import create_access_token, hash_password, verify_password
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import AuthTokenResponse, FirebaseTokenRequest, LoginRequest, RegisterRequest, UpdateProfileRequest, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


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
