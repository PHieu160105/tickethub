from base64 import b64encode
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_admin
from app.core.cache import EVENT_DETAIL_CACHE_NAMESPACE, EVENT_LIST_CACHE_NAMESPACE, SHOW_DETAIL_CACHE_NAMESPACE, public_api_cache, show_seat_cache_namespace
from app.core.db import get_db_session
from app.models.enums import EventStatus
from app.models.user import User
from app.schemas.admin import UploadImageResponse
from app.schemas.common import APIMessage
from app.schemas.event import EventCardResponse, EventCreateRequest, EventDetailResponse, EventUpdateRequest
from app.services.dashboard_service import broadcast_dashboard_update
from app.services.event_service import (
    build_event_card_response,
    build_event_detail_response,
    create_event,
    get_event_by_slug_or_id,
    list_event_max_prices_for_event_ids,
    list_event_shows,
    list_live_events,
    list_shows_for_event_ids,
)

router = APIRouter()


@router.post("/events", response_model=EventDetailResponse)
async def create_admin_event(
    payload: EventCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    admin_user: User = Depends(get_current_active_admin),
) -> EventDetailResponse:
    event = await create_event(session, admin_user.id, payload)
    try:
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    await public_api_cache.invalidate_namespace(EVENT_LIST_CACHE_NAMESPACE)
    await public_api_cache.invalidate_namespace(EVENT_DETAIL_CACHE_NAMESPACE)
    await public_api_cache.invalidate_namespace(SHOW_DETAIL_CACHE_NAMESPACE)
    await broadcast_dashboard_update()
    return await build_event_detail_response(session, event, include_unpublished_shows=True)


@router.get("/events", response_model=list[EventCardResponse])
async def list_admin_events(
    search: str | None = Query(default=None, max_length=120),
    category: str | None = Query(default=None, max_length=80),
    start_from: datetime | None = Query(default=None),
    end_to: datetime | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> list[EventCardResponse]:
    events = await list_live_events(
        session,
        search=search,
        category=category,
        start_from=start_from,
        end_to=end_to,
        limit=limit,
        offset=offset,
        include_unpublished=True,
    )
    shows_by_event_id = await list_shows_for_event_ids(session, [event.id for event in events], include_deleted=True)
    max_prices_by_event_id = await list_event_max_prices_for_event_ids(session, [event.id for event in events])
    return [
        await build_event_card_response(
            session,
            event,
            shows=shows_by_event_id.get(event.id, []),
            max_price=max_prices_by_event_id.get(event.id, 0),
        )
        for event in events
    ]


@router.get("/events/{event_key}", response_model=EventDetailResponse)
async def get_admin_event(
    event_key: str,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> EventDetailResponse:
    event = await get_event_by_slug_or_id(session, event_key)
    return await build_event_detail_response(session, event, include_unpublished_shows=True)


@router.patch("/events/{event_key}", response_model=EventDetailResponse)
async def update_event(
    event_key: str,
    payload: EventUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> EventDetailResponse:
    event = await get_event_by_slug_or_id(session, event_key)
    updates = payload.model_dump(exclude_unset=True)
    for queue_field in ("queue_enabled", "queue_release_batch", "max_active_queue_tokens"):
        updates.pop(queue_field, None)
    next_start = updates.get("start_date", event.start_date)
    next_end = updates.get("end_date", event.end_date)
    if next_end < next_start:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ngay ket thuc phai cung ngay hoac sau ngay bat dau")

    for field_name, field_value in updates.items():
        setattr(event, field_name, field_value)

    event.start_at_legacy = datetime.combine(event.start_date, datetime.min.time(), tzinfo=UTC)
    event.end_at_legacy = datetime.combine(event.end_date, datetime.max.time(), tzinfo=UTC)

    try:
        await session.commit()
        await session.refresh(event)
    except Exception:
        await session.rollback()
        raise

    await public_api_cache.invalidate_namespace(EVENT_LIST_CACHE_NAMESPACE)
    await public_api_cache.invalidate_namespace(EVENT_DETAIL_CACHE_NAMESPACE)
    await public_api_cache.invalidate_namespace(SHOW_DETAIL_CACHE_NAMESPACE)
    await broadcast_dashboard_update()
    return await build_event_detail_response(session, event, include_unpublished_shows=True)


@router.delete("/events/{event_key}", response_model=APIMessage)
async def delete_event(
    event_key: str,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> APIMessage:
    event = await get_event_by_slug_or_id(session, event_key)
    if event.status != EventStatus.DRAFT:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Chi co the xoa su kien o trang thai draft")
    shows = await list_event_shows(session, event.id, include_deleted=True)

    try:
        event.is_deleted = True
        for show in shows:
            show.is_deleted = True
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    await public_api_cache.invalidate_namespace(EVENT_LIST_CACHE_NAMESPACE)
    await public_api_cache.invalidate_namespace(EVENT_DETAIL_CACHE_NAMESPACE)
    await public_api_cache.invalidate_namespace(SHOW_DETAIL_CACHE_NAMESPACE)
    for show in shows:
        await public_api_cache.invalidate_namespace(show_seat_cache_namespace(show.id))
    await broadcast_dashboard_update()
    return APIMessage(detail="Da xoa su kien thanh cong")


@router.post("/events/upload-image", response_model=UploadImageResponse)
async def upload_event_image(
    file: UploadFile = File(...),
    _: User = Depends(get_current_active_admin),
) -> UploadImageResponse:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Chi cho phep upload file anh")

    extension = Path(file.filename or "").suffix.lower()
    if extension not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dinh dang duoc ho tro: jpg, jpeg, png, webp")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Anh phai co dung luong khong qua 10MB")

    base64_content = b64encode(content).decode("ascii")
    image_url = f"data:{file.content_type};base64,{base64_content}"
    return UploadImageResponse(image_url=image_url)
