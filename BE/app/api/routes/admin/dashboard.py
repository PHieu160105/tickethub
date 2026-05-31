from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_admin
from app.core.db import get_db_session
from app.models.enums import UserType
from app.models.user import User
from app.schemas.admin import AudienceDistributionResponse, DashboardSummaryResponse, RevenuePoint
from app.schemas.event import EventOccupancyResponse
from app.services.dashboard_service import get_audience_distribution, get_dashboard_occupancy, get_dashboard_summary, get_revenue_series

router = APIRouter()


@router.get("/dashboard/summary", response_model=DashboardSummaryResponse)
async def dashboard_summary(
    session: AsyncSession = Depends(get_db_session),
    admin_user: User = Depends(get_current_active_admin),
) -> DashboardSummaryResponse:
    return await get_dashboard_summary(session, staff_id=admin_user.id if admin_user.user_type == UserType.EVENT_STAFF else None)


@router.get("/dashboard/revenue", response_model=list[RevenuePoint])
async def dashboard_revenue(
    days: int = Query(default=14, ge=7, le=90),
    session: AsyncSession = Depends(get_db_session),
    admin_user: User = Depends(get_current_active_admin),
) -> list[RevenuePoint]:
    return await get_revenue_series(session, days=days, staff_id=admin_user.id if admin_user.user_type == UserType.EVENT_STAFF else None)


@router.get("/dashboard/audience", response_model=AudienceDistributionResponse)
async def dashboard_audience(
    session: AsyncSession = Depends(get_db_session),
    admin_user: User = Depends(get_current_active_admin),
) -> AudienceDistributionResponse:
    return await get_audience_distribution(session, staff_id=admin_user.id if admin_user.user_type == UserType.EVENT_STAFF else None)


@router.get("/dashboard/occupancy", response_model=list[EventOccupancyResponse])
async def dashboard_occupancy(
    session: AsyncSession = Depends(get_db_session),
    admin_user: User = Depends(get_current_active_admin),
) -> list[EventOccupancyResponse]:
    return await get_dashboard_occupancy(session, staff_id=admin_user.id if admin_user.user_type == UserType.EVENT_STAFF else None)
