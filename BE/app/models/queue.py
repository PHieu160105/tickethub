"""Khai báo mô hình ORM cho hàng đợi ảo của hệ thống."""

from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import QueueStatus


class QueueEntry(TimestampMixin, Base):
    """Đại diện cho một người dùng trong pipeline hàng đợi ảo của một show flash-sale.

    Input:
    - `event_id`, `show_id`, `user_id`, token queue và trạng thái hiện tại.

    Output:
    - Một bản ghi `queue_entries` dùng để kiểm soát vị trí, hạn truy cập và vòng đời queue.

    Cách hoạt động:
    - Mỗi người dùng vào hàng đợi sẽ có một token duy nhất.
    - Trạng thái sẽ đi qua các mốc như `waiting`, `admitted`, `expired`, `completed`.
    - Các mốc thời gian được dùng để xác định quyền được vào khu chọn ghế.
    """

    __tablename__ = "queue_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    show_id: Mapped[int | None] = mapped_column(ForeignKey("shows.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    token: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    status: Mapped[QueueStatus] = mapped_column(Enum(QueueStatus, native_enum=False), default=QueueStatus.WAITING, nullable=False, index=True)
    position_hint: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    admitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    show = relationship("Show", back_populates="queue_entries")
    user = relationship("User", back_populates="queue_entries")
