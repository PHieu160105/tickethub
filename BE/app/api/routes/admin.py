"""Admin management and analytics routes."""

from base64 import b64encode
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_admin
from app.core.cache import EVENT_LIST_CACHE_NAMESPACE, event_seat_cache_namespace, public_api_cache
from app.core.db import get_db_session
from app.core.search import build_ilike_pattern, sanitize_search_query
from app.models.enums import OrderStatus, SeatStatus
from app.models.event import Event
from app.models.order import Order, OrderItem, Ticket, TicketCancellation
from app.models.seat import Seat
from app.models.event import SeatZone
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
from app.schemas.event import EventCardResponse, EventCreateRequest, EventDetailResponse, EventOccupancyResponse, EventUpdateRequest
from app.schemas.event import (
    SeatSingleCreateRequest,
    SeatBulkCreateRequest,
    SeatCreateResponse,
    SeatBulkCreateResponse,
)
from app.services.dashboard_service import get_audience_distribution, get_dashboard_summary, get_revenue_series
from app.services.event_service import create_event_with_matrix, get_event_by_slug_or_id, get_event_seat_matrix
from app.models.seat import Seat
from app.models.event import SeatZone
from app.models.enums import SeatStatus
import math

router = APIRouter(prefix="/admin", tags=["admin"])


async def _build_event_detail_response(session: AsyncSession, event: Event) -> EventDetailResponse:
    zones, _ = await get_event_seat_matrix(session, event.id)
    return EventDetailResponse(
        id=event.id,
        slug=event.slug,
        title=event.title,
        description=event.description,
        category=event.category,
        venue=event.venue,
        start_at=event.start_at,
        end_at=event.end_at,
        cover_image_url=event.cover_image_url,
        status=event.status,
        queue_enabled=event.queue_enabled,
        hold_minutes=event.hold_minutes,
        queue_release_batch=event.queue_release_batch,
        max_active_queue_tokens=event.max_active_queue_tokens,
        zones=zones,
    )


@router.post("/events", response_model=EventDetailResponse)
async def create_event(
    payload: EventCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    admin_user: User = Depends(get_current_active_admin),
) -> EventDetailResponse:
    """Create new event and generate seat matrix."""

    try:
        event = await create_event_with_matrix(session, admin_user.id, payload)
        await session.commit()
        await public_api_cache.invalidate_namespace(EVENT_LIST_CACHE_NAMESPACE)
        await public_api_cache.invalidate_namespace(event_seat_cache_namespace(event.id))
    except Exception:
        await session.rollback()
        raise

    return await _build_event_detail_response(session, event)


@router.post("/events/{event_key}/seats/single", response_model=SeatCreateResponse)
async def create_event_seat_single(
    event_key: str,
    payload: SeatSingleCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> SeatCreateResponse:
    """Create one seat for an existing event with explicit coordinates."""

    event = await get_event_by_slug_or_id(session, event_key)

    if not payload.zone_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="zone_id is required")

    zone = await session.scalar(select(SeatZone).where(SeatZone.id == payload.zone_id, SeatZone.event_id == event.id))
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found for this event")

    # Ensure label uniqueness
    exists = await session.scalar(select(func.count()).select_from(Seat).where(Seat.event_id == event.id, Seat.seat_label == payload.seat_label))
    if exists and exists > 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Seat label already exists for this event")

    price = float(payload.price) if payload.price is not None else float(zone.price)

    seat = Seat(
        event_id=event.id,
        zone_id=zone.id,
        row_index=0,
        row_label="",
        seat_number=0,
        seat_label=payload.seat_label,
        price=price,
        status=SeatStatus.AVAILABLE,
        x_coord=payload.x,
        y_coord=payload.y,
        rotation=payload.rotation,
        section_id=payload.section_id,
    )
    session.add(seat)
    try:
        await session.commit()
        await session.refresh(seat)
    except Exception:
        await session.rollback()
        raise

    return SeatCreateResponse(id=seat.id, seat_label=seat.seat_label, x=float(seat.x_coord) if seat.x_coord is not None else None, y=float(seat.y_coord) if seat.y_coord is not None else None)


@router.post("/events/{event_key}/seats/bulk", response_model=SeatBulkCreateResponse)
async def create_event_seat_bulk(
    event_key: str,
    payload: SeatBulkCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> SeatBulkCreateResponse:
    """Bulk-generate seats for an event (straight pattern supported)."""

    event = await get_event_by_slug_or_id(session, event_key)

    if not payload.zone_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="zone_id is required for bulk generation")

    zone = await session.scalar(select(SeatZone).where(SeatZone.id == payload.zone_id, SeatZone.event_id == event.id))
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found for this event")

    # Fetch existing labels to avoid duplicates
    existing_labels = set(await session.scalars(select(Seat.seat_label).where(Seat.event_id == event.id)))

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
                x = start_x + c * gap_x
                y = start_y + r * gap_y
                # clamp
                x = max(0.0, min(100.0, x))
                y = max(0.0, min(100.0, y))
                label = f"{prefix}{r+1}-{c+1}"
                if label in existing_labels:
                    continue
                existing_labels.add(label)
                seat = Seat(
                    event_id=event.id,
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
                )
                seats_to_add.append(seat)

    elif payload.pattern == "arc":
        if not payload.arc_config:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="arc_config required for arc pattern")
        cfg = payload.arc_config
        base_radius = cfg.radius
        start_angle = cfg.start_angle
        end_angle = cfg.end_angle
        for r in range(rows):
            radius = base_radius + r * gap_y
            seats_in_row = cols + r * 2
            for c in range(seats_in_row):
                angle = start_angle + (end_angle - start_angle) * (c / (seats_in_row - 1 if seats_in_row > 1 else 1))
                rad = math.radians(angle)
                x = cfg.center_x + radius * math.sin(rad)
                y = cfg.center_y + radius * math.cos(rad)
                # normalize assuming center and radius in percentage
                x = max(0.0, min(100.0, x))
                y = max(0.0, min(100.0, y))
                label = f"{prefix}{r+1}-{c+1}"
                if label in existing_labels:
                    continue
                existing_labels.add(label)
                seat = Seat(
                    event_id=event.id,
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
                )
                seats_to_add.append(seat)

    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported pattern")

    if seats_to_add:
        session.add_all(seats_to_add)
        try:
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        # refresh newly created seats for ids
        for s in seats_to_add:
            await session.refresh(s)
            created.append(SeatCreateResponse(id=s.id, seat_label=s.seat_label, x=float(s.x_coord) if s.x_coord is not None else None, y=float(s.y_coord) if s.y_coord is not None else None))

    return SeatBulkCreateResponse(created_count=len(created), seats=created)


@router.patch("/events/{event_key}", response_model=EventDetailResponse)
async def update_event(
    event_key: str,
    payload: EventUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> EventDetailResponse:
    """Update existing released event metadata and queue settings."""

    event = await get_event_by_slug_or_id(session, event_key)

    next_start = payload.start_at or event.start_at
    next_end = payload.end_at or event.end_at
    if next_end <= next_start:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_at must be later than start_at")

    updates = payload.model_dump(exclude_unset=True)
    for field_name, field_value in updates.items():
        setattr(event, field_name, field_value)

    try:
        await session.commit()
        await session.refresh(event)
        await public_api_cache.invalidate_namespace(EVENT_LIST_CACHE_NAMESPACE)
        await public_api_cache.invalidate_namespace(event_seat_cache_namespace(event.id))
    except Exception:
        await session.rollback()
        raise

    return await _build_event_detail_response(session, event)


@router.delete("/events/{event_key}", response_model=APIMessage)
async def delete_event(
    event_key: str,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> APIMessage:
    """Soft-delete one event while retaining historical analytics data."""

    event = await get_event_by_slug_or_id(session, event_key)

    try:
        event.is_deleted = True
        await session.commit()
        await public_api_cache.invalidate_namespace(EVENT_LIST_CACHE_NAMESPACE)
        await public_api_cache.invalidate_namespace(event_seat_cache_namespace(event.id))
    except Exception:
        await session.rollback()
        raise

    return APIMessage(detail="Event deleted successfully")


@router.get("/events/{event_key}/stats", response_model=EventDetailStatsResponse)
async def event_stats_detail(
    event_key: str,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> EventDetailStatsResponse:
    """Return detailed seat/sales analytics for one event."""

    event = await get_event_by_slug_or_id(session, event_key)

    totals_row = (
        await session.execute(
            select(
                func.count(Seat.id).label("total_seats"),
                func.sum(case((Seat.status == SeatStatus.SOLD, 1), else_=0)).label("sold_seats"),
                func.sum(case((Seat.status == SeatStatus.LOCKED, 1), else_=0)).label("locked_seats"),
            ).where(Seat.event_id == event.id)
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
                .where(Order.event_id == event.id)
            )
        )
        or 0
    )

    total_revenue = float(
        (
            await session.scalar(
                select(func.coalesce(func.sum(OrderItem.price), 0))
                .join(Order, OrderItem.order_id == Order.id)
                .where(Order.event_id == event.id, Order.status == OrderStatus.PAID)
            )
        )
        or 0
    )

    canceled_tickets = int(
        (
            await session.scalar(
                select(func.count(TicketCancellation.id)).where(TicketCancellation.event_id == event.id)
            )
        )
        or 0
    )

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
            .where(SeatZone.event_id == event.id)
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
        event_id=event.id,
        event_title=event.title,
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

    stmt = select(Event).where(Event.is_deleted.is_(False)).order_by(Event.created_at.desc())

    pattern = build_ilike_pattern(search)
    if pattern:
        stmt = stmt.where(Event.title.ilike(pattern, escape="\\") | Event.venue.ilike(pattern, escape="\\"))

    if category:
        normalized_category = sanitize_search_query(category, max_length=80)
        if normalized_category:
            stmt = stmt.where(Event.category.ilike(normalized_category))

    if start_from:
        stmt = stmt.where(Event.start_at >= start_from)

    if end_to:
        stmt = stmt.where(Event.start_at <= end_to)

    events = list(await session.scalars(stmt.limit(limit).offset(offset)))
    return [EventCardResponse.model_validate(event) for event in events]


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
            Event.title.label("event_title"),
            User.full_name.label("customer_name"),
            Seat.seat_label,
            SeatZone.name.label("zone_name"),
            OrderItem.price,
            Order.created_at,
            Order.status,
        )
        .join(Order, OrderItem.order_id == Order.id)
        .join(Event, Order.event_id == Event.id)
        .join(User, Order.user_id == User.id)
        .join(Seat, OrderItem.seat_id == Seat.id)
        .join(SeatZone, Seat.zone_id == SeatZone.id)
        .order_by(Order.created_at.desc())
    )

    if event_id:
        stmt = stmt.where(Order.event_id == event_id)

    if status_filter:
        stmt = stmt.where(Order.status == status_filter.strip().lower())

    filtered_stmt = stmt.subquery()
    total = int((await session.scalar(select(func.count()).select_from(filtered_stmt))) or 0)

    rows = (await session.execute(stmt.limit(limit).offset(offset))).all()
    items = [
        AdminTicketSaleResponse(
            id=row.id,
            event_title=row.event_title,
            customer_name=row.customer_name,
            seat_label=row.seat_label,
            zone_name=row.zone_name,
            price=float(row.price or 0),
            purchased_at=row.created_at.isoformat(),
            order_status=str(row.status),
        )
        for row in rows
    ]
    return PaginatedAdminTicketSalesResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/tickets/revenue-by-event", response_model=list[AdminEventRevenueResponse])
async def list_admin_event_revenue(
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> list[AdminEventRevenueResponse]:
    """Return revenue and ticket volume grouped by event."""

    stmt = (
        select(
            Event.id,
            Event.title,
            func.sum(case((Order.status == OrderStatus.PAID, OrderItem.price), else_=0)).label("revenue"),
            func.sum(case((Order.status == OrderStatus.PAID, 1), else_=0)).label("tickets_sold"),
        )
        .outerjoin(Order, Order.event_id == Event.id)
        .outerjoin(OrderItem, OrderItem.order_id == Order.id)
        .group_by(Event.id, Event.title)
        .order_by(Event.start_at.desc())
    )
    rows = (await session.execute(stmt)).all()
    return [
        AdminEventRevenueResponse(
            event_id=row.id,
            event_title=row.title,
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
    """Return occupancy snapshot for each event."""

    stmt = (
        select(
            Event.id,
            Event.title,
            func.count(Seat.id).label("total_seats"),
            func.sum(case((Seat.status == SeatStatus.SOLD, 1), else_=0)).label("sold_seats"),
            func.sum(case((Seat.status == SeatStatus.LOCKED, 1), else_=0)).label("locked_seats"),
        )
        .join(Seat, Seat.event_id == Event.id)
        .where(Event.is_deleted.is_(False))
        .group_by(Event.id, Event.title)
        .order_by(Event.start_at.asc())
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
                event_id=row.id,
                event_title=row.title,
                total_seats=total,
                sold_seats=sold,
                locked_seats=locked,
                occupancy_rate=occupancy,
            )
        )

    return result
