"""add_venue_seating_system

Revision ID: b16913c86cb7
Revises: 
Create Date: 2026-04-29 09:09:26.584841

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b16913c86cb7'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create venues table
    op.create_table('venues',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('venue_type', sa.String(length=50), nullable=False),
        sa.Column('capacity', sa.Integer(), nullable=True),
        sa.Column('svg_source', sa.Text(), nullable=True),
        sa.Column('svg_processed', sa.Text(), nullable=True),
        sa.Column('width', sa.Integer(), nullable=False),
        sa.Column('height', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_by_user_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['ticket_rush.users.id'], name=op.f('fk_venues_created_by_user_id_users')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_venues')),
        schema='ticket_rush'
    )
    op.create_index(op.f('ix_ticket_rush_venues_id'), 'venues', ['id'], unique=False, schema='ticket_rush')

    # Create venue_layouts table
    op.create_table('venue_layouts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('venue_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('svg_data', sa.Text(), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['venue_id'], ['ticket_rush.venues.id'], name=op.f('fk_venue_layouts_venue_id_venues'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_venue_layouts')),
        schema='ticket_rush'
    )
    op.create_index(op.f('ix_ticket_rush_venue_layouts_id'), 'venue_layouts', ['id'], unique=False, schema='ticket_rush')
    op.create_index(op.f('ix_ticket_rush_venue_layouts_venue_id'), 'venue_layouts', ['venue_id'], unique=False, schema='ticket_rush')

    # Create sections table
    op.create_table('sections',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('venue_layout_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('code', sa.String(length=30), nullable=False),
        sa.Column('color', sa.String(length=20), nullable=False),
        sa.Column('price_base', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['venue_layout_id'], ['ticket_rush.venue_layouts.id'], name=op.f('fk_sections_venue_layout_id_venue_layouts'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_sections')),
        schema='ticket_rush'
    )
    op.create_index(op.f('ix_ticket_rush_sections_id'), 'sections', ['id'], unique=False, schema='ticket_rush')
    op.create_index(op.f('ix_ticket_rush_sections_venue_layout_id'), 'sections', ['venue_layout_id'], unique=False, schema='ticket_rush')

    # Add columns to events
    op.add_column('events', sa.Column('venue_id', sa.Integer(), nullable=True), schema='ticket_rush')
    op.add_column('events', sa.Column('venue_layout_id', sa.Integer(), nullable=True), schema='ticket_rush')
    op.create_index(op.f('ix_ticket_rush_events_venue_id'), 'events', ['venue_id'], unique=False, schema='ticket_rush')
    op.create_index(op.f('ix_ticket_rush_events_venue_layout_id'), 'events', ['venue_layout_id'], unique=False, schema='ticket_rush')
    op.create_foreign_key(op.f('fk_events_venue_id_venues'), 'events', 'venues', ['venue_id'], ['id'], source_schema='ticket_rush', referent_schema='ticket_rush')
    op.create_foreign_key(op.f('fk_events_venue_layout_id_venue_layouts'), 'events', 'venue_layouts', ['venue_layout_id'], ['id'], source_schema='ticket_rush', referent_schema='ticket_rush')

    # Add columns to seats
    op.add_column('seats', sa.Column('x_coord', sa.Numeric(precision=5, scale=2), nullable=True), schema='ticket_rush')
    op.add_column('seats', sa.Column('y_coord', sa.Numeric(precision=5, scale=2), nullable=True), schema='ticket_rush')
    op.add_column('seats', sa.Column('rotation', sa.Numeric(precision=5, scale=2), nullable=False, server_default='0'), schema='ticket_rush')
    op.add_column('seats', sa.Column('section_id', sa.Integer(), nullable=True), schema='ticket_rush')
    op.add_column('seats', sa.Column('venue_layout_id', sa.Integer(), nullable=True), schema='ticket_rush')
    op.create_index(op.f('ix_ticket_rush_seats_section_id'), 'seats', ['section_id'], unique=False, schema='ticket_rush')
    op.create_index(op.f('ix_ticket_rush_seats_venue_layout_id'), 'seats', ['venue_layout_id'], unique=False, schema='ticket_rush')
    op.create_foreign_key(op.f('fk_seats_venue_layout_id_venue_layouts'), 'seats', 'venue_layouts', ['venue_layout_id'], ['id'], source_schema='ticket_rush', referent_schema='ticket_rush')
    op.create_foreign_key(op.f('fk_seats_section_id_sections'), 'seats', 'sections', ['section_id'], ['id'], source_schema='ticket_rush', referent_schema='ticket_rush')


def downgrade() -> None:
    """Downgrade schema."""
    # Remove seat columns
    op.drop_constraint(op.f('fk_seats_section_id_sections'), 'seats', schema='ticket_rush', type_='foreignkey')
    op.drop_constraint(op.f('fk_seats_venue_layout_id_venue_layouts'), 'seats', schema='ticket_rush', type_='foreignkey')
    op.drop_index(op.f('ix_ticket_rush_seats_venue_layout_id'), table_name='seats', schema='ticket_rush')
    op.drop_index(op.f('ix_ticket_rush_seats_section_id'), table_name='seats', schema='ticket_rush')
    op.drop_column('seats', 'venue_layout_id', schema='ticket_rush')
    op.drop_column('seats', 'section_id', schema='ticket_rush')
    op.drop_column('seats', 'rotation', schema='ticket_rush')
    op.drop_column('seats', 'y_coord', schema='ticket_rush')
    op.drop_column('seats', 'x_coord', schema='ticket_rush')

    # Remove event columns
    op.drop_constraint(op.f('fk_events_venue_layout_id_venue_layouts'), 'events', schema='ticket_rush', type_='foreignkey')
    op.drop_constraint(op.f('fk_events_venue_id_venues'), 'events', schema='ticket_rush', type_='foreignkey')
    op.drop_index(op.f('ix_ticket_rush_events_venue_layout_id'), table_name='events', schema='ticket_rush')
    op.drop_index(op.f('ix_ticket_rush_events_venue_id'), table_name='events', schema='ticket_rush')
    op.drop_column('events', 'venue_layout_id', schema='ticket_rush')
    op.drop_column('events', 'venue_id', schema='ticket_rush')

    # Drop sections
    op.drop_index(op.f('ix_ticket_rush_sections_venue_layout_id'), table_name='sections', schema='ticket_rush')
    op.drop_index(op.f('ix_ticket_rush_sections_id'), table_name='sections', schema='ticket_rush')
    op.drop_table('sections', schema='ticket_rush')

    # Drop venue_layouts
    op.drop_index(op.f('ix_ticket_rush_venue_layouts_venue_id'), table_name='venue_layouts', schema='ticket_rush')
    op.drop_index(op.f('ix_ticket_rush_venue_layouts_id'), table_name='venue_layouts', schema='ticket_rush')
    op.drop_table('venue_layouts', schema='ticket_rush')

    # Drop venues
    op.drop_index(op.f('ix_ticket_rush_venues_id'), table_name='venues', schema='ticket_rush')
    op.drop_table('venues', schema='ticket_rush')
