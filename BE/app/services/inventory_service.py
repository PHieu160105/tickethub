"""Public seatmap service backed by show ticket inventory."""

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import SeatStatus
from app.models.event import Event, TicketTier, Show
from app.models.order import Ticket
from app.models.venue import Venue, VenueLayout
from app.services.event_inventory_service import sync_show_ticket_inventory


async def _get_show_or_404(session: AsyncSession, show_id: int) -> Show:
    show = await session.scalar(select(Show).where(Show.id == show_id, Show.is_deleted.is_(False)))
    if not show:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay buoi dien")
    return show


async def get_seatmap(
    session: AsyncSession,
    show_id: int,
    current_user_id: int | None = None,
) -> dict[str, Any]:
    show = await _get_show_or_404(session, show_id)
    await sync_show_ticket_inventory(session, show)

    event = await session.get(Event, show.event_id)
    layout: VenueLayout | None = await session.get(VenueLayout, show.venue_layout_id) if show.venue_layout_id else None
    venue: Venue | None = await session.get(Venue, layout.venue_id) if layout else None

    ticket_tiers = list(await session.scalars(select(TicketTier).where(TicketTier.show_id == show.id).order_by(TicketTier.id.asc())))
    tier_map = {
        tier.id: {
            "id": tier.id,
            "name": tier.name,
            "code": tier.code,
            "color": tier.color,
            "price": float(tier.price),
        }
        for tier in ticket_tiers
    }

    tickets = list(await session.scalars(select(Ticket).where(Ticket.show_id == show_id).order_by(Ticket.id.asc())))
    now = datetime.now(timezone.utc)
    seat_responses = []
    for ticket in tickets:
        normalized_status = ticket.status
        if ticket.is_staff_locked and normalized_status != SeatStatus.SOLD:
            normalized_status = SeatStatus.LOCKED
        if normalized_status == SeatStatus.LOCKED and ticket.lock_expires_at and ticket.lock_expires_at < now:
            normalized_status = SeatStatus.AVAILABLE

        tier_info = tier_map.get(ticket.ticket_tier_id or -1)
        seat_responses.append(
            {
                "id": ticket.id,
                "label": ticket.seat_label or f"Ticket #{ticket.id}",
                "x": float(ticket.x_coord) if ticket.x_coord is not None else None,
                "y": float(ticket.y_coord) if ticket.y_coord is not None else None,
                "ticket_tier_id": ticket.ticket_tier_id,
                "ticket_tier_name": tier_info.get("name") if tier_info else None,
                "price": float(ticket.price),
                "status": normalized_status.value,
                "lock_expires_at": ticket.lock_expires_at.isoformat() if ticket.lock_expires_at else None,
                "is_locked_by_me": current_user_id is not None and ticket.locked_by_customer_id == current_user_id,
                "is_admin_locked": ticket.is_staff_locked,
            }
        )

    return {
        "show_id": show.id,
        "show_title": show.title,
        "event_id": show.event_id,
        "event_slug": event.slug if event else "",
        "event_title": event.title if event else show.title,
        "venue_name": show.location,
        "background": {
            "source": venue.background_source if venue else None,
            "type": venue.background_type if venue else None,
            "width": venue.width if venue else None,
            "height": venue.height if venue else None,
        }
        if venue
        else None,
        "ticket_tiers": [tier_map[tier.id] for tier in ticket_tiers],
        "seats": seat_responses,
        "seat_count": len(tickets),
    }
