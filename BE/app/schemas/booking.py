"""Schemas for seat locking, payment checkout, and customer tickets."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.models.enums import EventStatus, OrderStatus, SeatStatus


class LockSeatsRequest(BaseModel):
    show_id: int
    seat_ids: list[int] = Field(min_length=1)
    queue_token: str | None = None


class LockSeatsResponse(BaseModel):
    locked_seat_ids: list[int]
    failed_seat_ids: list[int]
    message: str


class ReleaseSeatsRequest(BaseModel):
    show_id: int
    seat_ids: list[int] = Field(min_length=1)


class CheckoutRequest(BaseModel):
    show_id: int
    queue_token: str | None = None
    buyer_name: str = Field(min_length=1, max_length=255)
    buyer_email: str = Field(min_length=3, max_length=255)
    buyer_phone: str = Field(min_length=3, max_length=50)


class CheckoutItemResponse(BaseModel):
    seat_id: int
    seat_label: str
    ticket_tier_name: str
    price: Decimal
    ticket_code: str
    qr_payload: str


class CheckoutResponse(BaseModel):
    order_id: int
    order_status: OrderStatus
    total_amount: Decimal
    payment_url: str
    gateway_order_ref: str
    payment_expires_at: datetime | None = None
    paid_at: datetime | None = None
    items: list[CheckoutItemResponse] = Field(default_factory=list)


class OrderStatusResponse(BaseModel):
    order_id: int
    order_code: str | None = None
    order_status: OrderStatus
    total_amount: Decimal
    payment_provider: str | None = None
    gateway_order_ref: str | None = None
    gateway_transaction_id: str | None = None
    payment_url: str | None = None
    payment_expires_at: datetime | None = None
    paid_at: datetime | None = None
    refunded_at: datetime | None = None
    items: list[CheckoutItemResponse] = Field(default_factory=list)


class MyTicketResponse(BaseModel):
    ticket_id: int | None = None
    ticket_code: str
    qr_payload: str | None = None
    event_id: int
    event_slug: str
    event_title: str
    show_id: int
    show_title: str
    show_start_at: datetime
    show_end_at: datetime
    event_cover_image_url: str | None = None
    venue: str
    seat_label: str
    ticket_tier_name: str
    price: Decimal
    order_id: int | None = None
    order_status: OrderStatus
    show_status: EventStatus
    refund_status: Literal["NONE", "REFUND_PENDING", "REFUNDED", "REFUND_FAILED"] = "NONE"
    cancelled_at: datetime | None = None
    cancellation_reason: str | None = None
    refund_started_at: datetime | None = None
    refunded_at: datetime | None = None
    seat_status: SeatStatus
    ticket_status: Literal["active", "cancelled"] = "active"
    issued_at: datetime | None = None
