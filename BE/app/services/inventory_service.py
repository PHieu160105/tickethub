"""Public seatmap service backed by show ticket inventory."""

from datetime import datetime, timezone
import math
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import SeatStatus
from app.models.event import Event, SeatZone, Show
from app.models.order import Ticket
from app.models.seat import Seat
from app.models.venue import Polygon, Section, Venue, VenueLayout
from app.services.event_inventory_service import sync_show_ticket_inventory


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


async def _get_show_or_404(session: AsyncSession, show_id: int) -> Show:
    show = await session.scalar(select(Show).where(Show.id == show_id, Show.is_deleted.is_(False)))
    if not show:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy buổi diễn")
    return show


def _zone_block_map(zones: list[SeatZone]) -> dict[int, dict[str, float]]:
    if not zones:
        return {}

    cols = 1 if len(zones) == 1 else 2
    rows = max(math.ceil(len(zones) / cols), 1)
    margin_x = 8.0
    margin_y = 8.0
    gap_x = 6.0
    gap_y = 8.0
    block_width = (100.0 - margin_x * 2 - gap_x * (cols - 1)) / cols
    block_height = (100.0 - margin_y * 2 - gap_y * (rows - 1)) / rows

    blocks: dict[int, dict[str, float]] = {}
    for index, zone in enumerate(zones):
        col = index % cols
        row = index // cols
        blocks[zone.id] = {
            "left": margin_x + col * (block_width + gap_x),
            "top": margin_y + row * (block_height + gap_y),
            "width": block_width,
            "height": block_height,
        }
    return blocks


def _generated_xy(ticket: Ticket, zone: SeatZone | None, block: dict[str, float] | None) -> tuple[float | None, float | None]:
    if ticket.x_coord is not None and ticket.y_coord is not None:
        return float(ticket.x_coord), float(ticket.y_coord)
    if block is None:
        return None, None

    seats_per_row = max(int(zone.seats_per_row if zone else ticket.seat_number or 1), int(ticket.seat_number or 1), 1)
    seat_number = max(int(ticket.seat_number or 1), 1)
    usable_width = block["width"] * 0.82
    usable_height = block["height"] * 0.74
    left = block["left"] + (block["width"] - usable_width) / 2
    top = block["top"] + (block["height"] - usable_height) / 2
    x = left + ((seat_number - 0.5) / seats_per_row) * usable_width
    y = top + (0.5 * usable_height)
    return round(max(0.0, min(100.0, x)), 2), round(max(0.0, min(100.0, y)), 2)


async def get_seatmap(
    session: AsyncSession,
    show_id: int,
    current_user_id: int | None = None,
) -> dict[str, Any]:
    show = await _get_show_or_404(session, show_id)
    await sync_show_ticket_inventory(session, show)

    event = await session.get(Event, show.event_id)
    venue: Venue | None = None
    layout: VenueLayout | None = None
    if show.venue_layout_id:
        layout = await session.get(VenueLayout, show.venue_layout_id)
        if layout:
            venue = await session.get(Venue, layout.venue_id)

    zones = list(await session.scalars(select(SeatZone).where(SeatZone.show_id == show.id).order_by(SeatZone.id.asc())))
    zone_map = {
        zone.id: {
            "id": zone.id,
            "name": zone.name,
            "code": zone.code,
            "color": zone.color,
            "price": float(zone.price),
        }
        for zone in zones
    }
    zone_lookup = {zone.id: zone for zone in zones}
    zone_blocks = _zone_block_map(zones)

    tickets = list(
        await session.scalars(
            select(Ticket)
            .where(Ticket.show_id == show_id)
            .order_by(Ticket.ticket_tier_id.asc(), Ticket.seat_label.asc(), Ticket.id.asc())
        )
    )
    seat_ids = [ticket.seat_id for ticket in tickets if ticket.seat_id is not None]
    seat_map = {
        seat.id: seat
        for seat in (
            list(await session.scalars(select(Seat).where(Seat.id.in_(seat_ids))))
            if seat_ids
            else []
        )
    }
    now = datetime.now(timezone.utc)
    section_map: dict[int, Section] = {}
    if show.venue_layout_id:
        sections = list(await session.scalars(select(Section).where(Section.venue_layout_id == show.venue_layout_id)))
        section_map = {section.id: section for section in sections}

    seat_responses = []
    for ticket in tickets:
        normalized_status = SeatStatus.LOCKED if ticket.is_admin_locked and ticket.status != SeatStatus.SOLD else ticket.status
        lock_expires = _as_utc(ticket.lock_expires_at)
        if ticket.status == SeatStatus.LOCKED and lock_expires and lock_expires < now:
            normalized_status = SeatStatus.AVAILABLE

        seat = seat_map.get(ticket.seat_id) if ticket.seat_id is not None else None

        zone_info = zone_map.get(ticket.ticket_tier_id or -1)
        generated_x, generated_y = _generated_xy(
            ticket,
            zone_lookup.get(ticket.ticket_tier_id or -1),
            zone_blocks.get(ticket.ticket_tier_id or -1),
        )
        seat_responses.append(
            {
                "id": ticket.id,
                "label": ticket.seat_label or (seat.seat_label if seat else None),
                "x": generated_x,
                "y": generated_y,
                "rotation": float(seat.rotation) if seat and seat.rotation is not None else 0,
                "zone_id": ticket.ticket_tier_id,
                "zone_name": zone_info.get("name") if zone_info else None,
                "section_id": seat.section_id if seat else None,
                "section_name": section_map.get(seat.section_id).name if seat and seat.section_id in section_map else None,
                "price": float(ticket.price),
                "status": normalized_status.value,
                "lock_expires_at": ticket.lock_expires_at.isoformat() if ticket.lock_expires_at else None,
                "is_locked_by_me": current_user_id is not None and ticket.locked_by_user_id == current_user_id,
                "is_admin_locked": ticket.is_admin_locked,
            }
        )

    polygon_responses = []
    if venue and show.venue_layout_id:
        polygons = list(
            await session.scalars(
                select(Polygon)
                .where(Polygon.venue_id == venue.id, Polygon.venue_layout_id == show.venue_layout_id)
                .order_by(Polygon.id.asc())
            )
        )
        for polygon in polygons:
            section = section_map.get(polygon.section_id or -1)
            polygon_responses.append(
                {
                    "id": polygon.id,
                    "zone_id": None,
                    "zone_name": section.name if section else None,
                    "section_id": polygon.section_id,
                    "section_name": section.name if section else None,
                    "label": polygon.label,
                    "points": polygon.points,
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
        "zones": [zone_map[zone.id] for zone in zones],
        "polygons": polygon_responses,
        "seats": seat_responses,
        "seat_count": len(tickets),
    }
