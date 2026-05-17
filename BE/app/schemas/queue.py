"""Schema request/response cho hàng đợi ảo."""

from datetime import datetime

from pydantic import BaseModel

from app.models.enums import QueueStatus


class QueueJoinResponse(BaseModel):
    """Phản hồi khi tham gia hàng đợi, gồm token và trạng thái hiện tại."""

    token: str
    status: QueueStatus
    position: int
    message: str
    admitted_until: datetime | None = None


class QueueStatusResponse(BaseModel):
    """Phản hồi polling trạng thái phòng chờ."""

    token: str
    status: QueueStatus
    position: int | None = None
    admitted_until: datetime | None = None
    message: str


class QueueHeartbeatResponse(BaseModel):
    """Phản hồi sau khi làm mới mốc hoạt động của token hàng đợi."""

    token: str
    status: QueueStatus
    admitted_until: datetime | None = None
