"""Refactor user subtypes, simplify venue/seat schema, and remove legacy queue tables.

Revision ID: b20260530
Revises: a20260529
Create Date: 2026-05-30 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b20260530"
down_revision: Union[str, Sequence[str], None] = "a20260529"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table(schema: str, name: str) -> str:
    return f"{schema}.{name}"


def upgrade() -> None:
    schema = "ticket_rush"
    bind = op.get_bind()

    op.create_table(
        "customers",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey(_table(schema, "users.id"), ondelete="CASCADE"), primary_key=True),
        sa.Column("google_id", sa.String(length=255), nullable=True, unique=True),
        sa.Column("zalo_id", sa.String(length=255), nullable=True, unique=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        schema=schema,
    )
    op.create_table(
        "event_staff",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey(_table(schema, "users.id"), ondelete="CASCADE"), primary_key=True),
        sa.Column("staff_code", sa.String(length=50), nullable=False, unique=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        schema=schema,
    )
    op.create_table(
        "system_admins",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey(_table(schema, "users.id"), ondelete="CASCADE"), primary_key=True),
        sa.Column("admin_code", sa.String(length=50), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        schema=schema,
    )
    op.create_table(
        "event_assignments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey(_table(schema, "events.id"), ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("staff_id", sa.Integer(), sa.ForeignKey(_table(schema, "event_staff.user_id"), ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        schema=schema,
    )
    op.create_table(
        "admin_audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("actor_admin_id", sa.Integer(), sa.ForeignKey(_table(schema, "system_admins.user_id"), ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("target_table", sa.String(length=100), nullable=False),
        sa.Column("target_id", sa.String(length=100), nullable=False),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        schema=schema,
    )

    with op.batch_alter_table("users", schema=schema) as batch_op:
        batch_op.add_column(sa.Column("user_type", sa.String(length=30), nullable=True))

    bind.execute(
        sa.text(
            f"""
            UPDATE {_table(schema, 'users')}
            SET user_type = CASE
                WHEN role = 'ADMIN' AND email LIKE 'admin@%%' THEN 'SYSTEM_ADMIN'
                WHEN role = 'ADMIN' THEN 'EVENT_STAFF'
                WHEN role = 'CUSTOMER' THEN 'CUSTOMER'
                ELSE COALESCE(role, 'CUSTOMER')
            END
            """
        )
    )
    bind.execute(
        sa.text(
            f"""
            INSERT INTO {_table(schema, 'customers')} (user_id, google_id, zalo_id, phone)
            SELECT id, google_id, zalo_id, NULL
            FROM {_table(schema, 'users')}
            WHERE user_type = 'CUSTOMER'
            """
        )
    )
    bind.execute(
        sa.text(
            f"""
            INSERT INTO {_table(schema, 'event_staff')} (user_id, staff_code, is_active)
            SELECT id, 'STF-' || CAST(id AS TEXT), 1
            FROM {_table(schema, 'users')}
            WHERE user_type = 'EVENT_STAFF'
            """
        )
    )
    bind.execute(
        sa.text(
            f"""
            INSERT INTO {_table(schema, 'system_admins')} (user_id, admin_code)
            SELECT id, 'ADM-' || CAST(id AS TEXT)
            FROM {_table(schema, 'users')}
            WHERE user_type = 'SYSTEM_ADMIN'
            """
        )
    )

    with op.batch_alter_table("users", schema=schema) as batch_op:
        batch_op.drop_column("role")
        batch_op.drop_column("google_id")
        batch_op.drop_column("zalo_id")

    with op.batch_alter_table("events", schema=schema) as batch_op:
        batch_op.add_column(sa.Column("created_by_staff_id", sa.Integer(), nullable=True))
    bind.execute(
        sa.text(
            f"""
            UPDATE {_table(schema, 'events')}
            SET created_by_staff_id = created_by_user_id
            """
        )
    )
    with op.batch_alter_table("events", schema=schema) as batch_op:
        batch_op.alter_column("created_by_staff_id", nullable=False)
        batch_op.drop_column("created_by_user_id")
        batch_op.drop_column("venue")
        batch_op.drop_column("venue_id")
        batch_op.drop_column("venue_layout_id")
        batch_op.drop_column("start_at")
        batch_op.drop_column("end_at")
        batch_op.drop_column("hold_minutes")

    with op.batch_alter_table("shows", schema=schema) as batch_op:
        batch_op.add_column(sa.Column("created_by_staff_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("venue_layout_id", sa.Integer(), nullable=True))
    bind.execute(
        sa.text(
            f"""
            UPDATE {_table(schema, 'shows')}
            SET created_by_staff_id = created_by_user_id
            """
        )
    )
    with op.batch_alter_table("shows", schema=schema) as batch_op:
        batch_op.alter_column("created_by_staff_id", nullable=False)
        batch_op.drop_column("created_by_user_id")
        batch_op.drop_column("venue_id")

    with op.batch_alter_table("venues", schema=schema) as batch_op:
        batch_op.add_column(sa.Column("created_by_staff_id", sa.Integer(), nullable=True))
    bind.execute(
        sa.text(
            f"""
            UPDATE {_table(schema, 'venues')}
            SET created_by_staff_id = created_by_user_id
            """
        )
    )
    with op.batch_alter_table("venues", schema=schema) as batch_op:
        batch_op.alter_column("created_by_staff_id", nullable=False)
        batch_op.drop_column("created_by_user_id")
        batch_op.drop_column("city")
        batch_op.drop_column("venue_type")
        batch_op.drop_column("background_processed")
        batch_op.drop_column("svg_processed")

    with op.batch_alter_table("venue_layouts", schema=schema) as batch_op:
        batch_op.drop_column("svg_data")
        batch_op.drop_column("sort_order")

    with op.batch_alter_table("seats", schema=schema) as batch_op:
        batch_op.drop_column("event_id")
        batch_op.drop_column("show_id")
        batch_op.drop_column("zone_id")
        batch_op.drop_column("price")
        batch_op.drop_column("status")
        batch_op.drop_column("lock_expires_at")
        batch_op.drop_column("locked_by_user_id")
        batch_op.drop_column("is_admin_locked")
        batch_op.drop_column("section_id")
        batch_op.drop_column("rotation")
        batch_op.drop_column("row_index")

    with op.batch_alter_table("ticket_tiers", schema=schema) as batch_op:
        batch_op.drop_column("event_id")
        batch_op.drop_column("row_count")
        batch_op.drop_column("seats_per_row")

    with op.batch_alter_table("orders", schema=schema) as batch_op:
        batch_op.add_column(sa.Column("customer_id", sa.Integer(), nullable=True))
    bind.execute(
        sa.text(
            f"""
            UPDATE {_table(schema, 'orders')}
            SET customer_id = user_id
            """
        )
    )
    with op.batch_alter_table("orders", schema=schema) as batch_op:
        batch_op.alter_column("customer_id", nullable=False)
        batch_op.drop_column("user_id")
        batch_op.drop_column("event_id")

    with op.batch_alter_table("tickets", schema=schema) as batch_op:
        batch_op.add_column(sa.Column("locked_by_customer_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("is_staff_locked", sa.Boolean(), nullable=False, server_default=sa.false()))
    bind.execute(
        sa.text(
            f"""
            UPDATE {_table(schema, 'tickets')}
            SET locked_by_customer_id = locked_by_user_id,
                is_staff_locked = COALESCE(is_admin_locked, 0)
            """
        )
    )
    with op.batch_alter_table("tickets", schema=schema) as batch_op:
        batch_op.drop_column("locked_by_user_id")
        batch_op.drop_column("is_admin_locked")

    op.drop_table("queue_entries", schema=schema)
    op.drop_table("sections", schema=schema)
    op.drop_table("polygons", schema=schema)
    op.drop_table("show_polygons", schema=schema)


def downgrade() -> None:
    schema = "ticket_rush"
    bind = op.get_bind()

    op.create_table(
        "queue_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_id", sa.Integer(), nullable=False, index=True),
        sa.Column("show_id", sa.Integer(), nullable=True, index=True),
        sa.Column("user_id", sa.Integer(), nullable=False, index=True),
        sa.Column("token", sa.String(length=120), nullable=False, unique=True, index=True),
        sa.Column("status", sa.String(length=30), nullable=False, index=True),
        sa.Column("position_hint", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("admitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        schema=schema,
    )
    op.create_table("sections", sa.Column("id", sa.Integer(), primary_key=True), schema=schema)
    op.create_table("polygons", sa.Column("id", sa.Integer(), primary_key=True), schema=schema)
    op.create_table("show_polygons", sa.Column("id", sa.Integer(), primary_key=True), schema=schema)

    with op.batch_alter_table("tickets", schema=schema) as batch_op:
        batch_op.add_column(sa.Column("locked_by_user_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("is_admin_locked", sa.Boolean(), nullable=False, server_default=sa.false()))
    bind.execute(
        sa.text(
            f"""
            UPDATE {_table(schema, 'tickets')}
            SET locked_by_user_id = locked_by_customer_id,
                is_admin_locked = COALESCE(is_staff_locked, 0)
            """
        )
    )
    with op.batch_alter_table("tickets", schema=schema) as batch_op:
        batch_op.drop_column("locked_by_customer_id")
        batch_op.drop_column("is_staff_locked")

    with op.batch_alter_table("orders", schema=schema) as batch_op:
        batch_op.add_column(sa.Column("user_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("event_id", sa.Integer(), nullable=True))
    bind.execute(
        sa.text(
            f"""
            UPDATE {_table(schema, 'orders')}
            SET user_id = customer_id
            """
        )
    )
    with op.batch_alter_table("orders", schema=schema) as batch_op:
        batch_op.alter_column("user_id", nullable=False)
        batch_op.drop_column("customer_id")

    with op.batch_alter_table("ticket_tiers", schema=schema) as batch_op:
        batch_op.add_column(sa.Column("event_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("row_count", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("seats_per_row", sa.Integer(), nullable=True))

    with op.batch_alter_table("seats", schema=schema) as batch_op:
        batch_op.add_column(sa.Column("event_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("show_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("zone_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("price", sa.Numeric(10, 2), nullable=True))
        batch_op.add_column(sa.Column("status", sa.String(length=30), nullable=True))
        batch_op.add_column(sa.Column("lock_expires_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("locked_by_user_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("is_admin_locked", sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column("section_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("rotation", sa.Numeric(5, 2), nullable=True))
        batch_op.add_column(sa.Column("row_index", sa.Integer(), nullable=True))

    with op.batch_alter_table("venue_layouts", schema=schema) as batch_op:
        batch_op.add_column(sa.Column("svg_data", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"))

    with op.batch_alter_table("venues", schema=schema) as batch_op:
        batch_op.add_column(sa.Column("created_by_user_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("city", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("venue_type", sa.String(length=50), nullable=False, server_default="custom"))
        batch_op.add_column(sa.Column("background_processed", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("svg_processed", sa.Text(), nullable=True))

    with op.batch_alter_table("shows", schema=schema) as batch_op:
        batch_op.add_column(sa.Column("created_by_user_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("venue_id", sa.Integer(), nullable=True))

    with op.batch_alter_table("events", schema=schema) as batch_op:
        batch_op.add_column(sa.Column("created_by_user_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("venue", sa.String(length=200), nullable=True))
        batch_op.add_column(sa.Column("venue_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("venue_layout_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("start_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("end_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("hold_minutes", sa.Integer(), nullable=True))

    with op.batch_alter_table("users", schema=schema) as batch_op:
        batch_op.add_column(sa.Column("role", sa.String(length=30), nullable=True))
        batch_op.add_column(sa.Column("google_id", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("zalo_id", sa.String(length=255), nullable=True))

    bind.execute(
        sa.text(
            f"""
            UPDATE {_table(schema, 'users')}
            SET role = CASE
                WHEN user_type = 'SYSTEM_ADMIN' THEN 'ADMIN'
                WHEN user_type = 'EVENT_STAFF' THEN 'ADMIN'
                ELSE 'CUSTOMER'
            END
            """
        )
    )
    bind.execute(
        sa.text(
            f"""
            UPDATE {_table(schema, 'users')}
            SET google_id = c.google_id,
                zalo_id = c.zalo_id
            FROM {_table(schema, 'customers')} AS c
            WHERE c.user_id = users.id
            """
        )
    )
    bind.execute(
        sa.text(
            f"""
            UPDATE {_table(schema, 'events')}
            SET created_by_user_id = created_by_staff_id
            """
        )
    )
    bind.execute(
        sa.text(
            f"""
            UPDATE {_table(schema, 'shows')}
            SET created_by_user_id = created_by_staff_id
            """
        )
    )
    bind.execute(
        sa.text(
            f"""
            UPDATE {_table(schema, 'venues')}
            SET created_by_user_id = created_by_staff_id
            """
        )
    )
    bind.execute(
        sa.text(
            f"""
            UPDATE {_table(schema, 'orders')}
            SET user_id = customer_id
            """
        )
    )

    op.drop_table("admin_audit_logs", schema=schema)
    op.drop_table("event_assignments", schema=schema)
    op.drop_table("system_admins", schema=schema)
    op.drop_table("event_staff", schema=schema)
    op.drop_table("customers", schema=schema)

