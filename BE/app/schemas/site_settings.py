"""Schemas for lightweight site settings persistence."""

from pydantic import BaseModel, Field, field_validator


class SiteSettingsPayload(BaseModel):
    """Shared request/response payload for public site settings."""

    site_name: str = Field(default="TicketRush", min_length=1, max_length=120)
    contact_email: str = Field(default="contact@ticketrush.com", min_length=3, max_length=255)
    contact_phone: str = Field(default="+84 123 456 789", min_length=3, max_length=60)
    website: str = Field(default="https://ticketrush.com", min_length=3, max_length=255)
    address: str = Field(default="Hà Nội, Việt Nam", min_length=3, max_length=255)
    description: str = Field(default="Nền tảng đặt vé trực tuyến dành cho các sự kiện nổi bật.", min_length=3, max_length=500)

    @field_validator("*", mode="before")
    @classmethod
    def strip_string_values(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

