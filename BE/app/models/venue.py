"""Khai báo các mô hình ORM cho venue, layout, section và polygon."""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Venue(TimestampMixin, Base):
    """Đại diện cho địa điểm vật lý nơi show được tổ chức.

    Input:
    - Tên venue, địa chỉ, loại venue, sức chứa và dữ liệu nền sơ đồ.

    Output:
    - Một bản ghi `venues` là gốc cha cho nhiều `VenueLayout`.

    Cách hoạt động:
    - Venue chứa metadata vật lý chung.
    - Các layout con mô tả nhiều mặt sàn hoặc cấu hình chỗ ngồi khác nhau của cùng một venue.
    """

    __tablename__ = "venues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=True)
    venue_type: Mapped[str] = mapped_column(String(50), nullable=False)  # Loại venue như sân vận động, nhà hát, arena hoặc cấu hình tùy biến.
    svg_source: Mapped[str] = mapped_column(Text, nullable=True)  # Dữ liệu nền gốc được tải lên.
    svg_processed: Mapped[str] = mapped_column(Text, nullable=True)  # Dữ liệu nền đã qua tiền xử lý để gắn marker hoặc parse.
    width: Mapped[int] = mapped_column(Integer, default=1000, nullable=False)
    height: Mapped[int] = mapped_column(Integer, default=600, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    created_by = relationship("User", back_populates="venues")
    layouts = relationship("VenueLayout", back_populates="venue", cascade="all,delete")
    events = relationship("Event", back_populates="venue_obj")

    @property
    def background_source(self) -> str | None:
        return self.svg_source

    @property
    def background_processed(self) -> str | None:
        return self.svg_processed

    @property
    def background_type(self) -> str | None:
        if not self.svg_source:
            return None
        if "<svg" in self.svg_source[:500].lower():
            return "svg"
        if self.svg_source.startswith("data:image/"):
            return "raster"
        return "unknown"

    @property
    def can_parse_background(self) -> bool:
        return self.background_type == "svg"


class VenueLayout(TimestampMixin, Base):
    """Đại diện cho một cấu hình layout cụ thể của venue.

    Input:
    - `venue_id`, tên layout, mô tả, dữ liệu SVG và thứ tự sắp xếp.

    Output:
    - Một bản ghi `venue_layouts` để quản lý nhiều mặt sàn hoặc biến thể cấu hình.

    Cách hoạt động:
    - Một venue có thể có nhiều layout như main floor, balcony, mezzanine.
    """

    __tablename__ = "venue_layouts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    venue_id: Mapped[int] = mapped_column(ForeignKey("venues.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    svg_data: Mapped[str] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    venue = relationship("Venue", back_populates="layouts")
    sections = relationship("Section", back_populates="layout", cascade="all,delete")
    seats = relationship("Seat", back_populates="venue_layout", cascade="all,delete")
    events = relationship("Event", back_populates="venue_layout")


class Section(TimestampMixin, Base):
    """Đại diện cho một section bên trong một layout của venue.

    Input:
    - Tên section, mã section, màu hiển thị và giá nền.

    Output:
    - Một bản ghi `sections` dùng để nhóm ghế trong venue builder.

    Cách hoạt động:
    - Section thường ánh xạ sang khái niệm khu vực như VIP, Premium, Standard.
    """

    __tablename__ = "sections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    venue_layout_id: Mapped[int] = mapped_column(ForeignKey("venue_layouts.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#024ddf", nullable=False)
    price_base: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    layout = relationship("VenueLayout", back_populates="sections")
    seats = relationship("Seat", back_populates="section")


class Polygon(TimestampMixin, Base):
    """Đại diện cho metadata polygon vẽ trên layout của venue.

    Input:
    - `venue_id`, `venue_layout_id`, `section_id` tùy chọn và danh sách điểm polygon.

    Output:
    - Một bản ghi `polygons` dùng để tô vùng trực quan trong venue builder.

    Cách hoạt động:
    - Polygon có thể được gắn với section để phản ánh biên khu vực trên sơ đồ.
    """

    __tablename__ = "polygons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    venue_id: Mapped[int] = mapped_column(ForeignKey("venues.id", ondelete="CASCADE"), nullable=False, index=True)
    venue_layout_id: Mapped[int] = mapped_column(ForeignKey("venue_layouts.id", ondelete="CASCADE"), nullable=False, index=True)
    section_id: Mapped[int | None] = mapped_column(ForeignKey("sections.id", ondelete="SET NULL"), nullable=True, index=True)
    label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    points: Mapped[list[dict[str, float]]] = mapped_column(JSON, nullable=False)

    venue = relationship("Venue")
    layout = relationship("VenueLayout")
    section = relationship("Section")
