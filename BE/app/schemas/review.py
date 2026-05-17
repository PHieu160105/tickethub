"""Schema đánh giá sự kiện trên trang chi tiết."""

from datetime import datetime

from pydantic import BaseModel, Field


class EventReviewCreateRequest(BaseModel):
    """Payload tạo một đánh giá sự kiện."""

    rating: int = Field(ge=1, le=5)
    content: str = Field(min_length=1, max_length=2000)
    image_url: str | None = Field(default=None, max_length=2_000_000)


class EventReviewResponse(BaseModel):
    """Một dòng đánh giá đã serialize để trả về frontend."""

    id: int
    event_id: int
    user_id: int
    reviewer_name: str
    rating: int
    content: str
    image_url: str | None = None
    created_at: datetime
