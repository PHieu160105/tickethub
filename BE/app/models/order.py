"""ORM models for orders, tickets, and transaction logs."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym

from app.models.base import Base, TimestampMixin
from app.models.enums import OrderStatus, SeatStatus, sa_enum


class Order(TimestampMixin, Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.user_id", ondelete="CASCADE"), nullable=False, index=True)
    show_id: Mapped[int] = mapped_column(ForeignKey("shows.id", ondelete="CASCADE"), nullable=False, index=True)
    order_code: Mapped[str | None] = mapped_column(String(120), unique=True, nullable=True, index=True)
    buyer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    buyer_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    buyer_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[OrderStatus] = mapped_column(sa_enum(OrderStatus), default=OrderStatus.PENDING, nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user_id = synonym("customer_id")

    customer = relationship(
        "User",
        back_populates="orders",
        foreign_keys=[customer_id],
        primaryjoin="User.id == foreign(Order.customer_id)",
    )
    show = relationship("Show", back_populates="orders")
    tickets = relationship("Ticket", back_populates="order")
    transaction_logs = relationship("TransactionLog", back_populates="order", cascade="all,delete")

    @property
    def event_id(self) -> int | None:
        return self.show.event_id if self.show else None


class Ticket(TimestampMixin, Base):
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    show_id: Mapped[int] = mapped_column(ForeignKey("shows.id", ondelete="CASCADE"), nullable=False, index=True)
    ticket_tier_id: Mapped[int | None] = mapped_column(ForeignKey("ticket_tiers.id", ondelete="SET NULL"), nullable=True, index=True)
    seat_id: Mapped[int | None] = mapped_column(ForeignKey("seats.id", ondelete="SET NULL"), nullable=True, index=True)
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id", ondelete="SET NULL"), nullable=True, index=True)
    locked_by_customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.user_id", ondelete="SET NULL"), nullable=True, index=True)

    seat_label: Mapped[str | None] = mapped_column("label", String(120), nullable=True)
    row_label: Mapped[str | None] = mapped_column(String(20), nullable=True)
    seat_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    x_coord: Mapped[float | None] = mapped_column("x", Numeric(5, 2), nullable=True)
    y_coord: Mapped[float | None] = mapped_column("y", Numeric(5, 2), nullable=True)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    status: Mapped[SeatStatus] = mapped_column(sa_enum(SeatStatus), default=SeatStatus.AVAILABLE, nullable=False, index=True)
    lock_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_staff_locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    ticket_code: Mapped[str | None] = mapped_column(String(120), unique=True, nullable=True, index=True)
    qr_payload: Mapped[str | None] = mapped_column(Text, nullable=True)
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    checked_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    label = synonym("seat_label")
    x = synonym("x_coord")
    y = synonym("y_coord")
    locked_by_user_id = synonym("locked_by_customer_id")
    is_admin_locked = synonym("is_staff_locked")

    order = relationship("Order", back_populates="tickets")
    show = relationship("Show", back_populates="tickets")
    ticket_tier = relationship("TicketTier", back_populates="tickets")
    seat = relationship("Seat", back_populates="tickets")
    locked_by_customer = relationship(
        "User",
        back_populates="locked_tickets",
        foreign_keys=[locked_by_customer_id],
        primaryjoin="User.id == foreign(Ticket.locked_by_customer_id)",
    )


class TransactionLog(TimestampMixin, Base):
    __tablename__ = "transaction_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    payment_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gateway_transaction_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    amount: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    gateway_response_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    message: Mapped[str | None] = mapped_column(String(255), nullable=True)
    raw_payload: Mapped[str | None] = mapped_column(Text, nullable=True)

    order = relationship("Order", back_populates="transaction_logs")
