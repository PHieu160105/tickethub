"""Booking lifecycle tests for lock, payment creation, return finalization, and ticket lookup."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import OrderStatus, SeatStatus
from app.models.order import Order, Ticket
from app.services.booking_payment_service import build_order_status_response, create_checkout_payment, handle_vnpay_return
from app.services.booking_service import fetch_my_tickets, lock_seats, release_expired_locks
from app.services.vnpay_service import VNPayCreatePaymentResult, VNPayTransactionStatusResult


class FakeVNPayService:
    def create_payment(self, **kwargs) -> VNPayCreatePaymentResult:
        return VNPayCreatePaymentResult(
            payment_url=f"https://sandbox.vnpayment.vn/pay/{kwargs['txn_ref']}",
            raw_payload={"vnp_TxnRef": kwargs["txn_ref"], "vnp_Amount": kwargs["amount"] * 100},
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


@pytest.mark.asyncio
async def test_seat_lock_prevents_second_user(
    db_session: AsyncSession,
    sample_show,
    customer_users,
):
    user1, user2 = customer_users
    ticket = await db_session.scalar(select(Ticket).where(Ticket.show_id == sample_show.id).order_by(Ticket.id.asc()))
    assert ticket is not None

    first_result = await lock_seats(db_session, user_id=user1.id, show_id=sample_show.id, seat_ids=[ticket.id], queue_token=None)
    second_result = await lock_seats(db_session, user_id=user2.id, show_id=sample_show.id, seat_ids=[ticket.id], queue_token=None)

    assert first_result.locked_seat_ids == [ticket.id]
    assert second_result.locked_seat_ids == []
    assert ticket.id in second_result.failed_seat_ids


@pytest.mark.asyncio
async def test_checkout_creates_pending_payment_and_reserves_ticket(
    db_session: AsyncSession,
    sample_show,
    customer_users,
    monkeypatch: pytest.MonkeyPatch,
):
    user1, _ = customer_users
    ticket = await db_session.scalar(select(Ticket).where(Ticket.show_id == sample_show.id).order_by(Ticket.id.asc()))
    assert ticket is not None

    await lock_seats(db_session, user_id=user1.id, show_id=sample_show.id, seat_ids=[ticket.id], queue_token=None)
    monkeypatch.setattr("app.services.booking_payment_service.get_vnpay_service", lambda: FakeVNPayService())

    checkout = await create_checkout_payment(
        db_session,
        user_id=user1.id,
        show_id=sample_show.id,
        queue_token=None,
        buyer_name="User One",
        buyer_email="u1@test.local",
        buyer_phone="0900000001",
    )

    assert checkout.order_status == OrderStatus.PENDING_PAYMENT
    assert checkout.payment_url.startswith("https://sandbox.vnpayment.vn/pay/")

    order = await db_session.get(Order, checkout.order_id)
    assert order is not None
    assert order.payment_provider == "VNPAY"
    assert order.gateway_order_ref is not None
    reserved_ticket = await db_session.get(Ticket, ticket.id)
    assert reserved_ticket is not None
    assert reserved_ticket.order_id == order.id
    assert reserved_ticket.status == SeatStatus.LOCKED


@pytest.mark.asyncio
async def test_return_marks_seat_sold_and_generates_ticket(
    db_session: AsyncSession,
    sample_show,
    customer_users,
    monkeypatch: pytest.MonkeyPatch,
):
    user1, _ = customer_users
    ticket = await db_session.scalar(select(Ticket).where(Ticket.show_id == sample_show.id).order_by(Ticket.id.asc()))
    assert ticket is not None

    await lock_seats(db_session, user_id=user1.id, show_id=sample_show.id, seat_ids=[ticket.id], queue_token=None)
    fake_gateway = FakeVNPayService()
    monkeypatch.setattr("app.services.booking_payment_service.get_vnpay_service", lambda: fake_gateway)

    checkout = await create_checkout_payment(
        db_session,
        user_id=user1.id,
        show_id=sample_show.id,
        queue_token=None,
        buyer_name="User One",
        buyer_email="u1@test.local",
        buyer_phone="0900000001",
    )
    order_id, success = await handle_vnpay_return(
        db_session,
        {
            "vnp_TxnRef": checkout.gateway_order_ref,
            "vnp_Amount": "10000",
            "vnp_ResponseCode": "00",
            "vnp_TransactionStatus": "00",
            "vnp_TransactionNo": "240101000000001",
            "vnp_PayDate": "20260531183000",
        },
    )

    assert order_id == checkout.order_id
    assert success is True

    order_status = await build_order_status_response(db_session, user1.id, checkout.order_id)
    assert order_status.order_status == OrderStatus.PAID
    assert len(order_status.items) == 1
    assert order_status.items[0].ticket_code.startswith("TR-")

    refreshed_ticket = await db_session.scalar(select(Ticket).where(Ticket.id == ticket.id))
    assert refreshed_ticket is not None
    assert refreshed_ticket.status == SeatStatus.SOLD


@pytest.mark.asyncio
async def test_invalid_return_signature_does_not_finalize_order(
    db_session: AsyncSession,
    sample_show,
    customer_users,
    monkeypatch: pytest.MonkeyPatch,
):
    user1, _ = customer_users
    ticket = await db_session.scalar(select(Ticket).where(Ticket.show_id == sample_show.id).order_by(Ticket.id.asc()))
    assert ticket is not None

    class RejectVNPayService(FakeVNPayService):
        def verify_return_params(self, params: dict[str, str]) -> dict[str, str]:
            raise HTTPException(status_code=400, detail="Invalid VNPay checksum")

    await lock_seats(db_session, user_id=user1.id, show_id=sample_show.id, seat_ids=[ticket.id], queue_token=None)
    monkeypatch.setattr("app.services.booking_payment_service.get_vnpay_service", lambda: RejectVNPayService())

    checkout = await create_checkout_payment(
        db_session,
        user_id=user1.id,
        show_id=sample_show.id,
        queue_token=None,
        buyer_name="User One",
        buyer_email="u1@test.local",
        buyer_phone="0900000001",
    )

    with pytest.raises(HTTPException):
        await handle_vnpay_return(db_session, {"vnp_TxnRef": checkout.gateway_order_ref})

    order = await db_session.get(Order, checkout.order_id)
    assert order is not None
    assert order.status == OrderStatus.PENDING_PAYMENT


@pytest.mark.asyncio
async def test_expired_lock_worker_releases_seat(
    db_session: AsyncSession,
    sample_show,
    customer_users,
):
    user1, _ = customer_users
    ticket = await db_session.scalar(select(Ticket).where(Ticket.show_id == sample_show.id).order_by(Ticket.id.asc()))
    assert ticket is not None

    await lock_seats(db_session, user_id=user1.id, show_id=sample_show.id, seat_ids=[ticket.id], queue_token=None)

    ticket.lock_expires_at = datetime.now(UTC) - timedelta(minutes=1)
    await db_session.commit()

    released = await release_expired_locks(db_session)
    assert sample_show.id in released

    refreshed_ticket = await db_session.scalar(select(Ticket).where(Ticket.id == ticket.id))
    assert refreshed_ticket is not None
    assert refreshed_ticket.status == SeatStatus.AVAILABLE


@pytest.mark.asyncio
async def test_my_ticket_search_supports_code_event_and_time(
    db_session: AsyncSession,
    sample_event,
    sample_show,
    customer_users,
    monkeypatch: pytest.MonkeyPatch,
):
    user1, _ = customer_users
    ticket = await db_session.scalar(select(Ticket).where(Ticket.show_id == sample_show.id).order_by(Ticket.id.asc()))
    assert ticket is not None

    await lock_seats(db_session, user_id=user1.id, show_id=sample_show.id, seat_ids=[ticket.id], queue_token=None)
    monkeypatch.setattr("app.services.booking_payment_service.get_vnpay_service", lambda: FakeVNPayService())

    checkout = await create_checkout_payment(
        db_session,
        user_id=user1.id,
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
            "vnp_TransactionNo": "240101000000002",
            "vnp_PayDate": "20260531183000",
        },
    )

    all_tickets = await fetch_my_tickets(db_session, user_id=user1.id)
    assert len(all_tickets) == 1
    first = all_tickets[0]

    by_code = await fetch_my_tickets(db_session, user_id=user1.id, search=first.ticket_code)
    assert len(by_code) == 1

    by_event = await fetch_my_tickets(db_session, user_id=user1.id, search=sample_event.title)
    assert len(by_event) == 1

    before_event = await fetch_my_tickets(
        db_session,
        user_id=user1.id,
        end_to=sample_show.start_at - timedelta(days=5),
    )
    assert before_event == []
