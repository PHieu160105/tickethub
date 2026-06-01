"""Drop the admin audit log table.

Revision ID: e20260601
Revises: d20260531
Create Date: 2026-06-01 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e20260601"
down_revision: Union[str, Sequence[str], None] = "d20260531"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table("admin_audit_logs", schema="ticket_rush")


def downgrade() -> None:
    op.create_table(
        "admin_audit_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("target_table", sa.String(length=100), nullable=False),
        sa.Column("target_id", sa.String(length=100), nullable=False),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["ticket_rush.users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        schema="ticket_rush",
    )
    op.create_index("ix_admin_audit_logs_id", "admin_audit_logs", ["id"], unique=False, schema="ticket_rush")
    op.create_index("ix_admin_audit_logs_actor_user_id", "admin_audit_logs", ["actor_user_id"], unique=False, schema="ticket_rush")
    op.create_index("ix_admin_audit_logs_created_at", "admin_audit_logs", ["created_at"], unique=False, schema="ticket_rush")
