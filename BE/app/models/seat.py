"""Khai báo mô hình ORM cho ghế và vòng đời trạng thái ghế."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import SeatStatus


class Seat(TimestampMixin, Base):
    """Đại diện cho một ghế cụ thể có thể đi qua các trạng thái khả dụng, giữ chỗ và đã bán.

    Input:
    - Vị trí ghế, vùng ghế, giá, trạng thái, tọa độ trực quan và thông tin khóa ghế.

    Output:
    - Một bản ghi `seats` là đơn vị tồn kho nhỏ nhất trong hệ thống bán vé.

    Cách hoạt động:
    - Ghế được sinh theo vùng hoặc clone từ venue layout.
    - Trạng thái ghế thay đổi theo luồng `available -> locked -> sold` hoặc quay lại `available`.
    """

    __tablename__ = "seats"
    __table_args__ = (UniqueConstraint("show_id", "seat_label", name="uq_seats_show_id_seat_label"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int | None] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=True, index=True)
    show_id: Mapped[int | None] = mapped_column(ForeignKey("shows.id", ondelete="CASCADE"), nullable=True, index=True)
    zone_id: Mapped[int | None] = mapped_column(ForeignKey("seat_zones.id", ondelete="CASCADE"), nullable=True, index=True)

    row_index: Mapped[int] = mapped_column(Integer, nullable=False)
    row_label: Mapped[str] = mapped_column(String(12), nullable=False)
    seat_number: Mapped[int] = mapped_column(Integer, nullable=False)
    seat_label: Mapped[str] = mapped_column(String(40), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    status: Mapped[SeatStatus] = mapped_column(Enum(SeatStatus, native_enum=False), default=SeatStatus.AVAILABLE, nullable=False, index=True)
    lock_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    locked_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    is_admin_locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    x_coord: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)  # Tọa độ phần trăm theo trục X trong khoảng 0-100.
    y_coord: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)  # Tọa độ phần trăm theo trục Y trong khoảng 0-100.
    rotation: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)  # Góc xoay trực quan của ghế trong khoảng 0-360 độ.
    section_id: Mapped[int | None] = mapped_column(ForeignKey("sections.id"), nullable=True, index=True)
    venue_layout_id: Mapped[int | None] = mapped_column(ForeignKey("venue_layouts.id"), nullable=True, index=True)

    sold_order_item = relationship("OrderItem", back_populates="seat", uselist=False)
    zone = relationship("SeatZone", back_populates="seats")
    show = relationship("Show", back_populates="seats")
    locked_by_user = relationship("User", back_populates="locked_seats", foreign_keys=[locked_by_user_id])
    section = relationship("Section", back_populates="seats")
    venue_layout = relationship("VenueLayout", back_populates="seats")
