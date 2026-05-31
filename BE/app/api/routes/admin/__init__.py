from fastapi import APIRouter

from . import audit, dashboard, events, performers, settings, show_planner, shows, staff, tickets, users, venue_layouts, venue_seats, venues

router = APIRouter(prefix="/admin", tags=["admin"])
router.include_router(events.router)
router.include_router(shows.router)
router.include_router(staff.router)
router.include_router(audit.router)
router.include_router(performers.router)
router.include_router(show_planner.router)
router.include_router(venues.router)
router.include_router(venue_layouts.router)
router.include_router(venue_seats.router)
router.include_router(users.router)
router.include_router(tickets.router)
router.include_router(dashboard.router)
router.include_router(settings.router)
