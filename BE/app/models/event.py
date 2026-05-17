"""Khai báo các mô hình ORM cho sự kiện, show và vùng ghế."""

from datetime import UTC, date, datetime, time

from sqlalchemy import JSON, Boolean, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import EventStatus


class Event(TimestampMixin, Base):
    """Đại diện cho thực thể sự kiện cha dùng để gom một hoặc nhiều show bán vé.

    Input:
    - Dữ liệu mô tả sự kiện như tiêu đề, mô tả, danh mục, ảnh bìa và khoảng ngày diễn ra.

    Output:
    - Một bản ghi `events` đóng vai trò thực thể cha cho các `show`.

    Cách hoạt động:
    - `Event` không phải đơn vị bán vé trực tiếp trong kiến trúc hiện tại.
    - Mỗi `Event` có thể chứa nhiều `Show`.
    - Một số cột legacy cấp event vẫn được giữ lại để tương thích dữ liệu cũ.
    """

    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    cover_image_url: Mapped[str] = mapped_column(Text, default="", nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False, index=True, default=date.today)
    end_date: Mapped[date] = mapped_column(Date, nullable=False, index=True, default=date.today)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    status: Mapped[EventStatus] = mapped_column(Enum(EventStatus, native_enum=False), default=EventStatus.DRAFT, nullable=False)

    # Các cột ticketing cấp event cũ được giữ lại chỉ để hỗ trợ dữ liệu cũ khi backfill/migrate.
    venue: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    start_at_legacy: Mapped[datetime | None] = mapped_column("start_at", DateTime(timezone=True), nullable=True)
    end_at_legacy: Mapped[datetime | None] = mapped_column("end_at", DateTime(timezone=True), nullable=True)
    hold_minutes: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    queue_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    queue_release_batch: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    max_active_queue_tokens: Mapped[int] = mapped_column(Integer, default=200, nullable=False)
    venue_id: Mapped[int | None] = mapped_column(ForeignKey("venues.id"), nullable=True, index=True)
    venue_layout_id: Mapped[int | None] = mapped_column(ForeignKey("venue_layouts.id"), nullable=True, index=True)

    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    created_by = relationship("User", back_populates="events_created")
    venue_obj = relationship("Venue", back_populates="events")
    venue_layout = relationship("VenueLayout", back_populates="events")
    shows = relationship("Show", back_populates="event", cascade="all,delete")
    reviews = relationship("EventReview", back_populates="event", cascade="all,delete")

    @property
    def start_at(self) -> datetime:
        """Sinh thời điểm bắt đầu giả lập theo UTC cho response kiểu cũ.

        Input:
        - Không nhận tham số ngoài.

        Output:
        - `datetime` UTC tại đầu ngày `start_date`.

        Cách hoạt động:
        - Dùng khi response cũ vẫn cần `start_at` dù mô hình mới lưu theo `start_date`.
        """

        return datetime.combine(self.start_date, time.min, tzinfo=UTC)

    @property
    def end_at(self) -> datetime:
        """Sinh thời điểm kết thúc giả lập theo UTC cho response kiểu cũ.

        Input:
        - Không nhận tham số ngoài.

        Output:
        - `datetime` UTC tại cuối ngày `end_date`.

        Cách hoạt động:
        - Dùng khi response cũ vẫn cần `end_at` dù mô hình mới lưu theo `end_date`.
        """

        return datetime.combine(self.end_date, time.max, tzinfo=UTC)


class Show(TimestampMixin, Base):
    """Đại diện cho đơn vị bán vé thực tế gắn với một sự kiện cha.

    Input:
    - Dữ liệu lịch diễn thật như thời gian bắt đầu, kết thúc, venue và cấu hình queue/hold.

    Output:
    - Một bản ghi `shows` là đầu mối gắn ghế, đơn hàng, queue và polygon.

    Cách hoạt động:
    - Người dùng lock ghế, checkout và vào queue theo `show_id`, không phải `event_id`.
    """

    __tablename__ = "shows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    venue: Mapped[str] = mapped_column(String(200), nullable=False)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    status: Mapped[EventStatus] = mapped_column(Enum(EventStatus, native_enum=False), default=EventStatus.DRAFT, nullable=False)
    hold_minutes: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    queue_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    queue_release_batch: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    max_active_queue_tokens: Mapped[int] = mapped_column(Integer, default=200, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    venue_id: Mapped[int | None] = mapped_column(ForeignKey("venues.id"), nullable=True, index=True)
    venue_layout_id: Mapped[int | None] = mapped_column(ForeignKey("venue_layouts.id"), nullable=True, index=True)

    event = relationship("Event", back_populates="shows")
    created_by = relationship("User", back_populates="shows_created")
    venue_obj = relationship("Venue")
    venue_layout = relationship("VenueLayout")
    zones = relationship("SeatZone", back_populates="show", cascade="all,delete")
    seats = relationship("Seat", back_populates="show", cascade="all,delete")
    polygons = relationship("ShowPolygon", back_populates="show", cascade="all,delete")
    orders = relationship("Order", back_populates="show", cascade="all,delete")
    queue_entries = relationship("QueueEntry", back_populates="show", cascade="all,delete")


class SeatZone(TimestampMixin, Base):
    """Đại diện cho cấu hình một vùng ghế bán được trong một show.

    Input:
    - Mã vùng, tên vùng, số hàng, số ghế mỗi hàng, giá và màu hiển thị.

    Output:
    - Một bản ghi `seat_zones` làm khuôn để sinh hoặc nhóm ghế theo vùng.

    Cách hoạt động:
    - Một `Show` có thể có nhiều `SeatZone`.
    - Mỗi `SeatZone` liên kết tới danh sách ghế và polygon trực quan.
    """

    __tablename__ = "seat_zones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int | None] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), index=True, nullable=True)
    show_id: Mapped[int | None] = mapped_column(ForeignKey("shows.id", ondelete="CASCADE"), index=True, nullable=True)

    code: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    row_count: Mapped[int] = mapped_column(Integer, nullable=False)
    seats_per_row: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#024ddf", nullable=False)

    show = relationship("Show", back_populates="zones")
    seats = relationship("Seat", back_populates="zone", cascade="all,delete")
    polygons = relationship("ShowPolygon", back_populates="zone", cascade="all,delete")


class ShowPolygon(TimestampMixin, Base):
    """Lưu metadata polygon được vẽ đè lên sơ đồ ghế tự do của một show.

    Input:
    - `show_id`, `zone_id` tùy chọn, nhãn hiển thị và danh sách điểm polygon.

    Output:
    - Một bản ghi `show_polygons` phục vụ render seatmap dạng canvas hoặc free-form.

    Cách hoạt động:
    - Polygon có thể gắn với một vùng ghế để tô khối, đặt nhãn hoặc bao vùng trực quan.
    """

    __tablename__ = "show_polygons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    show_id: Mapped[int] = mapped_column(ForeignKey("shows.id", ondelete="CASCADE"), nullable=False, index=True)
    zone_id: Mapped[int | None] = mapped_column(ForeignKey("seat_zones.id", ondelete="SET NULL"), nullable=True, index=True)
    label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    points: Mapped[list[dict[str, float]]] = mapped_column(JSON, nullable=False)

    show = relationship("Show", back_populates="polygons")
    zone = relationship("SeatZone", back_populates="polygons")
