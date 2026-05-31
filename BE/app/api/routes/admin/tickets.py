from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_event_staff
from app.models.event import EventAssignment
from app.core.db import get_db_session
from app.models.enums import OrderStatus
from app.models.event import Event, SeatZone, Show
from app.models.order import Order, Ticket
from app.models.user import User
from app.schemas.admin import AdminEventRevenueResponse, AdminTicketSaleResponse, PaginatedAdminTicketSalesResponse

router = APIRouter()


@router.get("/tickets/sales", response_model=PaginatedAdminTicketSalesResponse)
async def list_admin_ticket_sales(
    event_id: int | None = Query(default=None, ge=1),
    show_id: int | None = Query(default=None, ge=1),
    status_filter: str | None = Query(default=None, max_length=40),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db_session),
    staff_user: User = Depends(get_current_active_event_staff),
) -> PaginatedAdminTicketSalesResponse:
    stmt = (
        select(
            Ticket.id,
            Event.id.label("event_id"),
            Event.title.label("event_title"),
            Show.id.label("show_id"),
            Show.title.label("show_title"),
            Show.start_at.label("show_start_at"),
            Show.venue.label("venue"),
            User.full_name.label("customer_name"),
            Ticket.label.label("seat_label"),
            SeatZone.name.label("zone_name"),
            Ticket.price,
            Order.created_at,
            Order.status,
        )
        .join(Order, Ticket.order_id == Order.id)
        .join(Show, Ticket.show_id == Show.id)
        .join(Event, Show.event_id == Event.id)
        .join(User, Order.user_id == User.id)
        .outerjoin(SeatZone, Ticket.ticket_tier_id == SeatZone.id)
        .where(Order.status.in_([OrderStatus.PAID, OrderStatus.PENDING]))
        .where(Event.id.in_(select(EventAssignment.event_id).where(EventAssignment.staff_id == staff_user.id, EventAssignment.is_active.is_(True))))
        .order_by(Order.created_at.desc())
    )
    if event_id:
        stmt = stmt.where(Show.event_id == event_id)
    if show_id:
        stmt = stmt.where(Order.show_id == show_id)
    if status_filter:
        normalized_status = status_filter.strip().lower()
        if normalized_status not in {OrderStatus.PAID.value, OrderStatus.PENDING.value}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Trang thai loc khong hop le")
        stmt = stmt.where(Order.status == normalized_status)

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
            zone_name=row.zone_name or "Khu vuc chung",
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
    staff_user: User = Depends(get_current_active_event_staff),
) -> list[AdminEventRevenueResponse]:
    stmt = (
        select(
            Event.id.label("event_id"),
            Event.title.label("event_title"),
            Show.id.label("show_id"),
            Show.title.label("show_title"),
            Show.start_at.label("show_start_at"),
            func.sum(case((Order.status == OrderStatus.PAID, Ticket.price), else_=0)).label("revenue"),
            func.sum(case((Order.status == OrderStatus.PAID, 1), else_=0)).label("tickets_sold"),
        )
        .join(Show, Show.event_id == Event.id)
        .outerjoin(Order, Order.show_id == Show.id)
        .outerjoin(Ticket, Ticket.order_id == Order.id)
        .where(Show.is_deleted.is_(False))
        .where(Event.id.in_(select(EventAssignment.event_id).where(EventAssignment.staff_id == staff_user.id, EventAssignment.is_active.is_(True))))
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
