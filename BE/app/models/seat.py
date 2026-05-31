"""ORM model for reusable layout seats."""

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym

from app.models.base import Base, TimestampMixin


class Seat(TimestampMixin, Base):
    __tablename__ = "seats"
    __table_args__ = (UniqueConstraint("venue_layout_id", "label", name="uq_seats_layout_label"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    venue_layout_id: Mapped[int] = mapped_column(ForeignKey("venue_layouts.id", ondelete="CASCADE"), nullable=False, index=True)
    row_label: Mapped[str | None] = mapped_column(String(12), nullable=True)
    seat_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    seat_label: Mapped[str] = mapped_column("label", String(40), nullable=False)
    x_coord: Mapped[float | None] = mapped_column("x", Numeric(5, 2), nullable=True)
    y_coord: Mapped[float | None] = mapped_column("y", Numeric(5, 2), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    label = synonym("seat_label")
    x = synonym("x_coord")
    y = synonym("y_coord")

    venue_layout = relationship("VenueLayout", back_populates="seats")
    tickets = relationship("Ticket", back_populates="seat")

    @property
    def rotation(self) -> float:
        return 0.0

    @property
    def section_id(self) -> None:
        return None

    @property
    def is_admin_locked(self) -> bool:
        return False
