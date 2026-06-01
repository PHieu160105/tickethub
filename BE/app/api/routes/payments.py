from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_db_session
from app.services.booking_payment_service import _build_payment_result_url, handle_vnpay_return

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/vnpay/return")
async def vnpay_return(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    params = {key: value for key, value in request.query_params.items()}
    try:
        order_id, success = await handle_vnpay_return(session, params)
        target_url = _build_payment_result_url(order_id, gateway_error=None if success else "payment_failed")
    except HTTPException:
        frontend_base = get_settings().frontend_app_url.rstrip("/")
        target_url = f"{frontend_base}/payment/result?gatewayError=invalid_signature"
    return RedirectResponse(url=target_url, status_code=302)
