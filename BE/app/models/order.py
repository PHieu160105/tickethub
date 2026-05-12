"""Order and ticket ORM models."""

from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import OrderStatus


class Order(TimestampMixin, Base):
    """Checkout document for one user/event purchase."""

    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    show_id: Mapped[int | None] = mapped_column(ForeignKey("shows.id", ondelete="CASCADE"), nullable=True, index=True)

    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus, native_enum=False), default=OrderStatus.PENDING, nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="orders")
    show = relationship("Show", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all,delete")


class OrderItem(TimestampMixin, Base):
    """Line item binding one sold seat to an order."""

    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    seat_id: Mapped[int] = mapped_column(ForeignKey("seats.id", ondelete="CASCADE"), nullable=False, index=True, unique=True)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    order = relationship("Order", back_populates="items")
    seat = relationship("Seat", back_populates="sold_order_item")
    ticket = relationship("Ticket", back_populates="order_item", uselist=False, cascade="all,delete")


class Ticket(TimestampMixin, Base):
    """Digital ticket emitted after payment confirmation."""

    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_item_id: Mapped[int] = mapped_column(ForeignKey("order_items.id", ondelete="CASCADE"), unique=True, nullable=False)
    ticket_code: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    qr_payload: Mapped[str] = mapped_column(String(500), nullable=False)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    order_item = relationship("OrderItem", back_populates="ticket")


class TicketCancellation(TimestampMixin, Base):
    """Audit record for canceled tickets to support admin analytics."""

    __tablename__ = "ticket_cancellations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticket_code: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="SET NULL"), nullable=True, index=True)
    show_id: Mapped[int | None] = mapped_column(ForeignKey("shows.id", ondelete="SET NULL"), nullable=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="SET NULL"), nullable=True, index=True)
    seat_id: Mapped[int] = mapped_column(ForeignKey("seats.id", ondelete="SET NULL"), nullable=True, index=True)
    canceled_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    canceled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
