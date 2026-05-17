"""Schema địa điểm, bố cục, khu vực và builder ghế mẫu."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


# ── Schema địa điểm ──

class VenueCreateRequest(BaseModel):
    """Payload tạo địa điểm mới."""

    name: str = Field(min_length=1, max_length=255)
    address: str | None = None
    city: str | None = Field(default=None, max_length=100)
    venue_type: str = Field(default="custom", max_length=50)
    capacity: int | None = Field(default=None, ge=1)
    width: int = Field(default=1000, ge=100)
    height: int = Field(default=600, ge=100)


class VenueUpdateRequest(BaseModel):
    """Payload cập nhật địa điểm."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    address: str | None = None
    city: str | None = Field(default=None, max_length=100)
    venue_type: str | None = Field(default=None, max_length=50)
    capacity: int | None = Field(default=None, ge=1)
    width: int | None = Field(default=None, ge=100)
    height: int | None = Field(default=None, ge=100)
    is_active: bool | None = None


class VenueListResponse(BaseModel):
    """Payload tóm tắt địa điểm cho danh sách."""

    id: int
    name: str
    city: str | None
    venue_type: str
    capacity: int | None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VenueDetailResponse(VenueListResponse):
    """Payload chi tiết địa điểm."""

    address: str | None
    width: int
    height: int
    background_source: str | None = None
    background_processed: str | None = None
    background_type: str | None = None
    can_parse_background: bool = False
    svg_source: str | None
    svg_processed: str | None
    created_by_user_id: int
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Schema bố cục ──

class LayoutCreateRequest(BaseModel):
    """Payload tạo bố cục cho địa điểm."""

    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    svg_data: str | None = None
    sort_order: int = Field(default=0, ge=0)


class LayoutUpdateRequest(BaseModel):
    """Payload cập nhật bố cục."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    svg_data: str | None = None
    sort_order: int | None = Field(default=None, ge=0)


class LayoutDetailResponse(BaseModel):
    """Payload chi tiết bố cục."""

    id: int
    venue_id: int
    name: str
    description: str | None
    svg_data: str | None
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Schema khu vực ──

class SectionCreateRequest(BaseModel):
    """Payload tạo khu vực trong bố cục."""

    name: str = Field(min_length=1, max_length=100)
    code: str = Field(min_length=1, max_length=30)
    color: str = Field(default="#024ddf", max_length=20)
    price_base: Decimal = Field(gt=0)
    sort_order: int = Field(default=0, ge=0)


class SectionUpdateRequest(BaseModel):
    """Payload cập nhật khu vực."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    code: str | None = Field(default=None, min_length=1, max_length=30)
    color: str | None = Field(default=None, max_length=20)
    price_base: Decimal | None = Field(default=None, gt=0)
    sort_order: int | None = Field(default=None, ge=0)


class SectionDetailResponse(BaseModel):
    """Payload chi tiết khu vực."""

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


class PolygonPoint(BaseModel):
    x: float = Field(ge=0.0, le=100.0)
    y: float = Field(ge=0.0, le=100.0)


class ArcConfig(BaseModel):
    center_x: float = Field(ge=0.0, le=100.0)
    center_y: float = Field(ge=0.0, le=100.0)
    radius: float = Field(gt=0.0)
    start_angle: float
    end_angle: float


class VenueSeatSingleCreateRequest(BaseModel):
    layout_id: int | None = Field(default=None, ge=1)
    label: str = Field(min_length=1, max_length=100)
    x: float = Field(ge=0.0, le=100.0)
    y: float = Field(ge=0.0, le=100.0)
    rotation: float = Field(default=0.0, ge=0.0, le=360.0)
    section_id: int | None = Field(default=None, ge=1)
    is_admin_locked: bool = False


class VenueSeatBulkCreateRequest(BaseModel):
    layout_id: int | None = Field(default=None, ge=1)
    section_id: int | None = Field(default=None, ge=1)
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
    x: float | None = Field(default=None, ge=0.0, le=100.0)
    y: float | None = Field(default=None, ge=0.0, le=100.0)
    rotation: float | None = Field(default=None, ge=0.0, le=360.0)
    section_id: int | None = Field(default=None, ge=1)
    is_admin_locked: bool | None = None


class VenueSeatResponse(BaseModel):
    id: int
    venue_layout_id: int | None
    section_id: int | None
    section_name: str | None = None
    label: str
    x: float | None
    y: float | None
    rotation: float
    is_admin_locked: bool = False


class VenueSeatBulkCreateResponse(BaseModel):
    created_count: int
    seats: list[VenueSeatResponse]


class VenueSeatSyncCreateItem(BaseModel):
    client_id: int = Field(lt=0)
    label: str = Field(min_length=1, max_length=100)
    x: float = Field(ge=0.0, le=100.0)
    y: float = Field(ge=0.0, le=100.0)
    rotation: float = Field(default=0.0, ge=0.0, le=360.0)
    section_id: int | None = Field(default=None, ge=1)
    is_admin_locked: bool = False


class VenueSeatSyncUpdateItem(BaseModel):
    id: int = Field(ge=1)
    label: str = Field(min_length=1, max_length=100)
    x: float = Field(ge=0.0, le=100.0)
    y: float = Field(ge=0.0, le=100.0)
    rotation: float = Field(default=0.0, ge=0.0, le=360.0)
    section_id: int | None = Field(default=None, ge=1)
    is_admin_locked: bool = False


class VenueSeatSyncRequest(BaseModel):
    layout_id: int | None = Field(default=None, ge=1)
    create: list[VenueSeatSyncCreateItem] = Field(default_factory=list)
    update: list[VenueSeatSyncUpdateItem] = Field(default_factory=list)
    delete_ids: list[int] = Field(default_factory=list)


class VenueSeatSyncCreatedItem(BaseModel):
    client_id: int
    id: int
    label: str
    x: float | None
    y: float | None


class VenueSeatSyncResponse(BaseModel):
    created: list[VenueSeatSyncCreatedItem]
    updated_ids: list[int]
    deleted_ids: list[int]


class PolygonCreateRequest(BaseModel):
    layout_id: int | None = Field(default=None, ge=1)
    section_id: int | None = Field(default=None, ge=1)
    label: str | None = Field(default=None, max_length=100)
    points: list[PolygonPoint] = Field(min_length=3)


class PolygonUpdateRequest(BaseModel):
    section_id: int | None = Field(default=None, ge=1)
    label: str | None = Field(default=None, max_length=100)
    points: list[PolygonPoint] | None = Field(default=None, min_length=3)


class PolygonResponse(BaseModel):
    id: int
    venue_id: int
    venue_layout_id: int
    section_id: int | None
    section_name: str | None = None
    label: str | None
    points: list[PolygonPoint]
    created_at: datetime
    updated_at: datetime
