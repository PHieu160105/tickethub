"""Schema phản hồi sơ đồ ghế cho màn chọn ghế."""

from pydantic import BaseModel, ConfigDict


class SeatMapSectionResponse(BaseModel):
    """Metadata khu vực lấy từ venue layout."""

    id: int
    name: str
    code: str
    color: str
    price_base: float

    model_config = ConfigDict(from_attributes=True)


class SeatMapZoneResponse(BaseModel):
    """Metadata khu giá vé của một buổi diễn."""

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
    rotation: float
    zone_id: int | None = None
    zone_name: str | None = None
    section_id: int | None
    section_name: str | None
    price: float
    status: str
    lock_expires_at: str | None
    is_locked_by_me: bool
    is_admin_locked: bool = False

    model_config = ConfigDict(from_attributes=True)


class SeatMapPolygonPointResponse(BaseModel):
    """Một điểm polygon theo hệ tọa độ phần trăm."""

    x: float
    y: float


class SeatMapPolygonResponse(BaseModel):
    """Metadata polygon overlay để vẽ vùng ghế trên bản đồ khách hàng."""

    id: int
    zone_id: int | None = None
    zone_name: str | None = None
    section_id: int | None
    section_name: str | None
    label: str | None
    points: list[SeatMapPolygonPointResponse]

    model_config = ConfigDict(from_attributes=True)


class SeatMapBackgroundResponse(BaseModel):
    """Metadata ảnh nền địa điểm dùng làm lớp nền sơ đồ ghế."""

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
    queue_enabled: bool
    queue_required: bool = False
    background: SeatMapBackgroundResponse | None = None
    zones: list[SeatMapZoneResponse]
    sections: list[SeatMapSectionResponse]
    polygons: list[SeatMapPolygonResponse]
    seats: list[SeatMapSeatResponse]
    seat_count: int
