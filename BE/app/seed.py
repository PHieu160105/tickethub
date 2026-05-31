"""Utilities to seed local demo accounts."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.enums import Gender, UserType
from app.models.user import Customer, EventStaff, SystemAdmin, User


async def seed_demo_data(session: AsyncSession) -> None:
    system_admin = await session.scalar(select(User).where(User.email == "admin@ticketrush.com"))
    if not system_admin:
        system_admin = User(
            full_name="Quan tri TicketRush",
            email="admin@ticketrush.com",
            password_hash=hash_password("Admin@123"),
            user_type=UserType.SYSTEM_ADMIN,
            gender=Gender.OTHER,
            age=30,
        )
        system_admin.system_admin_profile = SystemAdmin(admin_code="SYS-0001")
        session.add(system_admin)
    else:
        system_admin.full_name = "Quan tri TicketRush"
        system_admin.password_hash = hash_password("Admin@123")
        system_admin.user_type = UserType.SYSTEM_ADMIN
        system_admin.gender = Gender.OTHER
        system_admin.age = 30
        system_admin_profile = await session.scalar(select(SystemAdmin).where(SystemAdmin.user_id == system_admin.id))
        if not system_admin_profile:
            system_admin.system_admin_profile = SystemAdmin(admin_code="SYS-0001")

    event_staff = await session.scalar(select(User).where(User.email == "staff@ticketrush.com"))
    if not event_staff:
        event_staff = User(
            full_name="Nhan vien su kien",
            email="staff@ticketrush.com",
            password_hash=hash_password("Staff@123"),
            user_type=UserType.EVENT_STAFF,
            gender=Gender.OTHER,
            age=28,
        )
        event_staff.event_staff_profile = EventStaff(staff_code="STF-0001", is_active=True)
        session.add(event_staff)
    else:
        event_staff.full_name = "Nhan vien su kien"
        event_staff.password_hash = hash_password("Staff@123")
        event_staff.user_type = UserType.EVENT_STAFF
        event_staff.gender = Gender.OTHER
        event_staff.age = 28
        event_staff_profile = await session.scalar(select(EventStaff).where(EventStaff.user_id == event_staff.id))
        if not event_staff_profile:
            event_staff.event_staff_profile = EventStaff(staff_code="STF-0001", is_active=True)

    customer = await session.scalar(select(User).where(User.email == "customer@ticketrush.com"))
    if not customer:
        customer = User(
            full_name="Khach hang demo",
            email="customer@ticketrush.com",
            password_hash=hash_password("Customer@123"),
            user_type=UserType.CUSTOMER,
            gender=Gender.FEMALE,
            age=24,
        )
        customer.customer_profile = Customer()
        session.add(customer)
    else:
        customer.full_name = "Khach hang demo"
        customer.password_hash = hash_password("Customer@123")
        customer.user_type = UserType.CUSTOMER
        customer.gender = Gender.FEMALE
        customer.age = 24
        customer_profile = await session.scalar(select(Customer).where(Customer.user_id == customer.id))
        if not customer_profile:
            customer.customer_profile = Customer()

    await session.commit()
