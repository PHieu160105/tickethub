import math

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_assigned_event_staff
from app.core.db import get_db_session
from app.models.enums import SeatStatus
from app.models.event import TicketTier
from app.models.order import Ticket
from app.models.user import User
from app.schemas.common import APIMessage
from app.schemas.event import (
    SeatBulkCreateRequest,
    SeatBulkCreateResponse,
    SeatCreateResponse,
    SeatSingleCreateRequest,
    SeatSyncCreatedItem,
    SeatSyncRequest,
    SeatSyncResponse,
    SeatUpdateRequest,
    TicketTierCreate,
    TicketTierResponse,
    TicketTierUpdate,
)
from app.services.dashboard_service import broadcast_dashboard_update
from app.services.event_inventory_service import sync_show_ticket_inventory
from app.services.event_lifecycle_service import create_show_ticket_tier, delete_show_ticket_tier, update_show_ticket_tier

from ._shared import (
    _build_event_or_404_show,
    _ensure_show_is_draft,
    _invalidate_show_cache,
    _validate_unique_ids,
    _validate_unique_labels,
)

router = APIRouter()


def _ticket_response(ticket: Ticket) -> SeatCreateResponse:
    return SeatCreateResponse(
        id=ticket.id,
        seat_label=ticket.seat_label or f"Ticket #{ticket.id}",
        x=float(ticket.x_coord) if ticket.x_coord is not None else None,
        y=float(ticket.y_coord) if ticket.y_coord is not None else None,
    )


def _ticket_tier_response(tier: TicketTier) -> TicketTierResponse:
    return TicketTierResponse(
        id=tier.id,
        code=tier.code,
        name=tier.name,
        description=tier.description,
        base_price=tier.base_price,
        color=tier.color,
        is_active=tier.is_active,
    )


@router.get("/events/{event_key}/shows/{show_id}/ticket-tiers", response_model=list[TicketTierResponse])
async def list_ticket_tiers(
    event_key: str,
    show_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_assigned_event_staff),
) -> list[TicketTierResponse]:
    _, show = await _build_event_or_404_show(session, event_key, show_id)
    ticket_tiers = list(await session.scalars(select(TicketTier).where(TicketTier.show_id == show.id).order_by(TicketTier.id.asc())))
    return [_ticket_tier_response(tier) for tier in ticket_tiers]


@router.post("/events/{event_key}/shows/{show_id}/ticket-tiers", response_model=TicketTierResponse, status_code=status.HTTP_201_CREATED)
async def create_ticket_tier(
    event_key: str,
    show_id: int,
    payload: TicketTierCreate,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_assigned_event_staff),
) -> TicketTierResponse:
    _, show = await _build_event_or_404_show(session, event_key, show_id)
    _ensure_show_is_draft(show)
    try:
        tier = await create_show_ticket_tier(session, show, payload)
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    await _invalidate_show_cache(show.id)
    await broadcast_dashboard_update()
    return _ticket_tier_response(tier)


@router.patch("/events/{event_key}/shows/{show_id}/ticket-tiers/{ticket_tier_id}", response_model=TicketTierResponse)
async def update_ticket_tier(
    event_key: str,
    show_id: int,
    ticket_tier_id: int,
    payload: TicketTierUpdate,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_assigned_event_staff),
) -> TicketTierResponse:
    _, show = await _build_event_or_404_show(session, event_key, show_id)
    _ensure_show_is_draft(show)
    try:
        tier = await update_show_ticket_tier(session, show, ticket_tier_id, payload)
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    await _invalidate_show_cache(show.id)
    await broadcast_dashboard_update()
    return _ticket_tier_response(tier)


@router.delete("/events/{event_key}/shows/{show_id}/ticket-tiers/{ticket_tier_id}", response_model=APIMessage)
async def delete_ticket_tier(
    event_key: str,
    show_id: int,
    ticket_tier_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_assigned_event_staff),
) -> APIMessage:
    _, show = await _build_event_or_404_show(session, event_key, show_id)
    _ensure_show_is_draft(show)
    try:
        await delete_show_ticket_tier(session, show, ticket_tier_id)
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    await _invalidate_show_cache(show.id)
    await broadcast_dashboard_update()
    return APIMessage(detail="Da xoa hang ve thanh cong")


async def _default_ticket_tier(session: AsyncSession, show_id: int, ticket_tier_id: int | None) -> TicketTier:
    stmt = select(TicketTier).where(TicketTier.show_id == show_id)
    if ticket_tier_id is not None:
        stmt = stmt.where(TicketTier.id == ticket_tier_id)
    stmt = stmt.order_by(TicketTier.id.asc())
    tier = await session.scalar(stmt)
    if not tier:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Show can it nhat mot hang ve")
    return tier


@router.post("/events/{event_key}/shows/{show_id}/seats/single", response_model=SeatCreateResponse)
async def create_show_seat_single(
    event_key: str,
    show_id: int,
    payload: SeatSingleCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_assigned_event_staff),
) -> SeatCreateResponse:
    _, show = await _build_event_or_404_show(session, event_key, show_id)
    _ensure_show_is_draft(show)
    tier = await _default_ticket_tier(session, show.id, payload.ticket_tier_id)
    exists = await session.scalar(select(func.count()).select_from(Ticket).where(Ticket.show_id == show.id, Ticket.seat_label == payload.seat_label))
    if exists and exists > 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nhan ghe da ton tai trong buoi dien nay")

    ticket = Ticket(
        show_id=show.id,
        ticket_tier_id=tier.id,
        seat_id=None,
        label=payload.seat_label,
        row_label=None,
        seat_number=None,
        x=round(payload.x, 2),
        y=round(payload.y, 2),
        price=float(payload.price) if payload.price is not None else float(tier.base_price),
        status=SeatStatus.LOCKED if payload.is_admin_locked else SeatStatus.AVAILABLE,
        is_staff_locked=payload.is_admin_locked,
    )
    session.add(ticket)
    try:
        await session.flush()
        await session.commit()
        await session.refresh(ticket)
    except Exception:
        await session.rollback()
        raise
    await _invalidate_show_cache(show.id)
    await broadcast_dashboard_update()
    return _ticket_response(ticket)


@router.post("/events/{event_key}/shows/{show_id}/seats/bulk", response_model=SeatBulkCreateResponse)
async def create_show_seat_bulk(
    event_key: str,
    show_id: int,
    payload: SeatBulkCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_assigned_event_staff),
) -> SeatBulkCreateResponse:
    _, show = await _build_event_or_404_show(session, event_key, show_id)
    _ensure_show_is_draft(show)
    tier = await _default_ticket_tier(session, show.id, payload.ticket_tier_id)
    existing_labels = set(await session.scalars(select(Ticket.seat_label).where(Ticket.show_id == show.id)))
    created: list[Ticket] = []

    if payload.pattern not in {"straight", "arc"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mau sinh ghe khong duoc ho tro")

    for row in range(payload.rows):
        seats_in_row = payload.cols if payload.pattern == "straight" or payload.arc_config is None else payload.cols + row * 2
        for col in range(seats_in_row):
            label = f"{payload.label_prefix}{row + 1}-{col + 1}"
            if label in existing_labels:
                continue
            if payload.pattern == "straight":
                x = max(0.0, min(100.0, payload.start_x + col * payload.gap_x))
                y = max(0.0, min(100.0, payload.start_y + row * payload.gap_y))
            else:
                cfg = payload.arc_config
                radius = cfg.radius + row * payload.gap_y
                denominator = seats_in_row - 1 if seats_in_row > 1 else 1
                angle = cfg.start_angle + (cfg.end_angle - cfg.start_angle) * (col / denominator)
                radians = math.radians(angle)
                x = max(0.0, min(100.0, cfg.center_x + radius * math.sin(radians)))
                y = max(0.0, min(100.0, cfg.center_y + radius * math.cos(radians)))
            ticket = Ticket(
                show_id=show.id,
                ticket_tier_id=tier.id,
                seat_id=None,
                label=label,
                row_label=f"{payload.label_prefix}{row + 1}",
                seat_number=col + 1,
                x=round(x, 2),
                y=round(y, 2),
                price=float(tier.base_price),
                status=SeatStatus.AVAILABLE,
                is_staff_locked=False,
            )
            existing_labels.add(label)
            session.add(ticket)
            created.append(ticket)

    try:
        await session.flush()
        await session.commit()
        for ticket in created:
            await session.refresh(ticket)
    except Exception:
        await session.rollback()
        raise
    await _invalidate_show_cache(show.id)
    await broadcast_dashboard_update()
    return SeatBulkCreateResponse(created_count=len(created), seats=[_ticket_response(ticket) for ticket in created])


@router.post("/events/{event_key}/shows/{show_id}/seats/sync", response_model=SeatSyncResponse)
async def sync_show_seats(
    event_key: str,
    show_id: int,
    payload: SeatSyncRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_assigned_event_staff),
) -> SeatSyncResponse:
    _, show = await _build_event_or_404_show(session, event_key, show_id)
    _ensure_show_is_draft(show)

    existing_tickets = list(await session.scalars(select(Ticket).where(Ticket.show_id == show.id).order_by(Ticket.id.asc())))
    ticket_map = {ticket.id: ticket for ticket in existing_tickets}
    tier_map = {tier.id: tier for tier in await session.scalars(select(TicketTier).where(TicketTier.show_id == show.id))}

    update_ids = [item.id for item in payload.update]
    delete_ids = list(payload.delete_ids)
    client_ids = [item.client_id for item in payload.create]
    _validate_unique_ids(update_ids, "Duplicate seat ids in update payload")
    _validate_unique_ids(delete_ids, "Duplicate seat ids in delete payload")
    _validate_unique_ids(client_ids, "Duplicate client ids in create payload")

    final_labels: list[str] = []
    update_map = {item.id: item for item in payload.update}
    delete_set = set(delete_ids)
    for ticket in existing_tickets:
        if ticket.id in delete_set:
            continue
        candidate = update_map.get(ticket.id)
        final_labels.append(candidate.seat_label if candidate else (ticket.seat_label or f"Ticket #{ticket.id}"))
    final_labels.extend(item.seat_label for item in payload.create)
    _validate_unique_labels(final_labels, "Nhan ghe da ton tai trong buoi dien nay")

    created_pairs: list[tuple[int, Ticket]] = []
    try:
        for item in payload.update:
            ticket = ticket_map.get(item.id)
            if not ticket:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy ghế thuộc buổi diễn này")
            if item.ticket_tier_id is not None:
                tier = tier_map.get(item.ticket_tier_id)
                if not tier:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy hạng vé của buổi diễn này")
                ticket.ticket_tier_id = tier.id
                if item.price is None:
                    ticket.price = float(tier.base_price)
            ticket.label = item.seat_label
            ticket.x = round(item.x, 2)
            ticket.y = round(item.y, 2)
            if item.price is not None:
                ticket.price = float(item.price)
            ticket.is_staff_locked = item.is_admin_locked
            ticket.status = SeatStatus.LOCKED if item.is_admin_locked and ticket.status != SeatStatus.SOLD else (
                SeatStatus.AVAILABLE if ticket.status != SeatStatus.SOLD else ticket.status
            )

        for item in payload.create:
            tier = await _default_ticket_tier(session, show.id, item.ticket_tier_id)
            ticket = Ticket(
                show_id=show.id,
                ticket_tier_id=tier.id,
                seat_id=None,
                label=item.seat_label,
                row_label=None,
                seat_number=None,
                x=round(item.x, 2),
                y=round(item.y, 2),
                price=float(item.price) if item.price is not None else float(tier.base_price),
                status=SeatStatus.LOCKED if item.is_admin_locked else SeatStatus.AVAILABLE,
                is_staff_locked=item.is_admin_locked,
            )
            session.add(ticket)
            created_pairs.append((item.client_id, ticket))

        for seat_id in delete_ids:
            ticket = ticket_map.get(seat_id)
            if not ticket:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy ghế thuộc buổi diễn này")
            await session.delete(ticket)

        await session.flush()
        await session.commit()
        for _, ticket in created_pairs:
            await session.refresh(ticket)
    except Exception:
        await session.rollback()
        raise

    await _invalidate_show_cache(show.id)
    await broadcast_dashboard_update()
    return SeatSyncResponse(
        created=[
            SeatSyncCreatedItem(
                client_id=client_id,
                id=ticket.id,
                seat_label=ticket.seat_label or f"Ticket #{ticket.id}",
                x=float(ticket.x_coord) if ticket.x_coord is not None else None,
                y=float(ticket.y_coord) if ticket.y_coord is not None else None,
            )
            for client_id, ticket in created_pairs
        ],
        updated_ids=update_ids,
        deleted_ids=delete_ids,
    )


@router.patch("/events/{event_key}/shows/{show_id}/seats/{seat_id}", response_model=SeatCreateResponse)
async def update_show_seat(
    event_key: str,
    show_id: int,
    seat_id: int,
    payload: SeatUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_assigned_event_staff),
) -> SeatCreateResponse:
    _, show = await _build_event_or_404_show(session, event_key, show_id)
    _ensure_show_is_draft(show)
    ticket = await session.scalar(select(Ticket).where(Ticket.id == seat_id, Ticket.show_id == show.id))
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy ghế thuộc buổi diễn này")
    if payload.ticket_tier_id is not None:
        tier = await _default_ticket_tier(session, show.id, payload.ticket_tier_id)
        ticket.ticket_tier_id = tier.id
        if payload.price is None:
            ticket.price = float(tier.base_price)
    if payload.seat_label is not None:
        exists = await session.scalar(
            select(func.count()).select_from(Ticket).where(Ticket.show_id == show.id, Ticket.seat_label == payload.seat_label, Ticket.id != ticket.id)
        )
        if exists and exists > 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nhan ghe da ton tai trong buoi dien nay")
        ticket.label = payload.seat_label
    if payload.x is not None:
        ticket.x = round(payload.x, 2)
    if payload.y is not None:
        ticket.y = round(payload.y, 2)
    if payload.price is not None:
        ticket.price = float(payload.price)
    if payload.is_admin_locked is not None:
        ticket.is_staff_locked = payload.is_admin_locked
        if ticket.status != SeatStatus.SOLD:
            ticket.status = SeatStatus.LOCKED if payload.is_admin_locked else SeatStatus.AVAILABLE

    try:
        await session.commit()
        await session.refresh(ticket)
    except Exception:
        await session.rollback()
        raise
    await _invalidate_show_cache(show.id)
    await broadcast_dashboard_update()
    return _ticket_response(ticket)


@router.delete("/events/{event_key}/shows/{show_id}/seats/{seat_id}", response_model=APIMessage)
async def delete_show_seat(
    event_key: str,
    show_id: int,
    seat_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_assigned_event_staff),
) -> APIMessage:
    _, show = await _build_event_or_404_show(session, event_key, show_id)
    _ensure_show_is_draft(show)
    ticket = await session.scalar(select(Ticket).where(Ticket.id == seat_id, Ticket.show_id == show.id))
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy ghế thuộc buổi diễn này")
    if ticket.seat_id is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không thể xóa ghế được sinh từ layout")
    await session.delete(ticket)
    await session.commit()
    await _invalidate_show_cache(show.id)
    await broadcast_dashboard_update()
    return APIMessage(detail="Da xoa ghe thanh cong")
