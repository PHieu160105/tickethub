"""Help center REST endpoints."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_active_admin, get_current_user
from app.core.db import get_db_session
from app.models.enums import UserRole
from app.models.help import HelpMessage, HelpThread
from app.models.user import User
from app.schemas.help import HelpMessageCreateRequest, HelpMessageResponse, HelpThreadResponse
from app.ws.connection_manager import help_ws_manager

router = APIRouter(prefix="/help", tags=["help"])


async def _get_latest_customer_thread(session: AsyncSession, customer_id: int, *, with_customer: bool = False) -> HelpThread | None:
    stmt = (
        select(HelpThread)
        .where(HelpThread.customer_id == customer_id)
        .order_by(HelpThread.updated_at.desc(), HelpThread.id.desc())
    )
    if with_customer:
        stmt = stmt.options(selectinload(HelpThread.customer))
    return await session.scalar(stmt)


def _message_to_response(row: HelpMessage) -> HelpMessageResponse:
    return HelpMessageResponse(
        id=row.id,
        thread_id=row.thread_id,
        sender_id=row.sender_id,
        sender_role=str(row.sender_role),
        content=row.content,
        message_type=row.message_type,
        read_at=row.read_at,
        created_at=row.created_at,
    )


def _thread_to_response(row: HelpThread) -> HelpThreadResponse:
    return HelpThreadResponse(
        id=row.id,
        customer_id=row.customer_id,
        customer_name=row.customer.full_name if row.customer else "Customer",
        customer_email=row.customer.email if row.customer else "",
        last_message_at=row.last_message_at,
        last_message_preview=row.last_message_preview,
        status=row.status,
        unread_admin=row.unread_admin,
        unread_customer=row.unread_customer,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.post("/threads/me", response_model=HelpThreadResponse)
async def create_or_get_my_thread(
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> HelpThreadResponse:
    if current_user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Customer role is required")

    thread = await _get_latest_customer_thread(session, current_user.id, with_customer=True)
    if not thread:
        now = datetime.now(timezone.utc)
        thread = HelpThread(
            customer_id=current_user.id,
            last_message_at=now,
            last_message_preview="",
            status="open",
            unread_admin=0,
            unread_customer=0,
        )
        session.add(thread)
        await session.commit()
        await session.refresh(thread)
        await session.refresh(thread, attribute_names=["customer"])
    return _thread_to_response(thread)


@router.get("/threads/me/messages", response_model=list[HelpMessageResponse])
async def get_my_messages(
    limit: int = 100,
    offset: int = 0,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> list[HelpMessageResponse]:
    if current_user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Customer role is required")
    thread = await _get_latest_customer_thread(session, current_user.id)
    if not thread:
        return []
    rows = list(
        await session.scalars(
            select(HelpMessage)
            .where(HelpMessage.thread_id == thread.id)
            .order_by(HelpMessage.created_at.asc())
            .limit(limit)
            .offset(offset)
        )
    )
    return [_message_to_response(row) for row in rows]


@router.post("/threads/me/messages", response_model=HelpMessageResponse)
async def send_my_message(
    payload: HelpMessageCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> HelpMessageResponse:
    if current_user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Customer role is required")
    thread = await _get_latest_customer_thread(session, current_user.id)
    if not thread:
        now = datetime.now(timezone.utc)
        thread = HelpThread(
            customer_id=current_user.id,
            last_message_at=now,
            last_message_preview="",
            status="open",
            unread_admin=0,
            unread_customer=0,
        )
        session.add(thread)
        await session.flush()

    now = datetime.now(timezone.utc)
    message = HelpMessage(
        thread_id=thread.id,
        sender_id=current_user.id,
        sender_role=current_user.role,
        content=payload.content.strip(),
        message_type="text",
        created_at=now,
    )
    thread.last_message_at = now
    thread.last_message_preview = payload.content.strip()[:255]
    thread.unread_admin += 1
    thread.unread_customer = 0
    session.add(message)
    await session.commit()
    await session.refresh(message)

    response = _message_to_response(message)
    await help_ws_manager.broadcast_message(thread.id, response.model_dump(mode="json"))
    return response


@router.get("/admin/threads", response_model=list[HelpThreadResponse])
async def admin_list_threads(
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> list[HelpThreadResponse]:
    rows = list(
        await session.scalars(
            select(HelpThread)
            .options(selectinload(HelpThread.customer))
            .order_by(HelpThread.customer_id.asc(), HelpThread.updated_at.desc(), HelpThread.id.desc())
        )
    )
    latest_by_customer: dict[int, HelpThread] = {}
    for row in rows:
        if row.customer_id not in latest_by_customer:
            latest_by_customer[row.customer_id] = row

    deduped_rows = sorted(
        latest_by_customer.values(),
        key=lambda item: (item.last_message_at, item.id),
        reverse=True,
    )
    return [_thread_to_response(row) for row in deduped_rows]


@router.get("/admin/threads/{thread_id}/messages", response_model=list[HelpMessageResponse])
async def admin_get_thread_messages(
    thread_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> list[HelpMessageResponse]:
    thread = await session.scalar(select(HelpThread).where(HelpThread.id == thread_id))
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    canonical_thread = await _get_latest_customer_thread(session, thread.customer_id)
    if not canonical_thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    rows = list(
        await session.scalars(
            select(HelpMessage)
            .where(HelpMessage.thread_id == canonical_thread.id)
            .order_by(HelpMessage.created_at.asc())
        )
    )
    return [_message_to_response(row) for row in rows]


@router.post("/admin/threads/{thread_id}/messages", response_model=HelpMessageResponse)
async def admin_send_message(
    thread_id: int,
    payload: HelpMessageCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    admin_user: User = Depends(get_current_active_admin),
) -> HelpMessageResponse:
    thread = await session.scalar(select(HelpThread).where(HelpThread.id == thread_id))
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    canonical_thread = await _get_latest_customer_thread(session, thread.customer_id)
    if not canonical_thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    now = datetime.now(timezone.utc)
    message = HelpMessage(
        thread_id=canonical_thread.id,
        sender_id=admin_user.id,
        sender_role=admin_user.role,
        content=payload.content.strip(),
        message_type="text",
        created_at=now,
    )
    canonical_thread.last_message_at = now
    canonical_thread.last_message_preview = payload.content.strip()[:255]
    canonical_thread.unread_customer += 1
    canonical_thread.unread_admin = 0
    session.add(message)
    await session.commit()
    await session.refresh(message)
    response = _message_to_response(message)
    await help_ws_manager.broadcast_message(canonical_thread.id, response.model_dump(mode="json"))
    return response
