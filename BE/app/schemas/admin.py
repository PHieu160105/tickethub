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
    """Detailed show analytics for admin drilldown."""

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
    canceled_tickets: int
    total_revenue: float
    zone_stats: list[EventZoneStatsResponse]


class AdminUserResponse(BaseModel):
    """User row for admin management screen."""

    id: int
    full_name: str
    email: str
    role: str
    gender: str
    age: int
    total_tickets: int
    registered_at: str


class AdminTicketSaleResponse(BaseModel):
    """Recent ticket sale row shown on admin ticket table."""

    id: int
    event_id: int
    event_title: str
    show_id: int
    show_title: str
    show_start_at: str
    customer_name: str
    seat_label: str
    zone_name: str
    venue: str
    price: float
    purchased_at: str
    order_status: str


class AdminEventRevenueResponse(BaseModel):
    """Per-show revenue aggregate used in admin ticket analytics."""

    event_id: int
    event_title: str
    show_id: int
    show_title: str
    show_start_at: str
    tickets_sold: int
    revenue: float


class PaginatedAdminUsersResponse(BaseModel):
    """Paginated payload for admin users table."""

    items: list[AdminUserResponse]
    total: int
    limit: int
    offset: int


class PaginatedAdminTicketSalesResponse(BaseModel):
    """Paginated payload for admin ticket sales table."""

    items: list[AdminTicketSaleResponse]
    total: int
    limit: int
    offset: int
