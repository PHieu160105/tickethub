"""Seat map response schemas."""

from decimal import Decimal

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

    model_config = ConfigDict(from_attributes=True)


class SeatMapResponse(BaseModel):
    """Full seat map payload for frontend."""

    event_id: int
    event_title: str
    venue_name: str
    sections: list[SeatMapSectionResponse]
    seats: list[SeatMapSeatResponse]
    seat_count: int
