"""Customer booking routes: seat locks, payment checkout, and ticket history."""

from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_customer
from app.core.cache import public_api_cache, user_ticket_cache_namespace
from app.core.db import get_db_session
from app.core.rate_limit import rate_limit
from app.models.user import User
from app.schemas.booking import (
    CheckoutRequest,
    CheckoutResponse,
    LockSeatsRequest,
    LockSeatsResponse,
    MyTicketResponse,
    OrderStatusResponse,
    ReleaseSeatsRequest,
)
from app.schemas.common import APIMessage
from app.services.admission_service import ensure_admission_for_show, read_queue_token
from app.services.booking_payment_service import build_order_status_response, create_checkout_payment
from app.services.booking_service import fetch_my_tickets, lock_seats, release_seats
from app.services.event_query_service import get_show_by_id

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.post("/lock", response_model=LockSeatsResponse, dependencies=[Depends(rate_limit("bookings-lock", times=60, seconds=60))])
async def lock_event_seats(
    payload: LockSeatsRequest,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_customer),
) -> LockSeatsResponse:
    show = await get_show_by_id(session, payload.show_id)
    await ensure_admission_for_show(session, show, current_user, read_queue_token(request, payload.queue_token))
    return await lock_seats(
        session=session,
        user_id=current_user.id,
        show_id=payload.show_id,
        seat_ids=payload.seat_ids,
        queue_token=payload.queue_token,
    )


@router.post("/release", response_model=APIMessage, dependencies=[Depends(rate_limit("bookings-release", times=60, seconds=60))])
async def release_event_seats(
    payload: ReleaseSeatsRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_customer),
) -> APIMessage:
    released_count = await release_seats(
        session=session,
        user_id=current_user.id,
        show_id=payload.show_id,
        seat_ids=payload.seat_ids,
    )
    return APIMessage(detail=f"Da tra lai {released_count} ghe")


@router.post("/checkout", response_model=CheckoutResponse, dependencies=[Depends(rate_limit("bookings-checkout", times=10, seconds=60))])
async def checkout(
    payload: CheckoutRequest,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_customer),
) -> CheckoutResponse:
    show = await get_show_by_id(session, payload.show_id)
    await ensure_admission_for_show(session, show, current_user, read_queue_token(request, payload.queue_token))
    return await create_checkout_payment(
        session=session,
        user_id=current_user.id,
        show_id=payload.show_id,
        queue_token=payload.queue_token,
        buyer_name=payload.buyer_name,
        buyer_email=payload.buyer_email,
        buyer_phone=payload.buyer_phone,
        client_ip=request.client.host if request.client and request.client.host else "127.0.0.1",
    )


@router.get("/orders/{order_id}", response_model=OrderStatusResponse)
async def get_order_status(
    order_id: int,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_customer),
) -> OrderStatusResponse:
    return await build_order_status_response(session, current_user.id, order_id)


@router.get("/my-tickets", response_model=list[MyTicketResponse])
async def my_tickets(
    search: str | None = Query(default=None, max_length=120),
    start_from: datetime | None = Query(default=None),
    end_to: datetime | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_customer),
) -> list[MyTicketResponse]:
    cache_key = (
        search or "",
        start_from.isoformat() if start_from else "",
        end_to.isoformat() if end_to else "",
        limit,
        offset,
    )
    cached = await public_api_cache.get(user_ticket_cache_namespace(current_user.id), cache_key)
    if cached is not None and isinstance(cached, list):
        return cached

    response = await fetch_my_tickets(
        session,
        user_id=current_user.id,
        search=search,
        start_from=start_from,
        end_to=end_to,
        limit=limit,
        offset=offset,
    )
    return await public_api_cache.set(user_ticket_cache_namespace(current_user.id), cache_key, response, ttl_seconds=30)
