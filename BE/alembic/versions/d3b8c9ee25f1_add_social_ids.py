"""Thêm định danh đăng nhập mạng xã hội cho người dùng.

Revision ID: d3b8c9ee25f1
Revises: c2a7b9dd14f0
Create Date: 2026-05-11 10:50:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# Định danh revision do Alembic sử dụng.
revision: str = "d3b8c9ee25f1"
down_revision: Union[str, Sequence[str], None] = "c2a7b9dd14f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("google_id", sa.String(length=255), nullable=True), schema="ticket_rush")
    op.add_column("users", sa.Column("facebook_id", sa.String(length=255), nullable=True), schema="ticket_rush")
    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=True, schema="ticket_rush")
    op.create_index(op.f("ix_ticket_rush_users_google_id"), "users", ["google_id"], unique=True, schema="ticket_rush")
    op.create_index(op.f("ix_ticket_rush_users_facebook_id"), "users", ["facebook_id"], unique=True, schema="ticket_rush")


def downgrade() -> None:
    op.drop_index(op.f("ix_ticket_rush_users_facebook_id"), table_name="users", schema="ticket_rush")
    op.drop_index(op.f("ix_ticket_rush_users_google_id"), table_name="users", schema="ticket_rush")
    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=False, schema="ticket_rush")
    op.drop_column("users", "facebook_id", schema="ticket_rush")
    op.drop_column("users", "google_id", schema="ticket_rush")
