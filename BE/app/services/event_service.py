"""Event-related business logic and seat matrix generation."""

from datetime import UTC, datetime
from decimal import Decimal
import re

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import SeatStatus
from app.models.event import Event, SeatZone
from app.models.order import Order, OrderItem, Ticket
from app.models.seat import Seat
from app.models.user import User
from app.schemas.event import (
    EventCreateRequest,
    SeatPurchaseInfoResponse,
    SeatResponse,
    SeatUserInfoResponse,
    SeatZoneResponse,
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


def _as_utc(value: datetime | None) -> datetime | None:
    """Normalize naive datetimes from DB layer to UTC-aware values."""

    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=UTC)


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


async def create_event_with_matrix(session: AsyncSession, admin_id: int, payload: EventCreateRequest) -> Event:
    """Create event, zones and all generated seats in one transaction."""

    if payload.end_at <= payload.start_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_at must be later than start_at")

    slug = await build_unique_slug(session, payload.title)
    event = Event(
        slug=slug,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        venue=payload.venue,
        start_at=payload.start_at,
        end_at=payload.end_at,
        cover_image_url=payload.cover_image_url,
        status=payload.status,
        hold_minutes=payload.hold_minutes,
        queue_enabled=payload.queue_enabled,
        queue_release_batch=payload.queue_release_batch,
        max_active_queue_tokens=payload.max_active_queue_tokens,
        created_by_user_id=admin_id,
    )
    session.add(event)
    await session.flush()

    zone_models: list[SeatZone] = []
    seat_models: list[Seat] = []
    for zone_payload in payload.zones:
        zone = SeatZone(
            event_id=event.id,
            code=zone_payload.code,
            name=zone_payload.name,
            row_count=zone_payload.row_count,
            seats_per_row=zone_payload.seats_per_row,
            price=zone_payload.price,
            color=zone_payload.color,
        )
        session.add(zone)
        await session.flush()
        zone_models.append(zone)

        for row_index in range(1, zone_payload.row_count + 1):
            row_label = row_label_from_index(row_index)
            for seat_number in range(1, zone_payload.seats_per_row + 1):
                seat_label = f"{zone_payload.code}-{row_label}{seat_number}"
                seat_models.append(
                    Seat(
                        event_id=event.id,
                        zone_id=zone.id,
                        row_index=row_index,
                        row_label=row_label,
                        seat_number=seat_number,
                        seat_label=seat_label,
                        price=zone_payload.price,
                        status=SeatStatus.AVAILABLE,
                    )
                )

    session.add_all(seat_models)
    await session.flush()
    return event


async def list_live_events(
    session: AsyncSession,
    search: str | None,
    category: str | None,
    start_from: datetime | None,
    end_to: datetime | None,
    limit: int = 30,
    offset: int = 0,
) -> list[Event]:
    """Return events with basic optional search filters."""

    stmt = select(Event).order_by(Event.start_at.asc())

    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(Event.title.ilike(pattern) | Event.venue.ilike(pattern))

    if category:
        stmt = stmt.where(Event.category.ilike(category.strip()))

    if start_from:
        stmt = stmt.where(Event.start_at >= start_from)

    if end_to:
        stmt = stmt.where(Event.start_at <= end_to)

    stmt = stmt.limit(limit).offset(offset)

    result = await session.scalars(stmt)
    return list(result)


async def get_event_by_slug_or_id(session: AsyncSession, slug_or_id: str) -> Event:
    """Resolve event by slug path segment or numeric id."""

    if slug_or_id.isdigit():
        stmt = select(Event).where(Event.id == int(slug_or_id))
    else:
        stmt = select(Event).where(Event.slug == slug_or_id)

    event = await session.scalar(stmt)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


async def get_event_seat_matrix(
    session: AsyncSession,
    event_id: int,
    current_user_id: int | None = None,
    include_user_details: bool = False,
) -> tuple[list[SeatZoneResponse], list[SeatResponse]]:
    """Fetch seat matrix with lock ownership hints for current user."""

    zones = list(await session.scalars(select(SeatZone).where(SeatZone.event_id == event_id).order_by(SeatZone.id.asc())))
    seats = list(await session.scalars(select(Seat).where(Seat.event_id == event_id).order_by(Seat.zone_id, Seat.row_index, Seat.seat_number)))

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
        # Treat expired locks as available for client rendering. Real unlock still happens in worker.
        normalized_status = seat.status
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
                locked_by_user=locked_by_user,
                sold_to_user=sold_to_user,
            )
        )

    return zone_responses, seat_responses
