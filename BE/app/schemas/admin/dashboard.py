from pydantic import BaseModel

from app.schemas.event import EventOccupancyResponse


class DashboardSummaryResponse(BaseModel):
    total_revenue: float
    tickets_sold: int
    active_events: int
    waiting_queue_users: int


class RevenuePoint(BaseModel):
    date: str
    revenue: float


class AudienceDistributionResponse(BaseModel):
    age_groups: dict[str, int]
    gender_groups: dict[str, int]


class DashboardStreamResponse(BaseModel):
    summary: DashboardSummaryResponse
    revenue: list[RevenuePoint]
    occupancy: list[EventOccupancyResponse]
