"""DTO cho trung tâm hỗ trợ và chat realtime."""

from datetime import datetime

from pydantic import BaseModel, Field


class HelpMessageCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=5000)


class HelpMessageResponse(BaseModel):
    id: int
    thread_id: int
    sender_id: int
    sender_role: str
    content: str
    message_type: str
    read_at: datetime | None
    created_at: datetime


class HelpThreadResponse(BaseModel):
    id: int
    customer_id: int
    customer_name: str
    customer_email: str
    last_message_at: datetime
    last_message_preview: str
    status: str
    unread_admin: int
    unread_customer: int
    created_at: datetime
    updated_at: datetime
