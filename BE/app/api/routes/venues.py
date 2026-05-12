"""Venue, layout, section, and builder management routes."""

import base64
import math
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_admin
from app.core.db import get_db_session
from app.models.enums import SeatStatus
from app.models.seat import Seat
from app.models.user import User
from app.models.venue import Polygon, Section, Venue, VenueLayout
from app.schemas.common import APIMessage
from app.schemas.venue import (
    PolygonCreateRequest,
    PolygonResponse,
    PolygonUpdateRequest,
    LayoutCreateRequest,
    LayoutDetailResponse,
    LayoutUpdateRequest,
    SectionCreateRequest,
    SectionDetailResponse,
    SectionUpdateRequest,
    VenueSeatBulkCreateRequest,
    VenueSeatBulkCreateResponse,
    VenueCreateRequest,
    VenueDetailResponse,
    VenueListResponse,
    VenueSeatResponse,
    VenueSeatSingleCreateRequest,
    VenueSeatUpdateRequest,
    VenueUpdateRequest,
)
from app.services.map_processor import process_venue_svg

router = APIRouter(prefix="/admin/venues", tags=["admin-venues"])
seat_router = APIRouter(prefix="/admin/seats", tags=["admin-seats"])
polygon_router = APIRouter(prefix="/admin/polygons", tags=["admin-polygons"])


async def _get_venue_or_404(session: AsyncSession, venue_id: int) -> Venue:
    venue = await session.scalar(select(Venue).where(Venue.id == venue_id))
    if not venue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venue not found")
    return venue


async def _resolve_layout_for_venue(session: AsyncSession, venue_id: int, layout_id: int | None) -> VenueLayout:
    stmt = select(VenueLayout).where(VenueLayout.venue_id == venue_id)
    if layout_id is not None:
        stmt = stmt.where(VenueLayout.id == layout_id)
    stmt = stmt.order_by(VenueLayout.sort_order.asc(), VenueLayout.id.asc())
    layout = await session.scalar(stmt)
    if not layout:
        if layout_id is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Layout not found for this venue")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Venue requires at least one layout")
    return layout


async def _resolve_section_for_layout(session: AsyncSession, layout_id: int, section_id: int | None) -> Section | None:
    if section_id is None:
        return None
    section = await session.scalar(
        select(Section).where(Section.id == section_id, Section.venue_layout_id == layout_id)
    )
    if not section:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found for this layout")
    return section


async def _ensure_unique_layout_seat_label(
    session: AsyncSession,
    layout_id: int,
    label: str,
    exclude_seat_id: int | None = None,
) -> None:
    stmt = select(func.count()).select_from(Seat).where(
        Seat.venue_layout_id == layout_id,
        Seat.show_id.is_(None),
        func.lower(Seat.seat_label) == label.lower(),
    )
    if exclude_seat_id is not None:
        stmt = stmt.where(Seat.id != exclude_seat_id)
    exists = await session.scalar(stmt)
    if exists and exists > 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Seat label already exists for this layout")


def _seat_response_from_model(seat: Seat, section_name: str | None = None) -> VenueSeatResponse:
    return VenueSeatResponse(
        id=seat.id,
        venue_layout_id=seat.venue_layout_id,
        section_id=seat.section_id,
        section_name=section_name,
        label=seat.seat_label,
        x=float(seat.x_coord) if seat.x_coord is not None else None,
        y=float(seat.y_coord) if seat.y_coord is not None else None,
        rotation=float(seat.rotation) if seat.rotation is not None else 0.0,
        is_admin_locked=seat.is_admin_locked,
    )


def _polygon_response_from_model(polygon: Polygon, section_name: str | None = None) -> PolygonResponse:
    return PolygonResponse(
        id=polygon.id,
        venue_id=polygon.venue_id,
        venue_layout_id=polygon.venue_layout_id,
        section_id=polygon.section_id,
        section_name=section_name,
        label=polygon.label,
        points=polygon.points,
        created_at=polygon.created_at,
        updated_at=polygon.updated_at,
    )


def _apply_admin_lock_state(seat: Seat, is_admin_locked: bool) -> None:
    seat.is_admin_locked = is_admin_locked
    if is_admin_locked:
        seat.status = SeatStatus.LOCKED
        seat.locked_by_user_id = None
        seat.lock_expires_at = None
        return

    if seat.status == SeatStatus.LOCKED and seat.locked_by_user_id is None:
        seat.status = SeatStatus.AVAILABLE
        seat.lock_expires_at = None


def _generate_bulk_layout_seats(
    payload: VenueSeatBulkCreateRequest,
    layout_id: int,
    section_id: int | None,
    existing_labels: set[str],
) -> list[Seat]:
    seats_to_add: list[Seat] = []

    if payload.pattern == "straight":
        for row in range(payload.rows):
            for col in range(payload.cols):
                x = max(0.0, min(100.0, payload.start_x + col * payload.gap_x))
                y = max(0.0, min(100.0, payload.start_y + row * payload.gap_y))
                label = f"{payload.label_prefix}{row + 1}-{col + 1}"
                if label.lower() in existing_labels:
                    continue
                existing_labels.add(label.lower())
                seats_to_add.append(
                    Seat(
                        event_id=None,
                        zone_id=None,
                        row_index=row + 1,
                        row_label="",
                        seat_number=col + 1,
                        seat_label=label,
                        price=0,
                        x_coord=round(x, 2),
                        y_coord=round(y, 2),
                        rotation=0,
                        section_id=section_id,
                        venue_layout_id=layout_id,
                        status=SeatStatus.AVAILABLE,
                        is_admin_locked=False,
                    )
                )
        return seats_to_add

    if payload.pattern == "zigzag":
        for row in range(payload.rows):
            offset = payload.gap_x / 2 if row % 2 else 0
            for col in range(payload.cols):
                x = max(0.0, min(100.0, payload.start_x + offset + col * payload.gap_x))
                y = max(0.0, min(100.0, payload.start_y + row * payload.gap_y))
                label = f"{payload.label_prefix}{row + 1}-{col + 1}"
                if label.lower() in existing_labels:
                    continue
                existing_labels.add(label.lower())
                seats_to_add.append(
                    Seat(
                        event_id=None,
                        zone_id=None,
                        row_index=row + 1,
                        row_label="",
                        seat_number=col + 1,
                        seat_label=label,
                        price=0,
                        x_coord=round(x, 2),
                        y_coord=round(y, 2),
                        rotation=0,
                        section_id=section_id,
                        venue_layout_id=layout_id,
                        status=SeatStatus.AVAILABLE,
                        is_admin_locked=False,
                    )
                )
        return seats_to_add

    if payload.pattern == "arc":
        if payload.arc_config is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="arc_config required for arc pattern")
        cfg = payload.arc_config
        for row in range(payload.rows):
            radius = cfg.radius + row * payload.gap_y
            seats_in_row = payload.cols + row * 2
            denominator = seats_in_row - 1 if seats_in_row > 1 else 1
            for col in range(seats_in_row):
                angle = cfg.start_angle + (cfg.end_angle - cfg.start_angle) * (col / denominator)
                radians = math.radians(angle)
                x = max(0.0, min(100.0, cfg.center_x + radius * math.sin(radians)))
                y = max(0.0, min(100.0, cfg.center_y + radius * math.cos(radians)))
                label = f"{payload.label_prefix}{row + 1}-{col + 1}"
                if label.lower() in existing_labels:
                    continue
                existing_labels.add(label.lower())
                seats_to_add.append(
                    Seat(
                        event_id=None,
                        zone_id=None,
                        row_index=row + 1,
                        row_label="",
                        seat_number=col + 1,
                        seat_label=label,
                        price=0,
                        x_coord=round(x, 2),
                        y_coord=round(y, 2),
                        rotation=round(angle, 2),
                        section_id=section_id,
                        venue_layout_id=layout_id,
                        status=SeatStatus.AVAILABLE,
                        is_admin_locked=False,
                    )
                )
        return seats_to_add

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported pattern")


# ── Venue CRUD ──

@router.post("", response_model=VenueDetailResponse)
async def create_venue(
    payload: VenueCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    admin_user: User = Depends(get_current_active_admin),
) -> VenueDetailResponse:
    """Create a new venue."""

    venue = Venue(
        name=payload.name,
        address=payload.address,
        city=payload.city,
        venue_type=payload.venue_type,
        capacity=payload.capacity,
        width=payload.width or 1000,
        height=payload.height or 600,
        created_by_user_id=admin_user.id,
    )
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
    _: User = Depends(get_current_active_admin),
) -> list[VenueListResponse]:
    """List all venues."""

    stmt = select(Venue).where(Venue.is_active.is_(True)).order_by(Venue.created_at.desc())
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(Venue.name.ilike(pattern) | Venue.city.ilike(pattern))

    venues = list(await session.scalars(stmt.limit(limit).offset(offset)))
    return [VenueListResponse.model_validate(v) for v in venues]


@router.get("/{venue_id}", response_model=VenueDetailResponse)
async def get_venue(
    venue_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> VenueDetailResponse:
    """Get venue details."""

    venue = await session.scalar(select(Venue).where(Venue.id == venue_id))
    if not venue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venue not found")
    return VenueDetailResponse.model_validate(venue)


@router.patch("/{venue_id}", response_model=VenueDetailResponse)
async def update_venue(
    venue_id: int,
    payload: VenueUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> VenueDetailResponse:
    """Update venue metadata."""

    venue = await session.scalar(select(Venue).where(Venue.id == venue_id))
    if not venue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venue not found")

    updates = payload.model_dump(exclude_unset=True)
    for field_name, field_value in updates.items():
        setattr(venue, field_name, field_value)

    await session.commit()
    await session.refresh(venue)
    return VenueDetailResponse.model_validate(venue)


@router.delete("/{venue_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_venue(
    venue_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> None:
    """Soft-delete a venue."""

    venue = await session.scalar(select(Venue).where(Venue.id == venue_id))
    if not venue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venue not found")

    venue.is_active = False
    await session.commit()


# ── SVG Upload & Process ──

SVG_CONTENT_TYPES = {"image/svg+xml", "text/xml", "application/xml"}
RASTER_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}
BACKGROUND_CONTENT_TYPES = SVG_CONTENT_TYPES | RASTER_CONTENT_TYPES


def _is_svg_markup(value: str | None) -> bool:
    return bool(value and "<svg" in value[:500].lower())


async def _store_venue_background(venue: Venue, file: UploadFile) -> tuple[str, str]:
    if not file.content_type or file.content_type not in BACKGROUND_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only SVG, PNG, JPEG, and WEBP files are allowed",
        )

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Background must be <= 10MB")

    if file.content_type in SVG_CONTENT_TYPES:
        venue.svg_source = content.decode("utf-8")
        background_type = "svg"
    else:
        encoded = base64.b64encode(content).decode("ascii")
        venue.svg_source = f"data:{file.content_type};base64,{encoded}"
        background_type = "raster"

    # Parsed SVG output is tied to the current source and must be dropped on any new upload.
    venue.svg_processed = None
    return background_type, file.content_type

@router.post("/{venue_id}/upload-svg")
async def upload_venue_svg(
    venue_id: int,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> dict[str, Any]:
    """Backward-compatible endpoint for uploading a venue background."""

    return await upload_venue_background(venue_id=venue_id, file=file, session=session, _=_)


@router.post("/{venue_id}/upload-background")
async def upload_venue_background(
    venue_id: int,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> dict[str, Any]:
    """Upload and store a venue background."""

    venue = await session.scalar(select(Venue).where(Venue.id == venue_id))
    if not venue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venue not found")

    background_type, content_type = await _store_venue_background(venue, file)
    await session.commit()

    return {
        "detail": "Background uploaded successfully",
        "venue_id": venue_id,
        "background_type": background_type,
        "content_type": content_type,
    }


@router.post("/{venue_id}/process")
async def process_venue_svg_endpoint(
    venue_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> dict[str, Any]:
    """Process uploaded SVG and extract seats/sections."""

    venue = await session.scalar(select(Venue).where(Venue.id == venue_id))
    if not venue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venue not found")

    if not venue.svg_source:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No background uploaded for this venue")

    if not _is_svg_markup(venue.svg_source):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SVG parse is only available when the current background is an SVG",
        )

    result = await process_venue_svg(venue_id, venue.svg_source)

    venue.svg_processed = result.svg_processed
    venue.width = result.width
    venue.height = result.height
    await session.commit()

    return {
        "venue_id": venue_id,
        "seat_count": len(result.seats),
        "sections_detected": len(result.sections),
        "width": result.width,
        "height": result.height,
        "seats": [
            {"seat_id": s.seat_id, "label": s.label, "x": s.x, "y": s.y, "rotation": s.rotation, "section": s.section}
            for s in result.seats
        ],
        "sections": result.sections,
    }


# ── Layout CRUD ──

@router.post("/{venue_id}/layouts", response_model=LayoutDetailResponse)
async def create_layout(
    venue_id: int,
    payload: LayoutCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> LayoutDetailResponse:
    """Create a new layout for a venue."""

    venue = await session.scalar(select(Venue).where(Venue.id == venue_id))
    if not venue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venue not found")

    layout = VenueLayout(
        venue_id=venue_id,
        name=payload.name,
        description=payload.description,
        svg_data=payload.svg_data,
        sort_order=payload.sort_order or 0,
    )
    session.add(layout)
    await session.commit()
    await session.refresh(layout)
    return LayoutDetailResponse.model_validate(layout)


@router.get("/{venue_id}/layouts", response_model=list[LayoutDetailResponse])
async def list_layouts(
    venue_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> list[LayoutDetailResponse]:
    """List layouts for a venue."""

    layouts = list(
        await session.scalars(
            select(VenueLayout).where(VenueLayout.venue_id == venue_id).order_by(VenueLayout.sort_order.asc())
        )
    )
    return [LayoutDetailResponse.model_validate(l) for l in layouts]


# ── Layout detail/update/delete (using /admin/layouts prefix) ──

layout_router = APIRouter(prefix="/admin/layouts", tags=["admin-layouts"])


@layout_router.get("/{layout_id}", response_model=LayoutDetailResponse)
async def get_layout(
    layout_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> LayoutDetailResponse:
    """Get layout details."""

    layout = await session.scalar(select(VenueLayout).where(VenueLayout.id == layout_id))
    if not layout:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Layout not found")
    return LayoutDetailResponse.model_validate(layout)


@layout_router.patch("/{layout_id}", response_model=LayoutDetailResponse)
async def update_layout(
    layout_id: int,
    payload: LayoutUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> LayoutDetailResponse:
    """Update layout."""

    layout = await session.scalar(select(VenueLayout).where(VenueLayout.id == layout_id))
    if not layout:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Layout not found")

    updates = payload.model_dump(exclude_unset=True)
    for field_name, field_value in updates.items():
        setattr(layout, field_name, field_value)

    await session.commit()
    await session.refresh(layout)
    return LayoutDetailResponse.model_validate(layout)


@layout_router.delete("/{layout_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_layout(
    layout_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> None:
    """Delete a layout."""

    layout = await session.scalar(select(VenueLayout).where(VenueLayout.id == layout_id))
    if not layout:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Layout not found")

    await session.delete(layout)
    await session.commit()


# ── Section CRUD ──

@layout_router.get("/{layout_id}/sections", response_model=list[SectionDetailResponse])
async def list_sections(
    layout_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> list[SectionDetailResponse]:
    """List sections for a layout."""

    sections = list(
        await session.scalars(
            select(Section).where(Section.venue_layout_id == layout_id).order_by(Section.sort_order.asc())
        )
    )
    return [SectionDetailResponse.model_validate(s) for s in sections]


@layout_router.post("/{layout_id}/sections", response_model=SectionDetailResponse)
async def create_section(
    layout_id: int,
    payload: SectionCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> SectionDetailResponse:
    """Create a section within a layout."""

    layout = await session.scalar(select(VenueLayout).where(VenueLayout.id == layout_id))
    if not layout:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Layout not found")

    section = Section(
        venue_layout_id=layout_id,
        name=payload.name,
        code=payload.code,
        color=payload.color,
        price_base=payload.price_base,
        sort_order=payload.sort_order or 0,
    )
    session.add(section)
    await session.commit()
    await session.refresh(section)
    return SectionDetailResponse.model_validate(section)


section_router = APIRouter(prefix="/admin/sections", tags=["admin-sections"])


@section_router.patch("/{section_id}", response_model=SectionDetailResponse)
async def update_section(
    section_id: int,
    payload: SectionUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> SectionDetailResponse:
    """Update a section."""

    section = await session.scalar(select(Section).where(Section.id == section_id))
    if not section:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")

    updates = payload.model_dump(exclude_unset=True)
    for field_name, field_value in updates.items():
        setattr(section, field_name, field_value)

    await session.commit()
    await session.refresh(section)
    return SectionDetailResponse.model_validate(section)


@section_router.delete("/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_section(
    section_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> None:
    """Delete a section if it has no seats."""

    section = await session.scalar(select(Section).where(Section.id == section_id))
    if not section:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")

    # Check if section has seats
    seat_count = await session.scalar(
        select(func.count()).select_from(Seat).where(Seat.section_id == section_id)
    )
    if seat_count and seat_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete section with existing seats",
        )

    await session.delete(section)
    await session.commit()


# ── Venue Builder: Seats ──

@router.get("/{venue_id}/seats", response_model=list[VenueSeatResponse])
async def list_venue_seats(
    venue_id: int,
    layout_id: int | None = Query(default=None, ge=1),
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> list[VenueSeatResponse]:
    """List template seats for one venue layout."""

    await _get_venue_or_404(session, venue_id)
    layout = await _resolve_layout_for_venue(session, venue_id, layout_id)

    sections = list(await session.scalars(select(Section).where(Section.venue_layout_id == layout.id)))
    section_name_map = {section.id: section.name for section in sections}
    seats = list(
        await session.scalars(
            select(Seat)
            .where(Seat.venue_layout_id == layout.id, Seat.show_id.is_(None))
            .order_by(Seat.section_id.asc(), Seat.row_index.asc(), Seat.seat_number.asc(), Seat.seat_label.asc())
        )
    )
    return [_seat_response_from_model(seat, section_name_map.get(seat.section_id)) for seat in seats]


@router.post("/{venue_id}/seats/single", response_model=VenueSeatResponse)
async def create_venue_seat_single(
    venue_id: int,
    payload: VenueSeatSingleCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> VenueSeatResponse:
    """Create one template seat within a venue layout."""

    await _get_venue_or_404(session, venue_id)
    layout = await _resolve_layout_for_venue(session, venue_id, payload.layout_id)
    section = await _resolve_section_for_layout(session, layout.id, payload.section_id)
    await _ensure_unique_layout_seat_label(session, layout.id, payload.label)

    seat = Seat(
        event_id=None,
        zone_id=None,
        row_index=0,
        row_label="",
        seat_number=0,
        seat_label=payload.label,
        price=0,
        x_coord=round(payload.x, 2),
        y_coord=round(payload.y, 2),
        rotation=round(payload.rotation, 2),
        section_id=section.id if section else None,
        venue_layout_id=layout.id,
        status=SeatStatus.LOCKED if payload.is_admin_locked else SeatStatus.AVAILABLE,
        is_admin_locked=payload.is_admin_locked,
    )
    session.add(seat)
    await session.commit()
    await session.refresh(seat)
    return _seat_response_from_model(seat, section.name if section else None)


@router.post("/{venue_id}/seats/bulk", response_model=VenueSeatBulkCreateResponse)
async def create_venue_seat_bulk(
    venue_id: int,
    payload: VenueSeatBulkCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> VenueSeatBulkCreateResponse:
    """Bulk-generate template seats for one venue layout."""

    await _get_venue_or_404(session, venue_id)
    layout = await _resolve_layout_for_venue(session, venue_id, payload.layout_id)
    section = await _resolve_section_for_layout(session, layout.id, payload.section_id)

    existing_labels = {
        str(label).lower()
        for label in await session.scalars(
            select(Seat.seat_label).where(Seat.venue_layout_id == layout.id, Seat.show_id.is_(None))
        )
    }
    seats_to_add = _generate_bulk_layout_seats(payload, layout.id, section.id if section else None, existing_labels)

    seat_rows = [
        {
            "event_id": seat.event_id,
            "zone_id": seat.zone_id,
            "row_index": seat.row_index,
            "row_label": seat.row_label,
            "seat_number": seat.seat_number,
            "seat_label": seat.seat_label,
            "price": seat.price,
            "status": seat.status.value,
            "is_admin_locked": seat.is_admin_locked,
            "x_coord": seat.x_coord,
            "y_coord": seat.y_coord,
            "rotation": seat.rotation,
            "section_id": seat.section_id,
            "venue_layout_id": seat.venue_layout_id,
        }
        for seat in seats_to_add
    ]
    result = await session.execute(insert(Seat).returning(Seat.id), seat_rows)
    created_ids = [row[0] for row in result]
    await session.commit()

    created_seats = []
    for seat, seat_id in zip(seats_to_add, created_ids):
        seat.id = seat_id
        created_seats.append(_seat_response_from_model(seat, section.name if section else None))

    return VenueSeatBulkCreateResponse(
        created_count=len(created_seats),
        seats=created_seats,
    )


# ── Venue Builder: Polygons ──

@router.get("/{venue_id}/polygons", response_model=list[PolygonResponse])
async def list_venue_polygons(
    venue_id: int,
    layout_id: int | None = Query(default=None, ge=1),
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> list[PolygonResponse]:
    """List polygons for one venue layout."""

    await _get_venue_or_404(session, venue_id)
    layout = await _resolve_layout_for_venue(session, venue_id, layout_id)
    sections = list(await session.scalars(select(Section).where(Section.venue_layout_id == layout.id)))
    section_name_map = {section.id: section.name for section in sections}
    polygons = list(
        await session.scalars(
            select(Polygon)
            .where(Polygon.venue_id == venue_id, Polygon.venue_layout_id == layout.id)
            .order_by(Polygon.created_at.asc(), Polygon.id.asc())
        )
    )
    return [_polygon_response_from_model(polygon, section_name_map.get(polygon.section_id)) for polygon in polygons]


@router.post("/{venue_id}/polygons", response_model=PolygonResponse)
async def create_venue_polygon(
    venue_id: int,
    payload: PolygonCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> PolygonResponse:
    """Save one polygon zone for a venue layout."""

    await _get_venue_or_404(session, venue_id)
    layout = await _resolve_layout_for_venue(session, venue_id, payload.layout_id)
    section = await _resolve_section_for_layout(session, layout.id, payload.section_id)

    polygon = Polygon(
        venue_id=venue_id,
        venue_layout_id=layout.id,
        section_id=section.id if section else None,
        label=payload.label,
        points=[point.model_dump() for point in payload.points],
    )
    session.add(polygon)
    await session.commit()
    await session.refresh(polygon)
    return _polygon_response_from_model(polygon, section.name if section else None)


@polygon_router.patch("/{polygon_id}", response_model=PolygonResponse)
async def update_polygon(
    polygon_id: int,
    payload: PolygonUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> PolygonResponse:
    """Update one polygon zone."""

    polygon = await session.scalar(select(Polygon).where(Polygon.id == polygon_id))
    if not polygon:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Polygon not found")

    if payload.section_id is not None:
        section = await _resolve_section_for_layout(session, polygon.venue_layout_id, payload.section_id)
        polygon.section_id = section.id if section else None
    if payload.label is not None:
        polygon.label = payload.label
    if payload.points is not None:
        polygon.points = [point.model_dump() for point in payload.points]

    await session.commit()
    await session.refresh(polygon)
    section_name = None
    if polygon.section_id is not None:
        section = await session.scalar(select(Section).where(Section.id == polygon.section_id))
        section_name = section.name if section else None
    return _polygon_response_from_model(polygon, section_name)


@polygon_router.delete("/{polygon_id}", response_model=APIMessage)
async def delete_polygon(
    polygon_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> APIMessage:
    """Delete one polygon zone."""

    polygon = await session.scalar(select(Polygon).where(Polygon.id == polygon_id))
    if not polygon:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Polygon not found")

    await session.delete(polygon)
    await session.commit()
    return APIMessage(detail="Polygon deleted")


@seat_router.patch("/{seat_id}", response_model=VenueSeatResponse)
async def update_venue_seat(
    seat_id: int,
    payload: VenueSeatUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> VenueSeatResponse:
    """Update a template seat attached to a venue layout."""

    seat = await session.scalar(
        select(Seat).where(Seat.id == seat_id, Seat.show_id.is_(None), Seat.venue_layout_id.is_not(None))
    )
    if not seat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template seat not found")

    section = None
    if payload.section_id is not None:
        section = await _resolve_section_for_layout(session, seat.venue_layout_id, payload.section_id)
        seat.section_id = section.id if section else None

    if payload.label is not None:
        await _ensure_unique_layout_seat_label(session, seat.venue_layout_id, payload.label, exclude_seat_id=seat.id)
        seat.seat_label = payload.label
    if payload.x is not None:
        seat.x_coord = round(payload.x, 2)
    if payload.y is not None:
        seat.y_coord = round(payload.y, 2)
    if payload.rotation is not None:
        seat.rotation = round(payload.rotation, 2)
    if payload.is_admin_locked is not None:
        _apply_admin_lock_state(seat, payload.is_admin_locked)

    await session.commit()
    await session.refresh(seat)
    if section is None and seat.section_id is not None:
        section = await session.scalar(select(Section).where(Section.id == seat.section_id))
    return _seat_response_from_model(seat, section.name if section else None)


@seat_router.delete("/{seat_id}", response_model=APIMessage)
async def delete_venue_seat(
    seat_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> APIMessage:
    """Delete a template seat attached to a venue layout."""

    seat = await session.scalar(
        select(Seat).where(Seat.id == seat_id, Seat.show_id.is_(None), Seat.venue_layout_id.is_not(None))
    )
    if not seat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template seat not found")

    await session.delete(seat)
    await session.commit()
    return APIMessage(detail="Seat deleted")
