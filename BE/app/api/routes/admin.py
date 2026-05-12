"""Admin management and analytics routes."""

from base64 import b64encode
from datetime import UTC, date, datetime
import math
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_admin
from app.core.cache import EVENT_LIST_CACHE_NAMESPACE, public_api_cache, show_seat_cache_namespace
from app.core.db import get_db_session
from app.core.search import build_ilike_pattern, sanitize_search_query
from app.models.enums import OrderStatus, SeatStatus
from app.models.event import Event, SeatZone, Show
from app.models.order import Order, OrderItem, Ticket, TicketCancellation
from app.models.seat import Seat
from app.models.user import User
from app.schemas.admin import (
    AdminEventRevenueResponse,
    AdminTicketSaleResponse,
    AdminUserResponse,
    AudienceDistributionResponse,
    DashboardSummaryResponse,
    EventDetailStatsResponse,
    EventZoneStatsResponse,
    PaginatedAdminTicketSalesResponse,
    PaginatedAdminUsersResponse,
    RevenuePoint,
    UploadImageResponse,
)
from app.schemas.common import APIMessage
from app.schemas.event import (
    EventCardResponse,
    EventCreateRequest,
    EventDetailResponse,
    EventOccupancyResponse,
    EventUpdateRequest,
    SeatBulkCreateRequest,
    SeatBulkCreateResponse,
    SeatCreateResponse,
    SeatSingleCreateRequest,
    SeatUpdateRequest,
    SeatZoneCreate,
    SeatZoneResponse,
    SeatZoneUpdate,
    ShowCreateRequest,
    ShowDetailResponse,
    ShowSummaryResponse,
    ShowUpdateRequest,
)
from app.services.dashboard_service import get_audience_distribution, get_dashboard_summary, get_revenue_series
from app.services.event_service import (
    build_event_card_response,
    build_event_detail_response,
    build_show_detail_response,
    combine_show_datetime,
    create_event,
    create_show_with_inventory,
    create_show_zone,
    delete_show_zone,
    get_event_by_slug_or_id,
    get_show_by_id,
    list_event_shows,
    list_live_events,
    list_show_zones,
    update_show_zone,
)

router = APIRouter(prefix="/admin", tags=["admin"])


def _apply_admin_lock_state(seat: Seat, is_admin_locked: bool) -> None:
    if seat.status == SeatStatus.SOLD and is_admin_locked != seat.is_admin_locked:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot change admin lock for sold seat")

    seat.is_admin_locked = is_admin_locked
    if is_admin_locked:
        seat.status = SeatStatus.LOCKED
        seat.locked_by_user_id = None
        seat.lock_expires_at = None
        return

    if seat.status == SeatStatus.LOCKED and seat.locked_by_user_id is None:
        seat.status = SeatStatus.AVAILABLE
        seat.lock_expires_at = None


async def _invalidate_show_cache(show_id: int) -> None:
    await public_api_cache.invalidate_namespace(show_seat_cache_namespace(show_id))
    await public_api_cache.invalidate_namespace(EVENT_LIST_CACHE_NAMESPACE)


async def _build_event_or_404_show(session: AsyncSession, event_key: str, show_id: int) -> tuple[Event, Show]:
    event = await get_event_by_slug_or_id(session, event_key)
    show = await get_show_by_id(session, show_id)
    if show.event_id != event.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Show not found for this event")
    return event, show


async def _build_show_stats_response(session: AsyncSession, show: Show, event: Event | None = None) -> EventDetailStatsResponse:
    event = event or await session.get(Event, show.event_id)
    totals_row = (
        await session.execute(
            select(
                func.count(Seat.id).label("total_seats"),
                func.sum(case((Seat.status == SeatStatus.SOLD, 1), else_=0)).label("sold_seats"),
                func.sum(case((Seat.status == SeatStatus.LOCKED, 1), else_=0)).label("locked_seats"),
            ).where(Seat.show_id == show.id)
        )
    ).one()

    total_seats = int(totals_row.total_seats or 0)
    sold_seats = int(totals_row.sold_seats or 0)
    locked_seats = int(totals_row.locked_seats or 0)
    available_seats = max(total_seats - sold_seats - locked_seats, 0)
    occupancy_rate = round((sold_seats / total_seats) * 100, 2) if total_seats else 0

    ticket_count = int(
        (
            await session.scalar(
                select(func.count(Ticket.id))
                .join(OrderItem, Ticket.order_item_id == OrderItem.id)
                .join(Order, OrderItem.order_id == Order.id)
                .where(Order.show_id == show.id)
            )
        )
        or 0
    )

    total_revenue = float(
        (
            await session.scalar(
                select(func.coalesce(func.sum(OrderItem.price), 0))
                .join(Order, OrderItem.order_id == Order.id)
                .where(Order.show_id == show.id, Order.status == OrderStatus.PAID)
            )
        )
        or 0
    )

    canceled_tickets = int((await session.scalar(select(func.count(TicketCancellation.id)).where(TicketCancellation.show_id == show.id))) or 0)

    zone_rows = (
        await session.execute(
            select(
                SeatZone.id,
                SeatZone.code,
                SeatZone.name,
                SeatZone.color,
                func.count(Seat.id).label("total_seats"),
                func.sum(case((Seat.status == SeatStatus.SOLD, 1), else_=0)).label("sold_seats"),
                func.sum(case((Seat.status == SeatStatus.LOCKED, 1), else_=0)).label("locked_seats"),
                func.min(Seat.price).label("min_price"),
                func.max(Seat.price).label("max_price"),
            )
            .outerjoin(Seat, Seat.zone_id == SeatZone.id)
            .where(SeatZone.show_id == show.id)
            .group_by(SeatZone.id, SeatZone.code, SeatZone.name, SeatZone.color)
            .order_by(SeatZone.id.asc())
        )
    ).all()

    zone_stats: list[EventZoneStatsResponse] = []
    for row in zone_rows:
        zone_total = int(row.total_seats or 0)
        zone_sold = int(row.sold_seats or 0)
        zone_locked = int(row.locked_seats or 0)
        zone_available = max(zone_total - zone_sold - zone_locked, 0)
        zone_stats.append(
            EventZoneStatsResponse(
                zone_id=row.id,
                zone_code=row.code,
                zone_name=row.name,
                color=row.color,
                total_seats=zone_total,
                sold_seats=zone_sold,
                locked_seats=zone_locked,
                available_seats=zone_available,
                occupancy_rate=round((zone_sold / zone_total) * 100, 2) if zone_total else 0,
                min_price=float(row.min_price or 0),
                max_price=float(row.max_price or 0),
            )
        )

    return EventDetailStatsResponse(
        event_id=show.event_id,
        event_title=event.title if event else "",
        show_id=show.id,
        show_title=show.title,
        show_start_at=show.start_at.isoformat(),
        show_end_at=show.end_at.isoformat(),
        total_seats=total_seats,
        sold_seats=sold_seats,
        locked_seats=locked_seats,
        available_seats=available_seats,
        occupancy_rate=occupancy_rate,
        tickets_issued=ticket_count,
        canceled_tickets=canceled_tickets,
        total_revenue=total_revenue,
        zone_stats=zone_stats,
    )


@router.post("/events", response_model=EventDetailResponse)
async def create_admin_event(
    payload: EventCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    admin_user: User = Depends(get_current_active_admin),
) -> EventDetailResponse:
    """Create new parent event."""

    try:
        event = await create_event(session, admin_user.id, payload)
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    await public_api_cache.invalidate_namespace(EVENT_LIST_CACHE_NAMESPACE)
    return await build_event_detail_response(session, event)


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
    """List all events for admin management view."""

    events = await list_live_events(session, search=search, category=category, start_from=start_from, end_to=end_to, limit=limit, offset=offset)
    return [await build_event_card_response(session, event) for event in events]


@router.get("/events/{event_key}", response_model=EventDetailResponse)
async def get_admin_event(
    event_key: str,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> EventDetailResponse:
    """Return one event detail for admin."""

    event = await get_event_by_slug_or_id(session, event_key)
    return await build_event_detail_response(session, event)


@router.patch("/events/{event_key}", response_model=EventDetailResponse)
async def update_event(
    event_key: str,
    payload: EventUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> EventDetailResponse:
    """Update event metadata only."""

    event = await get_event_by_slug_or_id(session, event_key)
    updates = payload.model_dump(exclude_unset=True)
    next_start = updates.get("start_date", event.start_date)
    next_end = updates.get("end_date", event.end_date)
    if next_end < next_start:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_date must be on or after start_date")

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
    return await build_event_detail_response(session, event)


@router.delete("/events/{event_key}", response_model=APIMessage)
async def delete_event(
    event_key: str,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> APIMessage:
    """Soft-delete one event and its child shows."""

    event = await get_event_by_slug_or_id(session, event_key)
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
    for show in shows:
        await public_api_cache.invalidate_namespace(show_seat_cache_namespace(show.id))
    return APIMessage(detail="Event deleted successfully")


@router.get("/events/{event_key}/shows", response_model=list[ShowSummaryResponse])
async def list_admin_event_shows(
    event_key: str,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> list[ShowSummaryResponse]:
    """List all shows under one event."""

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
    """Create one sellable show under an event."""

    event = await get_event_by_slug_or_id(session, event_key)
    try:
        show = await create_show_with_inventory(session, event, admin_user.id, payload)
        await session.commit()
        await session.refresh(show)
    except Exception:
        await session.rollback()
        raise

    await _invalidate_show_cache(show.id)
    return ShowDetailResponse(**(await build_show_detail_response(session, show)))


@router.get("/events/{event_key}/shows/{show_id}", response_model=ShowDetailResponse)
async def get_admin_show(
    event_key: str,
    show_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> ShowDetailResponse:
    """Get one admin show detail."""

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
    """Update one sellable show metadata and queue settings."""

    event, show = await _build_event_or_404_show(session, event_key, show_id)
    updates = payload.model_dump(exclude_unset=True)

    next_date = updates.get("show_date", show.start_at.date())
    next_start_time = updates.get("start_time", show.start_at.timetz().replace(tzinfo=None))
    next_end_time = updates.get("end_time", show.end_at.timetz().replace(tzinfo=None))
    next_start_at = combine_show_datetime(next_date, next_start_time)
    next_end_at = combine_show_datetime(next_date, next_end_time)
    if next_date < event.start_date or next_date > event.end_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="show_date must be within the event date range")
    if next_end_at <= next_start_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_time must be later than start_time")

    if ("venue_id" in updates and updates["venue_id"] != show.venue_id) or ("venue_layout_id" in updates and updates["venue_layout_id"] != show.venue_layout_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Changing venue/layout after show creation is not supported")

    for field_name, field_value in updates.items():
        if field_name in {"show_date", "start_time", "end_time"}:
            continue
        setattr(show, field_name, field_value)

    show.start_at = next_start_at
    show.end_at = next_end_at

    try:
        await session.commit()
        await session.refresh(show)
    except Exception:
        await session.rollback()
        raise

    await _invalidate_show_cache(show.id)
    return ShowDetailResponse(**(await build_show_detail_response(session, show)))


@router.delete("/events/{event_key}/shows/{show_id}", response_model=APIMessage)
async def delete_admin_show(
    event_key: str,
    show_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> APIMessage:
    """Soft-delete one show."""

    _, show = await _build_event_or_404_show(session, event_key, show_id)
    try:
        show.is_deleted = True
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    await _invalidate_show_cache(show.id)
    return APIMessage(detail="Show deleted successfully")


@router.get("/events/{event_key}/shows/{show_id}/stats", response_model=EventDetailStatsResponse)
async def show_stats_detail(
    event_key: str,
    show_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> EventDetailStatsResponse:
    """Return detailed seat/sales analytics for one show."""

    event, show = await _build_event_or_404_show(session, event_key, show_id)
    return await _build_show_stats_response(session, show, event)


@router.get("/events/{event_key}/shows/{show_id}/zones", response_model=list[SeatZoneResponse])
async def list_zones(
    event_key: str,
    show_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> list[SeatZoneResponse]:
    """List zones of one show for admin CRUD modal."""

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
    """Create one seat zone and generate seats."""

    _, show = await _build_event_or_404_show(session, event_key, show_id)
    try:
        zone = await create_show_zone(session, show, payload)
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    await _invalidate_show_cache(show.id)
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
    """Update one seat zone and regenerate its seats."""

    _, show = await _build_event_or_404_show(session, event_key, show_id)
    try:
        zone = await update_show_zone(session, show, zone_id, SeatZoneCreate(**payload.model_dump()))
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    await _invalidate_show_cache(show.id)
    return SeatZoneResponse.model_validate(zone)


@router.delete("/events/{event_key}/shows/{show_id}/zones/{zone_id}", response_model=APIMessage)
async def delete_zone(
    event_key: str,
    show_id: int,
    zone_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> APIMessage:
    """Delete one seat zone if safe."""

    _, show = await _build_event_or_404_show(session, event_key, show_id)
    try:
        await delete_show_zone(session, show, zone_id)
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    await _invalidate_show_cache(show.id)
    return APIMessage(detail="Zone deleted successfully")


@router.post("/events/{event_key}/shows/{show_id}/seats/single", response_model=SeatCreateResponse)
async def create_show_seat_single(
    event_key: str,
    show_id: int,
    payload: SeatSingleCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> SeatCreateResponse:
    """Create one seat for an existing show with explicit coordinates."""

    _, show = await _build_event_or_404_show(session, event_key, show_id)
    if not payload.zone_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="zone_id is required")

    zone = await session.scalar(select(SeatZone).where(SeatZone.id == payload.zone_id, SeatZone.show_id == show.id))
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found for this show")

    exists = await session.scalar(select(func.count()).select_from(Seat).where(Seat.show_id == show.id, Seat.seat_label == payload.seat_label))
    if exists and exists > 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Seat label already exists for this show")

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
        await session.commit()
        await session.refresh(seat)
    except Exception:
        await session.rollback()
        raise

    await _invalidate_show_cache(show.id)
    return SeatCreateResponse(id=seat.id, seat_label=seat.seat_label, x=float(seat.x_coord) if seat.x_coord is not None else None, y=float(seat.y_coord) if seat.y_coord is not None else None)


@router.post("/events/{event_key}/shows/{show_id}/seats/bulk", response_model=SeatBulkCreateResponse)
async def create_show_seat_bulk(
    event_key: str,
    show_id: int,
    payload: SeatBulkCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> SeatBulkCreateResponse:
    """Bulk-generate seats for a show."""

    _, show = await _build_event_or_404_show(session, event_key, show_id)
    if not payload.zone_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="zone_id is required for bulk generation")

    zone = await session.scalar(select(SeatZone).where(SeatZone.id == payload.zone_id, SeatZone.show_id == show.id))
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found for this show")

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
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="arc_config required for arc pattern")
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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported pattern")

    if seats_to_add:
        session.add_all(seats_to_add)
        try:
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        for seat in seats_to_add:
            await session.refresh(seat)
            created.append(SeatCreateResponse(id=seat.id, seat_label=seat.seat_label, x=float(seat.x_coord) if seat.x_coord is not None else None, y=float(seat.y_coord) if seat.y_coord is not None else None))

    await _invalidate_show_cache(show.id)
    return SeatBulkCreateResponse(created_count=len(created), seats=created)


@router.patch("/events/{event_key}/shows/{show_id}/seats/{seat_id}", response_model=SeatCreateResponse)
async def update_show_seat(
    event_key: str,
    show_id: int,
    seat_id: int,
    payload: SeatUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> SeatCreateResponse:
    """Update one seat for an existing show."""

    _, show = await _build_event_or_404_show(session, event_key, show_id)
    seat = await session.scalar(select(Seat).where(Seat.id == seat_id, Seat.show_id == show.id))
    if not seat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Seat not found for this show")

    if payload.zone_id is not None:
        zone = await session.scalar(select(SeatZone).where(SeatZone.id == payload.zone_id, SeatZone.show_id == show.id))
        if not zone:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found for this show")
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
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Seat label already exists for this show")
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
        await session.commit()
        await session.refresh(seat)
    except Exception:
        await session.rollback()
        raise

    await _invalidate_show_cache(show.id)
    return SeatCreateResponse(id=seat.id, seat_label=seat.seat_label, x=float(seat.x_coord) if seat.x_coord is not None else None, y=float(seat.y_coord) if seat.y_coord is not None else None)


@router.delete("/events/{event_key}/shows/{show_id}/seats/{seat_id}", response_model=APIMessage)
async def delete_show_seat(
    event_key: str,
    show_id: int,
    seat_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> APIMessage:
    """Delete one seat from an existing show."""

    _, show = await _build_event_or_404_show(session, event_key, show_id)
    seat = await session.scalar(select(Seat).where(Seat.id == seat_id, Seat.show_id == show.id))
    if not seat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Seat not found for this show")

    await session.delete(seat)
    try:
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    await _invalidate_show_cache(show.id)
    return APIMessage(detail="Seat deleted successfully")


@router.post("/events/upload-image", response_model=UploadImageResponse)
async def upload_event_image(
    file: UploadFile = File(...),
    _: User = Depends(get_current_active_admin),
) -> UploadImageResponse:
    """Encode uploaded event image as a data URL for DB storage."""

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only image files are allowed")

    extension = Path(file.filename or "").suffix.lower()
    if extension not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supported formats: jpg, jpeg, png, webp")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image must be <= 10MB")

    base64_content = b64encode(content).decode("ascii")
    image_url = f"data:{file.content_type};base64,{base64_content}"
    return UploadImageResponse(image_url=image_url)


@router.get("/users", response_model=PaginatedAdminUsersResponse)
async def list_admin_users(
    search: str | None = Query(default=None, max_length=120),
    role: str | None = Query(default=None, max_length=40),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> PaginatedAdminUsersResponse:
    """List users for admin management table."""

    stmt = (
        select(
            User.id,
            User.full_name,
            User.email,
            User.role,
            User.gender,
            User.age,
            User.created_at,
            func.count(Ticket.id).label("total_tickets"),
        )
        .outerjoin(Order, Order.user_id == User.id)
        .outerjoin(OrderItem, OrderItem.order_id == Order.id)
        .outerjoin(Ticket, Ticket.order_item_id == OrderItem.id)
        .group_by(User.id, User.full_name, User.email, User.role, User.gender, User.age, User.created_at)
        .order_by(User.created_at.desc())
    )

    pattern = build_ilike_pattern(search)
    if pattern:
        stmt = stmt.where(User.full_name.ilike(pattern, escape="\\") | User.email.ilike(pattern, escape="\\"))

    if role:
        stmt = stmt.where(User.role == role.strip().lower())

    filtered_stmt = stmt.subquery()
    total = int((await session.scalar(select(func.count()).select_from(filtered_stmt))) or 0)

    rows = (await session.execute(stmt.limit(limit).offset(offset))).all()
    items = [
        AdminUserResponse(
            id=row.id,
            full_name=row.full_name,
            email=row.email,
            role=str(row.role),
            gender=str(row.gender),
            age=int(row.age),
            total_tickets=int(row.total_tickets or 0),
            registered_at=row.created_at.isoformat(),
        )
        for row in rows
    ]
    return PaginatedAdminUsersResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/tickets/sales", response_model=PaginatedAdminTicketSalesResponse)
async def list_admin_ticket_sales(
    event_id: int | None = Query(default=None, ge=1),
    show_id: int | None = Query(default=None, ge=1),
    status_filter: str | None = Query(default=None, max_length=40),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> PaginatedAdminTicketSalesResponse:
    """List recent ticket sale rows for admin ticket tab."""

    stmt = (
        select(
            OrderItem.id,
            Event.id.label("event_id"),
            Event.title.label("event_title"),
            Show.id.label("show_id"),
            Show.title.label("show_title"),
            Show.start_at.label("show_start_at"),
            Show.venue.label("venue"),
            User.full_name.label("customer_name"),
            Seat.seat_label,
            SeatZone.name.label("zone_name"),
            OrderItem.price,
            Order.created_at,
            Order.status,
        )
        .join(Order, OrderItem.order_id == Order.id)
        .join(Show, Order.show_id == Show.id)
        .join(Event, Show.event_id == Event.id)
        .join(User, Order.user_id == User.id)
        .join(Seat, OrderItem.seat_id == Seat.id)
        .outerjoin(SeatZone, Seat.zone_id == SeatZone.id)
        .order_by(Order.created_at.desc())
    )

    if event_id:
        stmt = stmt.where(Show.event_id == event_id)
    if show_id:
        stmt = stmt.where(Order.show_id == show_id)
    if status_filter:
        stmt = stmt.where(Order.status == status_filter.strip().lower())

    filtered_stmt = stmt.subquery()
    total = int((await session.scalar(select(func.count()).select_from(filtered_stmt))) or 0)

    rows = (await session.execute(stmt.limit(limit).offset(offset))).all()
    items = [
        AdminTicketSaleResponse(
            id=row.id,
            event_id=row.event_id,
            event_title=row.event_title,
            show_id=row.show_id,
            show_title=row.show_title,
            show_start_at=row.show_start_at.isoformat(),
            customer_name=row.customer_name,
            seat_label=row.seat_label,
            zone_name=row.zone_name or "General",
            venue=row.venue,
            price=float(row.price or 0),
            purchased_at=row.created_at.isoformat(),
            order_status=str(row.status),
        )
        for row in rows
    ]
    return PaginatedAdminTicketSalesResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/tickets/revenue-by-show", response_model=list[AdminEventRevenueResponse])
async def list_admin_show_revenue(
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> list[AdminEventRevenueResponse]:
    """Return revenue and ticket volume grouped by show."""

    stmt = (
        select(
            Event.id.label("event_id"),
            Event.title.label("event_title"),
            Show.id.label("show_id"),
            Show.title.label("show_title"),
            Show.start_at.label("show_start_at"),
            func.sum(case((Order.status == OrderStatus.PAID, OrderItem.price), else_=0)).label("revenue"),
            func.sum(case((Order.status == OrderStatus.PAID, 1), else_=0)).label("tickets_sold"),
        )
        .join(Show, Show.event_id == Event.id)
        .outerjoin(Order, Order.show_id == Show.id)
        .outerjoin(OrderItem, OrderItem.order_id == Order.id)
        .where(Show.is_deleted.is_(False))
        .group_by(Event.id, Event.title, Show.id, Show.title, Show.start_at)
        .order_by(Show.start_at.desc())
    )
    rows = (await session.execute(stmt)).all()
    return [
        AdminEventRevenueResponse(
            event_id=row.event_id,
            event_title=row.event_title,
            show_id=row.show_id,
            show_title=row.show_title,
            show_start_at=row.show_start_at.isoformat(),
            tickets_sold=int(row.tickets_sold or 0),
            revenue=float(row.revenue or 0),
        )
        for row in rows
    ]


@router.get("/dashboard/summary", response_model=DashboardSummaryResponse)
async def dashboard_summary(
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> DashboardSummaryResponse:
    """Return headline KPI values."""

    return await get_dashboard_summary(session)


@router.get("/dashboard/revenue", response_model=list[RevenuePoint])
async def dashboard_revenue(
    days: int = Query(default=14, ge=7, le=90),
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> list[RevenuePoint]:
    """Return historical revenue points."""

    return await get_revenue_series(session, days=days)


@router.get("/dashboard/audience", response_model=AudienceDistributionResponse)
async def dashboard_audience(
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> AudienceDistributionResponse:
    """Return age and gender distributions for ticket buyers."""

    return await get_audience_distribution(session)


@router.get("/dashboard/occupancy", response_model=list[EventOccupancyResponse])
async def dashboard_occupancy(
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> list[EventOccupancyResponse]:
    """Return occupancy snapshot for each show."""

    stmt = (
        select(
            Event.id.label("event_id"),
            Event.title.label("event_title"),
            Show.id.label("show_id"),
            Show.title.label("show_title"),
            func.count(Seat.id).label("total_seats"),
            func.sum(case((Seat.status == SeatStatus.SOLD, 1), else_=0)).label("sold_seats"),
            func.sum(case((Seat.status == SeatStatus.LOCKED, 1), else_=0)).label("locked_seats"),
        )
        .join(Show, Show.event_id == Event.id)
        .outerjoin(Seat, Seat.show_id == Show.id)
        .where(Event.is_deleted.is_(False), Show.is_deleted.is_(False))
        .group_by(Event.id, Event.title, Show.id, Show.title)
        .order_by(Show.start_at.asc())
    )
    rows = (await session.execute(stmt)).all()

    result: list[EventOccupancyResponse] = []
    for row in rows:
        total = int(row.total_seats or 0)
        sold = int(row.sold_seats or 0)
        locked = int(row.locked_seats or 0)
        occupancy = round((sold / total) * 100, 2) if total else 0
        result.append(
            EventOccupancyResponse(
                event_id=row.event_id,
                event_title=row.event_title,
                show_id=row.show_id,
                show_title=row.show_title,
                total_seats=total,
                sold_seats=sold,
                locked_seats=locked,
                occupancy_rate=occupancy,
            )
        )

    return result
