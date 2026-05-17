"""Các schema phục vụ dashboard, thống kê và màn quản trị."""

from pydantic import BaseModel


class DashboardSummaryResponse(BaseModel):
    """Các chỉ số KPI tổng quan hiển thị trên thẻ dashboard admin."""

    total_revenue: float
    tickets_sold: int
    cancelled_tickets: int
    active_events: int
    waiting_queue_users: int


class RevenuePoint(BaseModel):
    """Một điểm dữ liệu doanh thu theo ngày cho biểu đồ xu hướng."""

    date: str
    revenue: float


class AudienceDistributionResponse(BaseModel):
    """Phân bổ người mua theo nhóm tuổi và giới tính."""

    age_groups: dict[str, int]
    gender_groups: dict[str, int]


class DashboardStreamResponse(BaseModel):
    """Payload phát qua WebSocket để dashboard admin cập nhật gần thời gian thực."""

    total_revenue: float
    tickets_sold: int
    cancelled_tickets: int
    active_events: int
    waiting_queue_users: int


class UploadImageResponse(BaseModel):
    """URL ảnh công khai trả về sau khi admin upload ảnh."""

    image_url: str


class EventZoneStatsResponse(BaseModel):
    """Tổng hợp ghế và doanh số của một khu vực trong buổi diễn."""

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
    """Thống kê chi tiết một buổi diễn cho màn drilldown của admin."""

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
    """Một dòng dữ liệu người dùng trên màn quản lý admin."""

    id: int
    full_name: str
    email: str
    role: str
    gender: str
    age: int
    total_tickets: int
    registered_at: str


class AdminTicketSaleResponse(BaseModel):
    """Một dòng vé bán gần đây trên bảng quản lý vé của admin."""

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
    """Doanh thu tổng hợp theo buổi diễn dùng cho phân tích vé của admin."""

    event_id: int
    event_title: str
    show_id: int
    show_title: str
    show_start_at: str
    tickets_sold: int
    revenue: float


class PaginatedAdminUsersResponse(BaseModel):
    """Payload phân trang cho bảng người dùng admin."""

    items: list[AdminUserResponse]
    total: int
    limit: int
    offset: int


class PaginatedAdminTicketSalesResponse(BaseModel):
    """Payload phân trang cho bảng doanh số vé admin."""

    items: list[AdminTicketSaleResponse]
    total: int
    limit: int
    offset: int
