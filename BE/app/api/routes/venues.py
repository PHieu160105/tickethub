"""Admin venue, layout, and reusable seat-template routes."""

import base64
import math
import re
import struct

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_event_staff
from app.core.db import get_db_session
from app.models.seat import Seat
from app.models.user import User
from app.models.venue import Venue, VenueLayout
from app.schemas.common import APIMessage
from app.schemas.venue import (
    LayoutCreateRequest,
    LayoutDetailResponse,
    LayoutUpdateRequest,
    VenueCreateRequest,
    VenueDetailResponse,
    VenueListResponse,
    VenueSeatBulkCreateRequest,
    VenueSeatBulkCreateResponse,
    VenueSeatResponse,
    VenueSeatSingleCreateRequest,
    VenueSeatSyncCreatedItem,
    VenueSeatSyncRequest,
    VenueSeatSyncResponse,
    VenueSeatUpdateRequest,
    VenueUpdateRequest,
)
from app.services.audit_service import add_audit_log, model_snapshot

router = APIRouter(prefix="/venues", tags=["admin-venues"])
layout_router = APIRouter(prefix="/layouts", tags=["admin-layouts"])
seat_router = APIRouter(prefix="/seats", tags=["admin-seats"])

RASTER_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}
SVG_CONTENT_TYPE = "image/svg+xml"
BACKGROUND_CONTENT_TYPES = RASTER_CONTENT_TYPES | {SVG_CONTENT_TYPE}


async def _get_venue_or_404(session: AsyncSession, venue_id: int) -> Venue:
    venue = await session.get(Venue, venue_id)
    if not venue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy địa điểm")
    return venue


async def _resolve_layout_for_venue(session: AsyncSession, venue_id: int, layout_id: int | None) -> VenueLayout:
    stmt = select(VenueLayout).where(VenueLayout.venue_id == venue_id).order_by(VenueLayout.id.asc())
    if layout_id is not None:
        stmt = stmt.where(VenueLayout.id == layout_id)
    layout = await session.scalar(stmt)
    if not layout:
        detail = "Không tìm thấy bố cục thuộc địa điểm này" if layout_id is not None else "Địa điểm cần ít nhất một bố cục"
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND if layout_id is not None else status.HTTP_400_BAD_REQUEST, detail=detail)
    return layout


def _seat_response(seat: Seat) -> VenueSeatResponse:
    return VenueSeatResponse(
        id=seat.id,
        venue_layout_id=seat.venue_layout_id,
        label=seat.label,
        row_label=seat.row_label,
        seat_number=seat.seat_number,
        x=float(seat.x_coord) if seat.x_coord is not None else None,
        y=float(seat.y_coord) if seat.y_coord is not None else None,
    )


def _extract_raster_dimensions(content: bytes, content_type: str) -> tuple[int, int] | None:
    if content_type == "image/png" and content.startswith(b"\x89PNG\r\n\x1a\n") and len(content) >= 24:
        return struct.unpack(">II", content[16:24])
    if content_type == "image/webp" and content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        if content[12:16] == b"VP8X" and len(content) >= 30:
            return 1 + int.from_bytes(content[24:27], "little"), 1 + int.from_bytes(content[27:30], "little")
    if content_type == "image/jpeg" and content.startswith(b"\xff\xd8"):
        index = 2
        while index + 9 < len(content):
            if content[index] != 0xFF:
                index += 1
                continue
            marker = content[index + 1]
            index += 2
            if marker in {0xD8, 0xD9}:
                continue
            if index + 2 > len(content):
                break
            segment_length = struct.unpack(">H", content[index:index + 2])[0]
            if marker in {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}:
                if index + 7 <= len(content):
                    return struct.unpack(">H", content[index + 5:index + 7])[0], struct.unpack(">H", content[index + 3:index + 5])[0]
                break
            index += segment_length
    return None


async def _store_venue_background(venue: Venue, file: UploadFile) -> tuple[str, str]:
    if not file.content_type or file.content_type not in BACKGROUND_CONTENT_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Chỉ cho phép ảnh nền SVG, PNG, JPEG hoặc WEBP")
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ảnh nền phải có dung lượng không quá 10MB")
    if file.content_type == SVG_CONTENT_TYPE:
        venue.background_source = f"data:{file.content_type};base64,{base64.b64encode(content).decode('ascii')}"
        return "svg", file.content_type
    dimensions = _extract_raster_dimensions(content, file.content_type)
    if not dimensions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không đọc được kích thước ảnh nền")
    venue.background_source = f"data:{file.content_type};base64,{base64.b64encode(content).decode('ascii')}"
    venue.width, venue.height = dimensions
    return "raster", file.content_type


def _derive_layout_seat_identity(label: str, row_label: str | None, seat_number: int | None) -> tuple[str | None, int | None]:
    if row_label is not None or seat_number is not None:
        return row_label, seat_number
    match = re.match(r"^\s*([A-Za-z]+)\s*[- ]?\s*(\d+)\s*$", label)
    return (match.group(1), int(match.group(2))) if match else (None, None)


@router.post("", response_model=VenueDetailResponse)
async def create_venue(
    payload: VenueCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    staff_user: User = Depends(get_current_active_event_staff),
) -> VenueDetailResponse:
    venue = Venue(name=payload.name, address=payload.address, created_by_staff_id=staff_user.id)
    session.add(venue)
    await session.flush()
    add_audit_log(session, staff_user, "CREATE_VENUE", "venues", venue.id, new_value=model_snapshot(venue, "name", "address", "is_active"))
    await session.commit()
    await session.refresh(venue)
    return VenueDetailResponse.model_validate(venue)


@router.get("", response_model=list[VenueListResponse])
async def list_venues(
    search: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db_session),
    staff_user: User = Depends(get_current_active_event_staff),
) -> list[VenueListResponse]:
    stmt = select(Venue).order_by(Venue.created_at.desc())
    if search:
        stmt = stmt.where(Venue.name.ilike(f"%{search}%"))
    return [VenueListResponse.model_validate(venue) for venue in await session.scalars(stmt.limit(limit).offset(offset))]


@router.get("/{venue_id}", response_model=VenueDetailResponse)
async def get_venue(
    venue_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_event_staff),
) -> VenueDetailResponse:
    return VenueDetailResponse.model_validate(await _get_venue_or_404(session, venue_id))


@router.patch("/{venue_id}", response_model=VenueDetailResponse)
async def update_venue(
    venue_id: int,
    payload: VenueUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    staff_user: User = Depends(get_current_active_event_staff),
) -> VenueDetailResponse:
    venue = await _get_venue_or_404(session, venue_id)
    updates = payload.model_dump(exclude_unset=True)
    old_value = {field: getattr(venue, field) for field in updates}
    for field_name, field_value in updates.items():
        setattr(venue, field_name, field_value)
    add_audit_log(session, staff_user, "UPDATE_VENUE", "venues", venue.id, old_value=old_value, new_value={field: getattr(venue, field) for field in updates})
    await session.commit()
    await session.refresh(venue)
    return VenueDetailResponse.model_validate(venue)


@router.delete("/{venue_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_venue(
    venue_id: int,
    session: AsyncSession = Depends(get_db_session),
    staff_user: User = Depends(get_current_active_event_staff),
) -> None:
    venue = await _get_venue_or_404(session, venue_id)
    add_audit_log(session, staff_user, "DELETE_VENUE", "venues", venue.id, old_value=model_snapshot(venue, "name", "address", "is_active"))
    await session.delete(venue)
    await session.commit()


@router.post("/{venue_id}/upload-background")
async def upload_venue_background(
    venue_id: int,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
    staff_user: User = Depends(get_current_active_event_staff),
) -> dict:
    venue = await _get_venue_or_404(session, venue_id)
    background_type, content_type = await _store_venue_background(venue, file)
    add_audit_log(session, staff_user, "UPDATE_VENUE_BACKGROUND", "venues", venue.id, new_value={"background_type": background_type, "content_type": content_type, "width": venue.width, "height": venue.height})
    await session.commit()
    await session.refresh(venue)
    return {
        "detail": "Đã tải lên ảnh nền",
        "venue_id": venue.id,
        "background_type": background_type,
        "content_type": content_type,
        "width": venue.width,
        "height": venue.height,
    }


@router.get("/{venue_id}/layouts", response_model=list[LayoutDetailResponse])
async def list_layouts(
    venue_id: int,
    session: AsyncSession = Depends(get_db_session),
    staff_user: User = Depends(get_current_active_event_staff),
) -> list[LayoutDetailResponse]:
    await _get_venue_or_404(session, venue_id)
    layouts = await session.scalars(select(VenueLayout).where(VenueLayout.venue_id == venue_id).order_by(VenueLayout.id.asc()))
    return [LayoutDetailResponse.model_validate(layout) for layout in layouts]


@router.post("/{venue_id}/layouts", response_model=LayoutDetailResponse)
async def create_layout(
    venue_id: int,
    payload: LayoutCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    staff_user: User = Depends(get_current_active_event_staff),
) -> LayoutDetailResponse:
    await _get_venue_or_404(session, venue_id)
    layout = VenueLayout(venue_id=venue_id, name=payload.name, description=payload.description)
    session.add(layout)
    await session.flush()
    add_audit_log(session, staff_user, "CREATE_VENUE_LAYOUT", "venue_layouts", layout.id, new_value=model_snapshot(layout, "venue_id", "name", "description"))
    await session.commit()
    await session.refresh(layout)
    return LayoutDetailResponse.model_validate(layout)


@layout_router.patch("/{layout_id}", response_model=LayoutDetailResponse)
async def update_layout(
    layout_id: int,
    payload: LayoutUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    staff_user: User = Depends(get_current_active_event_staff),
) -> LayoutDetailResponse:
    layout = await session.get(VenueLayout, layout_id)
    if not layout:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy bố cục")
    updates = payload.model_dump(exclude_unset=True)
    old_value = {field: getattr(layout, field) for field in updates}
    for field_name, field_value in updates.items():
        setattr(layout, field_name, field_value)
    add_audit_log(session, staff_user, "UPDATE_VENUE_LAYOUT", "venue_layouts", layout.id, old_value=old_value, new_value={field: getattr(layout, field) for field in updates})
    await session.commit()
    await session.refresh(layout)
    return LayoutDetailResponse.model_validate(layout)


@layout_router.delete("/{layout_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_layout(
    layout_id: int,
    session: AsyncSession = Depends(get_db_session),
    staff_user: User = Depends(get_current_active_event_staff),
) -> None:
    layout = await session.get(VenueLayout, layout_id)
    if not layout:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy bố cục")
    add_audit_log(session, staff_user, "DELETE_VENUE_LAYOUT", "venue_layouts", layout.id, old_value=model_snapshot(layout, "venue_id", "name", "description"))
    await session.delete(layout)
    await session.commit()


@router.get("/{venue_id}/seats", response_model=list[VenueSeatResponse])
async def list_venue_seats(
    venue_id: int,
    layout_id: int | None = Query(default=None, ge=1),
    session: AsyncSession = Depends(get_db_session),
    staff_user: User = Depends(get_current_active_event_staff),
) -> list[VenueSeatResponse]:
    await _get_venue_or_404(session, venue_id)
    layout = await _resolve_layout_for_venue(session, venue_id, layout_id)
    return [_seat_response(seat) for seat in await session.scalars(select(Seat).where(Seat.venue_layout_id == layout.id).order_by(Seat.id.asc()))]


@router.post("/{venue_id}/seats/single", response_model=VenueSeatResponse)
async def create_venue_seat_single(
    venue_id: int,
    payload: VenueSeatSingleCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    staff_user: User = Depends(get_current_active_event_staff),
) -> VenueSeatResponse:
    await _get_venue_or_404(session, venue_id)
    layout = await _resolve_layout_for_venue(session, venue_id, payload.layout_id)
    exists = await session.scalar(select(func.count()).select_from(Seat).where(Seat.venue_layout_id == layout.id, func.lower(Seat.seat_label) == payload.label.lower()))
    if exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nhãn ghế đã tồn tại trong bố cục này")
    row_label, seat_number = _derive_layout_seat_identity(payload.label, payload.row_label, payload.seat_number)
    seat = Seat(venue_layout_id=layout.id, row_label=row_label, seat_number=seat_number, label=payload.label, x=round(payload.x, 2), y=round(payload.y, 2), is_active=True)
    session.add(seat)
    await session.flush()
    add_audit_log(session, staff_user, "CREATE_LAYOUT_SEAT", "seats", seat.id, new_value=model_snapshot(seat, "venue_layout_id", "label", "row_label", "seat_number", "x", "y"))
    await session.commit()
    await session.refresh(seat)
    return _seat_response(seat)


@router.post("/{venue_id}/seats/bulk", response_model=VenueSeatBulkCreateResponse)
async def create_venue_seat_bulk(
    venue_id: int,
    payload: VenueSeatBulkCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    staff_user: User = Depends(get_current_active_event_staff),
) -> VenueSeatBulkCreateResponse:
    await _get_venue_or_404(session, venue_id)
    layout = await _resolve_layout_for_venue(session, venue_id, payload.layout_id)
    existing_labels = {str(label).lower() for label in await session.scalars(select(Seat.seat_label).where(Seat.venue_layout_id == layout.id))}
    if payload.pattern not in {"straight", "zigzag", "arc"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mẫu sinh ghế không được hỗ trợ")
    created: list[Seat] = []
    for row in range(payload.rows):
        seats_in_row = payload.cols if payload.pattern != "arc" or payload.arc_config is None else payload.cols + row * 2
        offset = payload.gap_x / 2 if payload.pattern == "zigzag" and row % 2 else 0
        for col in range(seats_in_row):
            label = f"{payload.label_prefix}{row + 1}-{col + 1}"
            if label.lower() in existing_labels:
                continue
            if payload.pattern == "arc" and payload.arc_config:
                cfg = payload.arc_config
                radius = cfg.radius + row * payload.gap_y
                angle = cfg.start_angle + (cfg.end_angle - cfg.start_angle) * (col / max(seats_in_row - 1, 1))
                x = max(0.0, min(100.0, cfg.center_x + radius * math.sin(math.radians(angle))))
                y = max(0.0, min(100.0, cfg.center_y + radius * math.cos(math.radians(angle))))
            else:
                x = max(0.0, min(100.0, payload.start_x + offset + col * payload.gap_x))
                y = max(0.0, min(100.0, payload.start_y + row * payload.gap_y))
            seat = Seat(venue_layout_id=layout.id, row_label=f"{payload.label_prefix}{row + 1}", seat_number=col + 1, label=label, x=round(x, 2), y=round(y, 2), is_active=True)
            session.add(seat)
            created.append(seat)
            existing_labels.add(label.lower())
    await session.flush()
    add_audit_log(session, staff_user, "BULK_CREATE_LAYOUT_SEATS", "venue_layouts", layout.id, new_value={"seat_ids": [seat.id for seat in created], "created_count": len(created)})
    await session.commit()
    for seat in created:
        await session.refresh(seat)
    return VenueSeatBulkCreateResponse(created_count=len(created), seats=[_seat_response(seat) for seat in created])


@router.post("/{venue_id}/seats/sync", response_model=VenueSeatSyncResponse)
async def sync_venue_seats(
    venue_id: int,
    payload: VenueSeatSyncRequest,
    session: AsyncSession = Depends(get_db_session),
    staff_user: User = Depends(get_current_active_event_staff),
) -> VenueSeatSyncResponse:
    await _get_venue_or_404(session, venue_id)
    layout = await _resolve_layout_for_venue(session, venue_id, payload.layout_id)
    existing = list(await session.scalars(select(Seat).where(Seat.venue_layout_id == layout.id).order_by(Seat.id.asc())))
    seat_map = {seat.id: seat for seat in existing}
    delete_ids = set(payload.delete_ids)
    update_map = {item.id: item for item in payload.update}
    final_labels = [update_map.get(seat.id).label if seat.id in update_map else seat.label for seat in existing if seat.id not in delete_ids]
    final_labels.extend(item.label for item in payload.create)
    normalized = [label.strip().lower() for label in final_labels]
    if len(normalized) != len(set(normalized)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nhãn ghế đã tồn tại trong bố cục này")
    created_pairs: list[tuple[int, Seat]] = []
    for item in payload.update:
        seat = seat_map.get(item.id)
        if not seat:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy ghế mẫu")
        seat.label = item.label
        seat.row_label, seat.seat_number = _derive_layout_seat_identity(item.label, item.row_label, item.seat_number)
        seat.x, seat.y = round(item.x, 2), round(item.y, 2)
    for item in payload.create:
        row_label, seat_number = _derive_layout_seat_identity(item.label, item.row_label, item.seat_number)
        seat = Seat(venue_layout_id=layout.id, row_label=row_label, seat_number=seat_number, label=item.label, x=round(item.x, 2), y=round(item.y, 2), is_active=True)
        session.add(seat)
        created_pairs.append((item.client_id, seat))
    for seat_id in payload.delete_ids:
        seat = seat_map.get(seat_id)
        if not seat:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy ghế mẫu")
        await session.delete(seat)
    await session.flush()
    add_audit_log(
        session,
        staff_user,
        "SYNC_LAYOUT_SEATS",
        "venue_layouts",
        layout.id,
        new_value={"created_count": len(created_pairs), "updated_ids": [item.id for item in payload.update], "deleted_ids": payload.delete_ids},
    )
    await session.commit()
    for _, seat in created_pairs:
        await session.refresh(seat)
    return VenueSeatSyncResponse(
        created=[
            VenueSeatSyncCreatedItem(client_id=client_id, id=seat.id, label=seat.label, row_label=seat.row_label, seat_number=seat.seat_number, x=float(seat.x_coord) if seat.x_coord is not None else None, y=float(seat.y_coord) if seat.y_coord is not None else None)
            for client_id, seat in created_pairs
        ],
        updated_ids=[item.id for item in payload.update],
        deleted_ids=payload.delete_ids,
    )


@seat_router.patch("/{seat_id}", response_model=VenueSeatResponse)
async def update_venue_seat(
    seat_id: int,
    payload: VenueSeatUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    staff_user: User = Depends(get_current_active_event_staff),
) -> VenueSeatResponse:
    seat = await session.get(Seat, seat_id)
    if not seat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy ghế mẫu")
    old_value = model_snapshot(seat, "label", "row_label", "seat_number", "x", "y")
    if payload.label is not None:
        exists = await session.scalar(select(func.count()).select_from(Seat).where(Seat.venue_layout_id == seat.venue_layout_id, func.lower(Seat.seat_label) == payload.label.lower(), Seat.id != seat.id))
        if exists:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nhãn ghế đã tồn tại trong bố cục này")
        seat.label = payload.label
    if payload.label is not None or payload.row_label is not None or payload.seat_number is not None:
        seat.row_label, seat.seat_number = _derive_layout_seat_identity(seat.label, payload.row_label if payload.row_label is not None else seat.row_label, payload.seat_number if payload.seat_number is not None else seat.seat_number)
    if payload.x is not None:
        seat.x = round(payload.x, 2)
    if payload.y is not None:
        seat.y = round(payload.y, 2)
    add_audit_log(session, staff_user, "UPDATE_LAYOUT_SEAT", "seats", seat.id, old_value=old_value, new_value=model_snapshot(seat, "label", "row_label", "seat_number", "x", "y"))
    await session.commit()
    await session.refresh(seat)
    return _seat_response(seat)


@seat_router.delete("/{seat_id}", response_model=APIMessage)
async def delete_venue_seat(
    seat_id: int,
    session: AsyncSession = Depends(get_db_session),
    staff_user: User = Depends(get_current_active_event_staff),
) -> APIMessage:
    seat = await session.get(Seat, seat_id)
    if not seat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy ghế mẫu")
    add_audit_log(session, staff_user, "DELETE_LAYOUT_SEAT", "seats", seat.id, old_value=model_snapshot(seat, "venue_layout_id", "label", "row_label", "seat_number", "x", "y"))
    await session.delete(seat)
    await session.commit()
    return APIMessage(detail="Đã xóa ghế")
