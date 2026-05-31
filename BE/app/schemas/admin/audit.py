"""Schemas for system-admin audit log queries."""

from datetime import datetime

from pydantic import BaseModel


class AdminAuditLogResponse(BaseModel):
    id: int
    actor_user_id: int
    actor_name: str
    actor_email: str
    actor_user_type: str
    action: str
    target_table: str
    target_id: str
    old_value: str | None
    new_value: str | None
    created_at: datetime


class PaginatedAdminAuditLogsResponse(BaseModel):
    items: list[AdminAuditLogResponse]
    total: int
    limit: int
    offset: int
