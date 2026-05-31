"""Merge migration heads and enforce one assignment row per staff and event.

Revision ID: c20260531
Revises: a91b2c3d4e5f, b20260530
Create Date: 2026-05-31 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c20260531"
down_revision: Union[str, Sequence[str], None] = ("a91b2c3d4e5f", "b20260530")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    schema = "ticket_rush"
    op.get_bind().execute(
        sa.text(
            f"""
            DELETE FROM {schema}.event_assignments
            WHERE id IN (
                SELECT id
                FROM (
                    SELECT
                        id,
                        ROW_NUMBER() OVER (PARTITION BY event_id, staff_id ORDER BY id ASC) AS row_number
                    FROM {schema}.event_assignments
                ) duplicates
                WHERE duplicates.row_number > 1
            )
            """
        )
    )
    op.create_unique_constraint(
        "uq_event_assignments_event_id",
        "event_assignments",
        ["event_id", "staff_id"],
        schema=schema,
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_event_assignments_event_id",
        "event_assignments",
        schema="ticket_rush",
        type_="unique",
    )
