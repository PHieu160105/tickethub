"""ORM model for template seats and transitional show-seat compatibility."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym

from app.models.base import Base, TimestampMixin
from app.models.enums import SeatStatus, sa_enum


class Seat(TimestampMixin, Base):
    __tablename__ = "seats"
    __table_args__ = (UniqueConstraint("show_id", "label", name="uq_seats_show_id_seat_label"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int | None] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=True, index=True)
    show_id: Mapped[int | None] = mapped_column(ForeignKey("shows.id", ondelete="CASCADE"), nullable=True, index=True)
    zone_id: Mapped[int | None] = mapped_column(ForeignKey("ticket_tiers.id", ondelete="CASCADE"), nullable=True, index=True)

    row_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    row_label: Mapped[str] = mapped_column(String(12), nullable=False)
    seat_number: Mapped[int] = mapped_column(Integer, nullable=False)
    seat_label: Mapped[str] = mapped_column("label", String(40), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)

    status: Mapped[SeatStatus] = mapped_column(sa_enum(SeatStatus), default=SeatStatus.AVAILABLE, nullable=False, index=True)
    lock_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    locked_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    is_admin_locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    x_coord: Mapped[float | None] = mapped_column("x", Numeric(5, 2), nullable=True)
    y_coord: Mapped[float | None] = mapped_column("y", Numeric(5, 2), nullable=True)
    rotation: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    section_id: Mapped[int | None] = mapped_column(ForeignKey("sections.id", ondelete="SET NULL"), nullable=True, index=True)
    venue_layout_id: Mapped[int | None] = mapped_column(ForeignKey("venue_layouts.id", ondelete="SET NULL"), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    label = synonym("seat_label")
    x = synonym("x_coord")
    y = synonym("y_coord")

    zone = relationship("TicketTier", back_populates="seats")
    show = relationship("Show", back_populates="seats")
    locked_by_user = relationship("User", back_populates="locked_seats", foreign_keys=[locked_by_user_id])
    section = relationship("Section", back_populates="seats")
    venue_layout = relationship("VenueLayout", back_populates="seats")
    tickets = relationship("Ticket", back_populates="seat")
