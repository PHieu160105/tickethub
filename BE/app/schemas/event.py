"""Event and seat related schemas."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import EventStatus, Gender, SeatStatus


class SeatZoneCreate(BaseModel):
    """Seat zone matrix config payload for event creation."""

    code: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=100)
    row_count: int = Field(ge=1, le=40)
    seats_per_row: int = Field(ge=1, le=60)
    price: Decimal = Field(gt=0)
    color: str = Field(default="#024ddf", max_length=20)


class EventCreateRequest(BaseModel):
    """Admin payload to create a brand-new event and seats."""

    title: str = Field(min_length=3, max_length=255)
    description: str = Field(min_length=10)
    category: str = Field(min_length=2, max_length=80)
    venue: str = Field(min_length=3, max_length=200)
    start_at: datetime
    end_at: datetime
    cover_image_url: str = ""
    status: EventStatus = EventStatus.LIVE
    hold_minutes: int = Field(default=10, ge=1, le=60)
    queue_enabled: bool = True
    queue_release_batch: int = Field(default=50, ge=1, le=500)
    max_active_queue_tokens: int = Field(default=200, ge=1, le=5000)
    zones: list[SeatZoneCreate] = Field(min_length=1)


class EventUpdateRequest(BaseModel):
    """Admin payload to update released event metadata/settings."""

    title: str | None = Field(default=None, min_length=3, max_length=255)
    description: str | None = Field(default=None, min_length=10)
    category: str | None = Field(default=None, min_length=2, max_length=80)
    venue: str | None = Field(default=None, min_length=3, max_length=200)
    start_at: datetime | None = None
    end_at: datetime | None = None
    cover_image_url: str | None = None
    status: EventStatus | None = None
    hold_minutes: int | None = Field(default=None, ge=1, le=60)
    queue_enabled: bool | None = None
    queue_release_batch: int | None = Field(default=None, ge=1, le=500)
    max_active_queue_tokens: int | None = Field(default=None, ge=1, le=5000)


class EventCardResponse(BaseModel):
    """Short event shape for listings."""

    id: int
    slug: str
    title: str
    description: str
    category: str
    venue: str
    start_at: datetime
    end_at: datetime
    cover_image_url: str
    status: EventStatus
    queue_enabled: bool

    model_config = ConfigDict(from_attributes=True)


class SeatZoneResponse(BaseModel):
    """Read-only zone payload."""

    id: int
    code: str
    name: str
    row_count: int
    seats_per_row: int
    price: Decimal
    color: str

    model_config = ConfigDict(from_attributes=True)


class SeatUserInfoResponse(BaseModel):
    """Basic user info shown to admin in seat inspector."""

    user_id: int
    full_name: str
    email: str
    gender: Gender
    age: int


class SeatPurchaseInfoResponse(BaseModel):
    """Purchase details for sold seats."""

    user: SeatUserInfoResponse
    order_id: int
    ticket_code: str | None = None
    issued_at: datetime | None = None


class EventDetailResponse(EventCardResponse):
    """Detailed event payload used for booking screen."""

    hold_minutes: int
    queue_release_batch: int
    max_active_queue_tokens: int
    zones: list[SeatZoneResponse]


class SeatResponse(BaseModel):
    """Serializable seat object for matrix rendering."""

    id: int
    zone_id: int
    row_index: int
    row_label: str
    seat_number: int
    seat_label: str
    price: Decimal
    status: SeatStatus
    lock_expires_at: datetime | None = None
    is_locked_by_me: bool = False
    locked_by_user: SeatUserInfoResponse | None = None
    sold_to_user: SeatPurchaseInfoResponse | None = None


class SeatMatrixResponse(BaseModel):
    """Seats and zones returned to seat matrix screen."""

    event_id: int
    event_slug: str
    queue_enabled: bool
    zones: list[SeatZoneResponse]
    seats: list[SeatResponse]


class EventOccupancyResponse(BaseModel):
    """Per-event occupancy totals for dashboard."""

    event_id: int
    event_title: str
    total_seats: int
    sold_seats: int
    locked_seats: int
    occupancy_rate: float


# ── Admin Seat Creation Schemas ──


class SeatSingleCreateRequest(BaseModel):
    """Create a single seat for an event with coordinates (percent 0-100)."""

    seat_label: str = Field(min_length=1, max_length=100)
    x: float = Field(ge=0.0, le=100.0)
    y: float = Field(ge=0.0, le=100.0)
    rotation: float = Field(default=0.0, ge=0.0, le=360.0)
    zone_id: int | None = None
    section_id: int | None = None
    price: Decimal | None = None


class ArcConfig(BaseModel):
    center_x: float = Field(ge=0.0, le=100.0)
    center_y: float = Field(ge=0.0, le=100.0)
    radius: float = Field(gt=0.0)
    start_angle: float
    end_angle: float


class SeatBulkCreateRequest(BaseModel):
    """Bulk generate seats for an event using supported patterns."""

    zone_id: int | None = None
    section_id: int | None = None
    pattern: str = Field(default="straight")  # straight | arc | zigzag
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


class SeatBulkCreateResponse(BaseModel):
    created_count: int
    seats: list[SeatCreateResponse]

