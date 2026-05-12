"""Review schemas for event detail page."""

from datetime import datetime

from pydantic import BaseModel, Field


class EventReviewCreateRequest(BaseModel):
    """Payload to create one event review."""

    rating: int = Field(ge=1, le=5)
    content: str = Field(min_length=1, max_length=2000)
    image_url: str | None = Field(default=None, max_length=2_000_000)


class EventReviewResponse(BaseModel):
    """Serialized review row."""

    id: int
    event_id: int
    user_id: int
    reviewer_name: str
    rating: int
    content: str
    image_url: str | None = None
    created_at: datetime
