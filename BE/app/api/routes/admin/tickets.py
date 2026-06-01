from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_event_staff, get_current_active_admin
from app.models.event import EventAssignment
from app.core.db import get_db_session
from app.models.enums import OrderStatus
from app.models.event import Event, Show, TicketTier
from app.models.order import Order, Ticket, TransactionLog
from app.models.user import User
from app.schemas.admin import (
    AdminEventRevenueResponse,
    AdminTicketSaleResponse,
    AdminTicketTransactionDetailResponse,
    AdminTransactionLogResponse,
    PaginatedAdminTicketSalesResponse,
)

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
    allowed_statuses = {
        OrderStatus.PAID,
        OrderStatus.PENDING_PAYMENT,
        OrderStatus.PAYMENT_FAILED,
        OrderStatus.CANCELLED,
    }
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
            TicketTier.name.label("ticket_tier_name"),
            Ticket.price,
            Order.created_at,
            Order.status,
        )
        .join(Order, Ticket.order_id == Order.id)
        .join(Show, Ticket.show_id == Show.id)
        .join(Event, Show.event_id == Event.id)
        .join(User, Order.user_id == User.id)
        .outerjoin(TicketTier, Ticket.ticket_tier_id == TicketTier.id)
        .where(Order.status.in_(allowed_statuses))
        .where(Event.id.in_(select(EventAssignment.event_id).where(EventAssignment.staff_id == staff_user.id, EventAssignment.is_active.is_(True))))
        .order_by(Order.created_at.desc())
    )
    if event_id:
        stmt = stmt.where(Show.event_id == event_id)
    if show_id:
        stmt = stmt.where(Order.show_id == show_id)
    if status_filter:
        normalized_status = status_filter.strip()
        if normalized_status not in {item.value for item in allowed_statuses}:
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
            ticket_tier_name=row.ticket_tier_name or "Khu vuc chung",
            venue=row.venue,
            price=float(row.price or 0),
            purchased_at=row.created_at.isoformat(),
            order_status=str(row.status),
        )
        for row in rows
    ]
    return PaginatedAdminTicketSalesResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/tickets/sales/{ticket_id}/transaction-history", response_model=AdminTicketTransactionDetailResponse)
async def get_admin_ticket_transaction_history(
    ticket_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> AdminTicketTransactionDetailResponse:
    row = (
        await session.execute(
            select(
                Ticket.id.label("ticket_id"),
                Ticket.label.label("seat_label"),
                TicketTier.name.label("ticket_tier_name"),
                Ticket.price,
                Show.id.label("show_id"),
                Show.title.label("show_title"),
                Show.start_at.label("show_start_at"),
                Event.id.label("event_id"),
                Event.title.label("event_title"),
                Show.venue.label("venue"),
                Order.id.label("order_id"),
                Order.order_code,
                Order.status.label("order_status"),
                Order.payment_provider,
                Order.gateway_order_ref,
                Order.gateway_transaction_id,
                Order.payment_started_at,
                Order.payment_expires_at,
                Order.paid_at,
                Order.buyer_name,
                Order.buyer_email,
                Order.buyer_phone,
            )
            .join(Order, Ticket.order_id == Order.id)
            .join(Show, Ticket.show_id == Show.id)
            .join(Event, Show.event_id == Event.id)
            .outerjoin(TicketTier, Ticket.ticket_tier_id == TicketTier.id)
            .where(Ticket.id == ticket_id)
        )
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay giao dich ve")

    logs = list(
        await session.scalars(
            select(TransactionLog)
            .where(TransactionLog.order_id == row.order_id)
            .order_by(TransactionLog.created_at.desc(), TransactionLog.id.desc())
        )
    )

    return AdminTicketTransactionDetailResponse(
        ticket_id=row.ticket_id,
        seat_label=row.seat_label,
        ticket_tier_name=row.ticket_tier_name or "Hạng vé chung",
        price=float(row.price or 0),
        show_id=row.show_id,
        show_title=row.show_title,
        show_start_at=row.show_start_at.isoformat(),
        event_id=row.event_id,
        event_title=row.event_title,
        venue=row.venue,
        order_id=row.order_id,
        order_code=row.order_code,
        order_status=str(row.order_status),
        payment_provider=row.payment_provider,
        gateway_order_ref=row.gateway_order_ref,
        gateway_transaction_id=row.gateway_transaction_id,
        payment_started_at=row.payment_started_at.isoformat() if row.payment_started_at else None,
        payment_expires_at=row.payment_expires_at.isoformat() if row.payment_expires_at else None,
        paid_at=row.paid_at.isoformat() if row.paid_at else None,
        buyer_name=row.buyer_name,
        buyer_email=row.buyer_email,
        buyer_phone=row.buyer_phone,
        logs=[
            AdminTransactionLogResponse(
                id=log.id,
                action=log.action,
                status=log.status,
                payment_method=log.payment_method,
                gateway_transaction_id=log.gateway_transaction_id,
                gateway_response_code=log.gateway_response_code,
                amount=float(log.amount) if log.amount is not None else None,
                message=log.message,
                raw_payload=log.raw_payload,
                created_at=log.created_at.isoformat(),
            )
            for log in logs
        ],
    )


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
