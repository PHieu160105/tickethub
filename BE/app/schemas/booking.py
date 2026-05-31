"""Schema giữ ghế, thanh toán và vé điện tử."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.models.enums import OrderStatus, SeatStatus


class LockSeatsRequest(BaseModel):
    """Payload yêu cầu giữ một hoặc nhiều ghế."""

    show_id: int
    seat_ids: list[int] = Field(min_length=1)
    queue_token: str | None = None


class LockSeatsResponse(BaseModel):
    """Kết quả giữ ghế, tách rõ ghế giữ thành công và ghế bị từ chối."""

    locked_seat_ids: list[int]
    failed_seat_ids: list[int]
    message: str


class ReleaseSeatsRequest(BaseModel):
    """Payload trả ghế thủ công khi người dùng rời luồng thanh toán."""

    show_id: int
    seat_ids: list[int] = Field(min_length=1)


class CheckoutRequest(BaseModel):
    """Payload xác nhận thanh toán mô phỏng, chưa đi qua cổng thanh toán thật."""

    show_id: int
    queue_token: str | None = None
    discount_code: str | None = None


class CheckoutItemResponse(BaseModel):
    """Một dòng ghế đã mua trong đơn hàng."""

    seat_id: int
    seat_label: str
    ticket_tier_name: str
    price: Decimal
    ticket_code: str
    qr_payload: str


class CheckoutResponse(BaseModel):
    """Phản hồi xác nhận đơn hàng sau khi mô phỏng thanh toán thành công."""

    order_id: int
    order_status: OrderStatus
    total_amount: Decimal
    discount_amount: Decimal = Decimal("0")
    discount_code: str | None = None
    paid_at: datetime
    items: list[CheckoutItemResponse]


class MyTicketResponse(BaseModel):
    """Payload vé của khách hàng trên màn quản lý vé cá nhân."""

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
    seat_status: SeatStatus
    ticket_status: Literal['active'] = 'active'
    issued_at: datetime | None = None
