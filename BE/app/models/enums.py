"""Shared domain enums for ORM models and API schemas."""

from enum import StrEnum

from sqlalchemy import Enum as SAEnum


class UserType(StrEnum):
    CUSTOMER = "CUSTOMER"
    EVENT_STAFF = "EVENT_STAFF"
    SYSTEM_ADMIN = "SYSTEM_ADMIN"
    ADMIN = "SYSTEM_ADMIN"


class Gender(StrEnum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"


class EventStatus(StrEnum):
    DRAFT = "DRAFT"
    LIVE = "LIVE"
    CLOSED = "CLOSED"
    CANCELLED = "CANCELLED"


class EventCategory(StrEnum):
    MUSIC = "MUSIC"
    THEATER = "THEATER"
    DANCE = "DANCE"
    TRADITIONAL = "TRADITIONAL"
    COMEDY = "COMEDY"
    CIRCUS = "CIRCUS"
    OTHER = "OTHER"


class SeatSource(StrEnum):
    LAYOUT = "LAYOUT"
    FREE_FORM = "FREE_FORM"


class SeatStatus(StrEnum):
    AVAILABLE = "AVAILABLE"
    LOCKED = "LOCKED"
    SOLD = "SOLD"


class OrderStatus(StrEnum):
    PENDING = "PENDING"
    PENDING_PAYMENT = "PENDING_PAYMENT"
    PAID = "PAID"
    PAYMENT_FAILED = "PAYMENT_FAILED"
    CANCELLED = "CANCELLED"
    REFUND_PENDING = "REFUND_PENDING"
    REFUNDED = "REFUNDED"
    REFUND_FAILED = "REFUND_FAILED"


class QueueStatus(StrEnum):
    WAITING = "WAITING"
    ADMITTED = "ADMITTED"
    EXPIRED = "EXPIRED"
    COMPLETED = "COMPLETED"


class PerformerRole(StrEnum):
    MAIN = "MAIN"
    GUEST = "GUEST"
    BACKUP = "BACKUP"


def sa_enum(enum_cls: type[StrEnum]) -> SAEnum:
    return SAEnum(
        enum_cls,
        native_enum=False,
        values_callable=lambda cls: [item.value for item in cls],
    )


UserRole = UserType
