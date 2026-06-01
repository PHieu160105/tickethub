"""ORM models for base users and subtype tables."""

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import Gender, UserType, sa_enum


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    user_type: Mapped[UserType] = mapped_column(sa_enum(UserType), default=UserType.CUSTOMER, nullable=False, index=True)
    gender: Mapped[Gender] = mapped_column(sa_enum(Gender), default=Gender.OTHER, nullable=False)
    age: Mapped[int] = mapped_column(Integer, default=18, nullable=False)

    customer_profile = relationship("Customer", back_populates="user", uselist=False, cascade="all,delete-orphan")
    event_staff_profile = relationship("EventStaff", back_populates="user", uselist=False, cascade="all,delete-orphan")
    system_admin_profile = relationship("SystemAdmin", back_populates="user", uselist=False, cascade="all,delete-orphan")

    orders = relationship(
        "Order",
        back_populates="customer",
        cascade="all,delete",
        primaryjoin="User.id == foreign(Order.customer_id)",
        foreign_keys="Order.customer_id",
    )
    locked_tickets = relationship(
        "Ticket",
        back_populates="locked_by_customer",
        primaryjoin="User.id == foreign(Ticket.locked_by_customer_id)",
        foreign_keys="Ticket.locked_by_customer_id",
    )
    created_events = relationship(
        "Event",
        back_populates="created_by_staff",
        primaryjoin="User.id == foreign(Event.created_by_staff_id)",
        foreign_keys="Event.created_by_staff_id",
    )
    created_shows = relationship(
        "Show",
        back_populates="created_by_staff",
        primaryjoin="User.id == foreign(Show.created_by_staff_id)",
        foreign_keys="Show.created_by_staff_id",
    )
    created_venues = relationship(
        "Venue",
        back_populates="created_by_staff",
        primaryjoin="User.id == foreign(Venue.created_by_staff_id)",
        foreign_keys="Venue.created_by_staff_id",
    )
    event_assignments = relationship(
        "EventAssignment",
        back_populates="staff",
        primaryjoin="User.id == foreign(EventAssignment.staff_id)",
        foreign_keys="EventAssignment.staff_id",
    )
    @property
    def role(self) -> UserType:
        return self.user_type

    @role.setter
    def role(self, value: UserType | str) -> None:
        self.user_type = UserType(value)

    @property
    def google_id(self) -> str | None:
        return self.customer_profile.google_id if self.customer_profile else None

    @property
    def zalo_id(self) -> str | None:
        return self.customer_profile.zalo_id if self.customer_profile else None


class Customer(TimestampMixin, Base):
    __tablename__ = "customers"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    zalo_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    user = relationship("User", back_populates="customer_profile")


class EventStaff(TimestampMixin, Base):
    __tablename__ = "event_staff"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    staff_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user = relationship("User", back_populates="event_staff_profile")


class SystemAdmin(TimestampMixin, Base):
    __tablename__ = "system_admins"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    admin_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)

    user = relationship("User", back_populates="system_admin_profile")
