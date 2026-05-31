"""Các route xem sơ đồ ghế theo tọa độ.

Ghi chú:
- Route trong file này là public-friendly: guest có thể xem ghế và giá.
- Quyền giữ ghế/thanh toán không nằm ở đây mà nằm ở `bookings.py` và `booking_service.py`.
"""

# FastAPI dùng `APIRouter` để gom route và `Depends` để inject dependency.
from fastapi import APIRouter, Depends, HTTPException, Request, status

# SQLAlchemy dùng `select` để tạo câu SQL đọc section/venue layout.
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Các import dưới đây là module tự viết trong TicketRush.
from app.api.deps import get_optional_current_user
from app.core.cache import public_api_cache, show_seat_cache_namespace
from app.core.db import get_db_session
from app.models.enums import EventStatus, UserType
from app.models.event import Event
from app.models.user import User
from app.schemas.event import SeatMatrixResponse
from app.schemas.seatmap import SeatMapResponse
from app.services.event_inventory_service import get_show_seat_matrix
from app.services.event_query_service import get_show_by_id
from app.services.admission_service import ensure_admission_for_show, read_queue_token, reject_before_show_lookup_if_waiting_room
from app.services.inventory_service import get_seatmap
from app.services.queue_service import is_show_queue_required

# Prefix `/shows` tạo các URL như `/api/shows/{show_id}/seats`.
router = APIRouter(prefix="/shows", tags=["seatmap"])


def _is_admin(user: User | None) -> bool:
    return bool(user and user.user_type in {UserType.EVENT_STAFF, UserType.SYSTEM_ADMIN})


async def _ensure_show_visible_to_user(session: AsyncSession, show_id: int, current_user: User | None):
    show = await get_show_by_id(session, show_id)
    event = await session.get(Event, show.event_id)
    if not _is_admin(current_user) and (show.status != EventStatus.LIVE or not event or event.status != EventStatus.LIVE):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy buổi diễn")
    return show, event


@router.get("/{show_id}/seats", response_model=SeatMatrixResponse)
async def show_seat_matrix(
    show_id: int,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    current_user: User | None = Depends(get_optional_current_user),
) -> SeatMatrixResponse:
    """Trả ma trận ghế đầy đủ cho màn đặt vé.

    Input:
    - `show_id`: id buổi diễn cần xem ghế.
    - `current_user`: user nếu có token hợp lệ, hoặc `None` nếu là guest.

    Output:
    - `SeatMatrixResponse` gồm metadata show/event, khu giá vé và danh sách ghế.

    Cách hoạt động:
    - Guest được xem ghế/giá nên dùng `get_optional_current_user`, không bắt đăng nhập.
    - Nếu là guest, cache response ngắn hạn để giảm tải DB khi nhiều người chỉ xem sơ đồ.
    - Nếu là admin, service có thể trả thêm thông tin người giữ/người mua để inspect.
    """

    queue_token = read_queue_token(request)
    await reject_before_show_lookup_if_waiting_room(show_id, current_user, queue_token)

    # Lấy show trước để xác thực `show_id` tồn tại và lấy event_id.
    show, event = await _ensure_show_visible_to_user(session, show_id, current_user)
    await ensure_admission_for_show(session, show, current_user, queue_token, record_hit=False)
    if current_user is None:
        # Guest không có thông tin cá nhân hóa nên có thể dùng cache public.
        cached = await public_api_cache.get(show_seat_cache_namespace(show.id), "anonymous")
        if cached is not None:
            return cached

    # Service dựng dữ liệu ghế; `current_user_id=None` nghĩa là guest, không đánh dấu ghế của tôi.
    zones, seats = await get_show_seat_matrix(
        session,
        show.id,
        current_user_id=current_user.id if current_user else None,
        include_user_details=_is_admin(current_user),
    )
    queue_required = False
    if current_user is not None:
        queue_required = await is_show_queue_required(session, show, current_user.id)

    # Event cha dùng để frontend quay lại trang chi tiết sự kiện bằng slug.
    response = SeatMatrixResponse(
        show_id=show.id,
        show_title=show.title,
        event_id=show.event_id,
        event_slug=event.slug if event else "",
        event_title=event.title if event else show.title,
        queue_required=queue_required,
        zones=zones,
        seats=seats,
    )
    if current_user is None:
        # Cache 30 giây đủ giảm tải danh sách ghế nhưng vẫn không làm trạng thái lock/sold trễ quá lâu.
        return await public_api_cache.set(show_seat_cache_namespace(show.id), "anonymous", response, ttl_seconds=30)
    return response


@router.get("/{show_id}/seatmap", response_model=SeatMapResponse)
async def show_seatmap(
    show_id: int,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    current_user: User | None = Depends(get_optional_current_user),
) -> SeatMapResponse:
    """Lấy sơ đồ ghế đầy đủ có tọa độ để frontend render canvas.

    Input:
    - `show_id`: id buổi diễn cần render sơ đồ.
    - `current_user`: user nếu có token hợp lệ, hoặc `None` cho guest.

    Output:
    - `SeatMapResponse` gồm ghế có tọa độ, khu vực, polygon và ảnh nền.

    Cách hoạt động:
    - Dùng route này cho canvas seat map của customer.
    - Guest được xem giá và trạng thái ghế nhưng không được giữ ghế ở route này.
    - Cache guest 10 giây vì seat map có trạng thái lock cần cập nhật nhanh hơn matrix.
    """

    queue_token = read_queue_token(request)
    await reject_before_show_lookup_if_waiting_room(show_id, current_user, queue_token)

    show, _ = await _ensure_show_visible_to_user(session, show_id, current_user)
    await ensure_admission_for_show(session, show, current_user, queue_token, record_hit=False)
    if current_user is None:
        cached = await public_api_cache.get(show_seat_cache_namespace(show.id), "seatmap_anonymous")
        if cached is not None:
            return cached

    queue_required = False
    if current_user is not None:
        queue_required = await is_show_queue_required(session, show, current_user.id)

    response = SeatMapResponse.model_validate(
        await get_seatmap(
            session,
            show.id,
            current_user_id=current_user.id if current_user else None,
        )
    )
    response.queue_required = queue_required
    if current_user is None:
        # TTL ngắn để người xem đông không dồn toàn bộ request vào DB nhưng vẫn thấy trạng thái gần realtime.
        return await public_api_cache.set(show_seat_cache_namespace(show.id), "seatmap_anonymous", response, ttl_seconds=10)
    return response


@router.get("/{show_id}/sections", response_model=list[dict])
async def show_sections(
    show_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Section của venue layout đã bị loại khỏi flow hiện tại."""

    show, _ = await _ensure_show_visible_to_user(session, show_id, None)
    _ = show
    return []
