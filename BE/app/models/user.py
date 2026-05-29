"""ORM model for application users."""

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import Gender, UserRole, sa_enum


class User(TimestampMixin, Base):
    """Đại diện cho tài khoản người dùng trên nền tảng.

    Input:
    - Thông tin định danh, email, mật khẩu băm, social id, vai trò và hồ sơ cơ bản.

    Output:
    - Một bản ghi `users` được dùng bởi xác thực, phân quyền và lịch sử mua vé.

    Cách hoạt động:
    - Hệ thống hiện phân biệt hai vai trò chính: `customer` và `admin`.
    - Một user có thể tạo event/show, giữ ghế, mua vé, vào queue hoặc gửi hỗ trợ tùy vai trò.
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    zalo_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    role: Mapped[UserRole] = mapped_column(sa_enum(UserRole), default=UserRole.CUSTOMER, nullable=False)
    gender: Mapped[Gender] = mapped_column(sa_enum(Gender), default=Gender.OTHER, nullable=False)
    age: Mapped[int] = mapped_column(Integer, default=18, nullable=False)

    events_created = relationship("Event", back_populates="created_by", cascade="all,delete")
    shows_created = relationship("Show", back_populates="created_by", cascade="all,delete")
    venues = relationship("Venue", back_populates="created_by")
    locked_seats = relationship("Seat", back_populates="locked_by_user", foreign_keys="Seat.locked_by_user_id")
    orders = relationship("Order", back_populates="user", cascade="all,delete")
    queue_entries = relationship("QueueEntry", back_populates="user", cascade="all,delete")
