"""Primary API router aggregation."""

from fastapi import APIRouter

from app.api.routes import admin, auth, bookings, events, queue, ws

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(events.router)
api_router.include_router(queue.router)
api_router.include_router(bookings.router)
api_router.include_router(admin.router)

ws_router = APIRouter()
ws_router.include_router(ws.router)
