"""Event/show read-model service entry points."""

from app.services.event_core_service import (  # noqa: F401
    build_event_card_response,
    build_event_detail_response,
    build_show_detail_response,
    build_show_summary_response,
    get_event_by_slug_or_id,
    get_show_by_id,
    list_event_max_prices_for_event_ids,
    list_event_shows,
    list_live_events,
    list_show_ticket_tiers,
    list_shows_for_event_ids,
)

__all__ = [
    "build_event_card_response",
    "build_event_detail_response",
    "build_show_detail_response",
    "build_show_summary_response",
    "get_event_by_slug_or_id",
    "get_show_by_id",
    "list_event_max_prices_for_event_ids",
    "list_event_shows",
    "list_live_events",
    "list_show_ticket_tiers",
    "list_shows_for_event_ids",
]
