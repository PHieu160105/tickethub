"""Thêm bảng performers và show_performers.

Revision ID: a91b2c3d4e5f
Revises: f6a7b8c9d012
Create Date: 2026-05-27 15:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a91b2c3d4e5f"
down_revision: Union[str, Sequence[str], None] = "f6a7b8c9d012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "performers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("stage_name", sa.String(length=255), nullable=False),
        sa.Column("stage_name_normalized", sa.String(length=255), nullable=False),
        sa.Column("artist_type", sa.String(length=120), nullable=True),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("stage_name_normalized", name="uq_performers_stage_name_normalized"),
        schema="ticket_rush",
    )
    op.create_index("ix_ticket_rush_performers_id", "performers", ["id"], unique=False, schema="ticket_rush")
    op.create_index(
        "ix_ticket_rush_performers_stage_name_normalized",
        "performers",
        ["stage_name_normalized"],
        unique=False,
        schema="ticket_rush",
    )

    op.create_table(
        "show_performers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("show_id", sa.Integer(), nullable=False),
        sa.Column("performer_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.Enum("main", "guest", "backup", name="performerrole", native_enum=False), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["performer_id"], ["ticket_rush.performers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["show_id"], ["ticket_rush.shows.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("show_id", "performer_id", name="uq_show_performers_show_id_performer_id"),
        schema="ticket_rush",
    )
    op.create_index("ix_ticket_rush_show_performers_id", "show_performers", ["id"], unique=False, schema="ticket_rush")
    op.create_index("ix_ticket_rush_show_performers_show_id", "show_performers", ["show_id"], unique=False, schema="ticket_rush")
    op.create_index(
        "ix_ticket_rush_show_performers_performer_id",
        "show_performers",
        ["performer_id"],
        unique=False,
        schema="ticket_rush",
    )
    op.create_index("ix_ticket_rush_show_performers_role", "show_performers", ["role"], unique=False, schema="ticket_rush")


def downgrade() -> None:
    op.drop_index("ix_ticket_rush_show_performers_role", table_name="show_performers", schema="ticket_rush")
    op.drop_index("ix_ticket_rush_show_performers_performer_id", table_name="show_performers", schema="ticket_rush")
    op.drop_index("ix_ticket_rush_show_performers_show_id", table_name="show_performers", schema="ticket_rush")
    op.drop_index("ix_ticket_rush_show_performers_id", table_name="show_performers", schema="ticket_rush")
    op.drop_table("show_performers", schema="ticket_rush")

    op.drop_index("ix_ticket_rush_performers_stage_name_normalized", table_name="performers", schema="ticket_rush")
    op.drop_index("ix_ticket_rush_performers_id", table_name="performers", schema="ticket_rush")
    op.drop_table("performers", schema="ticket_rush")
