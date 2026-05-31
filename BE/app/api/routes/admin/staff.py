from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_system_admin
from app.core.db import get_db_session
from app.core.security import hash_password
from app.models.enums import UserType
from app.models.user import AdminAuditLog, EventStaff, User
from app.schemas.admin import EventStaffCreateRequest, EventStaffResponse, EventStaffStatusRequest

router = APIRouter()


def _staff_response(user: User, profile: EventStaff) -> EventStaffResponse:
    return EventStaffResponse(
        user_id=user.id,
        full_name=user.full_name,
        email=user.email,
        staff_code=profile.staff_code,
        is_active=profile.is_active,
        created_at=user.created_at.isoformat(),
    )


@router.get("/staff", response_model=list[EventStaffResponse])
async def list_event_staff(
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_system_admin),
) -> list[EventStaffResponse]:
    rows = (
        await session.execute(
            select(User, EventStaff)
            .join(EventStaff, EventStaff.user_id == User.id)
            .order_by(User.created_at.desc())
        )
    ).all()
    return [_staff_response(user, profile) for user, profile in rows]


@router.post("/staff", response_model=EventStaffResponse, status_code=status.HTTP_201_CREATED)
async def create_event_staff(
    payload: EventStaffCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    system_admin: User = Depends(get_current_system_admin),
) -> EventStaffResponse:
    if await session.scalar(select(User.id).where(User.email == str(payload.email).lower())):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email da ton tai")
    if await session.scalar(select(EventStaff.user_id).where(EventStaff.staff_code == payload.staff_code.strip())):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ma nhan vien da ton tai")

    user = User(
        full_name=payload.full_name.strip(),
        email=str(payload.email).lower(),
        password_hash=hash_password(payload.password),
        user_type=UserType.EVENT_STAFF,
        gender=payload.gender,
        age=payload.age,
    )
    profile = EventStaff(staff_code=payload.staff_code.strip(), is_active=True)
    user.event_staff_profile = profile
    session.add(user)
    await session.flush()
    session.add(AdminAuditLog(actor_admin_id=system_admin.id, action="CREATE_EVENT_STAFF", target_table="event_staff", target_id=str(user.id)))
    await session.commit()
    await session.refresh(user)
    await session.refresh(profile)
    return _staff_response(user, profile)


@router.patch("/staff/{staff_user_id}/status", response_model=EventStaffResponse)
async def update_event_staff_status(
    staff_user_id: int,
    payload: EventStaffStatusRequest,
    session: AsyncSession = Depends(get_db_session),
    system_admin: User = Depends(get_current_system_admin),
) -> EventStaffResponse:
    user = await session.get(User, staff_user_id)
    profile = await session.get(EventStaff, staff_user_id)
    if not user or not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay event staff")
    old_status = profile.is_active
    profile.is_active = payload.is_active
    session.add(
        AdminAuditLog(
            actor_admin_id=system_admin.id,
            action="UPDATE_EVENT_STAFF_STATUS",
            target_table="event_staff",
            target_id=str(staff_user_id),
            old_value=str(old_status),
            new_value=str(payload.is_active),
        )
    )
    await session.commit()
    await session.refresh(user)
    return _staff_response(user, profile)
