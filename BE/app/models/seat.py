"""Seat ORM model and lifecycle fields."""

from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import SeatStatus


class Seat(TimestampMixin, Base):
    """A concrete seat that can transition through available/locked/sold."""

    __tablename__ = "seats"
    __table_args__ = (UniqueConstraint("event_id", "seat_label", name="uq_seats_event_id_seat_label"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    zone_id: Mapped[int] = mapped_column(ForeignKey("seat_zones.id", ondelete="CASCADE"), nullable=False, index=True)

    row_index: Mapped[int] = mapped_column(Integer, nullable=False)
    row_label: Mapped[str] = mapped_column(String(12), nullable=False)
    seat_number: Mapped[int] = mapped_column(Integer, nullable=False)
    seat_label: Mapped[str] = mapped_column(String(40), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    status: Mapped[SeatStatus] = mapped_column(Enum(SeatStatus, native_enum=False), default=SeatStatus.AVAILABLE, nullable=False, index=True)
    lock_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    locked_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    sold_order_item = relationship("OrderItem", back_populates="seat", uselist=False)
    zone = relationship("SeatZone", back_populates="seats")
    event = relationship("Event", back_populates="seats")
    locked_by_user = relationship("User", back_populates="locked_seats", foreign_keys=[locked_by_user_id])
