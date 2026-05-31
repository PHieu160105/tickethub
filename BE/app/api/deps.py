"""Shared FastAPI auth and authorization dependencies."""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.core.security import TokenDecodeError, decode_access_token
from app.models.enums import UserType
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
oauth2_optional_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def get_current_user(
    session: AsyncSession = Depends(get_db_session),
    token: str = Depends(oauth2_scheme),
) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Thong tin dang nhap khong hop le hoac da het han",
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


async def get_optional_current_user(
    session: AsyncSession = Depends(get_db_session),
    token: str | None = Depends(oauth2_optional_scheme),
) -> User | None:
    if not token:
        return None

    try:
        payload = decode_access_token(token)
    except TokenDecodeError:
        return None

    user_id = int(payload["sub"])
    return await session.scalar(select(User).where(User.id == user_id))


async def get_current_active_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.user_type not in {UserType.EVENT_STAFF, UserType.SYSTEM_ADMIN}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chi tai khoan noi bo moi duoc truy cap")
    return current_user


async def get_current_system_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.user_type != UserType.SYSTEM_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chi system admin moi duoc truy cap")
    return current_user


async def get_current_customer(current_user: User = Depends(get_current_user)) -> User:
    if current_user.user_type != UserType.CUSTOMER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chi tai khoan khach hang moi duoc thuc hien thao tac nay")
    return current_user
