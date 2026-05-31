from pydantic import BaseModel


class AdminTicketSaleResponse(BaseModel):
    id: int
    event_id: int
    event_title: str
    show_id: int
    show_title: str
    show_start_at: str
    customer_name: str
    seat_label: str
    ticket_tier_name: str
    venue: str
    price: float
    purchased_at: str
    order_status: str


class AdminEventRevenueResponse(BaseModel):
    event_id: int
    event_title: str
    show_id: int
    show_title: str
    show_start_at: str
    tickets_sold: int
    revenue: float


class PaginatedAdminTicketSalesResponse(BaseModel):
    items: list[AdminTicketSaleResponse]
    total: int
    limit: int
    offset: int
