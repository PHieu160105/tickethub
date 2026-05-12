"""Help center chat ORM models."""

from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import UserRole


class HelpThread(TimestampMixin, Base):
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
