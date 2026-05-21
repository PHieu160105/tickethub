"""Thêm index cho Waiting Room admission control.

Revision ID: f6a7b8c9d012
Revises: e4f1c2d3a456
Create Date: 2026-05-21 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op


revision: str = "f6a7b8c9d012"
down_revision: Union[str, Sequence[str], None] = "e4f1c2d3a456"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        WITH ranked AS (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY show_id, user_id
                       ORDER BY created_at DESC, id DESC
                   ) AS rn
            FROM ticket_rush.queue_entries
            WHERE status IN ('waiting', 'admitted', 'WAITING', 'ADMITTED')
              AND show_id IS NOT NULL
        )
        UPDATE ticket_rush.queue_entries q
        SET status = 'expired'
        FROM ranked r
        WHERE q.id = r.id
          AND r.rn > 1
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_queue_entries_active_user_show
        ON ticket_rush.queue_entries (show_id, user_id)
        WHERE status IN ('waiting', 'admitted', 'WAITING', 'ADMITTED')
          AND show_id IS NOT NULL
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_queue_entries_show_status_created
        ON ticket_rush.queue_entries (show_id, status, created_at)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_queue_entries_show_user_token
        ON ticket_rush.queue_entries (show_id, user_id, token)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ticket_rush.ix_queue_entries_show_user_token")
    op.execute("DROP INDEX IF EXISTS ticket_rush.ix_queue_entries_show_status_created")
    op.execute("DROP INDEX IF EXISTS ticket_rush.uq_queue_entries_active_user_show")
