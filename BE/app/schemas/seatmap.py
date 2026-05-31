"""Schema phản hồi sơ đồ ghế cho màn chọn ghế."""

from pydantic import BaseModel, ConfigDict


class SeatMapTicketTierResponse(BaseModel):
    """Metadata hạng vé của một buổi diễn."""

    id: int
    code: str
    name: str
    color: str
    price: float

    model_config = ConfigDict(from_attributes=True)


class SeatMapSeatResponse(BaseModel):
    """Ghế có tọa độ để frontend render trên canvas."""

    id: int
    label: str
    x: float | None
    y: float | None
    ticket_tier_id: int | None = None
    ticket_tier_name: str | None = None
    price: float
    status: str
    lock_expires_at: str | None
    is_locked_by_me: bool
    is_admin_locked: bool = False

    model_config = ConfigDict(from_attributes=True)


class SeatMapBackgroundResponse(BaseModel):
    """Metadata ảnh nền tĩnh của địa điểm."""

    source: str | None
    type: str | None
    width: int | None
    height: int | None

    model_config = ConfigDict(from_attributes=True)


class SeatMapResponse(BaseModel):
    """Payload đầy đủ của sơ đồ ghế cho frontend."""

    show_id: int
    show_title: str
    event_id: int
    event_slug: str
    event_title: str
    venue_name: str
    queue_required: bool = False
    background: SeatMapBackgroundResponse | None = None
    ticket_tiers: list[SeatMapTicketTierResponse]
    seats: list[SeatMapSeatResponse]
    seat_count: int
