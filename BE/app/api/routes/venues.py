"""Venue, layout, and section management routes."""

from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_admin
from app.core.db import get_db_session
from app.models.user import User
from app.models.venue import Section, Venue, VenueLayout
from app.schemas.venue import (
    LayoutCreateRequest,
    LayoutDetailResponse,
    LayoutUpdateRequest,
    SectionCreateRequest,
    SectionDetailResponse,
    SectionUpdateRequest,
    VenueCreateRequest,
    VenueDetailResponse,
    VenueListResponse,
    VenueUpdateRequest,
)
from app.services.map_processor import process_venue_svg
from app.models.seat import Seat

router = APIRouter(prefix="/admin/venues", tags=["admin-venues"])


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

@router.post("/{venue_id}/upload-svg")
async def upload_venue_svg(
    venue_id: int,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> dict[str, Any]:
    """Upload and store original SVG for a venue."""

    venue = await session.scalar(select(Venue).where(Venue.id == venue_id))
    if not venue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venue not found")

    if not file.content_type or file.content_type not in ("image/svg+xml", "text/xml", "application/xml"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only SVG files are allowed")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SVG must be <= 10MB")

    svg_content = content.decode("utf-8")
    venue.svg_source = svg_content
    await session.commit()

    return {"detail": "SVG uploaded successfully", "venue_id": venue_id}


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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No SVG uploaded for this venue")

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
