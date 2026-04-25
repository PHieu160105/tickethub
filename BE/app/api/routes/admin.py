"""Admin management and analytics routes."""

from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_admin
from app.core.db import get_db_session
from app.models.enums import OrderStatus, SeatStatus
from app.models.event import Event
from app.models.order import Order, OrderItem, Ticket, TicketCancellation
from app.models.seat import Seat
from app.models.event import SeatZone
from app.models.user import User
from app.schemas.admin import (
    AudienceDistributionResponse,
    DashboardSummaryResponse,
    EventDetailStatsResponse,
    EventZoneStatsResponse,
    RevenuePoint,
    UploadImageResponse,
)
from app.schemas.common import APIMessage
from app.schemas.event import EventCardResponse, EventCreateRequest, EventDetailResponse, EventOccupancyResponse, EventUpdateRequest
from app.services.dashboard_service import get_audience_distribution, get_dashboard_summary, get_revenue_series
from app.services.event_service import create_event_with_matrix, get_event_by_slug_or_id, get_event_seat_matrix

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
    except Exception:
        await session.rollback()
        raise

    return await _build_event_detail_response(session, event)


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
    """Delete one released event and all related rows via cascade rules."""

    event = await get_event_by_slug_or_id(session, event_key)

    try:
        await session.delete(event)
        await session.commit()
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

    stmt = select(Event).order_by(Event.created_at.desc())

    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(Event.title.ilike(pattern) | Event.venue.ilike(pattern))

    if category:
        stmt = stmt.where(Event.category.ilike(category.strip()))

    if start_from:
        stmt = stmt.where(Event.start_at >= start_from)

    if end_to:
        stmt = stmt.where(Event.start_at <= end_to)

    events = list(await session.scalars(stmt.limit(limit).offset(offset)))
    return [EventCardResponse.model_validate(event) for event in events]


@router.post("/events/upload-image", response_model=UploadImageResponse)
async def upload_event_image(
    request: Request,
    file: UploadFile = File(...),
    _: User = Depends(get_current_active_admin),
) -> UploadImageResponse:
    """Upload event cover image file and return a public URL."""

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only image files are allowed")

    extension = Path(file.filename or "").suffix.lower()
    if extension not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supported formats: jpg, jpeg, png, webp")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image must be <= 10MB")

    static_dir = Path(__file__).resolve().parents[2] / "static" / "event-images"
    static_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid4().hex}{extension}"
    image_path = static_dir / filename
    image_path.write_bytes(content)

    image_url = f"{str(request.base_url).rstrip('/')}/static/event-images/{filename}"
    return UploadImageResponse(image_url=image_url)


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
