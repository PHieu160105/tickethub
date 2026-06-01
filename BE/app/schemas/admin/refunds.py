from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.enums import OrderStatus


class AdminRefundOrderResponse(BaseModel):
    order_id: int
    order_code: str | None = None
    buyer_name: str | None = None
    buyer_email: str | None = None
    buyer_phone: str | None = None
    total_amount: Decimal
    payment_provider: str | None = None
    gateway_order_ref: str | None = None
    gateway_transaction_id: str | None = None
    paid_at: datetime | None = None
    refund_status: OrderStatus
    refund_started_at: datetime | None = None
    refunded_at: datetime | None = None


class AdminRefundListResponse(BaseModel):
    show_id: int
    cancellation_reason: str | None = None
    orders: list[AdminRefundOrderResponse]


class AdminRefundBatchResponse(BaseModel):
    show_id: int
    requested_count: int
    refund_pending_count: int
    refunded_count: int
    failed_count: int
    orders: list[AdminRefundOrderResponse]


class ShowCancelRequest(BaseModel):
    cancellation_reason: str = Field(min_length=3, max_length=500)
