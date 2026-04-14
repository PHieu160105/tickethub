"""Reusable dependency utilities for auth and authorization."""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.core.security import TokenDecodeError, decode_access_token
from app.models.enums import UserRole
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
oauth2_optional_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def get_current_user(
    session: AsyncSession = Depends(get_db_session),
    token: str = Depends(oauth2_scheme),
) -> User:
    """Resolve currently authenticated user from bearer token."""

    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(token)
    except TokenDecodeError as exc:
        raise credentials_exc from exc

    user_id = int(payload["sub"])
    user = await session.scalar(select(User).where(User.id == user_id))
    if not user:
        raise credentials_exc

    return user


async def get_current_active_admin(current_user: User = Depends(get_current_user)) -> User:
    """Allow access only for admin role."""

    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role is required")
    return current_user


async def get_current_customer(current_user: User = Depends(get_current_user)) -> User:
    """Allow access only for customer booking actions."""

    if current_user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Customer role is required")
    return current_user


async def get_optional_current_user(
    session: AsyncSession = Depends(get_db_session),
    token: str | None = Depends(oauth2_optional_scheme),
) -> User | None:
    """Resolve current user when token exists; otherwise return None."""

    if not token:
        return None

    try:
        payload = decode_access_token(token)
    except TokenDecodeError:
        return None

    user_id = int(payload["sub"])
    return await session.scalar(select(User).where(User.id == user_id))
