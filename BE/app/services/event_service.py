"""Compatibility facade for event and show services.

New code should import from the narrower modules in this package. This facade
keeps existing routes and tests stable while the large legacy implementation is
split into domain-focused entry points.
"""

from app.services.event_core_service import (  # noqa: F401
    build_event_card_response,
    build_event_detail_response,
    build_show_detail_response,
    build_show_summary_response,
    build_unique_slug,
    combine_show_datetime,
    create_event,
    create_initial_show_zone,
    create_show_with_inventory,
    create_show_zone,
    delete_show_zone,
    get_event_by_slug_or_id,
    get_show_by_id,
    get_show_seat_matrix,
    list_event_max_prices_for_event_ids,
    list_event_shows,
    list_live_events,
    list_show_zones,
    list_shows_for_event_ids,
    slugify,
    sync_show_ticket_inventory,
    update_show_zone,
)

__all__ = [
    "build_event_card_response",
    "build_event_detail_response",
    "build_show_detail_response",
    "build_show_summary_response",
    "build_unique_slug",
    "combine_show_datetime",
    "create_event",
    "create_initial_show_zone",
    "create_show_with_inventory",
    "create_show_zone",
    "delete_show_zone",
    "get_event_by_slug_or_id",
    "get_show_by_id",
    "get_show_seat_matrix",
    "list_event_max_prices_for_event_ids",
    "list_event_shows",
    "list_live_events",
    "list_show_zones",
    "list_shows_for_event_ids",
    "slugify",
    "sync_show_ticket_inventory",
    "update_show_zone",
]
