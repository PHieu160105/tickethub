from datetime import UTC, datetime

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.enums import EventStatus, OrderStatus, UserRole
from app.models.order import Order, Ticket
from app.models.user import EventStaff, User
from app.services.booking_payment_service import create_checkout_payment, handle_vnpay_return
from app.services.refund_service import cancel_show, list_show_refunds, refresh_show_refunds, request_show_refunds
from app.services.vnpay_service import VNPayCreatePaymentResult, VNPayTransactionStatusResult


class FakeVNPayService:
    def create_payment(self, **kwargs) -> VNPayCreatePaymentResult:
        return VNPayCreatePaymentResult(
            payment_url=f"https://sandbox.vnpayment.vn/pay/{kwargs['txn_ref']}",
            raw_payload={"vnp_TxnRef": kwargs["txn_ref"]},
        )

    async def query_transaction(self, *, txn_ref: str, transaction_date: datetime, ip_addr: str = "127.0.0.1", transaction_no: str | None = None) -> VNPayTransactionStatusResult:
        _ = transaction_date, ip_addr, transaction_no
        return VNPayTransactionStatusResult(
            status="PENDING",
            transaction_no=None,
            response_code="00",
            transaction_status="01",
            paid_at=None,
            raw_payload={"vnp_TxnRef": txn_ref},
        )

    def verify_return_params(self, params: dict[str, str]) -> dict[str, str]:
        return params

    @staticmethod
    def _parse_gateway_datetime(value: str | None) -> datetime | None:
        _ = value
        return datetime.now(UTC)


async def _create_paid_order(db_session: AsyncSession, sample_show, user_id: int, monkeypatch: pytest.MonkeyPatch) -> int:
    ticket = await db_session.scalar(select(Ticket).where(Ticket.show_id == sample_show.id).order_by(Ticket.id.asc()))
    assert ticket is not None
    from app.services.booking_service import lock_seats

    await lock_seats(db_session, user_id=user_id, show_id=sample_show.id, seat_ids=[ticket.id], queue_token=None)
    monkeypatch.setattr("app.services.booking_payment_service.get_vnpay_service", lambda: FakeVNPayService())

    checkout = await create_checkout_payment(
        db_session,
        user_id=user_id,
        show_id=sample_show.id,
        queue_token=None,
        buyer_name="User One",
        buyer_email="u1@test.local",
        buyer_phone="0900000001",
    )
    await handle_vnpay_return(
        db_session,
        {
            "vnp_TxnRef": checkout.gateway_order_ref,
            "vnp_Amount": "10000",
            "vnp_ResponseCode": "00",
            "vnp_TransactionStatus": "00",
            "vnp_TransactionNo": "240101000000010",
            "vnp_PayDate": "20260531183000",
        },
    )
    return checkout.order_id


@pytest.mark.asyncio
async def test_staff_can_cancel_show_and_store_reason(
    db_session: AsyncSession,
    sample_event,
    sample_show,
    admin_user,
):
    show = await cancel_show(
        db_session,
        event_key=sample_event.slug,
        show_id=sample_show.id,
        actor=admin_user,
        cancellation_reason="Organiser issue",
    )

    assert show.status == EventStatus.CANCELLED
    assert show.cancellation_reason == "Organiser issue"
    assert show.cancelled_by_staff_id == admin_user.id


@pytest.mark.asyncio
async def test_other_staff_cannot_cancel_or_refund_show(
    db_session: AsyncSession,
    sample_event,
    sample_show,
):
    outsider = User(
        full_name="Outsider Staff",
        email="outsider@test.local",
        password_hash=hash_password("Staff@123"),
        role=UserRole.EVENT_STAFF,
    )
    outsider.event_staff_profile = EventStaff(staff_code="TEST-STAFF-002", is_active=True)
    db_session.add(outsider)
    await db_session.commit()
    await db_session.refresh(outsider)

    with pytest.raises(HTTPException):
        await cancel_show(
            db_session,
            event_key=sample_event.slug,
            show_id=sample_show.id,
            actor=outsider,
            cancellation_reason="No permission",
        )


@pytest.mark.asyncio
async def test_refund_request_is_rejected_for_vnpay_orders(
    db_session: AsyncSession,
    sample_event,
    sample_show,
    admin_user,
    customer_users,
    monkeypatch: pytest.MonkeyPatch,
):
    user1, _ = customer_users
    await _create_paid_order(db_session, sample_show, user1.id, monkeypatch)

    await cancel_show(
        db_session,
        event_key=sample_event.slug,
        show_id=sample_show.id,
        actor=admin_user,
        cancellation_reason="Venue issue",
    )

    refund_list = await list_show_refunds(
        db_session,
        event_key=sample_event.slug,
        show_id=sample_show.id,
        actor=admin_user,
    )
    assert len(refund_list.orders) == 1
    assert refund_list.orders[0].refund_status == OrderStatus.PAID

    with pytest.raises(HTTPException, match="VNPay"):
        await request_show_refunds(
            db_session,
            event_key=sample_event.slug,
            show_id=sample_show.id,
            actor=admin_user,
        )

    with pytest.raises(HTTPException, match="VNPay"):
        await refresh_show_refunds(
            db_session,
            event_key=sample_event.slug,
            show_id=sample_show.id,
            actor=admin_user,
        )

    order = await db_session.scalar(select(Order).where(Order.id == refund_list.orders[0].order_id))
    assert order is not None
    assert order.status == OrderStatus.PAID
    assert order.refunded_at is None
