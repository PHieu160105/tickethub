"""Khai báo các mô hình ORM cho trung tâm hỗ trợ và hội thoại trợ giúp."""

from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import UserRole


class HelpThread(TimestampMixin, Base):
    """Đại diện cho một luồng hội thoại hỗ trợ giữa khách hàng và quản trị viên.

    Input:
    - Khách hàng mở thread, hệ thống lưu thời điểm tin nhắn cuối, preview và bộ đếm unread.

    Output:
    - Một bản ghi `help_threads` đóng vai trò đầu mối cho danh sách tin nhắn hỗ trợ.

    Cách hoạt động:
    - Một thread thuộc về một khách hàng.
    - Thread giữ thông tin tóm tắt để màn hình danh sách tải nhanh hơn.
    """

    __tablename__ = "help_threads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    last_message_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    last_message_preview: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open", index=True)
    unread_admin: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unread_customer: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    customer = relationship("User")
    messages = relationship("HelpMessage", back_populates="thread", cascade="all,delete")


class HelpMessage(Base):
    """Đại diện cho một tin nhắn cụ thể bên trong một luồng hỗ trợ.

    Input:
    - `thread_id`, `sender_id`, vai trò người gửi, nội dung và loại tin nhắn.

    Output:
    - Một bản ghi `help_messages` dùng để render lịch sử chat hỗ trợ.

    Cách hoạt động:
    - Tin nhắn gắn với một `HelpThread`.
    - `sender_role` cho biết đây là tin từ khách hàng hay quản trị viên.
    """

    __tablename__ = "help_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    thread_id: Mapped[int] = mapped_column(ForeignKey("help_threads.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_role: Mapped[UserRole] = mapped_column(Enum(UserRole, native_enum=False), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    message_type: Mapped[str] = mapped_column(String(20), nullable=False, default="text")
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    thread = relationship("HelpThread", back_populates="messages")
    sender = relationship("User")
