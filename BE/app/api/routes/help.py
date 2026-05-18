"""Các endpoint REST cho trung tâm hỗ trợ khách hàng."""

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
from app.schemas.common import APIMessage
from app.schemas.help import HelpMessageCreateRequest, HelpMessageResponse, HelpThreadResponse
from app.ws.connection_manager import help_ws_manager

router = APIRouter(prefix="/help", tags=["help"])


async def _get_latest_customer_thread(session: AsyncSession, customer_id: int, *, with_customer: bool = False) -> HelpThread | None:
    """Lấy thread hỗ trợ mới nhất của một khách hàng.

    Input:
    - `session`: phiên database async.
    - `customer_id`: id khách hàng cần tìm thread.
    - `with_customer`: có preload quan hệ customer hay không.

    Output:
    - Thread mới nhất, hoặc `None` nếu khách chưa từng mở hội thoại.

    Cách hoạt động:
    - Sắp xếp theo `updated_at` và `id` giảm dần để lấy hội thoại mới nhất.
    - Khi cần hiển thị tên/email khách, dùng `selectinload` để tránh lazy-load ngoài async context.
    """

    stmt = (
        select(HelpThread)
        .where(HelpThread.customer_id == customer_id)
        .order_by(HelpThread.updated_at.desc(), HelpThread.id.desc())
    )
    if with_customer:
        stmt = stmt.options(selectinload(HelpThread.customer))
    return await session.scalar(stmt)


def _message_to_response(row: HelpMessage) -> HelpMessageResponse:
    """Chuyển model `HelpMessage` sang schema response an toàn cho frontend."""

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
    """Chuyển model `HelpThread` sang schema response cho customer/admin."""

    return HelpThreadResponse(
        id=row.id,
        customer_id=row.customer_id,
        customer_name=row.customer.full_name if row.customer else "Khách hàng",
        customer_email=row.customer.email if row.customer else "",
        last_message_at=row.last_message_at,
        last_message_preview=row.last_message_preview,
        status=row.status,
        unread_admin=row.unread_admin,
        unread_customer=row.unread_customer,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def _mark_customer_thread_seen(session: AsyncSession, thread: HelpThread) -> None:
    """Đánh dấu toàn bộ phản hồi admin trong một hội thoại là khách đã xem."""

    now = datetime.now(timezone.utc)
    rows = list(
        await session.scalars(
            select(HelpMessage).where(
                HelpMessage.thread_id == thread.id,
                HelpMessage.sender_role == UserRole.ADMIN,
                HelpMessage.read_at.is_(None),
            )
        )
    )
    for row in rows:
        row.read_at = now
    thread.unread_customer = 0


async def _mark_admin_threads_seen(session: AsyncSession, threads: list[HelpThread]) -> None:
    """Đánh dấu toàn bộ tin khách gửi trong các hội thoại admin đang xem là đã đọc."""

    if not threads:
        return

    now = datetime.now(timezone.utc)
    thread_ids = [thread.id for thread in threads]
    rows = list(
        await session.scalars(
            select(HelpMessage).where(
                HelpMessage.thread_id.in_(thread_ids),
                HelpMessage.sender_role == UserRole.CUSTOMER,
                HelpMessage.read_at.is_(None),
            )
        )
    )
    for row in rows:
        row.read_at = now
    for thread in threads:
        thread.unread_admin = 0


@router.post("/threads/me", response_model=HelpThreadResponse)
async def create_or_get_my_thread(
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> HelpThreadResponse:
    """Tạo hoặc lấy thread hỗ trợ của khách hàng đang đăng nhập."""

    if current_user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chỉ khách hàng mới được mở hội thoại hỗ trợ")

    thread = await _get_latest_customer_thread(session, current_user.id, with_customer=True)
    if not thread:
        # Khách chưa có thread thì tạo hội thoại trống để frontend bắt đầu nhắn tin.
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


@router.get("/threads/me", response_model=HelpThreadResponse | None)
async def get_my_thread(
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> HelpThreadResponse | None:
    """Đọc hội thoại hỗ trợ mới nhất của khách mà không tự tạo dữ liệu rỗng.

    Đầu vào:
    - `session`: phiên database được FastAPI cấp cho request hiện tại.
    - `current_user`: tài khoản đang đăng nhập lấy từ JWT.

    Đầu ra:
    - `HelpThreadResponse` nếu khách đã có hội thoại hỗ trợ.
    - `None` nếu khách chưa từng mở hoặc gửi tin nhắn hỗ trợ.

    Cách hoạt động:
    - Route này dành cho Navbar polling thông báo, nên chỉ đọc dữ liệu hiện có.
    - Không tạo thread rỗng để tránh request nền ghi database và tránh spam khi backend vừa restart.
    """

    if current_user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chỉ khách hàng mới được đọc hội thoại hỗ trợ")

    thread = await _get_latest_customer_thread(session, current_user.id, with_customer=True)
    return _thread_to_response(thread) if thread else None


@router.get("/threads/me/messages", response_model=list[HelpMessageResponse])
async def get_my_messages(
    limit: int = 100,
    offset: int = 0,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> list[HelpMessageResponse]:
    """Trả danh sách tin nhắn trong thread hỗ trợ của khách đang đăng nhập."""

    if current_user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chỉ khách hàng mới được đọc hội thoại hỗ trợ")
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


@router.post("/threads/me/mark-seen", response_model=APIMessage)
async def mark_my_thread_seen(
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> APIMessage:
    """Đánh dấu toàn bộ phản hồi admin trong hội thoại mới nhất của khách là đã xem."""

    if current_user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chỉ khách hàng mới được đánh dấu đã xem")

    thread = await _get_latest_customer_thread(session, current_user.id)
    if not thread:
        return APIMessage(detail="Không có thông báo hỗ trợ để đánh dấu đã xem")

    if thread.unread_customer > 0:
        await _mark_customer_thread_seen(session, thread)
        await session.commit()

    return APIMessage(detail="Đã đánh dấu phản hồi hỗ trợ là đã xem")


@router.post("/threads/me/messages", response_model=HelpMessageResponse)
async def send_my_message(
    payload: HelpMessageCreateRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> HelpMessageResponse:
    """Khách hàng gửi một tin nhắn vào thread hỗ trợ của chính mình."""

    if current_user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chỉ khách hàng mới được gửi tin nhắn hỗ trợ")
    thread = await _get_latest_customer_thread(session, current_user.id)
    if not thread:
        # Cho phép gửi tin nhắn đầu tiên mà không cần gọi API tạo thread trước.
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
    # Tin nhắn khách gửi làm tăng số tin chưa đọc phía admin.
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
    """Admin liệt kê thread hỗ trợ mới nhất của từng khách hàng."""

    rows = list(
        await session.scalars(
            select(HelpThread)
            .options(selectinload(HelpThread.customer))
            .order_by(HelpThread.customer_id.asc(), HelpThread.updated_at.desc(), HelpThread.id.desc())
        )
    )
    latest_by_customer: dict[int, HelpThread] = {}
    for row in rows:
        # Một khách có thể có nhiều thread lịch sử; màn inbox chỉ hiển thị thread mới nhất.
        if row.customer_id not in latest_by_customer:
            latest_by_customer[row.customer_id] = row

    deduped_rows = sorted(
        latest_by_customer.values(),
        key=lambda item: (item.last_message_at, item.id),
        reverse=True,
    )
    return [_thread_to_response(row) for row in deduped_rows]


@router.post("/admin/threads/mark-seen", response_model=APIMessage)
async def admin_mark_threads_seen(
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> APIMessage:
    """Đánh dấu toàn bộ thông báo hỗ trợ chưa đọc phía admin là đã xem."""

    threads = list(
        await session.scalars(select(HelpThread).where(HelpThread.unread_admin > 0))
    )
    if not threads:
        return APIMessage(detail="Không có thông báo hỗ trợ chưa xem")

    await _mark_admin_threads_seen(session, threads)
    await session.commit()
    return APIMessage(detail="Đã đánh dấu thông báo hỗ trợ là đã xem")


@router.get("/admin/threads/{thread_id}/messages", response_model=list[HelpMessageResponse])
async def admin_get_thread_messages(
    thread_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> list[HelpMessageResponse]:
    """Admin đọc tin nhắn của một thread hỗ trợ."""

    thread = await session.scalar(select(HelpThread).where(HelpThread.id == thread_id))
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy hội thoại hỗ trợ")
    canonical_thread = await _get_latest_customer_thread(session, thread.customer_id)
    if not canonical_thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy hội thoại hỗ trợ")
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
    """Admin gửi tin nhắn trả lời khách hàng trong thread hỗ trợ."""

    thread = await session.scalar(select(HelpThread).where(HelpThread.id == thread_id))
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy hội thoại hỗ trợ")
    canonical_thread = await _get_latest_customer_thread(session, thread.customer_id)
    if not canonical_thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy hội thoại hỗ trợ")

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
    # Tin nhắn admin gửi làm tăng số tin chưa đọc phía customer.
    canonical_thread.unread_customer += 1
    canonical_thread.unread_admin = 0
    session.add(message)
    await session.commit()
    await session.refresh(message)
    response = _message_to_response(message)
    await help_ws_manager.broadcast_message(canonical_thread.id, response.model_dump(mode="json"))
    return response
