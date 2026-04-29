"""Event and seat zone ORM models."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import EventStatus


class Event(TimestampMixin, Base):
    """Represents one sellable show/game/festival."""

    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    venue: Mapped[str] = mapped_column(String(200), nullable=False)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    cover_image_url: Mapped[str] = mapped_column(Text, default="", nullable=False)

    status: Mapped[EventStatus] = mapped_column(Enum(EventStatus, native_enum=False), default=EventStatus.DRAFT, nullable=False)
    hold_minutes: Mapped[int] = mapped_column(Integer, default=10, nullable=False)

    queue_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    queue_release_batch: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    max_active_queue_tokens: Mapped[int] = mapped_column(Integer, default=200, nullable=False)

    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    venue_id: Mapped[int | None] = mapped_column(ForeignKey("venues.id"), nullable=True, index=True)
    venue_layout_id: Mapped[int | None] = mapped_column(ForeignKey("venue_layouts.id"), nullable=True, index=True)

    created_by = relationship("User", back_populates="events_created")
    venue_obj = relationship("Venue", back_populates="events")
    venue_layout = relationship("VenueLayout", back_populates="events")
    zones = relationship("SeatZone", back_populates="event", cascade="all,delete")
    seats = relationship("Seat", back_populates="event", cascade="all,delete")
    orders = relationship("Order", back_populates="event", cascade="all,delete")
    queue_entries = relationship("QueueEntry", back_populates="event", cascade="all,delete")


class SeatZone(TimestampMixin, Base):
    """Configuration block describing one matrix area (e.g. VIP)."""

    __tablename__ = "seat_zones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), index=True, nullable=False)

    code: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    row_count: Mapped[int] = mapped_column(Integer, nullable=False)
    seats_per_row: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#024ddf", nullable=False)

    event = relationship("Event", back_populates="zones")
    seats = relationship("Seat", back_populates="zone", cascade="all,delete")
