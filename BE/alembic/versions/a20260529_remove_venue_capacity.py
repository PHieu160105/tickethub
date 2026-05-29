"""Remove legacy venue capacity.

Revision ID: a20260529
Revises: f6a7b8c9d012
Create Date: 2026-05-29 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a20260529"
down_revision: Union[str, Sequence[str], None] = "f6a7b8c9d012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("venues", "capacity", schema="ticket_rush")


def downgrade() -> None:
    op.add_column("venues", sa.Column("capacity", sa.Integer(), nullable=True), schema="ticket_rush")
