"""Thêm định danh Firebase cho người dùng.

Revision ID: xxxxx
Revises: d3b8c9ee25f1
Create Date: 2026-05-12 11:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "xxxxx"
down_revision: Union[str, Sequence[str], None] = "d3b8c9ee25f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("firebase_uid", sa.String(length=255), nullable=True), schema="ticket_rush")
    op.create_index(op.f("ix_ticket_rush_users_firebase_uid"), "users", ["firebase_uid"], unique=True, schema="ticket_rush")


def downgrade() -> None:
    op.drop_index(op.f("ix_ticket_rush_users_firebase_uid"), table_name="users", schema="ticket_rush")
    op.drop_column("users", "firebase_uid", schema="ticket_rush")
