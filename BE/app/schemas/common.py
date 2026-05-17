"""Các schema dùng chung cho nhiều nhóm API."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class APIMessage(BaseModel):
    """Payload phản hồi dạng thông báo cho các thao tác không cần trả dữ liệu chi tiết."""

    detail: str


class TimestampSchema(BaseModel):
    """Schema nền chứa thông tin thời điểm tạo và cập nhật bản ghi."""

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
