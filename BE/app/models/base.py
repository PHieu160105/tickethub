"""Khai báo lớp ORM gốc và các mixin dùng chung cho toàn bộ mô hình dữ liệu."""

from datetime import timezone, datetime

from sqlalchemy import DateTime, MetaData
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Quy ước đặt tên giúp tên index, khóa và ràng buộc ổn định giữa các môi trường chạy migration.
naming_convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Lớp ORM gốc mà tất cả bảng trong dự án đều kế thừa."""

    metadata = MetaData(naming_convention=naming_convention, schema="ticket_rush")


class TimestampMixin:
    """Tự động cung cấp thời gian tạo và thời gian cập nhật cho bản ghi.

    Input:
    - Không nhận tham số trực tiếp từ caller.

    Output:
    - Sinh ra hai cột `created_at` và `updated_at` cho model kế thừa.

    Cách hoạt động:
    - `created_at` được gán khi bản ghi được tạo mới.
    - `updated_at` được gán khi tạo mới và tự cập nhật lại mỗi lần bản ghi thay đổi.
    """

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
