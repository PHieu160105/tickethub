"""Admin venue, layout, and reusable seat builder routes."""

import base64
import math
import re
import struct
import xml.etree.ElementTree as ET

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
router = APIRouter(prefix="/venues", tags=["admin-venues"])
layout_router = APIRouter(prefix="/layouts", tags=["admin-layouts"])
seat_router = APIRouter(prefix="/seats", tags=["admin-seats"])
section_router = APIRouter(prefix="/sections", tags=["admin-sections"])
polygon_router = APIRouter(prefix="/polygons", tags=["admin-polygons"])

SVG_CONTENT_TYPES = {"image/svg+xml", "text/xml", "application/xml"}
RASTER_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}
BACKGROUND_CONTENT_TYPES = SVG_CONTENT_TYPES | RASTER_CONTENT_TYPES


async def _get_venue_or_404(session: AsyncSession, venue_id: int) -> Venue:
    venue = await session.scalar(select(Venue).where(Venue.id == venue_id))
    if not venue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay dia diem")
    return venue


async def _resolve_layout_for_venue(session: AsyncSession, venue_id: int, layout_id: int | None) -> VenueLayout:
    stmt = select(VenueLayout).where(VenueLayout.venue_id == venue_id).order_by(VenueLayout.id.asc())
    if layout_id is not None:
        stmt = stmt.where(VenueLayout.id == layout_id)
    layout = await session.scalar(stmt)
    if not layout:
        if layout_id is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay bo cuc thuoc dia diem nay")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dia diem can it nhat mot bo cuc")
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


def _parse_dimension_value(value: str | None) -> int | None:
    if not value:
        return None
    match = re.match(r"^\s*([0-9]+(?:\.[0-9]+)?)", value)
    if not match:
        return None
    return int(float(match.group(1)))


def _extract_svg_dimensions(content: bytes) -> tuple[int, int] | None:
    try:
        root = ET.fromstring(content.decode("utf-8"))
    except (UnicodeDecodeError, ET.ParseError):
        return None

    viewbox = re.split(r"[\s,]+", root.get("viewBox", "").strip())
    if len(viewbox) == 4:
        try:
            return int(float(viewbox[2])), int(float(viewbox[3]))
        except ValueError:
            return None

    width = _parse_dimension_value(root.get("width"))
    height = _parse_dimension_value(root.get("height"))
    if width and height:
        return width, height
    return None


def _extract_raster_dimensions(content: bytes, content_type: str) -> tuple[int, int] | None:
    if content_type == "image/png" and content.startswith(b"\x89PNG\r\n\x1a\n") and len(content) >= 24:
        return struct.unpack(">II", content[16:24])
    if content_type == "image/webp" and content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        chunk = content[12:16]
        if chunk == b"VP8X" and len(content) >= 30:
            width = 1 + int.from_bytes(content[24:27], "little")
            height = 1 + int.from_bytes(content[27:30], "little")
            return width, height
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
                    height = struct.unpack(">H", content[index + 3:index + 5])[0]
                    width = struct.unpack(">H", content[index + 5:index + 7])[0]
                    return width, height
                break
            index += segment_length
    return None


async def _store_venue_background(venue: Venue, file: UploadFile) -> tuple[str, str]:
    if not file.content_type or file.content_type not in BACKGROUND_CONTENT_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Chi cho phep file SVG, PNG, JPEG va WEBP")
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Anh nen phai co dung luong khong qua 10MB")
    if file.content_type in SVG_CONTENT_TYPES:
        venue.svg_source = content.decode("utf-8")
        background_type = "svg"
        dimensions = _extract_svg_dimensions(content)
    else:
        encoded = base64.b64encode(content).decode("ascii")
        venue.svg_source = f"data:{file.content_type};base64,{encoded}"
        background_type = "raster"
        dimensions = _extract_raster_dimensions(content, file.content_type)
    if dimensions:
        venue.width, venue.height = dimensions
    return background_type, file.content_type


def _derive_layout_seat_identity(label: str, row_label: str | None, seat_number: int | None) -> tuple[str | None, int | None]:
    if row_label is not None or seat_number is not None:
        return row_label, seat_number
    match = re.match(r"^\s*([A-Za-z]+)\s*[- ]?\s*(\d+)\s*$", label)
    if match:
        return match.group(1), int(match.group(2))
    return None, None


@router.post("", response_model=VenueDetailResponse)
async def create_venue(
    payload: VenueCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    admin_user: User = Depends(get_current_active_event_staff),
) -> VenueDetailResponse:
    venue = Venue(name=payload.name, address=payload.address, created_by_staff_id=admin_user.id)
    session.add(venue)
    await session.commit()
    await session.refresh(venue)
    return VenueDetailResponse.model_validate(venue)


@router.get("", response_model=list[VenueListResponse])
async def list_venues(
    search: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_event_staff),
) -> list[VenueListResponse]:
    stmt = select(Venue).where(Venue.is_active.is_(True)).order_by(Venue.created_at.desc())
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(Venue.name.ilike(pattern))
    venues = list(await session.scalars(stmt.limit(limit).offset(offset)))
    return [VenueListResponse.model_validate(venue) for venue in venues]


@router.get("/{venue_id}", response_model=VenueDetailResponse)
async def get_venue(
    venue_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_event_staff),
) -> VenueDetailResponse:
    venue = await _get_venue_or_404(session, venue_id)
    return VenueDetailResponse.model_validate(venue)


@router.patch("/{venue_id}", response_model=VenueDetailResponse)
async def update_venue(
    venue_id: int,
    payload: VenueUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_event_staff),
) -> VenueDetailResponse:
    venue = await _get_venue_or_404(session, venue_id)
    for field_name, field_value in payload.model_dump(exclude_unset=True).items():
        setattr(venue, field_name, field_value)
    await session.commit()
    await session.refresh(venue)
    return VenueDetailResponse.model_validate(venue)


@router.delete("/{venue_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_venue(
    venue_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_event_staff),
) -> None:
    venue = await _get_venue_or_404(session, venue_id)
    await session.delete(venue)
    await session.commit()


@router.post("/{venue_id}/upload-background")
async def upload_venue_background(
    venue_id: int,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_event_staff),
) -> dict:
    venue = await _get_venue_or_404(session, venue_id)
    background_type, content_type = await _store_venue_background(venue, file)
    await session.commit()
    await session.refresh(venue)
    return {
        "detail": "Da tai len anh nen",
        "venue_id": venue.id,
        "background_type": background_type,
        "content_type": content_type,
        "width": venue.width,
        "height": venue.height,
    }


@router.post("/{venue_id}/upload-svg")
async def upload_venue_svg(
    venue_id: int,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_event_staff),
) -> dict:
    return await upload_venue_background(venue_id=venue_id, file=file, session=session, _=_)


@router.get("/{venue_id}/layouts", response_model=list[LayoutDetailResponse])
async def list_layouts(
    venue_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_event_staff),
) -> list[LayoutDetailResponse]:
    await _get_venue_or_404(session, venue_id)
    layouts = list(await session.scalars(select(VenueLayout).where(VenueLayout.venue_id == venue_id).order_by(VenueLayout.id.asc())))
    return [LayoutDetailResponse.model_validate(layout) for layout in layouts]


@router.post("/{venue_id}/layouts", response_model=LayoutDetailResponse)
async def create_layout(
    venue_id: int,
    payload: LayoutCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_event_staff),
) -> LayoutDetailResponse:
    await _get_venue_or_404(session, venue_id)
    layout = VenueLayout(venue_id=venue_id, name=payload.name, description=payload.description)
    session.add(layout)
    await session.commit()
    await session.refresh(layout)
    return LayoutDetailResponse.model_validate(layout)


@layout_router.patch("/{layout_id}", response_model=LayoutDetailResponse)
async def update_layout(
    layout_id: int,
    payload: LayoutUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_event_staff),
) -> LayoutDetailResponse:
    layout = await session.scalar(select(VenueLayout).where(VenueLayout.id == layout_id))
    if not layout:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay bo cuc")
    for field_name, field_value in payload.model_dump(exclude_unset=True).items():
        setattr(layout, field_name, field_value)
    await session.commit()
    await session.refresh(layout)
    return LayoutDetailResponse.model_validate(layout)


@router.get("/layouts/{layout_id}/sections", response_model=list[dict])
async def list_layout_sections(
    layout_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_event_staff),
) -> list[dict]:
    layout = await session.scalar(select(VenueLayout).where(VenueLayout.id == layout_id))
    if not layout:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay bo cuc")
    return []


@router.post("/layouts/{layout_id}/sections", response_model=APIMessage)
async def create_layout_section(
    layout_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_event_staff),
) -> APIMessage:
    _ = layout_id
    raise HTTPException(status_code=status.HTTP_410_GONE, detail="Section da bi loai khoi he thong")


@layout_router.delete("/{layout_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_layout(
    layout_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_event_staff),
) -> None:
    layout = await session.scalar(select(VenueLayout).where(VenueLayout.id == layout_id))
    if not layout:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay bo cuc")
    await session.delete(layout)
    await session.commit()


@router.get("/{venue_id}/seats", response_model=list[VenueSeatResponse])
async def list_venue_seats(
    venue_id: int,
    layout_id: int | None = Query(default=None, ge=1),
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_event_staff),
) -> list[VenueSeatResponse]:
    await _get_venue_or_404(session, venue_id)
    layout = await _resolve_layout_for_venue(session, venue_id, layout_id)
    seats = list(await session.scalars(select(Seat).where(Seat.venue_layout_id == layout.id).order_by(Seat.id.asc())))
    return [_seat_response(seat) for seat in seats]


@router.get("/{venue_id}/polygons", response_model=list[dict])
async def list_venue_polygons(
    venue_id: int,
    layout_id: int | None = Query(default=None, ge=1),
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_event_staff),
) -> list[dict]:
    await _get_venue_or_404(session, venue_id)
    if layout_id is not None:
        await _resolve_layout_for_venue(session, venue_id, layout_id)
    return []


@router.post("/{venue_id}/polygons", response_model=APIMessage)
async def create_venue_polygon(
    venue_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_event_staff),
) -> APIMessage:
    _ = venue_id
    raise HTTPException(status_code=status.HTTP_410_GONE, detail="Polygon da bi loai khoi he thong")


@router.post("/{venue_id}/seats/single", response_model=VenueSeatResponse)
async def create_venue_seat_single(
    venue_id: int,
    payload: VenueSeatSingleCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_event_staff),
) -> VenueSeatResponse:
    await _get_venue_or_404(session, venue_id)
    layout = await _resolve_layout_for_venue(session, venue_id, payload.layout_id)
    existing = await session.scalar(
        select(func.count()).select_from(Seat).where(Seat.venue_layout_id == layout.id, func.lower(Seat.seat_label) == payload.label.lower())
    )
    if existing and existing > 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nhan ghe da ton tai trong bo cuc nay")
    row_label, seat_number = _derive_layout_seat_identity(payload.label, payload.row_label, payload.seat_number)
    seat = Seat(
        venue_layout_id=layout.id,
        row_label=row_label,
        seat_number=seat_number,
        label=payload.label,
        x=round(payload.x, 2),
        y=round(payload.y, 2),
        is_active=True,
    )
    session.add(seat)
    await session.commit()
    await session.refresh(seat)
    return _seat_response(seat)


@router.post("/{venue_id}/seats/bulk", response_model=VenueSeatBulkCreateResponse)
async def create_venue_seat_bulk(
    venue_id: int,
    payload: VenueSeatBulkCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_event_staff),
) -> VenueSeatBulkCreateResponse:
    await _get_venue_or_404(session, venue_id)
    layout = await _resolve_layout_for_venue(session, venue_id, payload.layout_id)
    existing_labels = {str(label).lower() for label in await session.scalars(select(Seat.seat_label).where(Seat.venue_layout_id == layout.id))}
    created: list[Seat] = []
    if payload.pattern not in {"straight", "zigzag", "arc"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mau sinh ghe khong duoc ho tro")

    for row in range(payload.rows):
        seats_in_row = payload.cols if payload.pattern != "arc" or payload.arc_config is None else payload.cols + row * 2
        offset = payload.gap_x / 2 if payload.pattern == "zigzag" and row % 2 else 0
        for col in range(seats_in_row):
            label = f"{payload.label_prefix}{row + 1}-{col + 1}"
            if label.lower() in existing_labels:
                continue
            if payload.pattern == "arc":
                cfg = payload.arc_config
                radius = cfg.radius + row * payload.gap_y
                denominator = seats_in_row - 1 if seats_in_row > 1 else 1
                angle = cfg.start_angle + (cfg.end_angle - cfg.start_angle) * (col / denominator)
                radians = math.radians(angle)
                x = max(0.0, min(100.0, cfg.center_x + radius * math.sin(radians)))
                y = max(0.0, min(100.0, cfg.center_y + radius * math.cos(radians)))
            else:
                x = max(0.0, min(100.0, payload.start_x + offset + col * payload.gap_x))
                y = max(0.0, min(100.0, payload.start_y + row * payload.gap_y))
            seat = Seat(
                venue_layout_id=layout.id,
                row_label=f"{payload.label_prefix}{row + 1}",
                seat_number=col + 1,
                label=label,
                x=round(x, 2),
                y=round(y, 2),
                is_active=True,
            )
            session.add(seat)
            created.append(seat)
            existing_labels.add(label.lower())

    await session.commit()
    for seat in created:
        await session.refresh(seat)
    return VenueSeatBulkCreateResponse(created_count=len(created), seats=[_seat_response(seat) for seat in created])


@router.post("/{venue_id}/seats/sync", response_model=VenueSeatSyncResponse)
async def sync_venue_seats(
    venue_id: int,
    payload: VenueSeatSyncRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_event_staff),
) -> VenueSeatSyncResponse:
    await _get_venue_or_404(session, venue_id)
    layout = await _resolve_layout_for_venue(session, venue_id, payload.layout_id)
    existing_seats = list(await session.scalars(select(Seat).where(Seat.venue_layout_id == layout.id).order_by(Seat.id.asc())))
    seat_map = {seat.id: seat for seat in existing_seats}

    update_ids = [item.id for item in payload.update]
    delete_ids = set(payload.delete_ids)
    client_ids = [item.client_id for item in payload.create]
    if len(update_ids) != len(set(update_ids)) or len(client_ids) != len(set(client_ids)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payload ghế bị trùng định danh")

    final_labels: list[str] = []
    update_map = {item.id: item for item in payload.update}
    for seat in existing_seats:
        if seat.id in delete_ids:
            continue
        candidate = update_map.get(seat.id)
        final_labels.append(candidate.label if candidate else seat.label)
    final_labels.extend(item.label for item in payload.create)
    lowered = [label.strip().lower() for label in final_labels]
    if len(lowered) != len(set(lowered)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nhan ghe da ton tai trong bo cuc nay")

    created_pairs: list[tuple[int, Seat]] = []
    try:
        for item in payload.update:
            seat = seat_map.get(item.id)
            if not seat:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay ghe mau")
            row_label, seat_number = _derive_layout_seat_identity(item.label, item.row_label, item.seat_number)
            seat.label = item.label
            seat.row_label = row_label
            seat.seat_number = seat_number
            seat.x = round(item.x, 2)
            seat.y = round(item.y, 2)

        for item in payload.create:
            row_label, seat_number = _derive_layout_seat_identity(item.label, item.row_label, item.seat_number)
            seat = Seat(
                venue_layout_id=layout.id,
                row_label=row_label,
                seat_number=seat_number,
                label=item.label,
                x=round(item.x, 2),
                y=round(item.y, 2),
                is_active=True,
            )
            session.add(seat)
            created_pairs.append((item.client_id, seat))

        for seat_id in payload.delete_ids:
            seat = seat_map.get(seat_id)
            if not seat:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay ghe mau")
            await session.delete(seat)

        await session.commit()
        for _, seat in created_pairs:
            await session.refresh(seat)
    except Exception:
        await session.rollback()
        raise

    return VenueSeatSyncResponse(
        created=[
            VenueSeatSyncCreatedItem(
                client_id=client_id,
                id=seat.id,
                label=seat.label,
                row_label=seat.row_label,
                seat_number=seat.seat_number,
                x=float(seat.x_coord) if seat.x_coord is not None else None,
                y=float(seat.y_coord) if seat.y_coord is not None else None,
            )
            for client_id, seat in created_pairs
        ],
        updated_ids=update_ids,
        deleted_ids=list(payload.delete_ids),
    )


@seat_router.patch("/{seat_id}", response_model=VenueSeatResponse)
async def update_venue_seat(
    seat_id: int,
    payload: VenueSeatUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_event_staff),
) -> VenueSeatResponse:
    seat = await session.scalar(select(Seat).where(Seat.id == seat_id))
    if not seat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay ghe mau")
    if payload.label is not None:
        existing = await session.scalar(
            select(func.count()).select_from(Seat).where(
                Seat.venue_layout_id == seat.venue_layout_id,
                func.lower(Seat.seat_label) == payload.label.lower(),
                Seat.id != seat.id,
            )
        )
        if existing and existing > 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nhan ghe da ton tai trong bo cuc nay")
        seat.label = payload.label
    if payload.label is not None or payload.row_label is not None or payload.seat_number is not None:
        row_label, seat_number = _derive_layout_seat_identity(
            seat.label,
            payload.row_label if payload.row_label is not None else seat.row_label,
            payload.seat_number if payload.seat_number is not None else seat.seat_number,
        )
        seat.row_label = row_label
        seat.seat_number = seat_number
    if payload.x is not None:
        seat.x = round(payload.x, 2)
    if payload.y is not None:
        seat.y = round(payload.y, 2)
    await session.commit()
    await session.refresh(seat)
    return _seat_response(seat)


@seat_router.delete("/{seat_id}", response_model=APIMessage)
async def delete_venue_seat(
    seat_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_event_staff),
) -> APIMessage:
    seat = await session.scalar(select(Seat).where(Seat.id == seat_id))
    if not seat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay ghe mau")
    await session.delete(seat)
    await session.commit()
    return APIMessage(detail="Da xoa ghe")


@section_router.api_route("/{rest_of_path:path}", methods=["GET", "POST", "PATCH", "DELETE"])
async def deprecated_sections(rest_of_path: str) -> APIMessage:
    _ = rest_of_path
    raise HTTPException(status_code=status.HTTP_410_GONE, detail="Section da bi loai khoi he thong")


@polygon_router.api_route("/{rest_of_path:path}", methods=["GET", "POST", "PATCH", "DELETE"])
async def deprecated_polygons(rest_of_path: str) -> APIMessage:
    _ = rest_of_path
    raise HTTPException(status_code=status.HTTP_410_GONE, detail="Polygon da bi loai khoi he thong")
