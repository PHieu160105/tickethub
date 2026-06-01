"""Add payment/refund fields and show cancellation metadata.

Revision ID: c20260531
Revises: b20260530
Create Date: 2026-05-31 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c20260531"
down_revision: Union[str, Sequence[str], None] = "b20260530"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    schema = "ticket_rush"

    with op.batch_alter_table("shows", schema=schema) as batch_op:
        batch_op.add_column(sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("cancelled_by_staff_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("cancellation_reason", sa.Text(), nullable=True))
        batch_op.create_foreign_key(
            "fk_shows_cancelled_by_staff_id_event_staff",
            "event_staff",
            ["cancelled_by_staff_id"],
            ["user_id"],
        )

    with op.batch_alter_table("orders", schema=schema) as batch_op:
        batch_op.add_column(sa.Column("payment_provider", sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column("gateway_order_ref", sa.String(length=120), nullable=True))
        batch_op.add_column(sa.Column("gateway_transaction_id", sa.String(length=120), nullable=True))
        batch_op.add_column(sa.Column("payment_started_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("payment_expires_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("refund_started_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.create_index("ix_ticket_rush_orders_gateway_order_ref", ["gateway_order_ref"], unique=False)
        batch_op.create_index("ix_ticket_rush_orders_gateway_transaction_id", ["gateway_transaction_id"], unique=False)


def downgrade() -> None:
    schema = "ticket_rush"

    with op.batch_alter_table("orders", schema=schema) as batch_op:
        batch_op.drop_index("ix_ticket_rush_orders_gateway_transaction_id")
        batch_op.drop_index("ix_ticket_rush_orders_gateway_order_ref")
        batch_op.drop_column("refunded_at")
        batch_op.drop_column("refund_started_at")
        batch_op.drop_column("payment_expires_at")
        batch_op.drop_column("payment_started_at")
        batch_op.drop_column("gateway_transaction_id")
        batch_op.drop_column("gateway_order_ref")
        batch_op.drop_column("payment_provider")

    with op.batch_alter_table("shows", schema=schema) as batch_op:
        batch_op.drop_constraint("fk_shows_cancelled_by_staff_id_event_staff", type_="foreignkey")
        batch_op.drop_column("cancellation_reason")
        batch_op.drop_column("cancelled_by_staff_id")
        batch_op.drop_column("cancelled_at")
