"""Dashboard stream and payment finalization broadcast tests."""

import json
from datetime import UTC, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Ticket
from app.services.booking_payment_service import create_checkout_payment, handle_vnpay_return
from app.services.booking_service import lock_seats
from app.services.dashboard_service import dump_dashboard_stream, get_dashboard_stream
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


@pytest.mark.asyncio
async def test_dashboard_stream_contains_summary_revenue_and_occupancy(
    db_session: AsyncSession,
    sample_show,
):
    payload = await get_dashboard_stream(db_session)

    assert payload.summary.active_events >= 1
    assert len(payload.revenue) == 14
    assert any(item.show_id == sample_show.id for item in payload.occupancy)


@pytest.mark.asyncio
async def test_dashboard_stream_dump_is_websocket_json_serializable(
    db_session: AsyncSession,
    sample_show,
):
    payload = await get_dashboard_stream(db_session)
    dumped = dump_dashboard_stream(payload)

    json.dumps({"type": "dashboard_update", "payload": dumped})
    occupancy = next(item for item in dumped["occupancy"] if item["show_id"] == sample_show.id)
    assert isinstance(occupancy["show_start_at"], str)


@pytest.mark.asyncio
async def test_payment_return_triggers_dashboard_broadcast_after_commit(
    db_session: AsyncSession,
    sample_show,
    customer_users,
    monkeypatch: pytest.MonkeyPatch,
):
    from app.services import booking_payment_service

    broadcast_calls = 0

    async def fake_broadcast_dashboard_update() -> None:
        nonlocal broadcast_calls
        broadcast_calls += 1

    monkeypatch.setattr(booking_payment_service, "broadcast_dashboard_update", fake_broadcast_dashboard_update)
    monkeypatch.setattr("app.services.booking_payment_service.get_vnpay_service", lambda: FakeVNPayService())

    user1, _ = customer_users
    ticket = await db_session.scalar(select(Ticket).where(Ticket.show_id == sample_show.id).order_by(Ticket.id.asc()))
    assert ticket is not None

    await lock_seats(db_session, user_id=user1.id, show_id=sample_show.id, seat_ids=[ticket.id], queue_token=None)
    checkout = await create_checkout_payment(
        db_session,
        user_id=user1.id,
        show_id=sample_show.id,
        queue_token=None,
        buyer_name="User One",
        buyer_email="u1@test.local",
        buyer_phone="0900000001",
    )
    broadcast_calls = 0

    await handle_vnpay_return(
        db_session,
        {
            "vnp_TxnRef": checkout.gateway_order_ref,
            "vnp_Amount": "10000",
            "vnp_ResponseCode": "00",
            "vnp_TransactionStatus": "00",
            "vnp_TransactionNo": "240101000000100",
            "vnp_PayDate": "20260531183000",
        },
    )

    assert broadcast_calls == 1
    payload = await get_dashboard_stream(db_session)
    assert payload.summary.tickets_sold == 1
    assert any(item.show_id == sample_show.id and item.sold_seats == 1 for item in payload.occupancy)
