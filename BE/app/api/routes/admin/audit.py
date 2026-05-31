"""System-admin audit log query routes."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_system_admin
from app.core.db import get_db_session
from app.models.user import AdminAuditLog, User
from app.schemas.admin.audit import AdminAuditLogResponse, PaginatedAdminAuditLogsResponse

router = APIRouter()


@router.get("/audit-logs", response_model=PaginatedAdminAuditLogsResponse)
async def list_admin_audit_logs(
    actor_user_id: int | None = Query(default=None, ge=1),
    action: str | None = Query(default=None, max_length=100),
    target_table: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_system_admin),
) -> PaginatedAdminAuditLogsResponse:
    filters = []
    if actor_user_id is not None:
        filters.append(AdminAuditLog.actor_user_id == actor_user_id)
    if action:
        filters.append(AdminAuditLog.action == action.strip().upper())
    if target_table:
        filters.append(AdminAuditLog.target_table == target_table.strip().lower())

    total = int((await session.scalar(select(func.count()).select_from(AdminAuditLog).where(*filters))) or 0)
    rows = (
        await session.execute(
            select(AdminAuditLog, User)
            .join(User, User.id == AdminAuditLog.actor_user_id)
            .where(*filters)
            .order_by(AdminAuditLog.created_at.desc(), AdminAuditLog.id.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return PaginatedAdminAuditLogsResponse(
        items=[
            AdminAuditLogResponse(
                id=log.id,
                actor_user_id=user.id,
                actor_name=user.full_name,
                actor_email=user.email,
                actor_user_type=user.user_type.value,
                action=log.action,
                target_table=log.target_table,
                target_id=log.target_id,
                old_value=log.old_value,
                new_value=log.new_value,
                created_at=log.created_at,
            )
            for log, user in rows
        ],
        total=total,
        limit=limit,
        offset=offset,
    )
