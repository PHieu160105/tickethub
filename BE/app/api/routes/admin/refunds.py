from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_admin
from app.core.db import get_db_session
from app.models.user import User
from app.schemas.admin import AdminRefundBatchResponse, AdminRefundListResponse, ShowCancelRequest
from app.schemas.common import APIMessage
from app.services.refund_service import cancel_show, list_show_refunds, refresh_show_refunds, request_show_refunds

router = APIRouter()


@router.post("/events/{event_key}/shows/{show_id}/cancel", response_model=APIMessage)
async def cancel_admin_show(
    event_key: str,
    show_id: int,
    payload: ShowCancelRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_admin),
) -> APIMessage:
    await cancel_show(
        session,
        event_key=event_key,
        show_id=show_id,
        actor=current_user,
        cancellation_reason=payload.cancellation_reason,
    )
    return APIMessage(detail="Da huy show thanh cong")


@router.get("/events/{event_key}/shows/{show_id}/refunds", response_model=AdminRefundListResponse)
async def get_show_refunds(
    event_key: str,
    show_id: int,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_admin),
) -> AdminRefundListResponse:
    return await list_show_refunds(session, event_key=event_key, show_id=show_id, actor=current_user)


@router.post("/events/{event_key}/shows/{show_id}/refunds", response_model=AdminRefundBatchResponse)
async def request_refunds(
    event_key: str,
    show_id: int,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_admin),
) -> AdminRefundBatchResponse:
    return await request_show_refunds(session, event_key=event_key, show_id=show_id, actor=current_user)


@router.post("/events/{event_key}/shows/{show_id}/refunds/refresh", response_model=AdminRefundBatchResponse)
async def refresh_refunds(
    event_key: str,
    show_id: int,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_admin),
) -> AdminRefundBatchResponse:
    return await refresh_show_refunds(session, event_key=event_key, show_id=show_id, actor=current_user)
