"""Booking lifecycle tests for lock, payment creation, return finalization, and ticket lookup."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import OrderStatus, SeatStatus
from app.models.order import Order, Ticket, TransactionLog
from app.schemas.booking import CheckoutItemResponse
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


class RecordingEmailDeliveryProvider:
    def __init__(self) -> None:
        self.sent_payloads = []

    async def send(self, payload) -> None:
        self.sent_payloads.append(payload)


class FailingEmailDeliveryProvider:
    async def send(self, payload) -> None:
        _ = payload
        raise RuntimeError("SMTP unavailable")


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
    delivery_provider = RecordingEmailDeliveryProvider()
    monkeypatch.setattr("app.services.booking_payment_service.get_vnpay_service", lambda: fake_gateway)
    monkeypatch.setattr("app.services.ticket_delivery_service.get_email_ticket_delivery_provider", lambda: delivery_provider)

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
    assert len(delivery_provider.sent_payloads) == 1
    delivery_logs = list(
        await db_session.scalars(
            select(TransactionLog).where(TransactionLog.order_id == checkout.order_id, TransactionLog.action == "TICKET_DELIVERY_EMAIL_SENT")
        )
    )
    assert len(delivery_logs) == 1


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


@pytest.mark.asyncio
async def test_delivery_failure_does_not_fail_paid_order(
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
    monkeypatch.setattr("app.services.ticket_delivery_service.get_email_ticket_delivery_provider", lambda: FailingEmailDeliveryProvider())

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
            "vnp_TransactionNo": "240101000000003",
            "vnp_PayDate": "20260531183000",
        },
    )

    order = await db_session.get(Order, checkout.order_id)
    assert order is not None
    assert order.status == OrderStatus.PAID
    refreshed_ticket = await db_session.get(Ticket, ticket.id)
    assert refreshed_ticket is not None
    assert refreshed_ticket.status == SeatStatus.SOLD
    failed_logs = list(
        await db_session.scalars(
            select(TransactionLog).where(TransactionLog.order_id == checkout.order_id, TransactionLog.action == "TICKET_DELIVERY_EMAIL_FAILED")
        )
    )
    assert len(failed_logs) == 1


@pytest.mark.asyncio
async def test_delivery_skips_invalid_buyer_email(
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
    monkeypatch.setattr("app.services.ticket_delivery_service.get_email_ticket_delivery_provider", lambda: RecordingEmailDeliveryProvider())

    checkout = await create_checkout_payment(
        db_session,
        user_id=user1.id,
        show_id=sample_show.id,
        queue_token=None,
        buyer_name="User One",
        buyer_email="not-an-email",
        buyer_phone="0900000001",
    )
    await handle_vnpay_return(
        db_session,
        {
            "vnp_TxnRef": checkout.gateway_order_ref,
            "vnp_Amount": "10000",
            "vnp_ResponseCode": "00",
            "vnp_TransactionStatus": "00",
            "vnp_TransactionNo": "240101000000004",
            "vnp_PayDate": "20260531183000",
        },
    )

    skipped_logs = list(
        await db_session.scalars(
            select(TransactionLog).where(TransactionLog.order_id == checkout.order_id, TransactionLog.action == "TICKET_DELIVERY_EMAIL_SKIPPED")
        )
    )
    assert len(skipped_logs) == 1


def test_settings_normalize_smtp_password_and_env_path():
    from app.core.config import ENV_FILE_PATH, Settings

    settings = Settings(
        DATABASE_URL="sqlite+aiosqlite:///memory",
        SMTP_HOST=" smtp.gmail.com ",
        SMTP_USERNAME=" user@gmail.com ",
        SMTP_PASSWORD="abcd efgh ijkl mnop",
        SMTP_FROM_EMAIL=" sender@gmail.com ",
        TICKET_DELIVERY_ENABLED=True,
    )

    assert ENV_FILE_PATH.name == ".env"
    assert settings.smtp_host_clean == "smtp.gmail.com"
    assert settings.smtp_username_clean == "user@gmail.com"
    assert settings.smtp_from_email_clean == "sender@gmail.com"
    assert settings.smtp_password_clean == "abcdefghijklmnop"
    assert settings.smtp_local_hostname_clean == "localhost.localdomain"


@pytest.mark.asyncio
async def test_fastapi_mail_connection_uses_configured_local_hostname(monkeypatch: pytest.MonkeyPatch):
    from app.services.ticket_delivery_service import SMTPEmailTicketDeliveryProvider

    captured: dict[str, object] = {}

    class FakeSMTP:
        def __init__(self, **kwargs) -> None:
            captured.update(kwargs)

        async def connect(self) -> None:
            return None

        async def login(self, username: str, password: str) -> None:
            captured["login_username"] = username
            captured["login_password"] = password

        async def send_message(self, message) -> None:
            captured["message"] = message

        async def quit(self) -> None:
            return None

    monkeypatch.setattr("app.services.ticket_delivery_service.aiosmtplib.SMTP", FakeSMTP)
    monkeypatch.setattr(
        "app.services.ticket_delivery_service.get_settings",
        lambda: type(
            "StubSettings",
            (),
            {
                "smtp_host_clean": "smtp.gmail.com",
                "smtp_port": 587,
                "smtp_username_clean": "user@gmail.com",
                "smtp_password_clean": "abcdefghijklmnop",
                "smtp_from_email_clean": "sender@gmail.com",
                "smtp_from_name_clean": "TicketHub",
                "smtp_local_hostname_clean": "localhost.localdomain",
                "smtp_use_tls": True,
            },
        )(),
    )

    payload = type(
        "Payload",
        (),
        {
            "order_code": "ORD-TEST",
            "buyer_email": "buyer@example.com",
            "buyer_name": "Buyer",
            "buyer_phone": "0900000000",
            "total_amount": 100000,
            "payment_provider": "VNPAY",
            "paid_at_iso": "2026-06-01T21:00:00+00:00",
            "items": [
                CheckoutItemResponse(
                    seat_id=1,
                    seat_label="A1",
                    zone_name="VIP",
                    price=100000,
                    ticket_code="TR-TEST",
                    qr_payload="ticketrush://ticket/TR-TEST",
                )
            ],
        },
    )()

    await SMTPEmailTicketDeliveryProvider().send(payload)

    assert captured["hostname"] == "smtp.gmail.com"
    assert captured["port"] == 587
    assert captured["local_hostname"] == "localhost.localdomain"
    assert captured["login_username"] == "user@gmail.com"
    assert captured["login_password"] == "abcdefghijklmnop"


@pytest.mark.asyncio
async def test_reconcile_paid_order_sends_email_once_for_multiple_tickets(
    db_session: AsyncSession,
    sample_show,
    customer_users,
    monkeypatch: pytest.MonkeyPatch,
):
    user1, _ = customer_users
    tickets = list(await db_session.scalars(select(Ticket).where(Ticket.show_id == sample_show.id).order_by(Ticket.id.asc()).limit(2)))
    assert len(tickets) == 2

    await lock_seats(db_session, user_id=user1.id, show_id=sample_show.id, seat_ids=[ticket.id for ticket in tickets], queue_token=None)
    delivery_provider = RecordingEmailDeliveryProvider()

    class PaidVNPayService(FakeVNPayService):
        async def query_transaction(self, *, txn_ref: str, transaction_date: datetime, ip_addr: str = "127.0.0.1", transaction_no: str | None = None) -> VNPayTransactionStatusResult:
            _ = txn_ref, transaction_date, ip_addr, transaction_no
            return VNPayTransactionStatusResult(
                status="PAID",
                transaction_no="240101000000005",
                response_code="00",
                transaction_status="00",
                paid_at=datetime.now(UTC),
                raw_payload={"source": "query"},
            )

    monkeypatch.setattr("app.services.booking_payment_service.get_vnpay_service", lambda: PaidVNPayService())
    monkeypatch.setattr("app.services.ticket_delivery_service.get_email_ticket_delivery_provider", lambda: delivery_provider)

    checkout = await create_checkout_payment(
        db_session,
        user_id=user1.id,
        show_id=sample_show.id,
        queue_token=None,
        buyer_name="User One",
        buyer_email="u1@test.local",
        buyer_phone="0900000001",
    )

    order_status = await build_order_status_response(db_session, user1.id, checkout.order_id)
    assert order_status.order_status == OrderStatus.PAID
    assert len(order_status.items) == 2
    assert len(delivery_provider.sent_payloads) == 1
    assert len(delivery_provider.sent_payloads[0].items) == 2

    order_id, success = await handle_vnpay_return(
        db_session,
        {
            "vnp_TxnRef": checkout.gateway_order_ref,
            "vnp_Amount": "20000",
            "vnp_ResponseCode": "00",
            "vnp_TransactionStatus": "00",
            "vnp_TransactionNo": "240101000000005",
            "vnp_PayDate": "20260531183000",
        },
    )
    assert order_id == checkout.order_id
    assert success is True
    assert len(delivery_provider.sent_payloads) == 1
