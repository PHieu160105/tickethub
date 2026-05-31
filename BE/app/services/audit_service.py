"""Helpers for recording internal user mutations in the audit log."""

import json
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import AdminAuditLog, User

MAX_AUDIT_STRING_LENGTH = 500


def _normalize_audit_value(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): _normalize_audit_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_normalize_audit_value(item) for item in value]
    if isinstance(value, str) and len(value) > MAX_AUDIT_STRING_LENGTH:
        return f"{value[:MAX_AUDIT_STRING_LENGTH]}... <truncated {len(value) - MAX_AUDIT_STRING_LENGTH} chars>"
    return value


def _json_default(value: Any) -> Any:
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    raise TypeError(f"Unsupported audit value: {type(value).__name__}")


def serialize_audit_value(value: Any) -> str | None:
    if value is None:
        return None
    return json.dumps(_normalize_audit_value(value), default=_json_default, ensure_ascii=False, sort_keys=True)


def model_snapshot(model: Any, *fields: str) -> dict[str, Any]:
    return {field: getattr(model, field) for field in fields}


def add_audit_log(
    session: AsyncSession,
    actor: User,
    action: str,
    target_table: str,
    target_id: int | str,
    *,
    old_value: Any = None,
    new_value: Any = None,
) -> None:
    session.add(
        AdminAuditLog(
            actor_user_id=actor.id,
            action=action,
            target_table=target_table,
            target_id=str(target_id),
            old_value=serialize_audit_value(old_value),
            new_value=serialize_audit_value(new_value),
        )
    )
