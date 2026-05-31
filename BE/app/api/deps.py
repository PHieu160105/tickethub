"""Shared FastAPI auth and authorization dependencies."""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.core.security import TokenDecodeError, decode_access_token
from app.models.enums import UserType
from app.models.event import Event, EventAssignment, Show
from app.models.user import EventStaff, User

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


async def get_current_active_admin(
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.user_type not in {UserType.EVENT_STAFF, UserType.SYSTEM_ADMIN}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chi tai khoan noi bo moi duoc truy cap")
    if current_user.user_type == UserType.EVENT_STAFF:
        profile = await session.get(EventStaff, current_user.id)
        if not profile or not profile.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tai khoan event staff dang bi vo hieu hoa")
    return current_user


async def get_current_system_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.user_type != UserType.SYSTEM_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chi system admin moi duoc truy cap")
    return current_user


async def get_current_active_event_staff(
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_admin),
) -> User:
    if current_user.user_type != UserType.EVENT_STAFF:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chi event staff moi duoc thuc hien thao tac nay")
    profile = await session.get(EventStaff, current_user.id)
    if not profile or not profile.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tai khoan event staff dang bi vo hieu hoa")
    return current_user


async def get_current_assigned_event_staff(
    event_key: str,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_event_staff),
) -> User:
    event_stmt = select(Event.id).where(Event.is_deleted.is_(False))
    event_stmt = event_stmt.where(Event.id == int(event_key)) if event_key.isdigit() else event_stmt.where(Event.slug == event_key)
    event_id = await session.scalar(event_stmt)
    assignment = await session.scalar(
        select(EventAssignment.id).where(
            EventAssignment.event_id == event_id,
            EventAssignment.staff_id == current_user.id,
            EventAssignment.is_active.is_(True),
        )
    )
    if not event_id or not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay su kien duoc phan cong")
    return current_user


async def get_current_show_event_staff(
    show_id: int,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_event_staff),
) -> User:
    assignment = await session.scalar(
        select(EventAssignment.id)
        .join(Show, Show.event_id == EventAssignment.event_id)
        .where(
            Show.id == show_id,
            Show.is_deleted.is_(False),
            EventAssignment.staff_id == current_user.id,
            EventAssignment.is_active.is_(True),
        )
    )
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay show thuoc su kien duoc phan cong")
    return current_user


async def get_current_customer(current_user: User = Depends(get_current_user)) -> User:
    if current_user.user_type != UserType.CUSTOMER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chi tai khoan khach hang moi duoc thuc hien thao tac nay")
    return current_user
