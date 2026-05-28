from pydantic import BaseModel


class EventZoneStatsResponse(BaseModel):
    zone_id: int
    zone_code: str
    zone_name: str
    color: str
    total_seats: int
    sold_seats: int
    locked_seats: int
    available_seats: int
    occupancy_rate: float
    min_price: float
    max_price: float


class EventDetailStatsResponse(BaseModel):
    event_id: int
    event_title: str
    show_id: int
    show_title: str
    show_start_at: str
    show_end_at: str
    total_seats: int
    sold_seats: int
    locked_seats: int
    available_seats: int
    occupancy_rate: float
    tickets_issued: int
    total_revenue: float
    zone_stats: list[EventZoneStatsResponse]
