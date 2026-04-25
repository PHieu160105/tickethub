"""Virtual queue request/response schemas."""

from datetime import datetime

from pydantic import BaseModel

from app.models.enums import QueueStatus


class QueueJoinResponse(BaseModel):
    """Queue join response containing token and current status."""

    token: str
    status: QueueStatus
    position: int
    message: str
    admitted_until: datetime | None = None


class QueueStatusResponse(BaseModel):
    """Waiting room polling response."""

    token: str
    status: QueueStatus
    position: int | None = None
    admitted_until: datetime | None = None
    message: str


class QueueHeartbeatResponse(BaseModel):
    """Response after refreshing queue token TTL."""

    token: str
    status: QueueStatus
    admitted_until: datetime | None = None
