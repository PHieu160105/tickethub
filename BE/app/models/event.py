"""ORM models for events, shows, tiers, and event assignments."""

from datetime import date, datetime, time, timezone

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
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
    created_by_staff_id: Mapped[int] = mapped_column(ForeignKey("event_staff.user_id"), nullable=False, index=True)

    created_by_staff = relationship(
        "User",
        back_populates="created_events",
        foreign_keys=[created_by_staff_id],
        primaryjoin="User.id == foreign(Event.created_by_staff_id)",
    )
    assignments = relationship("EventAssignment", back_populates="event", cascade="all,delete-orphan")
    shows = relationship("Show", back_populates="event", cascade="all,delete")

    @property
    def created_by_user_id(self) -> int:
        return self.created_by_staff_id

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
    created_by_staff_id: Mapped[int] = mapped_column(ForeignKey("event_staff.user_id"), nullable=False, index=True)
    venue_layout_id: Mapped[int | None] = mapped_column(ForeignKey("venue_layouts.id", ondelete="SET NULL"), nullable=True, index=True)

    location = synonym("venue")

    event = relationship("Event", back_populates="shows")
    created_by_staff = relationship(
        "User",
        back_populates="created_shows",
        foreign_keys=[created_by_staff_id],
        primaryjoin="User.id == foreign(Show.created_by_staff_id)",
    )
    venue_layout = relationship("VenueLayout")
    ticket_tiers = relationship("TicketTier", back_populates="show", cascade="all,delete")
    tickets = relationship("Ticket", back_populates="show", cascade="all,delete")
    orders = relationship("Order", back_populates="show", cascade="all,delete")
    show_performers = relationship("ShowPerformer", back_populates="show", cascade="all,delete-orphan")
    @property
    def created_by_user_id(self) -> int:
        return self.created_by_staff_id


class TicketTier(TimestampMixin, Base):
    __tablename__ = "ticket_tiers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    show_id: Mapped[int] = mapped_column(ForeignKey("shows.id", ondelete="CASCADE"), index=True, nullable=False)
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    base_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#024ddf", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    show = relationship("Show", back_populates="ticket_tiers")
    tickets = relationship("Ticket", back_populates="ticket_tier")

    @property
    def price(self) -> float:
        return float(self.base_price)

    @price.setter
    def price(self, value: float) -> None:
        self.base_price = value

class EventAssignment(TimestampMixin, Base):
    __tablename__ = "event_assignments"
    __table_args__ = (UniqueConstraint("event_id", "staff_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    staff_id: Mapped[int] = mapped_column(ForeignKey("event_staff.user_id", ondelete="CASCADE"), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    event = relationship("Event", back_populates="assignments")
    staff = relationship(
        "User",
        back_populates="event_assignments",
        foreign_keys=[staff_id],
        primaryjoin="User.id == foreign(EventAssignment.staff_id)",
    )
