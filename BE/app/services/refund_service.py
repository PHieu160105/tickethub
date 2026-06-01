"""Staff-facing show cancellation and refund workflow."""

from collections import defaultdict
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.admin._shared import _build_event_or_404_show, _interrupt_active_show_sessions, _invalidate_show_cache
from app.core.cache import public_api_cache, show_seat_cache_namespace, user_ticket_cache_namespace
from app.models.enums import EventStatus, OrderStatus, UserType
from app.models.event import EventAssignment, Show
from app.models.order import Order, TransactionLog
from app.models.user import User
from app.schemas.admin import AdminRefundBatchResponse, AdminRefundListResponse, AdminRefundOrderResponse
from app.services.booking_payment_service import _release_order_tickets
from app.services.dashboard_service import broadcast_dashboard_update
from app.services.queue_service import process_virtual_queue
from app.ws.connection_manager import seat_ws_manager


async def _ensure_staff_can_manage_show(session: AsyncSession, show: Show, actor: User) -> None:
    if actor.user_type == UserType.SYSTEM_ADMIN:
        return
    if actor.user_type != UserType.EVENT_STAFF:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chi staff moi duoc quan ly hoan tien")
    if show.created_by_staff_id == actor.id:
        return
    assignment = await session.scalar(
        select(EventAssignment).where(
            EventAssignment.event_id == show.event_id,
            EventAssignment.staff_id == actor.id,
            EventAssignment.is_active.is_(True),
        )
    )
    if assignment:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Staff khong co quyen voi show nay")


def _refund_response_from_order(order: Order) -> AdminRefundOrderResponse:
    return AdminRefundOrderResponse(
        order_id=order.id,
        order_code=order.order_code,
        buyer_name=order.buyer_name,
        buyer_email=order.buyer_email,
        buyer_phone=order.buyer_phone,
        total_amount=Decimal(str(order.total_amount)),
        payment_provider=order.payment_provider,
        gateway_order_ref=order.gateway_order_ref,
        gateway_transaction_id=order.gateway_transaction_id,
        paid_at=order.paid_at,
        refund_status=order.status,
        refund_started_at=order.refund_started_at,
        refunded_at=order.refunded_at,
    )


async def cancel_show(
    session: AsyncSession,
    *,
    event_key: str,
    show_id: int,
    actor: User,
    cancellation_reason: str,
) -> Show:
    _, show = await _build_event_or_404_show(session, event_key, show_id)
    await _ensure_staff_can_manage_show(session, show, actor)
    if show.status == EventStatus.CANCELLED:
        return show

    changed_tickets, expired_queue_count = await _interrupt_active_show_sessions(session, show)
    pending_orders = list(
        await session.scalars(
            select(Order)
            .where(
                Order.show_id == show.id,
                Order.status.in_([OrderStatus.PENDING_PAYMENT, OrderStatus.PENDING]),
            )
            .order_by(Order.id.asc())
            .with_for_update()
        )
    )
    changed_by_user: dict[int, list[dict[str, int | str | None]]] = defaultdict(list)
    for order in pending_orders:
        released = await _release_order_tickets(session, order, next_status=OrderStatus.CANCELLED)
        if released:
            changed_by_user[order.customer_id].extend(released)
        session.add(
            TransactionLog(
                order_id=order.id,
                action="SHOW_CANCELLED",
                status=OrderStatus.CANCELLED.value,
                payment_method=order.payment_provider,
                amount=float(order.total_amount),
                message="Pending payment cancelled because the show was cancelled",
            )
        )

    show.status = EventStatus.CANCELLED
    show.cancelled_at = datetime.now(UTC)
    show.cancelled_by_staff_id = actor.id
    show.cancellation_reason = cancellation_reason
    await session.commit()

    await _invalidate_show_cache(show.id)
    if changed_tickets:
        await public_api_cache.invalidate_namespace(show_seat_cache_namespace(show.id))
        await seat_ws_manager.broadcast_seat_changes(show.id, changed_tickets)
    for user_id, payload in changed_by_user.items():
        await public_api_cache.invalidate_namespace(user_ticket_cache_namespace(user_id))
        if payload:
            await seat_ws_manager.broadcast_seat_changes(show.id, payload)
    if expired_queue_count:
        await process_virtual_queue(session)
    await broadcast_dashboard_update()
    return show


async def list_show_refunds(
    session: AsyncSession,
    *,
    event_key: str,
    show_id: int,
    actor: User,
) -> AdminRefundListResponse:
    _, show = await _build_event_or_404_show(session, event_key, show_id)
    await _ensure_staff_can_manage_show(session, show, actor)
    orders = list(
        await session.scalars(
            select(Order)
            .where(
                Order.show_id == show.id,
                Order.status.in_(
                    [
                        OrderStatus.PAID,
                        OrderStatus.REFUND_PENDING,
                        OrderStatus.REFUNDED,
                        OrderStatus.REFUND_FAILED,
                    ]
                ),
            )
            .order_by(Order.paid_at.desc(), Order.id.desc())
        )
    )
    return AdminRefundListResponse(
        show_id=show.id,
        cancellation_reason=show.cancellation_reason,
        orders=[_refund_response_from_order(order) for order in orders],
    )
async def request_show_refunds(
    session: AsyncSession,
    *,
    event_key: str,
    show_id: int,
    actor: User,
) -> AdminRefundBatchResponse:
    _, show = await _build_event_or_404_show(session, event_key, show_id)
    await _ensure_staff_can_manage_show(session, show, actor)
    if show.status != EventStatus.CANCELLED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Chi duoc hoan tien sau khi show da bi huy")

    orders = list(
        await session.scalars(
            select(Order)
            .where(
                Order.show_id == show.id,
                Order.status.in_([OrderStatus.PAID, OrderStatus.REFUND_FAILED]),
            )
            .order_by(Order.id.asc())
            .with_for_update()
        )
    )
    if orders:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hoan tien tu dong cho VNPay chua duoc ho tro",
        )

    return AdminRefundBatchResponse(
        show_id=show.id,
        requested_count=0,
        refund_pending_count=0,
        refunded_count=0,
        failed_count=0,
        orders=[],
    )


async def refresh_show_refunds(
    session: AsyncSession,
    *,
    event_key: str,
    show_id: int,
    actor: User,
) -> AdminRefundBatchResponse:
    _, show = await _build_event_or_404_show(session, event_key, show_id)
    await _ensure_staff_can_manage_show(session, show, actor)

    unsupported_orders = list(
        await session.scalars(
            select(Order)
            .where(
                Order.show_id == show.id,
                Order.payment_provider == "VNPAY",
                Order.status.in_([OrderStatus.PAID, OrderStatus.REFUND_PENDING, OrderStatus.REFUND_FAILED]),
            )
            .order_by(Order.id.asc())
        )
    )
    if unsupported_orders:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hoan tien tu dong cho VNPay chua duoc ho tro",
        )

    pending_orders = list(
        await session.scalars(
            select(Order)
            .where(Order.show_id == show.id, Order.status == OrderStatus.REFUND_PENDING)
            .order_by(Order.id.asc())
            .with_for_update()
        )
    )
    if pending_orders:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hoan tien tu dong cho VNPay chua duoc ho tro",
        )

    refreshed = await list_show_refunds(session, event_key=event_key, show_id=show_id, actor=actor)
    return AdminRefundBatchResponse(
        show_id=show.id,
        requested_count=len(pending_orders),
        refund_pending_count=sum(1 for order in refreshed.orders if order.refund_status == OrderStatus.REFUND_PENDING),
        refunded_count=sum(1 for order in refreshed.orders if order.refund_status == OrderStatus.REFUNDED),
        failed_count=sum(1 for order in refreshed.orders if order.refund_status == OrderStatus.REFUND_FAILED),
        orders=refreshed.orders,
    )
