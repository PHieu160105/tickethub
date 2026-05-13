"""Primary API router aggregation."""

from fastapi import APIRouter

from app.api.routes import admin, auth, bookings, events, help, queue, search, seatmap, site_settings, venues
from app.api.routes.venues import layout_router, polygon_router, section_router, seat_router


api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(events.event_router)
api_router.include_router(events.show_router)
api_router.include_router(site_settings.public_router)
api_router.include_router(queue.router)
api_router.include_router(bookings.router)
api_router.include_router(admin.router)
api_router.include_router(site_settings.admin_router)
api_router.include_router(help.router)
api_router.include_router(search.router)
api_router.include_router(venues.router)
api_router.include_router(layout_router)
api_router.include_router(section_router)
api_router.include_router(seat_router)
api_router.include_router(polygon_router)
api_router.include_router(seatmap.router)
