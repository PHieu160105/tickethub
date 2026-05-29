"""ORM models for events, shows, tiers, and planner overlays."""

from datetime import date, datetime, time, timezone

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym

from app.models.base import Base, TimestampMixin
from app.models.enums import EventCategory, EventStatus, SeatSource, sa_enum


class Event(TimestampMixin, Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[EventCategory] = mapped_column(sa_enum(EventCategory), nullable=False, index=True)
    cover_image_url: Mapped[str] = mapped_column(Text, default="", nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False, index=True, default=date.today)
    end_date: Mapped[date] = mapped_column(Date, nullable=False, index=True, default=date.today)
    status: Mapped[EventStatus] = mapped_column(sa_enum(EventStatus), default=EventStatus.DRAFT, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)

    # Legacy event-level fields are kept for compatibility with older services and data backfill.
    venue: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    start_at_legacy: Mapped[datetime | None] = mapped_column("start_at", DateTime(timezone=True), nullable=True)
    end_at_legacy: Mapped[datetime | None] = mapped_column("end_at", DateTime(timezone=True), nullable=True)
    hold_minutes: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    venue_id: Mapped[int | None] = mapped_column(ForeignKey("venues.id", ondelete="SET NULL"), nullable=True, index=True)
    venue_layout_id: Mapped[int | None] = mapped_column(ForeignKey("venue_layouts.id", ondelete="SET NULL"), nullable=True, index=True)

    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    created_by = relationship("User", back_populates="events_created")
    venue_obj = relationship("Venue", back_populates="events")
    venue_layout = relationship("VenueLayout", back_populates="events")
    shows = relationship("Show", back_populates="event", cascade="all,delete")

    @property
    def start_at(self) -> datetime:
        return datetime.combine(self.start_date, time.min, tzinfo=timezone.utc)

    @property
    def end_at(self) -> datetime:
        return datetime.combine(self.end_date, time.max, tzinfo=timezone.utc)


class Show(TimestampMixin, Base):
    __tablename__ = "shows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    venue: Mapped[str] = mapped_column("location", String(200), nullable=False)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    status: Mapped[EventStatus] = mapped_column(sa_enum(EventStatus), default=EventStatus.DRAFT, nullable=False)
    seat_source: Mapped[SeatSource] = mapped_column(sa_enum(SeatSource), default=SeatSource.LAYOUT, nullable=False)
    hold_minutes: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    venue_id: Mapped[int | None] = mapped_column(ForeignKey("venues.id", ondelete="SET NULL"), nullable=True, index=True)
    venue_layout_id: Mapped[int | None] = mapped_column(ForeignKey("venue_layouts.id", ondelete="SET NULL"), nullable=True, index=True)

    location = synonym("venue")

    event = relationship("Event", back_populates="shows")
    created_by = relationship("User", back_populates="shows_created")
    venue_obj = relationship("Venue")
    venue_layout = relationship("VenueLayout")
    zones = relationship("TicketTier", back_populates="show", cascade="all,delete")
    seats = relationship("Seat", back_populates="show", cascade="all,delete")
    tickets = relationship("Ticket", back_populates="show", cascade="all,delete")
    polygons = relationship("ShowPolygon", back_populates="show", cascade="all,delete")
    orders = relationship("Order", back_populates="show", cascade="all,delete")
    queue_entries = relationship("QueueEntry", back_populates="show", cascade="all,delete")
    show_performers = relationship("ShowPerformer", back_populates="show", cascade="all,delete-orphan")


class TicketTier(TimestampMixin, Base):
    __tablename__ = "ticket_tiers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int | None] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), index=True, nullable=True)
    show_id: Mapped[int | None] = mapped_column(ForeignKey("shows.id", ondelete="CASCADE"), index=True, nullable=True)
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    base_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#024ddf", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Legacy planner fields; still used by show-planner matrix generation until routes move fully to v2.
    row_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    seats_per_row: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    show = relationship("Show", back_populates="zones")
    seats = relationship("Seat", back_populates="zone", cascade="all,delete")
    tickets = relationship("Ticket", back_populates="ticket_tier")
    polygons = relationship("ShowPolygon", back_populates="zone", cascade="all,delete")

    @property
    def price(self) -> float:
        return float(self.base_price)

    @price.setter
    def price(self, value: float) -> None:
        self.base_price = value


SeatZone = TicketTier


class ShowPolygon(TimestampMixin, Base):
    __tablename__ = "show_polygons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    show_id: Mapped[int] = mapped_column(ForeignKey("shows.id", ondelete="CASCADE"), nullable=False, index=True)
    zone_id: Mapped[int | None] = mapped_column(ForeignKey("ticket_tiers.id", ondelete="SET NULL"), nullable=True, index=True)
    label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    points: Mapped[list[dict[str, float]]] = mapped_column(JSON, nullable=False)

    show = relationship("Show", back_populates="polygons")
    zone = relationship("TicketTier", back_populates="polygons")
