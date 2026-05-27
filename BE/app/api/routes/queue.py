"""Các endpoint HTTP cho hàng đợi ảo của từng buổi diễn.

Ghi chú cho người đọc:
- File route chỉ nhận request, kiểm tra đăng nhập/rate limit và gọi service.
- Thuật toán cấp lượt thật nằm trong `app/services/queue_service.py`.
"""

# `APIRouter`, `Depends` là class/hàm của FastAPI dùng để khai báo route và dependency.
from fastapi import APIRouter, Depends, HTTPException, status

# `AsyncSession` là phiên làm việc bất đồng bộ với database của SQLAlchemy.
from sqlalchemy.ext.asyncio import AsyncSession

# Các import dưới đây là code nội bộ của project.
from app.api.deps import get_current_user
from app.core.db import get_db_session
from app.core.rate_limit import rate_limit
from app.models.enums import EventStatus
from app.models.event import Event
from app.models.user import User
from app.schemas.common import APIMessage
from app.schemas.queue import QueueHeartbeatResponse, QueueJoinResponse, QueueRequirementResponse, QueueStatusResponse
from app.services.event_service import get_show_by_id
from app.services.queue_service import (
    get_queue_requirement_details,
    get_queue_status,
    heartbeat_queue_token,
    join_show_queue,
    leave_queue_token,
)

# Mọi route trong file này đều nằm dưới `/api/shows/{show_id}/queue`.
router = APIRouter(prefix="/shows/{show_id}/queue", tags=["queue"])


async def _get_public_show_or_404(session: AsyncSession, show_id: int):
    show = await get_show_by_id(session, show_id)
    event = await session.get(Event, show.event_id)
    if show.status != EventStatus.LIVE or not event or event.status != EventStatus.LIVE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy buổi diễn")
    return show


@router.post("/join", response_model=QueueJoinResponse, dependencies=[Depends(rate_limit("queue-join", times=5, seconds=60))])
async def join_queue(
    show_id: int,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> QueueJoinResponse:
    """Tham gia hàng đợi của một buổi diễn và nhận token chờ/được vào.

    Input:
    - `show_id`: id buổi diễn lấy từ URL.
    - `session`: phiên database do FastAPI inject.
    - `current_user`: user đã đăng nhập lấy từ JWT.

    Output:
    - `QueueJoinResponse` gồm token, trạng thái, vị trí và hạn vào nếu được cấp lượt.

    Cách hoạt động:
    - Rate limit chặn user spam join quá 5 lần/phút.
    - Route lấy show từ database rồi ủy quyền toàn bộ thuật toán cho `join_show_queue`.
    """

    # Lấy show để service biết cấu hình queue của buổi diễn: bật/tắt, batch, số slot active.
    show = await _get_public_show_or_404(session, show_id)

    # Service tự quyết định user được `admitted` ngay hay phải `waiting`.
    return await join_show_queue(session, show=show, user_id=current_user.id)


@router.get("/check", response_model=QueueRequirementResponse, dependencies=[Depends(rate_limit("queue-check", times=30, seconds=60))])
async def queue_requirement(
    show_id: int,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> QueueRequirementResponse:
    """Kiểm tra show hiện có cần phòng chờ hay không trước khi chuyển sang màn chọn ghế."""

    show = await _get_public_show_or_404(session, show_id)
    required, active_users, threshold = await get_queue_requirement_details(session, show=show, user_id=current_user.id)
    message = (
        "Lưu lượng đã chạm ngưỡng, người dùng cần đi qua phòng chờ."
        if required
        else "Lưu lượng chưa chạm ngưỡng, người dùng có thể vào chọn ghế ngay."
    )
    return QueueRequirementResponse(required=required, active_users=active_users, threshold=threshold, message=message)


@router.get("/status/{token}", response_model=QueueStatusResponse, dependencies=[Depends(rate_limit("queue-status", times=60, seconds=60))])
async def queue_status(
    show_id: int,
    token: str,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> QueueStatusResponse:
    """Polling trạng thái và vị trí hiện tại trong hàng đợi.

    Input:
    - `show_id`: id buổi diễn.
    - `token`: token hàng đợi client đang giữ trong sessionStorage.
    - `current_user`: user hiện tại, dùng để chống xem token của người khác.

    Output:
    - `QueueStatusResponse` cho biết user đang chờ, đã được vào, hết hạn hay hoàn tất.

    Cách hoạt động:
    - Frontend gọi route này mỗi vài giây trên trang phòng chờ.
    - Rate limit 60 lần/phút đủ cho polling nhưng chặn vòng lặp lỗi quá nhanh.
    """

    await _get_public_show_or_404(session, show_id)
    # Service kiểm tra token có thuộc đúng user/show không rồi tính vị trí hiện tại.
    return await get_queue_status(session, show_id=show_id, token=token, user_id=current_user.id)


@router.post("/heartbeat/{token}", response_model=QueueHeartbeatResponse, dependencies=[Depends(rate_limit("queue-heartbeat", times=30, seconds=60))])
async def queue_heartbeat(
    show_id: int,
    token: str,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> QueueHeartbeatResponse:
    """Cập nhật mốc hoạt động của token hàng đợi đã được cấp lượt.

    Input:
    - `show_id`: id buổi diễn.
    - `token`: token đã ở trạng thái `ADMITTED`.
    - `current_user`: user sở hữu token.

    Output:
    - Token, trạng thái hiện tại và thời điểm hết hạn lượt vào.

    Cách hoạt động:
    - Frontend gọi định kỳ để backend biết user vẫn còn hoạt động.
    - Nếu token hết hạn, service trả lỗi 410 để frontend quay lại hàng đợi.
    """

    await _get_public_show_or_404(session, show_id)
    # `heartbeat_queue_token` chỉ nhận token đã admitted; token waiting sẽ bị từ chối.
    entry = await heartbeat_queue_token(session, show_id=show_id, token=token, user_id=current_user.id)
    return QueueHeartbeatResponse(token=entry.token, status=entry.status, admitted_until=entry.expires_at)


@router.post("/leave/{token}", response_model=APIMessage, dependencies=[Depends(rate_limit("queue-leave", times=30, seconds=60))])
async def leave_queue(
    show_id: int,
    token: str,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> APIMessage:
    """Hủy lượt hàng đợi khi người dùng rời luồng mua vé trước khi thanh toán."""

    await _get_public_show_or_404(session, show_id)
    expired = await leave_queue_token(session, show_id=show_id, token=token, user_id=current_user.id)
    return APIMessage(detail="Đã rời phòng chờ" if expired else "Không có lượt phòng chờ đang hoạt động")
