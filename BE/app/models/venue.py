"""ORM models for venues and reusable layouts."""

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Venue(TimestampMixin, Base):
    __tablename__ = "venues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    svg_source: Mapped[str | None] = mapped_column(Text, nullable=True)
    width: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    height: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by_staff_id: Mapped[int] = mapped_column(ForeignKey("event_staff.user_id"), nullable=False, index=True)

    created_by_staff = relationship(
        "User",
        back_populates="created_venues",
        foreign_keys=[created_by_staff_id],
        primaryjoin="User.id == foreign(Venue.created_by_staff_id)",
    )
    layouts = relationship("VenueLayout", back_populates="venue", cascade="all,delete")

    @property
    def created_by_user_id(self) -> int:
        return self.created_by_staff_id

    @property
    def city(self) -> None:
        return None

    @property
    def venue_type(self) -> str:
        return "custom"

    @property
    def background_source(self) -> str | None:
        return self.svg_source

    @property
    def background_type(self) -> str | None:
        if not self.svg_source:
            return None
        if "<svg" in self.svg_source[:500].lower():
            return "svg"
        return "raster"

class VenueLayout(TimestampMixin, Base):
    __tablename__ = "venue_layouts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    venue_id: Mapped[int] = mapped_column(ForeignKey("venues.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    venue = relationship("Venue", back_populates="layouts")
    seats = relationship("Seat", back_populates="venue_layout", cascade="all,delete")

    @property
    def svg_data(self) -> None:
        return None

    @property
    def sort_order(self) -> int:
        return 0
