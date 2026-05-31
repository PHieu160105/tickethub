from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_system_admin
from app.core.db import get_db_session
from app.core.search import build_ilike_pattern
from app.models.order import Order, Ticket
from app.models.user import User
from app.schemas.admin import AdminUserResponse, PaginatedAdminUsersResponse

router = APIRouter()


@router.get("/users", response_model=PaginatedAdminUsersResponse)
async def list_admin_users(
    search: str | None = Query(default=None, max_length=120),
    user_type: str | None = Query(default=None, max_length=40),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_system_admin),
) -> PaginatedAdminUsersResponse:
    stmt = (
        select(
            User.id,
            User.full_name,
            User.email,
            User.user_type,
            User.gender,
            User.age,
            User.created_at,
            func.count(Ticket.id).label("total_tickets"),
        )
        .outerjoin(Order, Order.customer_id == User.id)
        .outerjoin(Ticket, Ticket.order_id == Order.id)
        .group_by(User.id, User.full_name, User.email, User.user_type, User.gender, User.age, User.created_at)
        .order_by(User.created_at.desc())
    )

    pattern = build_ilike_pattern(search)
    if pattern:
        stmt = stmt.where(User.full_name.ilike(pattern, escape="\\") | User.email.ilike(pattern, escape="\\"))
    if user_type:
        stmt = stmt.where(User.user_type == user_type.strip().upper())

    filtered_stmt = stmt.subquery()
    total = int((await session.scalar(select(func.count()).select_from(filtered_stmt))) or 0)

    rows = (await session.execute(stmt.limit(limit).offset(offset))).all()
    items = [
        AdminUserResponse(
            id=row.id,
            full_name=row.full_name,
            email=row.email,
            user_type=str(row.user_type),
            gender=str(row.gender),
            age=int(row.age),
            total_tickets=int(row.total_tickets or 0),
            registered_at=row.created_at.isoformat(),
        )
        for row in rows
    ]
    return PaginatedAdminUsersResponse(items=items, total=total, limit=limit, offset=offset)
