"""Seat lock, release, checkout and ticket management routes."""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_customer
from app.core.db import get_db_session
from app.core.rate_limit import rate_limit
from app.models.user import User
from app.schemas.booking import (
    CheckoutRequest,
    CheckoutResponse,
    LockSeatsRequest,
    LockSeatsResponse,
    MyTicketResponse,
    ReleaseSeatsRequest,
)
from app.schemas.common import APIMessage
from app.services.booking_service import cancel_ticket, checkout_locked_seats, fetch_my_tickets, lock_seats, release_seats

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.post("/lock", response_model=LockSeatsResponse, dependencies=[Depends(rate_limit("bookings-lock", times=60, seconds=60))])
async def lock_event_seats(
    payload: LockSeatsRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_customer),
) -> LockSeatsResponse:
    """Lock one or many seats for current authenticated customer."""

    return await lock_seats(
        session=session,
        user_id=current_user.id,
        event_id=payload.event_id,
        seat_ids=payload.seat_ids,
        queue_token=payload.queue_token,
    )


@router.post("/release", response_model=APIMessage, dependencies=[Depends(rate_limit("bookings-release", times=60, seconds=60))])
async def release_event_seats(
    payload: ReleaseSeatsRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_customer),
) -> APIMessage:
    """Release selected seats if they are currently locked by the same user."""

    released_count = await release_seats(
        session=session,
        user_id=current_user.id,
        event_id=payload.event_id,
        seat_ids=payload.seat_ids,
    )
    return APIMessage(detail=f"Released {released_count} seats")


@router.post("/checkout", response_model=CheckoutResponse, dependencies=[Depends(rate_limit("bookings-checkout", times=10, seconds=60))])
async def checkout(
    payload: CheckoutRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_customer),
) -> CheckoutResponse:
    """Confirm checkout and mark user locked seats as sold tickets."""

    return await checkout_locked_seats(
        session=session,
        user_id=current_user.id,
        event_id=payload.event_id,
        queue_token=payload.queue_token,
        discount_code=payload.discount_code,
    )


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
    """List current user's purchased e-tickets with QR payload."""

    return await fetch_my_tickets(
        session,
        user_id=current_user.id,
        search=search,
        start_from=start_from,
        end_to=end_to,
        limit=limit,
        offset=offset,
    )


@router.delete("/my-tickets/{ticket_id}", response_model=APIMessage)
async def delete_ticket(
    ticket_id: int,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_customer),
) -> APIMessage:
    """Allow customer to cancel one owned ticket and release seat."""

    await cancel_ticket(session, user_id=current_user.id, ticket_id=ticket_id)
    return APIMessage(detail="Ticket canceled and seat released")
