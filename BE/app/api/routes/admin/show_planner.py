import math

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_admin
from app.core.db import get_db_session
from app.models.enums import SeatStatus
from app.models.event import SeatZone, ShowPolygon
from app.models.seat import Seat
from app.models.user import User
from app.models.venue import Section
from app.schemas.common import APIMessage
from app.schemas.event import (
    SeatBulkCreateRequest,
    SeatBulkCreateResponse,
    SeatCreateResponse,
    SeatSingleCreateRequest,
    SeatSyncCreatedItem,
    SeatSyncRequest,
    SeatSyncResponse,
    SeatUpdateRequest,
    SeatZoneCreate,
    SeatZoneResponse,
    SeatZoneUpdate,
    ShowPolygonCreateRequest,
    ShowPolygonResponse,
    ShowPolygonUpdateRequest,
)
from app.services.dashboard_service import broadcast_dashboard_update
from app.services.event_inventory_service import sync_show_ticket_inventory
from app.services.event_lifecycle_service import create_initial_show_zone, create_show_zone, delete_show_zone, update_show_zone
from app.services.event_query_service import get_show_by_id, list_show_zones

from ._shared import (
    _apply_admin_lock_state,
    _build_event_or_404_show,
    _ensure_show_is_draft,
    _invalidate_show_cache,
    _show_polygon_response_from_model,
    _validate_unique_ids,
    _validate_unique_labels,
)

router = APIRouter()


@router.get("/events/{event_key}/shows/{show_id}/zones", response_model=list[SeatZoneResponse])
async def list_zones(
    event_key: str,
    show_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> list[SeatZoneResponse]:
    _, show = await _build_event_or_404_show(session, event_key, show_id)
    zones = await list_show_zones(session, show.id)
    return [SeatZoneResponse.model_validate(zone) for zone in zones]


@router.post("/events/{event_key}/shows/{show_id}/zones", response_model=SeatZoneResponse, status_code=status.HTTP_201_CREATED)
async def create_zone(
    event_key: str,
    show_id: int,
    payload: SeatZoneCreate,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> SeatZoneResponse:
    _, show = await _build_event_or_404_show(session, event_key, show_id)
    _ensure_show_is_draft(show)
    try:
        zone = await create_show_zone(session, show, payload)
        await sync_show_ticket_inventory(session, show)
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    await _invalidate_show_cache(show.id)
    await broadcast_dashboard_update()
    return SeatZoneResponse.model_validate(zone)


@router.post("/events/{event_key}/shows/{show_id}/zones/initial", response_model=SeatZoneResponse, status_code=status.HTTP_201_CREATED)
async def create_initial_zone(
    event_key: str,
    show_id: int,
    payload: SeatZoneCreate,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> SeatZoneResponse:
    _, show = await _build_event_or_404_show(session, event_key, show_id)
    _ensure_show_is_draft(show)
    try:
        zone = await create_initial_show_zone(session, show, payload)
        await sync_show_ticket_inventory(session, show)
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    await _invalidate_show_cache(show.id)
    await broadcast_dashboard_update()
    return SeatZoneResponse.model_validate(zone)


@router.patch("/events/{event_key}/shows/{show_id}/zones/{zone_id}", response_model=SeatZoneResponse)
async def update_zone(
    event_key: str,
    show_id: int,
    zone_id: int,
    payload: SeatZoneUpdate,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> SeatZoneResponse:
    _, show = await _build_event_or_404_show(session, event_key, show_id)
    _ensure_show_is_draft(show)
    try:
        zone = await update_show_zone(session, show, zone_id, payload)
        await sync_show_ticket_inventory(session, show)
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    await _invalidate_show_cache(show.id)
    await broadcast_dashboard_update()
    return SeatZoneResponse.model_validate(zone)


@router.delete("/events/{event_key}/shows/{show_id}/zones/{zone_id}", response_model=APIMessage)
async def delete_zone(
    event_key: str,
    show_id: int,
    zone_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> APIMessage:
    _, show = await _build_event_or_404_show(session, event_key, show_id)
    _ensure_show_is_draft(show)
    try:
        await delete_show_zone(session, show, zone_id)
        await sync_show_ticket_inventory(session, show)
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    await _invalidate_show_cache(show.id)
    await broadcast_dashboard_update()
    return APIMessage(detail="Da xoa khu vuc ghe thanh cong")


@router.post("/events/{event_key}/shows/{show_id}/polygons", response_model=ShowPolygonResponse)
async def create_show_polygon(
    event_key: str,
    show_id: int,
    payload: ShowPolygonCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> ShowPolygonResponse:
    _, show = await _build_event_or_404_show(session, event_key, show_id)
    _ensure_show_is_draft(show)
    zone = None
    if payload.zone_id is not None:
        zone = await session.scalar(select(SeatZone).where(SeatZone.id == payload.zone_id, SeatZone.show_id == show.id))
        if not zone:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay khu vuc ghe thuoc buoi dien nay")

    polygon = ShowPolygon(
        show_id=show.id,
        zone_id=zone.id if zone else None,
        label=payload.label,
        points=[point.model_dump() for point in payload.points],
    )
    session.add(polygon)
    await session.commit()
    await session.refresh(polygon)

    await _invalidate_show_cache(show.id)
    return _show_polygon_response_from_model(polygon, zone.name if zone else None)


@router.patch("/show-polygons/{polygon_id}", response_model=ShowPolygonResponse)
async def update_show_polygon(
    polygon_id: int,
    payload: ShowPolygonUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> ShowPolygonResponse:
    polygon = await session.scalar(select(ShowPolygon).where(ShowPolygon.id == polygon_id))
    if not polygon:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay polygon cua buoi dien")
    show = await get_show_by_id(session, polygon.show_id)
    _ensure_show_is_draft(show)

    zone = None
    if payload.zone_id is not None:
        zone = await session.scalar(select(SeatZone).where(SeatZone.id == payload.zone_id, SeatZone.show_id == polygon.show_id))
        if not zone:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay khu vuc ghe thuoc buoi dien nay")
        polygon.zone_id = zone.id
    elif payload.zone_id is None and "zone_id" in payload.model_fields_set:
        polygon.zone_id = None

    if payload.label is not None:
        polygon.label = payload.label
    if payload.points is not None:
        polygon.points = [point.model_dump() for point in payload.points]

    await session.commit()
    await session.refresh(polygon)
    await _invalidate_show_cache(polygon.show_id)
    if zone is None and polygon.zone_id is not None:
        zone = await session.scalar(select(SeatZone).where(SeatZone.id == polygon.zone_id))
    return _show_polygon_response_from_model(polygon, zone.name if zone else None)


@router.delete("/show-polygons/{polygon_id}", response_model=APIMessage)
async def delete_show_polygon(
    polygon_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> APIMessage:
    polygon = await session.scalar(select(ShowPolygon).where(ShowPolygon.id == polygon_id))
    if not polygon:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay polygon cua buoi dien")
    show = await get_show_by_id(session, polygon.show_id)
    _ensure_show_is_draft(show)

    show_id = polygon.show_id
    await session.delete(polygon)
    await session.commit()
    await _invalidate_show_cache(show_id)
    return APIMessage(detail="Da xoa polygon cua buoi dien")


@router.post("/events/{event_key}/shows/{show_id}/seats/single", response_model=SeatCreateResponse)
async def create_show_seat_single(
    event_key: str,
    show_id: int,
    payload: SeatSingleCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> SeatCreateResponse:
    _, show = await _build_event_or_404_show(session, event_key, show_id)
    _ensure_show_is_draft(show)
    if not payload.zone_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bat buoc chon khu vuc ghe")

    zone = await session.scalar(select(SeatZone).where(SeatZone.id == payload.zone_id, SeatZone.show_id == show.id))
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay khu vuc ghe thuoc buoi dien nay")

    exists = await session.scalar(select(func.count()).select_from(Seat).where(Seat.show_id == show.id, Seat.seat_label == payload.seat_label))
    if exists and exists > 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nhan ghe da ton tai trong buoi dien nay")

    price = float(payload.price) if payload.price is not None else float(zone.price)
    seat = Seat(
        event_id=show.event_id,
        show_id=show.id,
        zone_id=zone.id,
        row_index=0,
        row_label="",
        seat_number=0,
        seat_label=payload.seat_label,
        price=price,
        status=SeatStatus.LOCKED if payload.is_admin_locked else SeatStatus.AVAILABLE,
        x_coord=payload.x,
        y_coord=payload.y,
        rotation=payload.rotation,
        section_id=payload.section_id,
        venue_layout_id=show.venue_layout_id,
        is_admin_locked=payload.is_admin_locked,
    )
    session.add(seat)
    try:
        await session.flush()
        await sync_show_ticket_inventory(session, show)
        await session.commit()
        await session.refresh(seat)
    except Exception:
        await session.rollback()
        raise

    await _invalidate_show_cache(show.id)
    await broadcast_dashboard_update()
    return SeatCreateResponse(id=seat.id, seat_label=seat.seat_label, x=float(seat.x_coord) if seat.x_coord is not None else None, y=float(seat.y_coord) if seat.y_coord is not None else None)


@router.post("/events/{event_key}/shows/{show_id}/seats/bulk", response_model=SeatBulkCreateResponse)
async def create_show_seat_bulk(
    event_key: str,
    show_id: int,
    payload: SeatBulkCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> SeatBulkCreateResponse:
    _, show = await _build_event_or_404_show(session, event_key, show_id)
    _ensure_show_is_draft(show)
    if not payload.zone_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bat buoc chon khu vuc ghe khi sinh ghe hang loat")

    zone = await session.scalar(select(SeatZone).where(SeatZone.id == payload.zone_id, SeatZone.show_id == show.id))
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay khu vuc ghe thuoc buoi dien nay")

    existing_labels = set(await session.scalars(select(Seat.seat_label).where(Seat.show_id == show.id)))
    created: list[SeatCreateResponse] = []
    seats_to_add: list[Seat] = []

    rows = payload.rows
    cols = payload.cols
    prefix = payload.label_prefix
    start_x = payload.start_x
    start_y = payload.start_y
    gap_x = payload.gap_x
    gap_y = payload.gap_y

    if payload.pattern == "straight":
        for r in range(rows):
            for c in range(cols):
                x = max(0.0, min(100.0, start_x + c * gap_x))
                y = max(0.0, min(100.0, start_y + r * gap_y))
                label = f"{prefix}{r + 1}-{c + 1}"
                if label in existing_labels:
                    continue
                existing_labels.add(label)
                seats_to_add.append(
                    Seat(
                        event_id=show.event_id,
                        show_id=show.id,
                        zone_id=zone.id,
                        row_index=r + 1,
                        row_label="",
                        seat_number=c + 1,
                        seat_label=label,
                        price=float(zone.price),
                        status=SeatStatus.AVAILABLE,
                        x_coord=round(x, 2),
                        y_coord=round(y, 2),
                        rotation=0.0,
                        section_id=payload.section_id,
                        venue_layout_id=show.venue_layout_id,
                        is_admin_locked=False,
                    )
                )
    elif payload.pattern == "arc":
        if not payload.arc_config:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bat buoc co cau hinh vong cung khi dung mau vong cung")
        cfg = payload.arc_config
        for r in range(rows):
            radius = cfg.radius + r * gap_y
            seats_in_row = cols + r * 2
            for c in range(seats_in_row):
                angle = cfg.start_angle + (cfg.end_angle - cfg.start_angle) * (c / (seats_in_row - 1 if seats_in_row > 1 else 1))
                rad = math.radians(angle)
                x = max(0.0, min(100.0, cfg.center_x + radius * math.sin(rad)))
                y = max(0.0, min(100.0, cfg.center_y + radius * math.cos(rad)))
                label = f"{prefix}{r + 1}-{c + 1}"
                if label in existing_labels:
                    continue
                existing_labels.add(label)
                seats_to_add.append(
                    Seat(
                        event_id=show.event_id,
                        show_id=show.id,
                        zone_id=zone.id,
                        row_index=r + 1,
                        row_label="",
                        seat_number=c + 1,
                        seat_label=label,
                        price=float(zone.price),
                        status=SeatStatus.AVAILABLE,
                        x_coord=round(x, 2),
                        y_coord=round(y, 2),
                        rotation=angle,
                        section_id=payload.section_id,
                        venue_layout_id=show.venue_layout_id,
                        is_admin_locked=False,
                    )
                )
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mau sinh ghe khong duoc ho tro")

    if seats_to_add:
        session.add_all(seats_to_add)
        try:
            await session.flush()
            await sync_show_ticket_inventory(session, show)
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        for seat in seats_to_add:
            await session.refresh(seat)
            created.append(SeatCreateResponse(id=seat.id, seat_label=seat.seat_label, x=float(seat.x_coord) if seat.x_coord is not None else None, y=float(seat.y_coord) if seat.y_coord is not None else None))

    await _invalidate_show_cache(show.id)
    await broadcast_dashboard_update()
    return SeatBulkCreateResponse(created_count=len(created), seats=created)


@router.post("/events/{event_key}/shows/{show_id}/seats/sync", response_model=SeatSyncResponse)
async def sync_show_seats(
    event_key: str,
    show_id: int,
    payload: SeatSyncRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> SeatSyncResponse:
    _, show = await _build_event_or_404_show(session, event_key, show_id)
    _ensure_show_is_draft(show)
    existing_seats = list(await session.scalars(select(Seat).where(Seat.show_id == show.id).order_by(Seat.id.asc())))
    seat_map = {seat.id: seat for seat in existing_seats}
    zone_map = {zone.id: zone for zone in await session.scalars(select(SeatZone).where(SeatZone.show_id == show.id))}
    sections = list(await session.scalars(select(Section).where(Section.venue_layout_id == show.venue_layout_id))) if show.venue_layout_id is not None else []
    section_map = {section.id: section for section in sections}

    update_ids = [item.id for item in payload.update]
    delete_ids = list(payload.delete_ids)
    client_ids = [item.client_id for item in payload.create]
    _validate_unique_ids(update_ids, "Duplicate seat ids in update payload")
    _validate_unique_ids(delete_ids, "Duplicate seat ids in delete payload")
    _validate_unique_ids(client_ids, "Duplicate client ids in create payload")

    delete_id_set = set(delete_ids)
    if delete_id_set.intersection(update_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mot ghe khong the vua cap nhat vua xoa trong cung request")

    missing_update_ids = [seat_id for seat_id in update_ids if seat_id not in seat_map]
    if missing_update_ids:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay ghe thuoc buoi dien nay")

    missing_delete_ids = [seat_id for seat_id in delete_ids if seat_id not in seat_map]
    if missing_delete_ids:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay ghe thuoc buoi dien nay")

    if show.venue_layout_id is None:
        if any(item.section_id is not None for item in payload.create) or any(item.section_id is not None for item in payload.update):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Buoi dien nay khong ho tro section_id")
    else:
        invalid_section = next((item.section_id for item in [*payload.create, *payload.update] if item.section_id is not None and item.section_id not in section_map), None)
        if invalid_section is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay khu vuc layout thuoc buoi dien nay")

    for item in payload.create:
        if item.zone_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bat buoc chon khu vuc ghe")
        if item.zone_id not in zone_map:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay khu vuc ghe thuoc buoi dien nay")

    for item in payload.update:
        if item.zone_id is not None and item.zone_id not in zone_map:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay khu vuc ghe thuoc buoi dien nay")

    final_labels: list[str] = []
    update_map = {item.id: item for item in payload.update}
    for seat in existing_seats:
        if seat.id in delete_id_set:
            continue
        candidate = update_map.get(seat.id)
        final_labels.append(candidate.seat_label if candidate else seat.seat_label)
    final_labels.extend(item.seat_label for item in payload.create)
    _validate_unique_labels(final_labels, "Nhan ghe da ton tai trong buoi dien nay")

    created_pairs: list[tuple[int, Seat]] = []
    try:
        for item in payload.update:
            seat = seat_map[item.id]
            zone = zone_map.get(item.zone_id) if item.zone_id is not None else None
            if item.zone_id is not None:
                seat.zone_id = item.zone_id
                if item.price is None:
                    seat.price = float(zone.price) if zone else seat.price

            seat.seat_label = item.seat_label
            seat.x_coord = item.x
            seat.y_coord = item.y
            seat.rotation = item.rotation
            seat.section_id = item.section_id
            if item.price is not None:
                seat.price = float(item.price)
            _apply_admin_lock_state(seat, item.is_admin_locked)

        for item in payload.create:
            zone = zone_map[item.zone_id]
            seat = Seat(
                event_id=show.event_id,
                show_id=show.id,
                zone_id=zone.id,
                row_index=0,
                row_label="",
                seat_number=0,
                seat_label=item.seat_label,
                price=float(item.price) if item.price is not None else float(zone.price),
                status=SeatStatus.LOCKED if item.is_admin_locked else SeatStatus.AVAILABLE,
                x_coord=item.x,
                y_coord=item.y,
                rotation=item.rotation,
                section_id=item.section_id,
                venue_layout_id=show.venue_layout_id,
                is_admin_locked=item.is_admin_locked,
            )
            session.add(seat)
            created_pairs.append((item.client_id, seat))

        for seat_id in delete_ids:
            await session.delete(seat_map[seat_id])

        await session.flush()
        await sync_show_ticket_inventory(session, show)
        response = SeatSyncResponse(
            created=[
                SeatSyncCreatedItem(
                    client_id=client_id,
                    id=seat.id,
                    seat_label=seat.seat_label,
                    x=float(seat.x_coord) if seat.x_coord is not None else None,
                    y=float(seat.y_coord) if seat.y_coord is not None else None,
                )
                for client_id, seat in created_pairs
            ],
            updated_ids=update_ids,
            deleted_ids=delete_ids,
        )
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    await _invalidate_show_cache(show.id)
    await broadcast_dashboard_update()
    return response


@router.patch("/events/{event_key}/shows/{show_id}/seats/{seat_id}", response_model=SeatCreateResponse)
async def update_show_seat(
    event_key: str,
    show_id: int,
    seat_id: int,
    payload: SeatUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> SeatCreateResponse:
    _, show = await _build_event_or_404_show(session, event_key, show_id)
    _ensure_show_is_draft(show)
    seat = await session.scalar(select(Seat).where(Seat.id == seat_id, Seat.show_id == show.id))
    if not seat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay ghe thuoc buoi dien nay")

    if payload.zone_id is not None:
        zone = await session.scalar(select(SeatZone).where(SeatZone.id == payload.zone_id, SeatZone.show_id == show.id))
        if not zone:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay khu vuc ghe thuoc buoi dien nay")
        seat.zone_id = zone.id
        if payload.price is None:
            seat.price = float(zone.price)

    if payload.seat_label is not None and payload.seat_label != seat.seat_label:
        exists = await session.scalar(
            select(func.count()).select_from(Seat).where(
                Seat.show_id == show.id,
                Seat.seat_label == payload.seat_label,
                Seat.id != seat.id,
            )
        )
        if exists and exists > 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nhan ghe da ton tai trong buoi dien nay")
        seat.seat_label = payload.seat_label

    if payload.x is not None:
        seat.x_coord = payload.x
    if payload.y is not None:
        seat.y_coord = payload.y
    if payload.rotation is not None:
        seat.rotation = payload.rotation
    if payload.section_id is not None:
        seat.section_id = payload.section_id
    if payload.price is not None:
        seat.price = float(payload.price)
    if payload.is_admin_locked is not None:
        _apply_admin_lock_state(seat, payload.is_admin_locked)

    try:
        await session.flush()
        await sync_show_ticket_inventory(session, show)
        await session.commit()
        await session.refresh(seat)
    except Exception:
        await session.rollback()
        raise

    await _invalidate_show_cache(show.id)
    await broadcast_dashboard_update()
    return SeatCreateResponse(id=seat.id, seat_label=seat.seat_label, x=float(seat.x_coord) if seat.x_coord is not None else None, y=float(seat.y_coord) if seat.y_coord is not None else None)


@router.delete("/events/{event_key}/shows/{show_id}/seats/{seat_id}", response_model=APIMessage)
async def delete_show_seat(
    event_key: str,
    show_id: int,
    seat_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> APIMessage:
    _, show = await _build_event_or_404_show(session, event_key, show_id)
    _ensure_show_is_draft(show)
    seat = await session.scalar(select(Seat).where(Seat.id == seat_id, Seat.show_id == show.id))
    if not seat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay ghe thuoc buoi dien nay")

    await session.delete(seat)
    try:
        await session.flush()
        await sync_show_ticket_inventory(session, show)
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    await _invalidate_show_cache(show.id)
    await broadcast_dashboard_update()
    return APIMessage(detail="Da xoa ghe thanh cong")
