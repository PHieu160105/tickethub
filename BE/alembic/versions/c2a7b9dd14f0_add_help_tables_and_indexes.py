"""Thêm bảng hỗ trợ khách hàng và các index quan trọng.

Revision ID: c2a7b9dd14f0
Revises: 7f3c1a5c2d11
Create Date: 2026-05-02 14:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# Định danh revision do Alembic sử dụng.
revision: str = "c2a7b9dd14f0"
down_revision: Union[str, Sequence[str], None] = "b16913c86cb7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "help_threads",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=False),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_message_preview", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("unread_admin", sa.Integer(), nullable=False),
        sa.Column("unread_customer", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["ticket_rush.users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema="ticket_rush",
    )
    op.create_table(
        "help_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("thread_id", sa.Integer(), nullable=False),
        sa.Column("sender_id", sa.Integer(), nullable=False),
        sa.Column("sender_role", sa.Enum("customer", "admin", name="userrole", native_enum=False), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("message_type", sa.String(length=20), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["sender_id"], ["ticket_rush.users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["thread_id"], ["ticket_rush.help_threads.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema="ticket_rush",
    )

    op.create_index("ix_ticket_rush_help_threads_customer_id", "help_threads", ["customer_id"], unique=False, schema="ticket_rush")
    op.create_index("ix_ticket_rush_help_threads_last_message_at", "help_threads", ["last_message_at"], unique=False, schema="ticket_rush")
    op.create_index("ix_ticket_rush_help_messages_thread_id", "help_messages", ["thread_id"], unique=False, schema="ticket_rush")
    op.create_index("ix_ticket_rush_help_messages_sender_id", "help_messages", ["sender_id"], unique=False, schema="ticket_rush")
    op.create_index("ix_ticket_rush_help_messages_created_at", "help_messages", ["created_at"], unique=False, schema="ticket_rush")
    op.create_index("ix_ticket_rush_help_messages_thread_created", "help_messages", ["thread_id", "created_at"], unique=False, schema="ticket_rush")
    op.create_index("ix_ticket_rush_help_messages_sender_created", "help_messages", ["sender_id", "created_at"], unique=False, schema="ticket_rush")

    op.create_index("ix_ticket_rush_events_start_at", "events", ["start_at"], unique=False, schema="ticket_rush")
    op.create_index("ix_ticket_rush_events_status_is_deleted", "events", ["status", "is_deleted"], unique=False, schema="ticket_rush")
    op.create_index("ix_ticket_rush_events_title", "events", ["title"], unique=False, schema="ticket_rush")
    op.create_index("ix_ticket_rush_orders_status_created_at", "orders", ["status", "created_at"], unique=False, schema="ticket_rush")
    op.create_index("ix_ticket_rush_orders_event_created_at", "orders", ["event_id", "created_at"], unique=False, schema="ticket_rush")
    op.create_index("ix_ticket_rush_seats_event_status", "seats", ["event_id", "status"], unique=False, schema="ticket_rush")
    op.create_index("ix_ticket_rush_seats_lock_expires_at", "seats", ["lock_expires_at"], unique=False, schema="ticket_rush")
    op.create_index(
        "ix_ticket_rush_queue_entries_event_status_position",
        "queue_entries",
        ["event_id", "status", "position_hint"],
        unique=False,
        schema="ticket_rush",
    )
    op.create_index("ix_ticket_rush_tickets_order_item_id", "tickets", ["order_item_id"], unique=False, schema="ticket_rush")


def downgrade() -> None:
    op.drop_index("ix_ticket_rush_tickets_order_item_id", table_name="tickets", schema="ticket_rush")
    op.drop_index("ix_ticket_rush_queue_entries_event_status_position", table_name="queue_entries", schema="ticket_rush")
    op.drop_index("ix_ticket_rush_seats_lock_expires_at", table_name="seats", schema="ticket_rush")
    op.drop_index("ix_ticket_rush_seats_event_status", table_name="seats", schema="ticket_rush")
    op.drop_index("ix_ticket_rush_orders_event_created_at", table_name="orders", schema="ticket_rush")
    op.drop_index("ix_ticket_rush_orders_status_created_at", table_name="orders", schema="ticket_rush")
    op.drop_index("ix_ticket_rush_events_title", table_name="events", schema="ticket_rush")
    op.drop_index("ix_ticket_rush_events_status_is_deleted", table_name="events", schema="ticket_rush")
    op.drop_index("ix_ticket_rush_events_start_at", table_name="events", schema="ticket_rush")

    op.drop_index("ix_ticket_rush_help_messages_sender_created", table_name="help_messages", schema="ticket_rush")
    op.drop_index("ix_ticket_rush_help_messages_thread_created", table_name="help_messages", schema="ticket_rush")
    op.drop_index("ix_ticket_rush_help_messages_created_at", table_name="help_messages", schema="ticket_rush")
    op.drop_index("ix_ticket_rush_help_messages_sender_id", table_name="help_messages", schema="ticket_rush")
    op.drop_index("ix_ticket_rush_help_messages_thread_id", table_name="help_messages", schema="ticket_rush")
    op.drop_index("ix_ticket_rush_help_threads_last_message_at", table_name="help_threads", schema="ticket_rush")
    op.drop_index("ix_ticket_rush_help_threads_customer_id", table_name="help_threads", schema="ticket_rush")
    op.drop_table("help_messages", schema="ticket_rush")
    op.drop_table("help_threads", schema="ticket_rush")
