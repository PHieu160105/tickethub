"""Event, show, and seat zone ORM models."""

from datetime import UTC, date, datetime, time

from sqlalchemy import JSON, Boolean, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import EventStatus


class Event(TimestampMixin, Base):
    """Parent event container that groups one or many sellable shows."""

    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    cover_image_url: Mapped[str] = mapped_column(Text, default="", nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False, index=True, default=date.today)
    end_date: Mapped[date] = mapped_column(Date, nullable=False, index=True, default=date.today)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    status: Mapped[EventStatus] = mapped_column(Enum(EventStatus, native_enum=False), default=EventStatus.DRAFT, nullable=False)

    # Legacy event-level ticketing fields are kept only to support backfill on older databases.
    venue: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    start_at_legacy: Mapped[datetime | None] = mapped_column("start_at", DateTime(timezone=True), nullable=True)
    end_at_legacy: Mapped[datetime | None] = mapped_column("end_at", DateTime(timezone=True), nullable=True)
    hold_minutes: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    queue_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    queue_release_batch: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    max_active_queue_tokens: Mapped[int] = mapped_column(Integer, default=200, nullable=False)
    venue_id: Mapped[int | None] = mapped_column(ForeignKey("venues.id"), nullable=True, index=True)
    venue_layout_id: Mapped[int | None] = mapped_column(ForeignKey("venue_layouts.id"), nullable=True, index=True)

    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    created_by = relationship("User", back_populates="events_created")
    venue_obj = relationship("Venue", back_populates="events")
    venue_layout = relationship("VenueLayout", back_populates="events")
    shows = relationship("Show", back_populates="event", cascade="all,delete")
    reviews = relationship("EventReview", back_populates="event", cascade="all,delete")

    @property
    def start_at(self) -> datetime:
        """Expose date-only events as a synthetic UTC datetime for legacy responses."""

        return datetime.combine(self.start_date, time.min, tzinfo=UTC)

    @property
    def end_at(self) -> datetime:
        """Expose date-only events as a synthetic UTC datetime for legacy responses."""

        return datetime.combine(self.end_date, time.max, tzinfo=UTC)


class Show(TimestampMixin, Base):
    """Sellable ticketing unit bound to one parent event."""

    __tablename__ = "shows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    venue: Mapped[str] = mapped_column(String(200), nullable=False)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    status: Mapped[EventStatus] = mapped_column(Enum(EventStatus, native_enum=False), default=EventStatus.DRAFT, nullable=False)
    hold_minutes: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    queue_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    queue_release_batch: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    max_active_queue_tokens: Mapped[int] = mapped_column(Integer, default=200, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    venue_id: Mapped[int | None] = mapped_column(ForeignKey("venues.id"), nullable=True, index=True)
    venue_layout_id: Mapped[int | None] = mapped_column(ForeignKey("venue_layouts.id"), nullable=True, index=True)

    event = relationship("Event", back_populates="shows")
    created_by = relationship("User", back_populates="shows_created")
    venue_obj = relationship("Venue")
    venue_layout = relationship("VenueLayout")
    zones = relationship("SeatZone", back_populates="show", cascade="all,delete")
    seats = relationship("Seat", back_populates="show", cascade="all,delete")
    polygons = relationship("ShowPolygon", back_populates="show", cascade="all,delete")
    orders = relationship("Order", back_populates="show", cascade="all,delete")
    queue_entries = relationship("QueueEntry", back_populates="show", cascade="all,delete")


class SeatZone(TimestampMixin, Base):
    """Configuration block describing one sellable seating area of a show."""

    __tablename__ = "seat_zones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int | None] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), index=True, nullable=True)
    show_id: Mapped[int | None] = mapped_column(ForeignKey("shows.id", ondelete="CASCADE"), index=True, nullable=True)

    code: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    row_count: Mapped[int] = mapped_column(Integer, nullable=False)
    seats_per_row: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#024ddf", nullable=False)

    show = relationship("Show", back_populates="zones")
    seats = relationship("Seat", back_populates="zone", cascade="all,delete")
    polygons = relationship("ShowPolygon", back_populates="zone", cascade="all,delete")


class ShowPolygon(TimestampMixin, Base):
    """Polygon metadata drawn on top of one show's free-form seat plan."""

    __tablename__ = "show_polygons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    show_id: Mapped[int] = mapped_column(ForeignKey("shows.id", ondelete="CASCADE"), nullable=False, index=True)
    zone_id: Mapped[int | None] = mapped_column(ForeignKey("seat_zones.id", ondelete="SET NULL"), nullable=True, index=True)
    label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    points: Mapped[list[dict[str, float]]] = mapped_column(JSON, nullable=False)

    show = relationship("Show", back_populates="polygons")
    zone = relationship("SeatZone", back_populates="polygons")
