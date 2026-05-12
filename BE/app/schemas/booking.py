"""Seat lock, checkout and ticket schemas."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.models.enums import OrderStatus, SeatStatus


class LockSeatsRequest(BaseModel):
    """Seat lock request payload."""

    show_id: int
    seat_ids: list[int] = Field(min_length=1)
    queue_token: str | None = None


class LockSeatsResponse(BaseModel):
    """Result for seat lock attempts."""

    locked_seat_ids: list[int]
    failed_seat_ids: list[int]
    message: str


class ReleaseSeatsRequest(BaseModel):
    """Manual release payload."""

    show_id: int
    seat_ids: list[int] = Field(min_length=1)


class CheckoutRequest(BaseModel):
    """Checkout confirmation payload (no external gateway)."""

    show_id: int
    queue_token: str | None = None
    discount_code: str | None = None


class CheckoutItemResponse(BaseModel):
    """One purchased seat line item."""

    seat_id: int
    seat_label: str
    zone_name: str
    price: Decimal
    ticket_code: str
    qr_payload: str


class CheckoutResponse(BaseModel):
    """Order confirmation response after payment simulation."""

    order_id: int
    order_status: OrderStatus
    total_amount: Decimal
    discount_amount: Decimal = Decimal("0")
    discount_code: str | None = None
    paid_at: datetime
    items: list[CheckoutItemResponse]


class MyTicketResponse(BaseModel):
    """Customer ticket management payload."""

    ticket_id: int | None = None
    cancellation_id: int | None = None
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
    zone_name: str
    price: Decimal
    order_id: int | None = None
    seat_status: SeatStatus
    ticket_status: Literal['active', 'cancelled'] = 'active'
    issued_at: datetime | None = None
    canceled_at: datetime | None = None
