"""Shared schema pieces."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class APIMessage(BaseModel):
    """Simple message response for operations without payload."""

    detail: str


class TimestampSchema(BaseModel):
    """Base response schema containing timestamp metadata."""

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
