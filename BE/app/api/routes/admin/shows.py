from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_admin
from app.core.db import get_db_session
from app.models.enums import EventStatus
from app.models.user import User
from app.schemas.admin import EventDetailStatsResponse
from app.schemas.common import APIMessage
from app.schemas.event import ShowCreateRequest, ShowDetailResponse, ShowSummaryResponse, ShowUpdateRequest
from app.services.dashboard_service import broadcast_dashboard_update
from app.services.event_lifecycle_service import create_show_with_inventory
from app.services.event_query_service import build_show_detail_response, get_event_by_slug_or_id, list_event_shows
from app.services.event_utils import combine_show_datetime
from app.ws.connection_manager import seat_ws_manager

from ._shared import _build_event_or_404_show, _build_show_stats_response, _interrupt_active_show_sessions, _invalidate_show_cache

router = APIRouter()


@router.get("/events/{event_key}/shows", response_model=list[ShowSummaryResponse])
async def list_admin_event_shows(
    event_key: str,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> list[ShowSummaryResponse]:
    event = await get_event_by_slug_or_id(session, event_key)
    shows = await list_event_shows(session, event.id)
    return [ShowSummaryResponse.model_validate(show) for show in shows]


@router.post("/events/{event_key}/shows", response_model=ShowDetailResponse)
async def create_admin_show(
    event_key: str,
    payload: ShowCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    admin_user: User = Depends(get_current_active_admin),
) -> ShowDetailResponse:
    event = await get_event_by_slug_or_id(session, event_key)
    try:
        show = await create_show_with_inventory(session, event, admin_user.id, payload)
        await session.commit()
        await session.refresh(show)
    except Exception:
        await session.rollback()
        raise

    await _invalidate_show_cache(show.id)
    await broadcast_dashboard_update()
    return ShowDetailResponse(**(await build_show_detail_response(session, show)))


@router.get("/events/{event_key}/shows/{show_id}", response_model=ShowDetailResponse)
async def get_admin_show(
    event_key: str,
    show_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> ShowDetailResponse:
    _, show = await _build_event_or_404_show(session, event_key, show_id)
    return ShowDetailResponse(**(await build_show_detail_response(session, show)))


@router.patch("/events/{event_key}/shows/{show_id}", response_model=ShowDetailResponse)
async def update_admin_show(
    event_key: str,
    show_id: int,
    payload: ShowUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> ShowDetailResponse:
    event, show = await _build_event_or_404_show(session, event_key, show_id)
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return ShowDetailResponse(**(await build_show_detail_response(session, show)))

    is_status_only_update = set(updates) == {"status"}
    previous_status = show.status
    is_unpublishing_show = previous_status == EventStatus.LIVE and updates.get("status") == EventStatus.DRAFT
    if show.status != EventStatus.DRAFT:
        if not is_status_only_update or updates.get("status") != EventStatus.DRAFT:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Show live phai chuyen ve draft truoc khi chinh sua")

    next_start_at = show.start_at
    next_end_at = show.end_at
    if not is_status_only_update:
        next_date = updates.get("show_date", show.start_at.date())
        next_start_time = updates.get("start_time", show.start_at.timetz().replace(tzinfo=None))
        next_end_time = updates.get("end_time", show.end_at.timetz().replace(tzinfo=None))
        next_start_at = combine_show_datetime(next_date, next_start_time)
        next_end_at = combine_show_datetime(next_date, next_end_time)
        if next_date < event.start_date or next_date > event.end_date:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ngay dien phai nam trong khoang ngay cua su kien")
        if next_end_at <= next_start_at:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Gio ket thuc phai sau gio bat dau")

    if "venue_layout_id" in updates and updates["venue_layout_id"] != show.venue_layout_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Khong ho tro doi dia diem hoac bo cuc sau khi da tao buoi dien")

    for field_name, field_value in updates.items():
        if field_name in {"show_date", "start_time", "end_time"}:
            continue
        setattr(show, field_name, field_value)

    show.start_at = next_start_at
    show.end_at = next_end_at

    interrupted_seats: list[dict[str, int | str | None]] = []
    expired_queue_count = 0
    try:
        if is_unpublishing_show:
            interrupted_seats, expired_queue_count = await _interrupt_active_show_sessions(session, show)
        await session.commit()
        await session.refresh(show)
    except Exception:
        await session.rollback()
        raise

    await _invalidate_show_cache(show.id)
    if is_unpublishing_show:
        if interrupted_seats:
            await seat_ws_manager.broadcast_seat_changes(show.id, interrupted_seats)
        await seat_ws_manager.broadcast_show_unpublished(
            show.id,
            {
                "event_slug": event.slug,
                "event_id": event.id,
                "released_seat_count": len(interrupted_seats),
                "expired_queue_count": expired_queue_count,
                "message": "Show dang duoc cap nhat. Phien dat ve hien tai da ket thuc.",
            },
        )
    await broadcast_dashboard_update()
    return ShowDetailResponse(**(await build_show_detail_response(session, show)))


@router.delete("/events/{event_key}/shows/{show_id}", response_model=APIMessage)
async def delete_admin_show(
    event_key: str,
    show_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> APIMessage:
    _, show = await _build_event_or_404_show(session, event_key, show_id)
    if show.status != EventStatus.DRAFT:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Chi co the xoa show o trang thai draft")
    try:
        show.is_deleted = True
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    await _invalidate_show_cache(show.id)
    await broadcast_dashboard_update()
    return APIMessage(detail="Da xoa buoi dien thanh cong")


@router.get("/events/{event_key}/shows/{show_id}/stats", response_model=EventDetailStatsResponse)
async def show_stats_detail(
    event_key: str,
    show_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> EventDetailStatsResponse:
    event, show = await _build_event_or_404_show(session, event_key, show_id)
    return await _build_show_stats_response(session, show, event)
