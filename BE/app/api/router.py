"""Primary API router aggregation."""

from fastapi import APIRouter

from app.api.routes import admin, auth, bookings, events, queue, seatmap, venues, ws
from app.api.routes.venues import layout_router, section_router

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(events.router)
api_router.include_router(queue.router)
api_router.include_router(bookings.router)
api_router.include_router(admin.router)
api_router.include_router(venues.router)
api_router.include_router(layout_router)
api_router.include_router(section_router)
api_router.include_router(seatmap.router)

ws_router = APIRouter()
ws_router.include_router(ws.router)
