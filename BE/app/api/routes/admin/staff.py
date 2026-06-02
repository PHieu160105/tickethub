from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_system_admin
from app.core.db import get_db_session
from app.core.security import hash_password
from app.models.enums import UserType
from app.models.event import Event, EventAssignment
from app.models.user import EventStaff, User
from app.schemas.admin import (
    AssignedEventStaffResponse,
    EventAssignmentOverviewResponse,
    EventAssignmentUpdateRequest,
    EventStaffCreateRequest,
    EventStaffResponse,
    EventStaffStatusRequest,
)

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


async def _events_without_another_active_staff(session: AsyncSession, staff_user_id: int) -> list[str]:
    assigned_event_ids = list(
        await session.scalars(
            select(EventAssignment.event_id).where(
                EventAssignment.staff_id == staff_user_id,
                EventAssignment.is_active.is_(True),
            )
        )
    )
    blocked_titles: list[str] = []
    for event_id in assigned_event_ids:
        replacement = await session.scalar(
            select(EventAssignment.id)
            .join(EventStaff, EventStaff.user_id == EventAssignment.staff_id)
            .where(
                EventAssignment.event_id == event_id,
                EventAssignment.staff_id != staff_user_id,
                EventAssignment.is_active.is_(True),
                EventStaff.is_active.is_(True),
            )
        )
        if not replacement:
            event = await session.get(Event, event_id)
            blocked_titles.append(event.title if event else str(event_id))
    return blocked_titles


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
    _: User = Depends(get_current_system_admin),
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
    await session.commit()
    await session.refresh(user)
    await session.refresh(profile)
    return _staff_response(user, profile)


@router.patch("/staff/{staff_user_id}/status", response_model=EventStaffResponse)
async def update_event_staff_status(
    staff_user_id: int,
    payload: EventStaffStatusRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_system_admin),
) -> EventStaffResponse:
    user = await session.get(User, staff_user_id)
    profile = await session.get(EventStaff, staff_user_id)
    if not user or not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy event staff")
    if not payload.is_active and profile.is_active:
        blocked_titles = await _events_without_another_active_staff(session, staff_user_id)
        if blocked_titles:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Hay phan cong staff thay the truoc khi vo hieu hoa tai khoan: {', '.join(blocked_titles)}",
            )
    profile.is_active = payload.is_active
    await session.commit()
    await session.refresh(user)
    return _staff_response(user, profile)


@router.get("/staff/assignments", response_model=list[EventAssignmentOverviewResponse])
async def list_event_assignments(
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_system_admin),
) -> list[EventAssignmentOverviewResponse]:
    events = list(await session.scalars(select(Event).where(Event.is_deleted.is_(False)).order_by(Event.start_date.desc(), Event.id.desc())))
    rows = (
        await session.execute(
            select(EventAssignment, User, EventStaff)
            .join(User, User.id == EventAssignment.staff_id)
            .join(EventStaff, EventStaff.user_id == EventAssignment.staff_id)
            .where(EventAssignment.is_active.is_(True))
            .order_by(User.full_name.asc())
        )
    ).all()
    grouped: dict[int, list[AssignedEventStaffResponse]] = {}
    for assignment, user, profile in rows:
        grouped.setdefault(assignment.event_id, []).append(
            AssignedEventStaffResponse(user_id=user.id, full_name=user.full_name, staff_code=profile.staff_code)
        )
    return [
        EventAssignmentOverviewResponse(
            event_id=event.id,
            event_slug=event.slug,
            event_title=event.title,
            event_status=event.status,
            assigned_staff=grouped.get(event.id, []),
        )
        for event in events
    ]


@router.put("/staff/assignments/{event_id}", response_model=EventAssignmentOverviewResponse)
async def update_event_assignments(
    event_id: int,
    payload: EventAssignmentUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    system_admin: User = Depends(get_current_system_admin),
) -> EventAssignmentOverviewResponse:
    event = await session.scalar(select(Event).where(Event.id == event_id, Event.is_deleted.is_(False)))
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy sự kiện")

    requested_staff_ids = set(payload.staff_ids)
    active_staff_ids = set(
        await session.scalars(
            select(EventStaff.user_id).where(
                EventStaff.user_id.in_(requested_staff_ids),
                EventStaff.is_active.is_(True),
            )
        )
    )
    if active_staff_ids != requested_staff_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Chi co the phan cong event staff dang hoat dong")

    current_assignments = list(await session.scalars(select(EventAssignment).where(EventAssignment.event_id == event.id)))
    current_by_staff_id = {assignment.staff_id: assignment for assignment in current_assignments}
    for assignment in current_assignments:
        assignment.is_active = assignment.staff_id in requested_staff_ids
    for staff_id in requested_staff_ids - current_by_staff_id.keys():
        session.add(EventAssignment(event_id=event.id, staff_id=staff_id, is_active=True))

    await session.commit()
    overviews = await list_event_assignments(session=session, _=system_admin)
    return next(item for item in overviews if item.event_id == event.id)
