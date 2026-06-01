"""Core event, show, and ticket-inventory services aligned with the current schema."""

from __future__ import annotations

import re
import unicodedata
from collections import defaultdict
from datetime import date, datetime, time, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import EventCategory, EventStatus, SeatSource, SeatStatus
from app.models.event import Event, EventAssignment, SeatZone, Show
from app.models.order import Order, Ticket
from app.models.performer import Performer, ShowPerformer
from app.models.seat import Seat
from app.models.user import User
from app.models.venue import Venue, VenueLayout


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower()
    return slug or "event"


def combine_show_datetime(show_date: date, show_time: time) -> datetime:
    return datetime.combine(show_date, show_time, tzinfo=timezone.utc)


async def build_unique_slug(session: AsyncSession, title: str, *, exclude_event_id: int | None = None) -> str:
    base_slug = slugify(title)
    candidate = base_slug
    suffix = 2
    while True:
        stmt = select(Event.id).where(Event.slug == candidate)
        if exclude_event_id is not None:
            stmt = stmt.where(Event.id != exclude_event_id)
        existing = await session.scalar(stmt)
        if existing is None:
            return candidate
        candidate = f"{base_slug}-{suffix}"
        suffix += 1


async def create_event(session: AsyncSession, staff_user_id: int, payload) -> Event:
    event = Event(
        slug=await build_unique_slug(session, payload.title),
        title=payload.title,
        description=payload.description,
        category=EventCategory(payload.category),
        cover_image_url=payload.cover_image_url or "",
        start_date=payload.start_date,
        end_date=payload.end_date,
        status=EventStatus(payload.status),
        created_by_staff_id=staff_user_id,
    )
    session.add(event)
    await session.flush()
    session.add(EventAssignment(event_id=event.id, staff_id=staff_user_id, is_active=True))
    await session.flush()
    return event


async def _get_layout(session: AsyncSession, venue_layout_id: int | None) -> VenueLayout | None:
    if venue_layout_id is None:
        return None
    layout = await session.get(VenueLayout, venue_layout_id)
    if not layout:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay bo cuc dia diem")
    return layout


async def create_show_with_inventory(session: AsyncSession, event: Event, staff_user_id: int, payload) -> Show:
    if payload.show_date < event.start_date or payload.show_date > event.end_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ngay dien phai nam trong khoang ngay cua su kien")

    start_at = combine_show_datetime(payload.show_date, payload.start_time)
    end_at = combine_show_datetime(payload.show_date, payload.end_time)
    if end_at <= start_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Gio ket thuc phai sau gio bat dau")

    if payload.seat_source == SeatSource.LAYOUT and payload.venue_layout_id is None and not payload.zones:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Show dung layout phai co venue_layout_id")

    await _get_layout(session, payload.venue_layout_id)

    show = Show(
        event_id=event.id,
        title=payload.title,
        description=payload.description,
        location=payload.location,
        start_at=start_at,
        end_at=end_at,
        status=EventStatus(payload.status),
        seat_source=SeatSource(payload.seat_source),
        hold_minutes=payload.hold_minutes,
        created_by_staff_id=staff_user_id,
        venue_layout_id=payload.venue_layout_id,
    )
    session.add(show)
    await session.flush()

    created_zone_pairs: list[tuple[SeatZone, object]] = []
    for zone_payload in payload.zones:
        zone = SeatZone(
            show_id=show.id,
            code=zone_payload.code,
            name=zone_payload.name,
            description=zone_payload.description,
            base_price=zone_payload.base_price,
            color=zone_payload.color,
            is_active=zone_payload.is_active,
        )
        session.add(zone)
        created_zone_pairs.append((zone, zone_payload))
    await session.flush()

    await sync_show_ticket_inventory(session, show)
    return show


async def list_event_shows(
    session: AsyncSession,
    event_id: int,
    *,
    live_only: bool = False,
    include_deleted: bool = False,
) -> list[Show]:
    stmt = select(Show).where(Show.event_id == event_id)
    if not include_deleted:
        stmt = stmt.where(Show.is_deleted.is_(False))
    if live_only:
        stmt = stmt.where(Show.status == EventStatus.LIVE)
    stmt = stmt.order_by(Show.start_at.asc(), Show.id.asc())
    return list(await session.scalars(stmt))


async def list_shows_for_event_ids(
    session: AsyncSession,
    event_ids: list[int],
    *,
    live_only: bool = False,
    include_deleted: bool = False,
) -> dict[int, list[Show]]:
    if not event_ids:
        return {}

    stmt = select(Show).where(Show.event_id.in_(event_ids))
    if not include_deleted:
        stmt = stmt.where(Show.is_deleted.is_(False))
    if live_only:
        stmt = stmt.where(Show.status == EventStatus.LIVE)
    stmt = stmt.order_by(Show.event_id.asc(), Show.start_at.asc(), Show.id.asc())

    grouped: dict[int, list[Show]] = defaultdict(list)
    for show in await session.scalars(stmt):
        grouped[show.event_id].append(show)
    return dict(grouped)


async def list_event_max_prices_for_event_ids(
    session: AsyncSession,
    event_ids: list[int],
    *,
    live_only: bool = False,
) -> dict[int, float]:
    if not event_ids:
        return {}

    stmt = (
        select(Show.event_id, func.max(Ticket.price).label("max_price"))
        .select_from(Show)
        .outerjoin(Ticket, Ticket.show_id == Show.id)
        .where(Show.event_id.in_(event_ids), Show.is_deleted.is_(False))
        .group_by(Show.event_id)
    )
    if live_only:
        stmt = stmt.where(Show.status == EventStatus.LIVE)

    rows = (await session.execute(stmt)).all()
    return {int(row.event_id): float(row.max_price or 0) for row in rows if row.event_id is not None}


async def get_event_by_slug_or_id(session: AsyncSession, event_key: str) -> Event:
    stmt = select(Event).where(Event.is_deleted.is_(False))
    if event_key.isdigit():
        stmt = stmt.where(Event.id == int(event_key))
    else:
        stmt = stmt.where(Event.slug == event_key)
    event = await session.scalar(stmt)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay su kien")
    return event


async def get_show_by_id(session: AsyncSession, show_id: int) -> Show:
    show = await session.scalar(select(Show).where(Show.id == show_id, Show.is_deleted.is_(False)))
    if not show:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay buoi dien")
    return show


async def list_show_zones(session: AsyncSession, show_id: int) -> list[SeatZone]:
    return list(await session.scalars(select(SeatZone).where(SeatZone.show_id == show_id).order_by(SeatZone.id.asc())))


async def create_show_zone(session: AsyncSession, show: Show, payload) -> SeatZone:
    zone = SeatZone(
        show_id=show.id,
        code=payload.code,
        name=payload.name,
        description=payload.description,
        base_price=payload.base_price,
        color=payload.color,
        is_active=payload.is_active,
    )
    session.add(zone)
    await session.flush()
    await sync_show_ticket_inventory(session, show)
    return zone


async def update_show_zone(session: AsyncSession, show: Show, zone_id: int, payload) -> SeatZone:
    zone = await session.scalar(select(SeatZone).where(SeatZone.id == zone_id, SeatZone.show_id == show.id))
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay hang ve cua buoi dien")

    zone.code = payload.code
    zone.name = payload.name
    zone.description = payload.description
    zone.base_price = payload.base_price
    zone.color = payload.color
    zone.is_active = payload.is_active
    await session.flush()

    tickets = list(
        await session.scalars(
            select(Ticket).where(
                Ticket.show_id == show.id,
                Ticket.ticket_tier_id == zone.id,
                Ticket.status != SeatStatus.SOLD,
            )
        )
    )
    for ticket in tickets:
        ticket.price = float(zone.base_price)
    await session.flush()
    return zone


async def delete_show_zone(session: AsyncSession, show: Show, zone_id: int) -> None:
    zone = await session.scalar(select(SeatZone).where(SeatZone.id == zone_id, SeatZone.show_id == show.id))
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay hang ve cua buoi dien")
    sold_count = await session.scalar(
        select(func.count(Ticket.id)).where(
            Ticket.show_id == show.id,
            Ticket.ticket_tier_id == zone.id,
            Ticket.status == SeatStatus.SOLD,
        )
    )
    if sold_count:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Khong the xoa hang ve da phat sinh ve ban")

    replacement_zone = await session.scalar(
        select(SeatZone).where(SeatZone.show_id == show.id, SeatZone.id != zone.id).order_by(SeatZone.id.asc())
    )
    tickets = list(await session.scalars(select(Ticket).where(Ticket.show_id == show.id, Ticket.ticket_tier_id == zone.id)))
    for ticket in tickets:
        ticket.ticket_tier_id = replacement_zone.id if replacement_zone else None
        if replacement_zone and ticket.status != SeatStatus.SOLD:
            ticket.price = float(replacement_zone.base_price)
    await session.delete(zone)
    await session.flush()


async def list_live_events(
    session: AsyncSession,
    *,
    search: str | None = None,
    category: str | None = None,
    start_from: datetime | None = None,
    end_to: datetime | None = None,
    limit: int = 30,
    offset: int = 0,
    include_unpublished: bool = False,
    staff_id: int | None = None,
) -> list[Event]:
    stmt = select(Event).where(Event.is_deleted.is_(False))
    if staff_id is not None:
        stmt = stmt.where(
            Event.assignments.any(
                and_(
                    EventAssignment.staff_id == staff_id,
                    EventAssignment.is_active.is_(True),
                )
            )
        )
    if not include_unpublished:
        stmt = stmt.where(Event.status == EventStatus.LIVE)
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(or_(Event.title.ilike(pattern), Event.description.ilike(pattern)))
    if category:
        stmt = stmt.where(Event.category == EventCategory(category.strip().upper()))
    if start_from:
        stmt = stmt.where(Event.end_date >= start_from.date())
    if end_to:
        stmt = stmt.where(Event.start_date <= end_to.date())
    stmt = stmt.order_by(Event.start_date.asc(), Event.id.asc()).limit(limit).offset(offset)
    return list(await session.scalars(stmt))


async def _list_show_performers_by_show_ids(session: AsyncSession, show_ids: list[int]) -> dict[int, list[dict]]:
    if not show_ids:
        return {}
    stmt = (
        select(ShowPerformer, Performer)
        .join(Performer, Performer.id == ShowPerformer.performer_id)
        .where(ShowPerformer.show_id.in_(show_ids))
        .order_by(ShowPerformer.show_id.asc(), ShowPerformer.sort_order.asc(), ShowPerformer.id.asc())
    )
    grouped: dict[int, list[dict]] = defaultdict(list)
    for link, performer in (await session.execute(stmt)).all():
        grouped[link.show_id].append(
            {
                "performer_id": performer.id,
                "stage_name": performer.stage_name,
                "artist_type": performer.artist_type,
                "image_url": performer.image_url,
                "role": link.role,
                "sort_order": link.sort_order,
            }
        )
    return dict(grouped)


async def build_show_summary_response(session: AsyncSession, show: Show, performers: list[dict] | None = None) -> dict:
    if performers is None:
        performers = (await _list_show_performers_by_show_ids(session, [show.id])).get(show.id, [])
    performers = [item for item in performers if item.get("role") in {"MAIN", "GUEST"}]
    return {
        "id": show.id,
        "event_id": show.event_id,
        "title": show.title,
        "description": show.description,
        "location": show.location,
        "start_at": show.start_at,
        "end_at": show.end_at,
        "status": show.status,
        "seat_source": show.seat_source,
        "performers": performers,
        "venue_layout_id": show.venue_layout_id,
        "cancelled_at": show.cancelled_at,
        "cancelled_by_staff_id": show.cancelled_by_staff_id,
        "cancellation_reason": show.cancellation_reason,
    }


async def build_event_card_response(
    session: AsyncSession,
    event: Event,
    *,
    shows: list[Show] | None = None,
    max_price: float | None = None,
) -> dict:
    shows = shows if shows is not None else await list_event_shows(session, event.id, live_only=event.status == EventStatus.LIVE)
    first_show = min(shows, key=lambda item: item.start_at, default=None)
    if max_price is None:
        max_price = (await list_event_max_prices_for_event_ids(session, [event.id])).get(event.id, 0)
    return {
        "id": event.id,
        "slug": event.slug,
        "title": event.title,
        "description": event.description,
        "category": event.category,
        "venue": first_show.location if first_show else "",
        "start_at": event.start_at,
        "end_at": event.end_at,
        "cover_image_url": event.cover_image_url,
        "status": event.status,
        "created_at": event.created_at,
        "max_price": float(max_price or 0),
    }


async def build_event_detail_response(
    session: AsyncSession,
    event: Event,
    *,
    include_unpublished_shows: bool = False,
) -> dict:
    shows = await list_event_shows(session, event.id, live_only=not include_unpublished_shows)
    performers_by_show_id = await _list_show_performers_by_show_ids(session, [show.id for show in shows])
    card = await build_event_card_response(session, event, shows=shows)
    card["shows"] = [
        await build_show_summary_response(session, show, performers=performers_by_show_id.get(show.id, []))
        for show in shows
    ]
    return card


async def build_show_detail_response(session: AsyncSession, show: Show) -> dict:
    event = await get_event_by_slug_or_id(session, str(show.event_id))
    summary = await build_show_summary_response(session, show)
    summary.update(
        {
            "event_slug": event.slug,
            "event_title": event.title,
            "hold_minutes": show.hold_minutes,
            "zones": [
                {
                    "id": zone.id,
                    "code": zone.code,
                    "name": zone.name,
                    "description": zone.description,
                    "base_price": Decimal(str(zone.base_price)),
                    "color": zone.color,
                    "is_active": zone.is_active,
                }
                for zone in await list_show_zones(session, show.id)
            ],
        }
    )
    return summary


async def sync_show_ticket_inventory(session: AsyncSession, show: Show) -> None:
    await session.flush()
    zones = await list_show_zones(session, show.id)
    default_zone = zones[0] if zones else None

    if show.seat_source == SeatSource.LAYOUT:
        if show.venue_layout_id is None:
            return

        layout_seats = list(
            await session.scalars(
                select(Seat).where(Seat.venue_layout_id == show.venue_layout_id, Seat.is_active.is_(True)).order_by(Seat.id.asc())
            )
        )
        existing_tickets = list(await session.scalars(select(Ticket).where(Ticket.show_id == show.id).order_by(Ticket.id.asc())))
        ticket_by_seat_id = {ticket.seat_id: ticket for ticket in existing_tickets if ticket.seat_id is not None}
        valid_seat_ids = {seat.id for seat in layout_seats}

        for ticket in existing_tickets:
            if ticket.seat_id is not None and ticket.seat_id not in valid_seat_ids and ticket.status != SeatStatus.SOLD:
                await session.delete(ticket)

        for seat in layout_seats:
            ticket = ticket_by_seat_id.get(seat.id)
            if not ticket:
                ticket = Ticket(
                    show_id=show.id,
                    ticket_tier_id=default_zone.id if default_zone else None,
                    seat_id=seat.id,
                    label=seat.label,
                    row_label=seat.row_label,
                    seat_number=seat.seat_number,
                    x=seat.x,
                    y=seat.y,
                    price=float(default_zone.base_price) if default_zone else 0,
                    status=SeatStatus.AVAILABLE,
                    is_staff_locked=False,
                )
                session.add(ticket)
                continue

            if ticket.status != SeatStatus.SOLD:
                ticket.label = seat.label
                ticket.row_label = seat.row_label
                ticket.seat_number = seat.seat_number
                ticket.x = seat.x
                ticket.y = seat.y
                if ticket.ticket_tier_id is None and default_zone:
                    ticket.ticket_tier_id = default_zone.id
                if ticket.ticket_tier_id == (default_zone.id if default_zone else None):
                    ticket.price = float(default_zone.base_price) if default_zone else ticket.price
        await session.flush()
        return

    existing_tickets = list(await session.scalars(select(Ticket).where(Ticket.show_id == show.id)))
    for ticket in existing_tickets:
        if ticket.ticket_tier_id is None and default_zone is not None:
            ticket.ticket_tier_id = default_zone.id
            if ticket.status != SeatStatus.SOLD:
                ticket.price = float(default_zone.base_price)
    await session.flush()


async def get_show_seat_matrix(
    session: AsyncSession,
    show_id: int,
    *,
    current_user_id: int | None = None,
    include_user_details: bool = False,
) -> tuple[list[dict], list[dict]]:
    show = await get_show_by_id(session, show_id)
    await sync_show_ticket_inventory(session, show)

    zones = await list_show_zones(session, show.id)
    zone_map = {zone.id: zone for zone in zones}
    tickets = list(await session.scalars(select(Ticket).where(Ticket.show_id == show.id).order_by(Ticket.id.asc())))

    user_ids = {ticket.locked_by_customer_id for ticket in tickets if include_user_details and ticket.locked_by_customer_id is not None}
    order_ids = {ticket.order_id for ticket in tickets if include_user_details and ticket.order_id is not None}
    users_by_id = {
        user.id: user
        for user in (
            list(await session.scalars(select(User).where(User.id.in_(user_ids)))) if user_ids else []
        )
    }
    orders_by_id = {
        order.id: order
        for order in (
            list(await session.scalars(select(Order).where(Order.id.in_(order_ids)))) if order_ids else []
        )
    }

    zone_responses = [
        {
            "id": zone.id,
            "code": zone.code,
            "name": zone.name,
            "description": zone.description,
            "base_price": Decimal(str(zone.base_price)),
            "color": zone.color,
            "is_active": zone.is_active,
        }
        for zone in zones
    ]

    seat_responses: list[dict] = []
    now = datetime.now(timezone.utc)
    for ticket in tickets:
        lock_expires = ticket.lock_expires_at if ticket.lock_expires_at and ticket.lock_expires_at.tzinfo else (
            ticket.lock_expires_at.replace(tzinfo=timezone.utc) if ticket.lock_expires_at else None
        )
        normalized_status = ticket.status
        if normalized_status == SeatStatus.LOCKED and lock_expires and lock_expires < now:
            normalized_status = SeatStatus.AVAILABLE
        if ticket.is_staff_locked and normalized_status != SeatStatus.SOLD:
            normalized_status = SeatStatus.LOCKED

        locked_by_user = None
        sold_to_user = None
        if include_user_details and ticket.locked_by_customer_id is not None:
            locked_user = users_by_id.get(ticket.locked_by_customer_id)
            if locked_user:
                locked_by_user = {
                    "user_id": locked_user.id,
                    "full_name": locked_user.full_name,
                    "email": locked_user.email,
                    "gender": locked_user.gender,
                    "age": locked_user.age,
                }
        if include_user_details and ticket.order_id is not None:
            order = orders_by_id.get(ticket.order_id)
            if order:
                order_user = users_by_id.get(order.customer_id)
                if order_user:
                    sold_to_user = {
                        "user": {
                            "user_id": order_user.id,
                            "full_name": order_user.full_name,
                            "email": order_user.email,
                            "gender": order_user.gender,
                            "age": order_user.age,
                        },
                        "order_id": order.id,
                        "ticket_code": ticket.ticket_code,
                        "issued_at": ticket.issued_at,
                    }

        seat_responses.append(
            {
                "id": ticket.id,
                "zone_id": ticket.ticket_tier_id,
                "row_index": 0,
                "row_label": ticket.row_label or "",
                "seat_number": ticket.seat_number or 0,
                "seat_label": ticket.seat_label or f"Ticket #{ticket.id}",
                "price": Decimal(str(ticket.price)),
                "status": normalized_status,
                "lock_expires_at": ticket.lock_expires_at,
                "is_locked_by_me": current_user_id is not None and ticket.locked_by_customer_id == current_user_id,
                "is_admin_locked": ticket.is_staff_locked,
                "locked_by_user": locked_by_user,
                "sold_to_user": sold_to_user,
            }
        )

    return zone_responses, seat_responses
