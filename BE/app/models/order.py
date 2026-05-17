"""Khai báo các mô hình ORM cho đơn hàng, dòng đơn hàng và vé điện tử."""

from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import OrderStatus


class Order(TimestampMixin, Base):
    """Đại diện cho chứng từ thanh toán của một lần mua vé.

    Input:
    - Người mua, sự kiện, show, trạng thái đơn và tổng tiền.

    Output:
    - Một bản ghi `orders` làm thực thể cha của các `order_items`.

    Cách hoạt động:
    - Mỗi lần checkout thành công sẽ tạo một `Order`.
    - `Order` liên kết tới nhiều dòng ghế đã mua và được dùng để thống kê doanh thu.
    """

    __tablename__ = "orders"

    # Khóa chính nội bộ của đơn hàng.
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # User mua vé; `CASCADE` giúp xóa dữ liệu con khi xóa user trong môi trường demo/test.
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Event cha phục vụ tương thích dữ liệu cũ và thống kê theo sự kiện.
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)

    # Show là buổi diễn bán vé thực tế; nullable để giữ tương thích với dữ liệu event-based cũ.
    show_id: Mapped[int | None] = mapped_column(ForeignKey("shows.id", ondelete="CASCADE"), nullable=True, index=True)

    # Trạng thái đơn: pending/paid/cancelled/refunded tùy enum nghiệp vụ.
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus, native_enum=False), default=OrderStatus.PENDING, nullable=False)

    # Tổng tiền tại thời điểm checkout; dùng Numeric để tiền không bị sai số floating-point trong DB.
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    # Thời điểm thanh toán thành công; null nghĩa là đơn chưa được thanh toán.
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Các relationship giúp code Python truy cập `order.user`, `order.show`, `order.items` mà không viết join thủ công.
    user = relationship("User", back_populates="orders")
    show = relationship("Show", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all,delete")


class OrderItem(TimestampMixin, Base):
    """Đại diện cho một dòng đơn hàng gắn một ghế đã bán với một đơn cụ thể.

    Input:
    - `order_id`, `seat_id`, giá bán của ghế tại thời điểm checkout.

    Output:
    - Một bản ghi `order_items` dùng để lưu chi tiết từng ghế trong đơn.

    Cách hoạt động:
    - Một ghế đã bán chỉ thuộc về một `OrderItem`.
    - `Ticket` sẽ phát hành dựa trên từng `OrderItem`.
    """

    __tablename__ = "order_items"

    # Khóa chính của từng dòng đơn.
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Dòng đơn thuộc về một đơn hàng cha.
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)

    # `unique=True` đảm bảo một ghế đã bán không thể nằm trong hai dòng đơn khác nhau.
    seat_id: Mapped[int] = mapped_column(ForeignKey("seats.id", ondelete="CASCADE"), nullable=False, index=True, unique=True)

    # Giá chốt của ghế tại thời điểm mua, không phụ thuộc việc admin đổi giá sau này.
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    # Liên kết ngược về đơn hàng, ghế và vé điện tử phát hành từ dòng đơn này.
    order = relationship("Order", back_populates="items")
    seat = relationship("Seat", back_populates="sold_order_item")
    ticket = relationship("Ticket", back_populates="order_item", uselist=False, cascade="all,delete")


class Ticket(TimestampMixin, Base):
    """Đại diện cho vé điện tử phát hành sau khi thanh toán thành công.

    Input:
    - `order_item_id`, mã vé, nội dung QR và thời điểm phát hành.

    Output:
    - Một bản ghi `tickets` phục vụ hiển thị vé, QR và đối soát vé đã bán.

    Cách hoạt động:
    - Mỗi `OrderItem` có tối đa một `Ticket`.
    - Mã vé và QR payload được sinh ở bước checkout.
    """

    __tablename__ = "tickets"

    # Khóa chính của vé điện tử.
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Mỗi dòng đơn chỉ phát hành tối đa một vé.
    order_item_id: Mapped[int] = mapped_column(ForeignKey("order_items.id", ondelete="CASCADE"), unique=True, nullable=False)

    # Mã vé duy nhất để người dùng tra cứu và admin đối soát.
    ticket_code: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)

    # Payload QR chứa thông tin cần thiết để app/quầy kiểm vé xác nhận vé.
    qr_payload: Mapped[str] = mapped_column(String(500), nullable=False)

    # Thời điểm phát hành vé sau thanh toán.
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Relationship một-một từ vé về dòng đơn gốc.
    order_item = relationship("OrderItem", back_populates="ticket")


class TicketCancellation(TimestampMixin, Base):
    """Lưu vết kiểm toán cho vé đã hủy để phục vụ thống kê và đối soát.

    Input:
    - Mã vé, người hủy, đơn hàng, show, ghế và giá trị hoàn nguyên tại thời điểm hủy.

    Output:
    - Một bản ghi `ticket_cancellations` phục vụ báo cáo quản trị.

    Cách hoạt động:
    - Khi vé bị hủy, hệ thống không chỉ xóa dấu vết mà tạo thêm bản ghi audit riêng.
    """

    __tablename__ = "ticket_cancellations"

    # Khóa chính của bản ghi audit hủy vé.
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Lưu lại mã vé đã hủy để vẫn tra được lịch sử sau khi bản ghi ticket gốc bị xóa.
    ticket_code: Mapped[str] = mapped_column(String(120), nullable=False, index=True)

    # Các khóa ngoại nullable vì dữ liệu gốc có thể bị xóa, audit vẫn phải giữ được.
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="SET NULL"), nullable=True, index=True)
    show_id: Mapped[int | None] = mapped_column(ForeignKey("shows.id", ondelete="SET NULL"), nullable=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="SET NULL"), nullable=True, index=True)
    seat_id: Mapped[int] = mapped_column(ForeignKey("seats.id", ondelete="SET NULL"), nullable=True, index=True)

    # Giá trị tiền của vé tại thời điểm hủy, phục vụ báo cáo thất thoát/hoàn tiền.
    canceled_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    # Thời điểm hủy vé.
    canceled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
