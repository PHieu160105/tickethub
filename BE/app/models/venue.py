"""Venue and layout ORM models."""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Venue(TimestampMixin, Base):
    """Represents a physical venue (stadium, theater, arena)."""

    __tablename__ = "venues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=True)
    venue_type: Mapped[str] = mapped_column(String(50), nullable=False)  # stadium, theater, arena, custom
    capacity: Mapped[int] = mapped_column(Integer, nullable=True)
    svg_source: Mapped[str] = mapped_column(Text, nullable=True)  # Original SVG
    svg_processed: Mapped[str] = mapped_column(Text, nullable=True)  # Processed with markers
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
    """Configuration/layout for a venue (main floor, mezzanine, etc.)."""

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
    """Zone/section within a layout (VIP, Premium, Standard)."""

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
    """Polygon zone metadata drawn on top of a venue layout."""

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
