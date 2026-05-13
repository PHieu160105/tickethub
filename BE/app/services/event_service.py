"""Event/show business logic and seat matrix generation."""

from collections import defaultdict
from datetime import UTC, date, datetime, time
from decimal import Decimal
import re

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.search import build_ilike_pattern, sanitize_search_query
from app.models.enums import SeatStatus
from app.models.event import Event, SeatZone, Show, ShowPolygon
from app.models.order import Order, OrderItem, Ticket
from app.models.seat import Seat
from app.models.user import User
from app.models.venue import Polygon, Section, Venue, VenueLayout
from app.schemas.event import (
    EventCardResponse,
    EventCreateRequest,
    EventDetailResponse,
    SeatPurchaseInfoResponse,
    SeatResponse,
    SeatUserInfoResponse,
    SeatZoneCreate,
    SeatZoneUpdate,
    SeatZoneResponse,
    ShowCreateRequest,
    ShowSummaryResponse,
)


def slugify(text: str) -> str:
    """Generate URL-friendly slug from title."""

    value = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return value or "event"


def row_label_from_index(index: int) -> str:
    """Convert 1-based index to spreadsheet-style row label (A..Z, AA..)."""

    label = ""
    value = index
    while value > 0:
        value, remainder = divmod(value - 1, 26)
        label = chr(65 + remainder) + label
    return label


def combine_show_datetime(show_date: date, show_time: time) -> datetime:
    """Combine date and time into a UTC-aware datetime."""

    return datetime.combine(show_date, show_time, tzinfo=UTC)


def _as_utc(value: datetime | None) -> datetime | None:
    """Normalize naive datetimes from DB layer to UTC-aware values."""

    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def _event_range_to_datetimes(start_date: date, end_date: date) -> tuple[datetime, datetime]:
    """Create synthetic UTC datetimes for event list/detail responses."""

    return (
        datetime.combine(start_date, time.min, tzinfo=UTC),
        datetime.combine(end_date, time.max, tzinfo=UTC),
    )


def _build_zone_seats(event_id: int, show_id: int, zone: SeatZone, payload: SeatZoneCreate) -> list[Seat]:
    """Generate full seat matrix models for one zone payload."""

    seat_models: list[Seat] = []
    for row_index in range(1, payload.row_count + 1):
        row_label = row_label_from_index(row_index)
        for seat_number in range(1, payload.seats_per_row + 1):
            seat_label = f"{payload.code}-{row_label}{seat_number}"
            seat_models.append(
                Seat(
                    event_id=event_id,
                    show_id=show_id,
                    zone_id=zone.id,
                    row_index=row_index,
                    row_label=row_label,
                    seat_number=seat_number,
                    seat_label=seat_label,
                    price=payload.price,
                    status=SeatStatus.AVAILABLE,
                )
            )
    return seat_models


def _build_positioned_zone_seats(
    event_id: int,
    show_id: int,
    zone: SeatZone,
    payload: SeatZoneCreate,
    *,
    start_x: float,
    start_y: float,
    gap_x: float,
    gap_y: float,
) -> list[Seat]:
    """Generate a seat grid with explicit coordinates for free-form planner bootstrapping."""

    seat_models: list[Seat] = []
    for row_index in range(1, payload.row_count + 1):
        row_label = row_label_from_index(row_index)
        for seat_number in range(1, payload.seats_per_row + 1):
            seat_label = f"{payload.code}-{row_label}{seat_number}"
            seat_models.append(
                Seat(
                    event_id=event_id,
                    show_id=show_id,
                    zone_id=zone.id,
                    row_index=row_index,
                    row_label=row_label,
                    seat_number=seat_number,
                    seat_label=seat_label,
                    price=payload.price,
                    status=SeatStatus.AVAILABLE,
                    x_coord=round(start_x + (seat_number - 1) * gap_x, 2),
                    y_coord=round(start_y + (row_index - 1) * gap_y, 2),
                    rotation=0.0,
                )
            )
    return seat_models


def _build_zone_boundary_polygon(zone: SeatZone, seats: list[Seat], *, padding: float, label: str | None = None) -> ShowPolygon:
    """Create a rectangular polygon around one zone's seeded seats."""

    if not seats:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot build boundary polygon without seats")

    x_values = [float(seat.x_coord) for seat in seats if seat.x_coord is not None]
    y_values = [float(seat.y_coord) for seat in seats if seat.y_coord is not None]
    if not x_values or not y_values:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot build boundary polygon without explicit seat coordinates")

    left = max(0.0, round(min(x_values) - padding, 2))
    top = max(0.0, round(min(y_values) - padding, 2))
    right = min(100.0, round(max(x_values) + padding, 2))
    bottom = min(100.0, round(max(y_values) + padding, 2))
    return ShowPolygon(
        show_id=zone.show_id or 0,
        zone_id=zone.id,
        label=label,
        points=[
            {"x": left, "y": top},
            {"x": right, "y": top},
            {"x": right, "y": bottom},
            {"x": left, "y": bottom},
        ],
    )


async def build_unique_slug(session: AsyncSession, title: str) -> str:
    """Create unique slug by appending numeric suffix if needed."""

    base_slug = slugify(title)
    existing = await session.scalar(select(func.count(Event.id)).where(Event.slug == base_slug))
    if existing == 0:
        return base_slug

    suffix = 2
    while True:
        candidate = f"{base_slug}-{suffix}"
        exists_candidate = await session.scalar(select(func.count(Event.id)).where(Event.slug == candidate))
        if exists_candidate == 0:
            return candidate
        suffix += 1


async def _resolve_event_layout(
    session: AsyncSession,
    venue_id: int | None,
    venue_layout_id: int | None,
) -> tuple[Venue | None, VenueLayout | None]:
    """Resolve venue + layout pair, validating ownership."""

    if venue_layout_id is None:
        if venue_id is None:
            return None, None
        venue = await session.get(Venue, venue_id)
        if not venue:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venue not found")
        return venue, None

    layout = await session.get(VenueLayout, venue_layout_id)
    if not layout:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venue layout not found")
    if venue_id is not None and layout.venue_id != venue_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="venue_layout_id does not belong to venue_id")

    venue = await session.get(Venue, layout.venue_id)
    if not venue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venue not found")
    return venue, layout


async def create_event(session: AsyncSession, admin_id: int, payload: EventCreateRequest) -> Event:
    """Create a parent event without sellable inventory."""

    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_date must be on or after start_date")

    start_at_legacy, end_at_legacy = _event_range_to_datetimes(payload.start_date, payload.end_date)
    event = Event(
        slug=await build_unique_slug(session, payload.title),
        title=payload.title,
        description=payload.description,
        category=payload.category,
        cover_image_url=payload.cover_image_url,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status=payload.status,
        created_by_user_id=admin_id,
        venue="",
        start_at_legacy=start_at_legacy,
        end_at_legacy=end_at_legacy,
    )
    session.add(event)
    await session.flush()
    return event


async def _clone_layout_inventory(session: AsyncSession, event: Event, show: Show, layout: VenueLayout) -> None:
    """Clone venue template sections/seats into a sellable show inventory."""

    sections = list(
        await session.scalars(
            select(Section).where(Section.venue_layout_id == layout.id).order_by(Section.sort_order.asc(), Section.id.asc())
        )
    )
    template_seats = list(
        await session.scalars(
            select(Seat)
            .where(Seat.venue_layout_id == layout.id, Seat.show_id.is_(None))
            .order_by(Seat.section_id.asc().nulls_last(), Seat.seat_label.asc())
        )
    )
    template_polygons = list(
        await session.scalars(
            select(Polygon)
            .where(Polygon.venue_layout_id == layout.id)
            .order_by(Polygon.id.asc())
        )
    )

    zone_map: dict[int | None, SeatZone] = {}
    if sections:
        for section in sections:
            zone = SeatZone(
                event_id=event.id,
                show_id=show.id,
                code=section.code,
                name=section.name,
                row_count=1,
                seats_per_row=1,
                price=section.price_base,
                color=section.color,
            )
            session.add(zone)
            await session.flush()
            zone_map[section.id] = zone
    elif template_seats:
        fallback_zone = SeatZone(
            event_id=event.id,
            show_id=show.id,
            code="GEN",
            name="General",
            row_count=1,
            seats_per_row=max(len(template_seats), 1),
            price=Decimal("0"),
            color="#024ddf",
        )
        session.add(fallback_zone)
        await session.flush()
        zone_map[None] = fallback_zone

    cloned_seats: list[Seat] = []
    for template_seat in template_seats:
        zone = zone_map.get(template_seat.section_id) or zone_map.get(None)
        price = float(zone.price) if zone else float(template_seat.price)
        cloned_seats.append(
            Seat(
                event_id=event.id,
                show_id=show.id,
                zone_id=zone.id if zone else None,
                row_index=template_seat.row_index,
                row_label=template_seat.row_label,
                seat_number=template_seat.seat_number,
                seat_label=template_seat.seat_label,
                price=price,
                status=SeatStatus.AVAILABLE,
                x_coord=template_seat.x_coord,
                y_coord=template_seat.y_coord,
                rotation=template_seat.rotation,
                section_id=template_seat.section_id,
                venue_layout_id=template_seat.venue_layout_id,
                is_admin_locked=template_seat.is_admin_locked,
            )
        )

    if cloned_seats:
        session.add_all(cloned_seats)
        await session.flush()

    cloned_polygons: list[ShowPolygon] = []
    for template_polygon in template_polygons:
        zone = zone_map.get(template_polygon.section_id) or zone_map.get(None)
        cloned_polygons.append(
            ShowPolygon(
                show_id=show.id,
                zone_id=zone.id if zone else None,
                label=template_polygon.label,
                points=template_polygon.points,
            )
        )

    if cloned_polygons:
        session.add_all(cloned_polygons)
        await session.flush()


async def create_show_with_inventory(session: AsyncSession, event: Event, admin_id: int, payload: ShowCreateRequest) -> Show:
    """Create a sellable show and initialize its seats."""

    if payload.show_date < event.start_date or payload.show_date > event.end_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="show_date must be within the event date range")

    start_at = combine_show_datetime(payload.show_date, payload.start_time)
    end_at = combine_show_datetime(payload.show_date, payload.end_time)
    if end_at <= start_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_time must be later than start_time")

    venue, layout = await _resolve_event_layout(session, payload.venue_id, payload.venue_layout_id)
    show = Show(
        event_id=event.id,
        title=payload.title,
        description=payload.description,
        venue=payload.venue if payload.venue else (venue.name if venue else ""),
        start_at=start_at,
        end_at=end_at,
        status=payload.status,
        hold_minutes=payload.hold_minutes,
        queue_enabled=payload.queue_enabled,
        queue_release_batch=payload.queue_release_batch,
        max_active_queue_tokens=payload.max_active_queue_tokens,
        created_by_user_id=admin_id,
        venue_id=venue.id if venue else None,
        venue_layout_id=layout.id if layout else None,
    )
    session.add(show)
    await session.flush()

    if layout:
        await _clone_layout_inventory(session, event, show, layout)
        return show

    seat_models: list[Seat] = []
    for zone_payload in payload.zones:
        zone = SeatZone(
            event_id=event.id,
            show_id=show.id,
            code=zone_payload.code,
            name=zone_payload.name,
            row_count=zone_payload.row_count,
            seats_per_row=zone_payload.seats_per_row,
            price=zone_payload.price,
            color=zone_payload.color,
        )
        session.add(zone)
        await session.flush()
        if zone_payload.generate_seats:
            seat_models.extend(_build_zone_seats(event.id, show.id, zone, zone_payload))

    if seat_models:
        session.add_all(seat_models)
        await session.flush()
    return show


async def list_event_shows(session: AsyncSession, event_id: int, include_deleted: bool = False) -> list[Show]:
    """List child shows for one event."""

    stmt = select(Show).where(Show.event_id == event_id)
    if not include_deleted:
        stmt = stmt.where(Show.is_deleted.is_(False))
    stmt = stmt.order_by(Show.start_at.asc(), Show.id.asc())
    return list(await session.scalars(stmt))


async def list_shows_for_event_ids(
    session: AsyncSession,
    event_ids: list[int],
    *,
    include_deleted: bool = False,
) -> dict[int, list[Show]]:
    """Bulk-load child shows for many events to avoid per-event queries."""

    if not event_ids:
        return {}

    stmt = select(Show).where(Show.event_id.in_(event_ids))
    if not include_deleted:
        stmt = stmt.where(Show.is_deleted.is_(False))
    stmt = stmt.order_by(Show.event_id.asc(), Show.start_at.asc(), Show.id.asc())

    grouped: dict[int, list[Show]] = defaultdict(list)
    for show in await session.scalars(stmt):
        grouped[show.event_id].append(show)
    return grouped


async def get_show_by_id(session: AsyncSession, show_id: int, include_deleted: bool = False) -> Show:
    """Resolve show by numeric id."""

    stmt = select(Show).where(Show.id == show_id)
    if not include_deleted:
        stmt = stmt.where(Show.is_deleted.is_(False))
    show = await session.scalar(stmt)
    if not show:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Show not found")
    return show


async def list_show_zones(session: AsyncSession, show_id: int) -> list[SeatZone]:
    """List all zones of a show by stable ordering."""

    return list(await session.scalars(select(SeatZone).where(SeatZone.show_id == show_id).order_by(SeatZone.id.asc())))


async def create_show_zone(session: AsyncSession, show: Show, payload: SeatZoneCreate) -> SeatZone:
    """Create one zone and optionally seed seats for it."""

    existing = await session.scalar(
        select(func.count(SeatZone.id)).where(SeatZone.show_id == show.id, func.lower(SeatZone.code) == payload.code.lower())
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Zone code already exists in this show")

    zone = SeatZone(
        event_id=show.event_id,
        show_id=show.id,
        code=payload.code,
        name=payload.name,
        row_count=payload.row_count,
        seats_per_row=payload.seats_per_row,
        price=payload.price,
        color=payload.color,
    )
    session.add(zone)
    await session.flush()

    if payload.generate_seats:
        session.add_all(_build_zone_seats(show.event_id, show.id, zone, payload))
        await session.flush()
    return zone


async def create_initial_show_zone(session: AsyncSession, show: Show, payload: SeatZoneCreate) -> SeatZone:
    """Create one free-form helper zone with seeded seats and one boundary polygon."""

    if show.venue_layout_id is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Initial helper zone is only available for free-form shows")

    start_x = 20.0
    start_y = 20.0
    gap_x = 3.0
    gap_y = 3.0
    padding = 1.0

    max_x = start_x + (payload.seats_per_row - 1) * gap_x
    max_y = start_y + (payload.row_count - 1) * gap_y
    if max_x + padding > 100.0 or max_y + padding > 100.0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Initial helper zone exceeds the canvas bounds with the current rows and seats per row",
        )

    zone = await create_show_zone(session, show, SeatZoneCreate(**payload.model_dump(), generate_seats=False))
    seats = _build_positioned_zone_seats(
        show.event_id,
        show.id,
        zone,
        payload,
        start_x=start_x,
        start_y=start_y,
        gap_x=gap_x,
        gap_y=gap_y,
    )
    if seats:
        session.add_all(seats)
        await session.flush()
        session.add(_build_zone_boundary_polygon(zone, seats, padding=padding, label=zone.name))
        await session.flush()
    return zone


async def update_show_zone(session: AsyncSession, show: Show, zone_id: int, payload: SeatZoneUpdate) -> SeatZone:
    """Update one zone and optionally regenerate seats when safe."""

    zone = await session.scalar(select(SeatZone).where(SeatZone.id == zone_id, SeatZone.show_id == show.id))
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")

    duplicate = await session.scalar(
        select(func.count(SeatZone.id)).where(
            SeatZone.show_id == show.id,
            SeatZone.id != zone.id,
            func.lower(SeatZone.code) == payload.code.lower(),
        )
    )
    if duplicate:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Zone code already exists in this show")

    zone.code = payload.code
    zone.name = payload.name
    zone.row_count = payload.row_count
    zone.seats_per_row = payload.seats_per_row
    zone.price = payload.price
    zone.color = payload.color

    if not payload.regenerate_seats:
        return zone

    blocked = await session.scalar(
        select(func.count(Seat.id)).where(
            Seat.zone_id == zone.id,
            Seat.status.in_([SeatStatus.SOLD, SeatStatus.LOCKED]),
        )
    )
    if blocked:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot update zone while it has sold/locked seats")

    existing_seats = list(await session.scalars(select(Seat).where(Seat.zone_id == zone.id)))
    for seat in existing_seats:
        await session.delete(seat)
    await session.flush()

    session.add_all(
        _build_zone_seats(
            show.event_id,
            show.id,
            zone,
            SeatZoneCreate(**payload.model_dump(exclude={"regenerate_seats"}), generate_seats=True),
        )
    )
    await session.flush()
    return zone


async def delete_show_zone(session: AsyncSession, show: Show, zone_id: int) -> None:
    """Delete zone if it does not contain sold/locked seats."""

    zone = await session.scalar(select(SeatZone).where(SeatZone.id == zone_id, SeatZone.show_id == show.id))
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")

    blocked = await session.scalar(
        select(func.count(Seat.id)).where(
            Seat.zone_id == zone.id,
            Seat.status.in_([SeatStatus.SOLD, SeatStatus.LOCKED]),
        )
    )
    if blocked:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete zone while it has sold/locked seats")

    await session.delete(zone)
    await session.flush()


async def list_live_events(
    session: AsyncSession,
    search: str | None,
    category: str | None,
    start_from: datetime | None,
    end_to: datetime | None,
    limit: int = 30,
    offset: int = 0,
) -> list[Event]:
    """Return events with optional search/category/date filters."""

    stmt = select(Event).where(Event.is_deleted.is_(False)).order_by(Event.start_date.asc(), Event.id.asc())

    pattern = build_ilike_pattern(search)
    if pattern:
        stmt = stmt.where(Event.title.ilike(pattern, escape="\\"))

    if category:
        normalized_category = sanitize_search_query(category, max_length=80)
        if normalized_category:
            stmt = stmt.where(Event.category.ilike(normalized_category))

    if start_from:
        stmt = stmt.where(Event.start_date >= start_from.date())

    if end_to:
        stmt = stmt.where(Event.start_date <= end_to.date())

    stmt = stmt.limit(limit).offset(offset)
    return list(await session.scalars(stmt))


async def get_event_by_slug_or_id(session: AsyncSession, slug_or_id: str, include_deleted: bool = False) -> Event:
    """Resolve event by slug path segment or numeric id."""

    if slug_or_id.isdigit():
        stmt = select(Event).where(Event.id == int(slug_or_id))
    else:
        stmt = select(Event).where(Event.slug == slug_or_id)

    if not include_deleted:
        stmt = stmt.where(Event.is_deleted.is_(False))

    event = await session.scalar(stmt)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


async def build_show_summary_response(show: Show) -> ShowSummaryResponse:
    """Serialize one show for API responses."""

    return ShowSummaryResponse.model_validate(show)


async def build_event_card_response(session: AsyncSession, event: Event, shows: list[Show] | None = None) -> EventCardResponse:
    """Build one event card enriched by its child shows."""

    if shows is None:
        shows = await list_event_shows(session, event.id)

    start_at, end_at = _event_range_to_datetimes(event.start_date, event.end_date)
    distinct_venues = [show.venue for show in shows if show.venue]
    if not distinct_venues:
        venue_summary = event.venue or "TBD"
    elif len(set(distinct_venues)) == 1:
        venue_summary = distinct_venues[0]
    else:
        venue_summary = "Multiple venues"

    return EventCardResponse(
        id=event.id,
        slug=event.slug,
        title=event.title,
        description=event.description,
        category=event.category,
        venue=venue_summary,
        start_at=start_at,
        end_at=end_at,
        cover_image_url=event.cover_image_url,
        status=event.status,
        created_at=event.created_at,
        queue_enabled=any(show.queue_enabled for show in shows),
    )


async def build_event_detail_response(session: AsyncSession, event: Event) -> EventDetailResponse:
    """Build one detailed event payload with child shows."""

    shows = await list_event_shows(session, event.id)
    card = await build_event_card_response(session, event, shows=shows)
    return EventDetailResponse(**card.model_dump(), shows=[await build_show_summary_response(show) for show in shows])


async def build_show_detail_response(session: AsyncSession, show: Show) -> dict[str, object]:
    """Build one detailed show payload."""

    event = await session.get(Event, show.event_id)
    zones, _ = await get_show_seat_matrix(session, show.id)
    return {
        "id": show.id,
        "event_id": show.event_id,
        "title": show.title,
        "description": show.description,
        "venue": show.venue,
        "start_at": show.start_at,
        "end_at": show.end_at,
        "status": show.status,
        "queue_enabled": show.queue_enabled,
        "venue_id": show.venue_id,
        "venue_layout_id": show.venue_layout_id,
        "event_slug": event.slug if event else "",
        "event_title": event.title if event else "",
        "hold_minutes": show.hold_minutes,
        "queue_release_batch": show.queue_release_batch,
        "max_active_queue_tokens": show.max_active_queue_tokens,
        "zones": zones,
    }


async def get_show_seat_matrix(
    session: AsyncSession,
    show_id: int,
    current_user_id: int | None = None,
    include_user_details: bool = False,
) -> tuple[list[SeatZoneResponse], list[SeatResponse]]:
    """Fetch one show's seat matrix with lock ownership hints."""

    zones = list(await session.scalars(select(SeatZone).where(SeatZone.show_id == show_id).order_by(SeatZone.id.asc())))
    seats = list(await session.scalars(select(Seat).where(Seat.show_id == show_id).order_by(Seat.zone_id, Seat.row_index, Seat.seat_number)))

    now = datetime.now(UTC)
    zone_responses = [SeatZoneResponse.model_validate(zone) for zone in zones]
    seat_responses: list[SeatResponse] = []

    locked_user_map: dict[int, SeatUserInfoResponse] = {}
    sold_user_map: dict[int, SeatPurchaseInfoResponse] = {}

    if include_user_details and seats:
        locked_user_ids = {seat.locked_by_user_id for seat in seats if seat.locked_by_user_id is not None}
        if locked_user_ids:
            user_rows = (
                await session.execute(
                    select(User.id, User.full_name, User.email, User.gender, User.age).where(User.id.in_(locked_user_ids))
                )
            ).all()
            locked_user_map = {
                row.id: SeatUserInfoResponse(
                    user_id=row.id,
                    full_name=row.full_name,
                    email=row.email,
                    gender=row.gender,
                    age=row.age,
                )
                for row in user_rows
            }

        seat_ids = [seat.id for seat in seats]
        sold_rows = (
            await session.execute(
                select(
                    OrderItem.seat_id,
                    Order.id.label("order_id"),
                    User.id.label("user_id"),
                    User.full_name,
                    User.email,
                    User.gender,
                    User.age,
                    Ticket.ticket_code,
                    Ticket.issued_at,
                )
                .join(Order, OrderItem.order_id == Order.id)
                .join(User, Order.user_id == User.id)
                .outerjoin(Ticket, Ticket.order_item_id == OrderItem.id)
                .where(OrderItem.seat_id.in_(seat_ids))
            )
        ).all()

        sold_user_map = {
            row.seat_id: SeatPurchaseInfoResponse(
                user=SeatUserInfoResponse(
                    user_id=row.user_id,
                    full_name=row.full_name,
                    email=row.email,
                    gender=row.gender,
                    age=row.age,
                ),
                order_id=row.order_id,
                ticket_code=row.ticket_code,
                issued_at=_as_utc(row.issued_at),
            )
            for row in sold_rows
        }

    for seat in seats:
        normalized_status = SeatStatus.LOCKED if seat.is_admin_locked and seat.status != SeatStatus.SOLD else seat.status
        lock_expires = _as_utc(seat.lock_expires_at)
        if seat.status == SeatStatus.LOCKED and lock_expires and lock_expires < now:
            normalized_status = SeatStatus.AVAILABLE

        locked_by_user = None
        if include_user_details and normalized_status == SeatStatus.LOCKED and seat.locked_by_user_id is not None:
            locked_by_user = locked_user_map.get(seat.locked_by_user_id)

        sold_to_user = sold_user_map.get(seat.id) if include_user_details and seat.status == SeatStatus.SOLD else None

        seat_responses.append(
            SeatResponse(
                id=seat.id,
                zone_id=seat.zone_id,
                row_index=seat.row_index,
                row_label=seat.row_label,
                seat_number=seat.seat_number,
                seat_label=seat.seat_label,
                price=Decimal(str(seat.price)),
                status=normalized_status,
                lock_expires_at=lock_expires,
                is_locked_by_me=seat.locked_by_user_id == current_user_id,
                is_admin_locked=seat.is_admin_locked,
                locked_by_user=locked_by_user,
                sold_to_user=sold_to_user,
            )
        )

    return zone_responses, seat_responses
