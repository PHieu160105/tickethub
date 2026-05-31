"""Schemas for venues, layouts, and reusable layout seats."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class VenueCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    address: str | None = None


class VenueUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    address: str | None = None
    is_active: bool | None = None


class VenueListResponse(BaseModel):
    id: int
    name: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VenueDetailResponse(VenueListResponse):
    address: str | None
    width: int
    height: int
    background_source: str | None = None
    background_type: str | None = None
    created_by_staff_id: int | None = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LayoutCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class LayoutUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None


class LayoutDetailResponse(BaseModel):
    id: int
    venue_id: int
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ArcConfig(BaseModel):
    center_x: float = Field(ge=0.0, le=100.0)
    center_y: float = Field(ge=0.0, le=100.0)
    radius: float = Field(gt=0.0)
    start_angle: float
    end_angle: float


class VenueSeatSingleCreateRequest(BaseModel):
    layout_id: int | None = Field(default=None, ge=1)
    label: str = Field(min_length=1, max_length=100)
    row_label: str | None = Field(default=None, min_length=1, max_length=20)
    seat_number: int | None = Field(default=None, ge=0)
    x: float = Field(ge=0.0, le=100.0)
    y: float = Field(ge=0.0, le=100.0)


class VenueSeatBulkCreateRequest(BaseModel):
    layout_id: int | None = Field(default=None, ge=1)
    pattern: str = Field(default="straight", min_length=1, max_length=20)
    rows: int = Field(default=1, ge=1)
    cols: int = Field(default=1, ge=1)
    gap_x: float = Field(default=3.0, ge=0.0)
    gap_y: float = Field(default=3.0, ge=0.0)
    start_x: float = Field(default=0.0, ge=0.0, le=100.0)
    start_y: float = Field(default=0.0, ge=0.0, le=100.0)
    label_prefix: str = Field(default="A", min_length=1, max_length=12)
    arc_config: ArcConfig | None = None


class VenueSeatUpdateRequest(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=100)
    row_label: str | None = Field(default=None, min_length=1, max_length=20)
    seat_number: int | None = Field(default=None, ge=0)
    x: float | None = Field(default=None, ge=0.0, le=100.0)
    y: float | None = Field(default=None, ge=0.0, le=100.0)


class VenueSeatResponse(BaseModel):
    id: int
    venue_layout_id: int | None
    label: str
    row_label: str | None
    seat_number: int | None
    x: float | None
    y: float | None


class VenueSeatBulkCreateResponse(BaseModel):
    created_count: int
    seats: list[VenueSeatResponse]


class VenueSeatSyncCreateItem(BaseModel):
    client_id: int = Field(lt=0)
    label: str = Field(min_length=1, max_length=100)
    row_label: str | None = Field(default=None, min_length=1, max_length=20)
    seat_number: int | None = Field(default=None, ge=0)
    x: float = Field(ge=0.0, le=100.0)
    y: float = Field(ge=0.0, le=100.0)


class VenueSeatSyncUpdateItem(BaseModel):
    id: int = Field(ge=1)
    label: str = Field(min_length=1, max_length=100)
    row_label: str | None = Field(default=None, min_length=1, max_length=20)
    seat_number: int | None = Field(default=None, ge=0)
    x: float = Field(ge=0.0, le=100.0)
    y: float = Field(ge=0.0, le=100.0)


class VenueSeatSyncRequest(BaseModel):
    layout_id: int | None = Field(default=None, ge=1)
    create: list[VenueSeatSyncCreateItem] = Field(default_factory=list)
    update: list[VenueSeatSyncUpdateItem] = Field(default_factory=list)
    delete_ids: list[int] = Field(default_factory=list)


class VenueSeatSyncCreatedItem(BaseModel):
    client_id: int
    id: int
    label: str
    row_label: str | None
    seat_number: int | None
    x: float | None
    y: float | None


class VenueSeatSyncResponse(BaseModel):
    created: list[VenueSeatSyncCreatedItem]
    updated_ids: list[int]
    deleted_ids: list[int]
