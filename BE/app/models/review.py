"""Khai báo mô hình ORM cho đánh giá sự kiện."""

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class EventReview(TimestampMixin, Base):
    """Đại diện cho đánh giá của khách hàng dành cho một sự kiện.

    Input:
    - `event_id`, `user_id`, số sao, nội dung và ảnh minh họa tùy chọn.

    Output:
    - Một bản ghi `event_reviews` dùng để hiển thị social proof ở trang sự kiện.

    Cách hoạt động:
    - Mỗi đánh giá gắn với một người dùng và một sự kiện cụ thể.
    """

    __tablename__ = "event_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewer_name: Mapped[str] = mapped_column(String(120), nullable=False)

    event = relationship("Event", back_populates="reviews")
    user = relationship("User", back_populates="event_reviews")
