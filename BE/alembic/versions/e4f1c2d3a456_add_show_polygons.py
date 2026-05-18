"""Thêm vùng đa giác riêng cho từng buổi diễn.

Revision ID: e4f1c2d3a456
Revises: xxxxx
Create Date: 2026-05-13 17:10:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e4f1c2d3a456"
down_revision: Union[str, Sequence[str], None] = "xxxxx"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "show_polygons",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("show_id", sa.Integer(), nullable=False),
        sa.Column("zone_id", sa.Integer(), nullable=True),
        sa.Column("label", sa.String(length=100), nullable=True),
        sa.Column("points", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["show_id"], ["ticket_rush.shows.id"], name=op.f("fk_show_polygons_show_id_shows"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["zone_id"], ["ticket_rush.seat_zones.id"], name=op.f("fk_show_polygons_zone_id_seat_zones"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_show_polygons")),
        schema="ticket_rush",
    )
    op.create_index(op.f("ix_ticket_rush_show_polygons_id"), "show_polygons", ["id"], unique=False, schema="ticket_rush")
    op.create_index(op.f("ix_ticket_rush_show_polygons_show_id"), "show_polygons", ["show_id"], unique=False, schema="ticket_rush")
    op.create_index(op.f("ix_ticket_rush_show_polygons_zone_id"), "show_polygons", ["zone_id"], unique=False, schema="ticket_rush")


def downgrade() -> None:
    op.drop_index(op.f("ix_ticket_rush_show_polygons_zone_id"), table_name="show_polygons", schema="ticket_rush")
    op.drop_index(op.f("ix_ticket_rush_show_polygons_show_id"), table_name="show_polygons", schema="ticket_rush")
    op.drop_index(op.f("ix_ticket_rush_show_polygons_id"), table_name="show_polygons", schema="ticket_rush")
    op.drop_table("show_polygons", schema="ticket_rush")
