"""User/account ORM model."""

from sqlalchemy import Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import Gender, UserRole


class User(TimestampMixin, Base):
    """Platform users: customer and admin roles."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, native_enum=False), default=UserRole.CUSTOMER, nullable=False)
    gender: Mapped[Gender] = mapped_column(Enum(Gender, native_enum=False), default=Gender.OTHER, nullable=False)
    age: Mapped[int] = mapped_column(Integer, default=18, nullable=False)

    events_created = relationship("Event", back_populates="created_by", cascade="all,delete")
    locked_seats = relationship("Seat", back_populates="locked_by_user", foreign_keys="Seat.locked_by_user_id")
    orders = relationship("Order", back_populates="user", cascade="all,delete")
    queue_entries = relationship("QueueEntry", back_populates="user", cascade="all,delete")
