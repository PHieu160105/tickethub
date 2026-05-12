"""Seat map response schemas."""

from pydantic import BaseModel, ConfigDict


class SeatMapSectionResponse(BaseModel):
    """Section metadata for seat map."""

    id: int
    name: str
    code: str
    color: str
    price_base: float

    model_config = ConfigDict(from_attributes=True)


class SeatMapSeatResponse(BaseModel):
    """Seat with coordinates for map rendering."""

    id: int
    label: str
    x: float | None
    y: float | None
    rotation: float
    section_id: int | None
    section_name: str | None
    price: float
    status: str
    lock_expires_at: str | None
    is_locked_by_me: bool
    is_admin_locked: bool = False

    model_config = ConfigDict(from_attributes=True)


class SeatMapPolygonPointResponse(BaseModel):
    """A single polygon point in percentage coordinates."""

    x: float
    y: float


class SeatMapPolygonResponse(BaseModel):
    """Polygon overlay metadata for customer map rendering."""

    id: int
    section_id: int | None
    section_name: str | None
    label: str | None
    points: list[SeatMapPolygonPointResponse]

    model_config = ConfigDict(from_attributes=True)


class SeatMapBackgroundResponse(BaseModel):
    """Venue background metadata for rendering the map base layer."""

    source: str | None
    type: str | None
    width: int | None
    height: int | None

    model_config = ConfigDict(from_attributes=True)


class SeatMapResponse(BaseModel):
    """Full seat map payload for frontend."""

    show_id: int
    show_title: str
    event_id: int
    event_slug: str
    event_title: str
    venue_name: str
    queue_enabled: bool
    background: SeatMapBackgroundResponse | None = None
    sections: list[SeatMapSectionResponse]
    polygons: list[SeatMapPolygonResponse]
    seats: list[SeatMapSeatResponse]
    seat_count: int
