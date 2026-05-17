"""Các route giữ ghế, trả ghế, thanh toán và quản lý vé.

Ghi chú:
- File route chỉ xử lý HTTP request/response.
- Luồng nghiệp vụ thật nằm trong `app/services/booking_service.py`.
- Tất cả route ở đây yêu cầu customer đã đăng nhập, guest chỉ được xem ghế ở `seatmap.py`.
"""

# `datetime` là kiểu ngày giờ chuẩn của Python, dùng cho bộ lọc vé theo khoảng thời gian.
from datetime import datetime

# FastAPI import: khai báo router, dependency và query parameter.
from fastapi import APIRouter, Depends, Query

# SQLAlchemy import: phiên database bất đồng bộ.
from sqlalchemy.ext.asyncio import AsyncSession

# Các import dưới đây là module tự viết trong TicketRush.
from app.api.deps import get_current_customer
from app.core.cache import public_api_cache, user_ticket_cache_namespace
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

# Prefix `/bookings` tạo các URL như `/api/bookings/lock`.
router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.post("/lock", response_model=LockSeatsResponse, dependencies=[Depends(rate_limit("bookings-lock", times=60, seconds=60))])
async def lock_event_seats(
    payload: LockSeatsRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_customer),
) -> LockSeatsResponse:
    """Giữ một hoặc nhiều ghế cho khách hàng đang đăng nhập.

    Input:
    - `payload.show_id`: buổi diễn cần giữ ghế.
    - `payload.seat_ids`: danh sách id ghế người dùng chọn.
    - `payload.queue_token`: token hàng đợi nếu show bật queue.

    Output:
    - Danh sách ghế giữ thành công và danh sách ghế bị từ chối.

    Cách hoạt động:
    - Route chỉ lấy `current_user.id` từ JWT rồi gọi `lock_seats`.
    - `booking_service` sẽ kiểm tra queue token và chống giữ trùng ghế.
    """

    return await lock_seats(
        session=session,
        user_id=current_user.id,
        show_id=payload.show_id,
        seat_ids=payload.seat_ids,
        queue_token=payload.queue_token,
    )


@router.post("/release", response_model=APIMessage, dependencies=[Depends(rate_limit("bookings-release", times=60, seconds=60))])
async def release_event_seats(
    payload: ReleaseSeatsRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_customer),
) -> APIMessage:
    """Trả lại các ghế đã chọn nếu chính người dùng hiện tại đang giữ các ghế đó.

    Input:
    - `payload.show_id`: buổi diễn chứa ghế.
    - `payload.seat_ids`: ghế cần trả.

    Output:
    - Thông báo số lượng ghế đã được mở lại.

    Cách hoạt động:
    - Chỉ ghế do chính user hiện tại giữ mới được release.
    - Ghế đang giữ bởi người khác hoặc đã bán không bị tác động.
    """

    # Service trả về số ghế thật sự được mở lại để thông báo chính xác cho frontend.
    released_count = await release_seats(
        session=session,
        user_id=current_user.id,
        show_id=payload.show_id,
        seat_ids=payload.seat_ids,
    )
    return APIMessage(detail=f"Đã trả lại {released_count} ghế")


@router.post("/checkout", response_model=CheckoutResponse, dependencies=[Depends(rate_limit("bookings-checkout", times=10, seconds=60))])
async def checkout(
    payload: CheckoutRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_customer),
) -> CheckoutResponse:
    """Xác nhận thanh toán và chuyển các ghế đang giữ thành vé đã bán.

    Input:
    - `payload.show_id`: buổi diễn cần thanh toán.
    - `payload.queue_token`: token queue nếu buổi diễn yêu cầu.
    - `payload.discount_code`: mã giảm giá mô phỏng nếu có.

    Output:
    - Đơn hàng, danh sách vé điện tử và tổng tiền.

    Cách hoạt động:
    - Service chỉ checkout những ghế user hiện tại đang giữ hợp lệ.
    - Sau khi thành công, queue token được đánh dấu hoàn tất để không quay lại hàng chờ.
    """

    return await checkout_locked_seats(
        session=session,
        user_id=current_user.id,
        show_id=payload.show_id,
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
    """Liệt kê vé điện tử đã mua của người dùng hiện tại kèm QR payload.

    Input:
    - `search`: từ khóa tìm theo mã vé/tên sự kiện.
    - `start_from`, `end_to`: khoảng thời gian lọc.
    - `limit`, `offset`: phân trang.

    Output:
    - Danh sách vé thuộc về user hiện tại.

    Cách hoạt động:
    - Cache riêng theo user và bộ lọc để giảm query lặp khi người dùng đổi tab.
    - Service vẫn kiểm tra quyền sở hữu bằng `user_id`, không lộ vé của người khác.
    """

    # Cache key phải chứa đủ bộ lọc; nếu thiếu sẽ dễ trả nhầm danh sách giữa các truy vấn khác nhau.
    cache_key = (
        search or "",
        start_from.isoformat() if start_from else "",
        end_to.isoformat() if end_to else "",
        limit,
        offset,
    )
    cached = await public_api_cache.get(user_ticket_cache_namespace(current_user.id), cache_key)
    if cached is not None and isinstance(cached, list):
        return cached

    # Không có cache thì đọc database qua service rồi lưu lại 30 giây.
    response = await fetch_my_tickets(
        session,
        user_id=current_user.id,
        search=search,
        start_from=start_from,
        end_to=end_to,
        limit=limit,
        offset=offset,
    )
    return await public_api_cache.set(user_ticket_cache_namespace(current_user.id), cache_key, response, ttl_seconds=30)


@router.delete("/my-tickets/{ticket_id}", response_model=APIMessage)
async def delete_ticket(
    ticket_id: int,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_customer),
) -> APIMessage:
    """Cho phép khách hàng hủy một vé thuộc sở hữu của mình và mở lại ghế.

    Input:
    - `ticket_id`: id vé trên URL.

    Output:
    - Thông báo hủy vé thành công.

    Cách hoạt động:
    - Service xác minh vé thuộc user hiện tại.
    - Khi hủy, ghế quay lại trạng thái available và tạo bản ghi audit hủy vé.
    """

    await cancel_ticket(session, user_id=current_user.id, ticket_id=ticket_id)
    return APIMessage(detail="Đã hủy vé và mở lại ghế")
