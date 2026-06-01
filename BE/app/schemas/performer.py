"""Schema cho nghệ sĩ và lineup theo show."""

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import PerformerRole

MAX_PERFORMER_IMAGE_BYTES = 10 * 1024 * 1024
MAX_PERFORMER_IMAGE_DATA_URL_LENGTH = 14_000_000


class PublicShowPerformerResponse(BaseModel):
    """Thông tin performer được phép hiển thị public trên show."""

    performer_id: int
    stage_name: str
    artist_type: str | None = None
    image_url: str | None = None
    role: PerformerRole
    sort_order: int


class AdminShowPerformerResponse(PublicShowPerformerResponse):
    """Thông tin performer đầy đủ cho popup quản trị lineup."""

    show_performer_id: int
    show_id: int


class ShowPerformerUpsertRequest(BaseModel):
    """Một row performer trong payload cập nhật lineup của show."""

    show_performer_id: int | None = None
    performer_id: int | None = None
    stage_name: str = Field(min_length=1, max_length=255)
    artist_type: str | None = Field(default=None, max_length=120)
    image_url: str | None = Field(default=None, max_length=MAX_PERFORMER_IMAGE_DATA_URL_LENGTH)
    role: PerformerRole
    sort_order: int = Field(default=0, ge=0, le=10_000)


class ShowPerformerBulkUpdateRequest(BaseModel):
    """Snapshot đầy đủ lineup của một show khi admin bấm lưu."""

    performers: list[ShowPerformerUpsertRequest] = Field(default_factory=list)


class PerformerSuggestionResponse(BaseModel):
    """Gợi ý performer cho autocomplete admin."""

    id: int
    stage_name: str
    artist_type: str | None = None
    show_count: int = 0
    has_image: bool = False

    model_config = ConfigDict(from_attributes=True)


class PerformerDetailResponse(BaseModel):
    """Chi tiết performer để autofill popup admin sau khi chọn gợi ý."""

    id: int
    stage_name: str
    artist_type: str | None = None
    image_url: str | None = None

    model_config = ConfigDict(from_attributes=True)
