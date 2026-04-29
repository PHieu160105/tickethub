"""Venue, layout, and section schemas."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


# ── Venue Schemas ──

class VenueCreateRequest(BaseModel):
    """Payload to create a new venue."""

    name: str = Field(min_length=1, max_length=255)
    address: str | None = None
    city: str | None = Field(default=None, max_length=100)
    venue_type: str = Field(default="custom", max_length=50)
    capacity: int | None = Field(default=None, ge=1)
    width: int = Field(default=1000, ge=100)
    height: int = Field(default=600, ge=100)


class VenueUpdateRequest(BaseModel):
    """Payload to update a venue."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    address: str | None = None
    city: str | None = Field(default=None, max_length=100)
    venue_type: str | None = Field(default=None, max_length=50)
    capacity: int | None = Field(default=None, ge=1)
    width: int | None = Field(default=None, ge=100)
    height: int | None = Field(default=None, ge=100)
    is_active: bool | None = None


class VenueListResponse(BaseModel):
    """Short venue shape for listings."""

    id: int
    name: str
    city: str | None
    venue_type: str
    capacity: int | None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VenueDetailResponse(VenueListResponse):
    """Full venue details."""

    address: str | None
    width: int
    height: int
    svg_source: str | None
    svg_processed: str | None
    created_by_user_id: int
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Layout Schemas ──

class LayoutCreateRequest(BaseModel):
    """Payload to create a venue layout."""

    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    svg_data: str | None = None
    sort_order: int = Field(default=0, ge=0)


class LayoutUpdateRequest(BaseModel):
    """Payload to update a layout."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    svg_data: str | None = None
    sort_order: int | None = Field(default=None, ge=0)


class LayoutDetailResponse(BaseModel):
    """Layout details."""

    id: int
    venue_id: int
    name: str
    description: str | None
    svg_data: str | None
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Section Schemas ──

class SectionCreateRequest(BaseModel):
    """Payload to create a section."""

    name: str = Field(min_length=1, max_length=100)
    code: str = Field(min_length=1, max_length=30)
    color: str = Field(default="#024ddf", max_length=20)
    price_base: Decimal = Field(gt=0)
    sort_order: int = Field(default=0, ge=0)


class SectionUpdateRequest(BaseModel):
    """Payload to update a section."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    code: str | None = Field(default=None, min_length=1, max_length=30)
    color: str | None = Field(default=None, max_length=20)
    price_base: Decimal | None = Field(default=None, gt=0)
    sort_order: int | None = Field(default=None, ge=0)


class SectionDetailResponse(BaseModel):
    """Section details."""

    id: int
    venue_layout_id: int
    name: str
    code: str
    color: str
    price_base: Decimal
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
