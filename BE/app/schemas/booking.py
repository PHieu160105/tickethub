"""Seat lock, checkout and ticket schemas."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.enums import OrderStatus, SeatStatus


class LockSeatsRequest(BaseModel):
    """Seat lock request payload."""

    event_id: int
    seat_ids: list[int] = Field(min_length=1)
    queue_token: str | None = None


class LockSeatsResponse(BaseModel):
    """Result for seat lock attempts."""

    locked_seat_ids: list[int]
    failed_seat_ids: list[int]
    message: str


class ReleaseSeatsRequest(BaseModel):
    """Manual release payload."""

    event_id: int
    seat_ids: list[int] = Field(min_length=1)


class CheckoutRequest(BaseModel):
    """Checkout confirmation payload (no external gateway)."""

    event_id: int
    queue_token: str | None = None


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
    paid_at: datetime
    items: list[CheckoutItemResponse]


class MyTicketResponse(BaseModel):
    """Customer ticket management payload."""

    ticket_id: int
    ticket_code: str
    qr_payload: str
    event_id: int
    event_slug: str
    event_title: str
    event_date: datetime
    venue: str
    seat_label: str
    zone_name: str
    price: Decimal
    order_id: int
    seat_status: SeatStatus
    issued_at: datetime
