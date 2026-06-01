"""Payment-oriented booking flow using locked tickets and VNPay."""

import json
from datetime import UTC, datetime
from decimal import Decimal
from urllib.parse import urlencode
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import public_api_cache, show_seat_cache_namespace, user_ticket_cache_namespace
from app.core.config import get_settings
from app.models.enums import OrderStatus, SeatStatus
from app.models.event import SeatZone
from app.models.order import Order, Ticket, TransactionLog
from app.schemas.booking import CheckoutItemResponse, CheckoutResponse, OrderStatusResponse
from app.services.booking_service import (
    _as_utc,
    _get_show_or_404,
    _process_queue_after_checkout,
    _sync_legacy_seat_from_ticket,
    _ticket_change_payload,
)
from app.services.dashboard_service import broadcast_dashboard_update
from app.services.event_inventory_service import sync_show_ticket_inventory
from app.services.queue_service import ensure_queue_access, mark_queue_completed
from app.services.ticket_delivery_service import dispatch_paid_order_tickets
from app.services.vnpay_service import VNPayTransactionStatusResult, get_vnpay_service
from app.ws.connection_manager import seat_ws_manager


def _amount_to_vnd_minor(amount: Decimal) -> int:
    return int(amount.quantize(Decimal("1")))


def _build_gateway_order_ref(order_id: int) -> str:
    return f"ORD{order_id:09d}"


def _vnpay_amount_matches(order: Order, raw_amount: str | int | None) -> bool:
    try:
        actual = int(raw_amount or 0)
    except (TypeError, ValueError):
        return False
    expected = _amount_to_vnd_minor(Decimal(str(order.total_amount))) * 100
    return actual == expected


def _build_payment_result_url(order_id: int | None = None, *, gateway_error: str | None = None) -> str:
    frontend_base = get_settings().frontend_app_url.rstrip("/")
    query: dict[str, str | int] = {}
    if order_id is not None:
        query["orderId"] = order_id
    if gateway_error:
        query["gatewayError"] = gateway_error
    suffix = f"?{urlencode(query)}" if query else ""
    return f"{frontend_base}/payment/result{suffix}"


async def _load_locked_tickets_for_checkout(
    session: AsyncSession,
    *,
    user_id: int,
    show_id: int,
) -> tuple[list[Ticket], list[dict[str, int | str | None]]]:
    now = datetime.now(UTC)
    tickets = list(
        await session.scalars(
            select(Ticket)
            .where(
                Ticket.show_id == show_id,
                Ticket.locked_by_customer_id == user_id,
                Ticket.status == SeatStatus.LOCKED,
            )
            .order_by(Ticket.id.asc())
            .with_for_update()
        )
    )
    valid_tickets: list[Ticket] = []
    changed_tickets: list[dict[str, int | str | None]] = []
    for ticket in tickets:
        lock_expires = _as_utc(ticket.lock_expires_at)
        if lock_expires and lock_expires < now:
            ticket.status = SeatStatus.AVAILABLE
            ticket.locked_by_customer_id = None
            ticket.lock_expires_at = None
            ticket.order_id = None
            _sync_legacy_seat_from_ticket(ticket)
            changed_tickets.append(_ticket_change_payload(ticket))
            continue
        valid_tickets.append(ticket)
    return valid_tickets, changed_tickets


async def _build_paid_items(session: AsyncSession, order_id: int) -> list[CheckoutItemResponse]:
    tickets = list(
        await session.scalars(
            select(Ticket)
            .where(Ticket.order_id == order_id, Ticket.ticket_code.is_not(None))
            .order_by(Ticket.id.asc())
        )
    )
    zone_ids = {ticket.ticket_tier_id for ticket in tickets if ticket.ticket_tier_id is not None}
    zone_rows = await session.execute(select(SeatZone.id, SeatZone.name).where(SeatZone.id.in_(zone_ids))) if zone_ids else None
    zone_map = {zone_id: zone_name for zone_id, zone_name in (zone_rows.all() if zone_rows else [])}
    return [
        CheckoutItemResponse(
            seat_id=ticket.id,
            seat_label=ticket.seat_label or f"Ticket #{ticket.id}",
            zone_name=zone_map.get(ticket.ticket_tier_id, "Chua phan hang"),
            price=Decimal(str(ticket.price)),
            ticket_code=ticket.ticket_code or "",
            qr_payload=ticket.qr_payload or "",
        )
        for ticket in tickets
    ]


async def _release_order_tickets(session: AsyncSession, order: Order, *, next_status: OrderStatus) -> list[dict[str, int | str | None]]:
    tickets = list(
        await session.scalars(
            select(Ticket).where(Ticket.order_id == order.id).order_by(Ticket.id.asc()).with_for_update()
        )
    )
    changed: list[dict[str, int | str | None]] = []
    for ticket in tickets:
        if ticket.status != SeatStatus.LOCKED:
            continue
        ticket.status = SeatStatus.AVAILABLE
        ticket.locked_by_customer_id = None
        ticket.lock_expires_at = None
        ticket.order_id = None
        _sync_legacy_seat_from_ticket(ticket)
        changed.append(_ticket_change_payload(ticket))
    order.status = next_status
    return changed


async def _apply_order_side_effects(
    *,
    show_id: int,
    user_id: int,
    changed_tickets: list[dict[str, int | str | None]],
) -> None:
    if changed_tickets:
        await public_api_cache.invalidate_namespace(show_seat_cache_namespace(show_id))
        await seat_ws_manager.broadcast_seat_changes(show_id=show_id, payload=changed_tickets)
        await broadcast_dashboard_update()
    await public_api_cache.invalidate_namespace(user_ticket_cache_namespace(user_id))


async def _finalize_paid_order(
    session: AsyncSession,
    *,
    order: Order,
    gateway_transaction_id: str | None,
    paid_at: datetime | None,
    raw_payload: dict,
) -> OrderStatusResponse:
    now = paid_at or datetime.now(UTC)
    tickets = list(
        await session.scalars(
            select(Ticket).where(Ticket.order_id == order.id).order_by(Ticket.id.asc()).with_for_update()
        )
    )
    if not tickets:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order has no reserved tickets to finalize")

    changed_tickets: list[dict[str, int | str | None]] = []
    for ticket in tickets:
        lock_expires = _as_utc(ticket.lock_expires_at)
        if ticket.status != SeatStatus.LOCKED or (lock_expires and lock_expires < now):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Reserved tickets are no longer valid for payment finalization")

    for ticket in tickets:
        ticket_code = f"TR-{now.strftime('%Y%m%d')}-{uuid4().hex[:12].upper()}"
        qr_payload = f"tickethub://ticket/{ticket_code}"
        ticket.ticket_code = ticket_code
        ticket.qr_payload = qr_payload
        ticket.issued_at = now
        ticket.status = SeatStatus.SOLD
        ticket.locked_by_customer_id = None
        ticket.lock_expires_at = None
        _sync_legacy_seat_from_ticket(ticket)
        changed_tickets.append(_ticket_change_payload(ticket))

    order.status = OrderStatus.PAID
    order.gateway_transaction_id = gateway_transaction_id or order.gateway_transaction_id
    order.paid_at = now
    session.add(
        TransactionLog(
            order_id=order.id,
            action="PAYMENT_SUCCESS",
            status=OrderStatus.PAID.value,
            payment_method=order.payment_provider,
            gateway_transaction_id=order.gateway_transaction_id,
            amount=float(order.total_amount),
            raw_payload=json.dumps(raw_payload),
        )
    )
    await session.commit()

    await _apply_order_side_effects(show_id=order.show_id, user_id=order.customer_id, changed_tickets=changed_tickets)
    paid_items = await _build_paid_items(session, order.id)
    await dispatch_paid_order_tickets(session, order=order, items=paid_items)
    return await build_order_status_response(session, order.customer_id, order.id)


async def create_checkout_payment(
    session: AsyncSession,
    *,
    user_id: int,
    show_id: int,
    queue_token: str | None,
    buyer_name: str,
    buyer_email: str,
    buyer_phone: str,
    client_ip: str = "127.0.0.1",
) -> CheckoutResponse:
    show = await _get_show_or_404(session, show_id)
    await sync_show_ticket_inventory(session, show)
    await ensure_queue_access(session, show, user_id, queue_token)

    now = datetime.now(UTC)
    tickets, expired_ticket_changes = await _load_locked_tickets_for_checkout(session, user_id=user_id, show_id=show_id)
    if not tickets:
        await session.commit()
        await _apply_order_side_effects(show_id=show_id, user_id=user_id, changed_tickets=expired_ticket_changes)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Khong co ve dang giu hop le de thanh toan")

    total_amount = sum(Decimal(str(ticket.price)) for ticket in tickets)
    payment_expires_at = min((_as_utc(ticket.lock_expires_at) for ticket in tickets if ticket.lock_expires_at), default=None)
    order = Order(
        customer_id=user_id,
        show_id=show_id,
        order_code=f"ORD-{now.strftime('%Y%m%d')}-{uuid4().hex[:10].upper()}",
        buyer_name=buyer_name,
        buyer_email=buyer_email,
        buyer_phone=buyer_phone,
        status=OrderStatus.PENDING_PAYMENT,
        total_amount=total_amount,
        payment_provider="VNPAY",
        payment_started_at=now,
        payment_expires_at=payment_expires_at,
    )
    session.add(order)
    await session.flush()
    gateway_order_ref = _build_gateway_order_ref(order.id)
    order.gateway_order_ref = gateway_order_ref
    for ticket in tickets:
        ticket.order_id = order.id
    session.add(
        TransactionLog(
            order_id=order.id,
            action="PAYMENT_INIT",
            status=OrderStatus.PENDING_PAYMENT.value,
            payment_method="VNPAY",
            amount=float(total_amount),
        )
    )
    await session.commit()
    if expired_ticket_changes:
        await _apply_order_side_effects(show_id=show_id, user_id=user_id, changed_tickets=expired_ticket_changes)

    try:
        result = get_vnpay_service().create_payment(
            txn_ref=gateway_order_ref,
            amount=_amount_to_vnd_minor(total_amount),
            order_info=f"Thanh toan don {order.order_code}",
            ip_addr=client_ip,
            create_at=now,
            expire_at=payment_expires_at,
        )
    except Exception:
        order = await session.get(Order, order.id)
        if order is not None:
            changed_tickets = await _release_order_tickets(session, order, next_status=OrderStatus.PAYMENT_FAILED)
            session.add(
                TransactionLog(
                    order_id=order.id,
                    action="PAYMENT_CREATE_FAILED",
                    status=OrderStatus.PAYMENT_FAILED.value,
                    payment_method="VNPAY",
                )
            )
            await session.commit()
            await _apply_order_side_effects(show_id=show_id, user_id=user_id, changed_tickets=changed_tickets)
        raise

    order = await session.get(Order, order.id)
    if order is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Order was not found after creation")
    session.add(
        TransactionLog(
            order_id=order.id,
            action="PAYMENT_GATEWAY_CREATED",
            status=OrderStatus.PENDING_PAYMENT.value,
            payment_method="VNPAY",
            amount=float(order.total_amount),
            raw_payload=json.dumps(result.raw_payload),
        )
    )
    await mark_queue_completed(session, show_id=show_id, user_id=user_id, queue_token=queue_token)
    await session.commit()
    await _process_queue_after_checkout(queue_token)
    return CheckoutResponse(
        order_id=order.id,
        order_status=order.status,
        total_amount=Decimal(str(order.total_amount)),
        payment_url=result.payment_url,
        gateway_order_ref=order.gateway_order_ref or gateway_order_ref,
        payment_expires_at=order.payment_expires_at,
    )


async def _reconcile_gateway_status(
    session: AsyncSession,
    order: Order,
    status_result: VNPayTransactionStatusResult,
) -> None:
    if order.status != OrderStatus.PENDING_PAYMENT:
        return
    if status_result.status == "PAID":
        await _finalize_paid_order(
            session,
            order=order,
            gateway_transaction_id=status_result.transaction_no,
            paid_at=status_result.paid_at,
            raw_payload=status_result.raw_payload,
        )
        return
    if status_result.status == "FAILED":
        changed_tickets = await _release_order_tickets(session, order, next_status=OrderStatus.CANCELLED)
        session.add(
            TransactionLog(
                order_id=order.id,
                action="PAYMENT_STATUS_FAILED",
                status=OrderStatus.CANCELLED.value,
                payment_method=order.payment_provider,
                gateway_transaction_id=order.gateway_transaction_id,
                amount=float(order.total_amount),
                gateway_response_code=status_result.transaction_status or status_result.response_code,
                raw_payload=json.dumps(status_result.raw_payload),
            )
        )
        await session.commit()
        await _apply_order_side_effects(show_id=order.show_id, user_id=order.customer_id, changed_tickets=changed_tickets)


async def build_order_status_response(session: AsyncSession, user_id: int, order_id: int) -> OrderStatusResponse:
    order = await session.scalar(select(Order).where(Order.id == order_id, Order.customer_id == user_id))
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay don hang")
    if order.status == OrderStatus.PENDING_PAYMENT and order.gateway_order_ref and order.payment_provider == "VNPAY":
        payment_started_at = _as_utc(order.payment_started_at) or datetime.now(UTC)
        status_result = await get_vnpay_service().query_transaction(
            txn_ref=order.gateway_order_ref,
            transaction_date=payment_started_at,
            transaction_no=order.gateway_transaction_id,
        )
        await _reconcile_gateway_status(session, order, status_result)
        order = await session.get(Order, order_id)
        if order is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay don hang")
    items = await _build_paid_items(session, order.id) if order.status in {OrderStatus.PAID, OrderStatus.REFUND_PENDING, OrderStatus.REFUNDED, OrderStatus.REFUND_FAILED} else []
    return OrderStatusResponse(
        order_id=order.id,
        order_code=order.order_code,
        order_status=order.status,
        total_amount=Decimal(str(order.total_amount)),
        payment_provider=order.payment_provider,
        gateway_order_ref=order.gateway_order_ref,
        gateway_transaction_id=order.gateway_transaction_id,
        payment_expires_at=order.payment_expires_at,
        paid_at=order.paid_at,
        refunded_at=order.refunded_at,
        items=items,
    )


async def handle_vnpay_return(session: AsyncSession, params: dict[str, str]) -> tuple[int | None, bool]:
    verified_params = get_vnpay_service().verify_return_params(params)
    txn_ref = str(verified_params.get("vnp_TxnRef") or "")
    if not txn_ref:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing VNPay order reference")

    order = await session.scalar(select(Order).where(Order.gateway_order_ref == txn_ref))
    if not order:
        return None, False
    if order.status == OrderStatus.PAID:
        return order.id, True

    response_code = str(verified_params.get("vnp_ResponseCode") or "")
    transaction_status = str(verified_params.get("vnp_TransactionStatus") or "")
    if response_code == "00" and transaction_status == "00":
        if not _vnpay_amount_matches(order, verified_params.get("vnp_Amount")):
            session.add(
                TransactionLog(
                    order_id=order.id,
                    action="PAYMENT_RETURN_MISMATCH",
                    status=OrderStatus.PAYMENT_FAILED.value,
                    payment_method=order.payment_provider,
                    amount=float(order.total_amount),
                    raw_payload=json.dumps(verified_params),
                    message="Amount mismatch",
                )
            )
            await session.commit()
            return order.id, False
        await _finalize_paid_order(
            session,
            order=order,
            gateway_transaction_id=str(verified_params.get("vnp_TransactionNo") or "") or None,
            paid_at=get_vnpay_service()._parse_gateway_datetime(verified_params.get("vnp_PayDate")),
            raw_payload=verified_params,
        )
        return order.id, True

    if order.status == OrderStatus.PENDING_PAYMENT:
        changed_tickets = await _release_order_tickets(session, order, next_status=OrderStatus.CANCELLED)
        session.add(
            TransactionLog(
                order_id=order.id,
                action="PAYMENT_RETURN_FAILED",
                status=OrderStatus.CANCELLED.value,
                payment_method=order.payment_provider,
                gateway_transaction_id=str(verified_params.get("vnp_TransactionNo") or "") or None,
                amount=float(order.total_amount),
                gateway_response_code=transaction_status or response_code,
                raw_payload=json.dumps(verified_params),
            )
        )
        await session.commit()
        await _apply_order_side_effects(show_id=order.show_id, user_id=order.customer_id, changed_tickets=changed_tickets)
    return order.id, False
