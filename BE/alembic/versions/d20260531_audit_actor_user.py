"""Allow audit logs for all internal users.

Revision ID: d20260531
Revises: c20260531
Create Date: 2026-05-31 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op


revision: str = "d20260531"
down_revision: Union[str, Sequence[str], None] = "c20260531"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    schema = "ticket_rush"
    op.drop_constraint(
        "fk_admin_audit_logs_actor_admin_id_system_admins",
        "admin_audit_logs",
        schema=schema,
        type_="foreignkey",
    )
    op.alter_column("admin_audit_logs", "actor_admin_id", new_column_name="actor_user_id", schema=schema)
    op.create_foreign_key(
        "fk_admin_audit_logs_actor_user_id_users",
        "admin_audit_logs",
        "users",
        ["actor_user_id"],
        ["id"],
        source_schema=schema,
        referent_schema=schema,
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    schema = "ticket_rush"
    op.drop_constraint(
        "fk_admin_audit_logs_actor_user_id_users",
        "admin_audit_logs",
        schema=schema,
        type_="foreignkey",
    )
    op.alter_column("admin_audit_logs", "actor_user_id", new_column_name="actor_admin_id", schema=schema)
    op.create_foreign_key(
        "fk_admin_audit_logs_actor_admin_id_system_admins",
        "admin_audit_logs",
        "system_admins",
        ["actor_admin_id"],
        ["user_id"],
        source_schema=schema,
        referent_schema=schema,
        ondelete="CASCADE",
    )
