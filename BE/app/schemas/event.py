"""Schema sự kiện, buổi diễn, ghế và planner admin."""

from datetime import date, datetime, time
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import EventCategory, EventStatus, Gender, SeatSource, SeatStatus
from app.schemas.performer import PublicShowPerformerResponse


class TicketTierCreate(BaseModel):
    """Payload tạo hạng vé của một buổi diễn."""

    code: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    base_price: Decimal = Field(gt=0)
    color: str = Field(default="#024ddf", max_length=20)
    is_active: bool = True


class TicketTierUpdate(BaseModel):
    """Payload cập nhật hạng vé của một buổi diễn."""

    code: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    base_price: Decimal = Field(gt=0)
    color: str = Field(default="#024ddf", max_length=20)
    is_active: bool = True


class EventCreateRequest(BaseModel):
    """Payload admin tạo sự kiện cha."""

    title: str = Field(min_length=3, max_length=255)
    description: str = Field(min_length=10)
    category: EventCategory
    start_date: date
    end_date: date
    cover_image_url: str = ""
    status: EventStatus = EventStatus.LIVE

    @model_validator(mode="after")
    def validate_range(self) -> "EventCreateRequest":
        if self.end_date < self.start_date:
            raise ValueError("Ngày kết thúc phải bằng hoặc sau ngày bắt đầu")
        return self


class EventUpdateRequest(BaseModel):
    """Payload admin cập nhật metadata của sự kiện."""

    title: str | None = Field(default=None, min_length=3, max_length=255)
    description: str | None = Field(default=None, min_length=10)
    category: EventCategory | None = None
    start_date: date | None = None
    end_date: date | None = None
    cover_image_url: str | None = None
    status: EventStatus | None = None


class ShowCreateRequest(BaseModel):
    """Payload admin tạo buổi diễn có thể bán vé."""

    title: str = Field(min_length=3, max_length=255)
    description: str = Field(min_length=10)
    location: str = Field(min_length=3, max_length=200)
    show_date: date
    start_time: time
    end_time: time
    status: EventStatus = EventStatus.LIVE
    hold_minutes: int = Field(default=10, ge=1, le=60)
    seat_source: SeatSource = SeatSource.LAYOUT
    venue_id: int | None = Field(default=None, ge=1)
    venue_layout_id: int | None = Field(default=None, ge=1)
    ticket_tiers: list[TicketTierCreate] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_show_source(self) -> "ShowCreateRequest":
        if self.end_time <= self.start_time:
            raise ValueError("Giờ kết thúc phải sau giờ bắt đầu")
        return self


class ShowUpdateRequest(BaseModel):
    """Payload admin cập nhật một buổi diễn."""

    title: str | None = Field(default=None, min_length=3, max_length=255)
    description: str | None = Field(default=None, min_length=10)
    location: str | None = Field(default=None, min_length=3, max_length=200)
    show_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    status: EventStatus | None = None
    hold_minutes: int | None = Field(default=None, ge=1, le=60)
    seat_source: SeatSource | None = None
    venue_layout_id: int | None = Field(default=None, ge=1)


class ShowSummaryResponse(BaseModel):
    """Payload tóm tắt buổi diễn cho trang chi tiết sự kiện và danh sách admin."""

    id: int
    event_id: int
    title: str
    description: str
    location: str
    start_at: datetime
    end_at: datetime
    status: EventStatus
    seat_source: SeatSource = SeatSource.LAYOUT
    performers: list[PublicShowPerformerResponse] = Field(default_factory=list)
    venue_layout_id: int | None = None
    cancelled_at: datetime | None = None
    cancelled_by_staff_id: int | None = None
    cancellation_reason: str | None = None
    has_booking_history: bool = False
    paid_order_count: int = 0
    refundable_order_count: int = 0
    refund_in_progress_count: int = 0
    historical_paid_order_count: int = 0
    historical_paid_ticket_count: int = 0
    refund_required_amount: Decimal = Decimal("0")
    refund_pending_amount: Decimal = Decimal("0")
    refunded_amount: Decimal = Decimal("0")
    refund_failed_amount: Decimal = Decimal("0")

    model_config = ConfigDict(from_attributes=True)


class EventCardResponse(BaseModel):
    """Payload tóm tắt sự kiện cho danh sách public/admin."""

    id: int
    slug: str
    title: str
    description: str
    category: EventCategory
    venue: str
    start_at: datetime
    end_at: datetime
    cover_image_url: str
    status: EventStatus
    created_at: datetime
    max_price: float


class EventDetailResponse(EventCardResponse):
    """Payload chi tiết sự kiện kèm các buổi diễn con."""

    shows: list[ShowSummaryResponse]


class ShowDetailResponse(ShowSummaryResponse):
    """Payload chi tiết buổi diễn cho admin và màn đặt vé."""

    event_slug: str
    event_title: str
    hold_minutes: int
    ticket_tiers: list["TicketTierResponse"]


class TicketTierResponse(BaseModel):
    """Payload hạng vé dạng chỉ đọc."""

    id: int
    code: str
    name: str
    description: str | None
    base_price: Decimal
    color: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class SeatUserInfoResponse(BaseModel):
    """Thông tin người dùng cơ bản hiển thị trong seat inspector của admin."""

    user_id: int
    full_name: str
    email: str
    gender: Gender
    age: int


class SeatPurchaseInfoResponse(BaseModel):
    """Thông tin đơn mua của ghế đã bán."""

    user: SeatUserInfoResponse
    order_id: int
    ticket_code: str | None = None
    issued_at: datetime | None = None


class SeatResponse(BaseModel):
    """Đối tượng ghế có thể serialize để render ma trận ghế."""

    id: int
    ticket_tier_id: int | None = None
    row_index: int
    row_label: str
    seat_number: int
    seat_label: str
    price: Decimal
    status: SeatStatus
    lock_expires_at: datetime | None = None
    is_locked_by_me: bool = False
    is_admin_locked: bool = False
    locked_by_user: SeatUserInfoResponse | None = None
    sold_to_user: SeatPurchaseInfoResponse | None = None


class SeatMatrixResponse(BaseModel):
    """Danh sách ghế và khu vực trả về màn đặt vé của một buổi diễn."""

    show_id: int
    show_title: str
    event_id: int
    event_slug: str
    event_title: str
    queue_required: bool = False
    ticket_tiers: list[TicketTierResponse]
    seats: list[SeatResponse]


class EventOccupancyResponse(BaseModel):
    """Tổng hợp lấp đầy ghế theo từng buổi diễn cho dashboard admin."""

    event_id: int
    event_title: str
    show_id: int
    show_title: str
    show_start_at: datetime
    venue: str
    total_seats: int
    sold_seats: int
    locked_seats: int
    occupancy_rate: float


class SeatSingleCreateRequest(BaseModel):
    """Payload tạo một ghế theo tọa độ phần trăm 0-100 của buổi diễn."""

    seat_label: str = Field(min_length=1, max_length=100)
    x: float = Field(ge=0.0, le=100.0)
    y: float = Field(ge=0.0, le=100.0)
    ticket_tier_id: int | None = None
    price: Decimal | None = None
    is_admin_locked: bool = False


class ArcConfig(BaseModel):
    center_x: float = Field(ge=0.0, le=100.0)
    center_y: float = Field(ge=0.0, le=100.0)
    radius: float = Field(gt=0.0)
    start_angle: float
    end_angle: float


class SeatBulkCreateRequest(BaseModel):
    """Payload sinh ghế hàng loạt theo các mẫu bố trí được hỗ trợ."""

    ticket_tier_id: int | None = None
    pattern: str = Field(default="straight")
    rows: int = Field(default=1, ge=1)
    cols: int = Field(default=1, ge=1)
    gap_x: float = Field(default=3.0, ge=0.0)
    gap_y: float = Field(default=3.0, ge=0.0)
    start_x: float = Field(default=0.0, ge=0.0, le=100.0)
    start_y: float = Field(default=0.0, ge=0.0, le=100.0)
    label_prefix: str = Field(default="A", min_length=1, max_length=6)
    arc_config: ArcConfig | None = None


class SeatCreateResponse(BaseModel):
    id: int
    seat_label: str
    x: float | None
    y: float | None


class SeatUpdateRequest(BaseModel):
    """Payload cập nhật hình học ghế và metadata bán vé của buổi diễn."""

    seat_label: str | None = Field(default=None, min_length=1, max_length=100)
    x: float | None = Field(default=None, ge=0.0, le=100.0)
    y: float | None = Field(default=None, ge=0.0, le=100.0)
    ticket_tier_id: int | None = None
    price: Decimal | None = None
    is_admin_locked: bool | None = None


class SeatBulkCreateResponse(BaseModel):
    created_count: int
    seats: list[SeatCreateResponse]


class SeatSyncCreateItem(BaseModel):
    client_id: int = Field(lt=0)
    seat_label: str = Field(min_length=1, max_length=100)
    x: float = Field(ge=0.0, le=100.0)
    y: float = Field(ge=0.0, le=100.0)
    ticket_tier_id: int | None = None
    price: Decimal | None = None
    is_admin_locked: bool = False


class SeatSyncUpdateItem(BaseModel):
    id: int = Field(ge=1)
    seat_label: str = Field(min_length=1, max_length=100)
    x: float = Field(ge=0.0, le=100.0)
    y: float = Field(ge=0.0, le=100.0)
    ticket_tier_id: int | None = None
    price: Decimal | None = None
    is_admin_locked: bool = False


class SeatSyncRequest(BaseModel):
    create: list[SeatSyncCreateItem] = Field(default_factory=list)
    update: list[SeatSyncUpdateItem] = Field(default_factory=list)
    delete_ids: list[int] = Field(default_factory=list)


class SeatSyncCreatedItem(BaseModel):
    client_id: int
    id: int
    seat_label: str
    x: float | None
    y: float | None


class SeatSyncResponse(BaseModel):
    created: list[SeatSyncCreatedItem]
    updated_ids: list[int]
    deleted_ids: list[int]


ShowDetailResponse.model_rebuild()
