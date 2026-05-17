"""Khai báo các enum miền nghiệp vụ dùng chung cho model ORM và schema."""

from enum import StrEnum


class UserRole(StrEnum):
    CUSTOMER = "customer"
    ADMIN = "admin"


class Gender(StrEnum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class EventStatus(StrEnum):
    DRAFT = "draft"
    LIVE = "live"
    CLOSED = "closed"


class SeatStatus(StrEnum):
    AVAILABLE = "available"
    LOCKED = "locked"
    SOLD = "sold"


class OrderStatus(StrEnum):
    PENDING = "pending"
    PAID = "paid"
    CANCELLED = "cancelled"


class QueueStatus(StrEnum):
    WAITING = "waiting"
    ADMITTED = "admitted"
    EXPIRED = "expired"
    COMPLETED = "completed"
