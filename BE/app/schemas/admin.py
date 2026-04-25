"""Admin dashboard schemas."""

from pydantic import BaseModel


class DashboardSummaryResponse(BaseModel):
    """High-level KPI metrics for admin cards."""

    total_revenue: float
    tickets_sold: int
    cancelled_tickets: int
    active_events: int
    waiting_queue_users: int


class RevenuePoint(BaseModel):
    """Revenue trend point."""

    date: str
    revenue: float


class AudienceDistributionResponse(BaseModel):
    """Audience demographics grouped by age bucket and gender."""

    age_groups: dict[str, int]
    gender_groups: dict[str, int]


class DashboardStreamResponse(BaseModel):
    """Payload broadcasted over WebSocket for near real-time updates."""

    total_revenue: float
    tickets_sold: int
    cancelled_tickets: int
    active_events: int
    waiting_queue_users: int


class UploadImageResponse(BaseModel):
    """Public image URL returned after admin upload."""

    image_url: str


class EventZoneStatsResponse(BaseModel):
    """Seat and sales summary for one zone of an event."""

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
    """Detailed event analytics for admin drilldown."""

    event_id: int
    event_title: str
    total_seats: int
    sold_seats: int
    locked_seats: int
    available_seats: int
    occupancy_rate: float
    tickets_issued: int
    canceled_tickets: int
    total_revenue: float
    zone_stats: list[EventZoneStatsResponse]
