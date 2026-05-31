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
    zone_name: str
    venue: str
    price: float
    purchased_at: str
    order_status: str


class AdminTransactionLogResponse(BaseModel):
    id: int
    action: str
    status: str
    payment_method: str | None = None
    gateway_transaction_id: str | None = None
    gateway_response_code: str | None = None
    amount: float | None = None
    message: str | None = None
    raw_payload: str | None = None
    created_at: str


class AdminTicketTransactionDetailResponse(BaseModel):
    ticket_id: int
    seat_label: str
    zone_name: str
    price: float
    show_id: int
    show_title: str
    show_start_at: str
    event_id: int
    event_title: str
    venue: str
    order_id: int
    order_code: str | None = None
    order_status: str
    payment_provider: str | None = None
    gateway_order_ref: str | None = None
    gateway_transaction_id: str | None = None
    payment_started_at: str | None = None
    payment_expires_at: str | None = None
    paid_at: str | None = None
    buyer_name: str | None = None
    buyer_email: str | None = None
    buyer_phone: str | None = None
    logs: list[AdminTransactionLogResponse]


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
