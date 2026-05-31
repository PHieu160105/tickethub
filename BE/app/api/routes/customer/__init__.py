from fastapi import APIRouter

from . import auth, bookings, events, payments, queue, search, seatmap, settings, shows

router = APIRouter()
router.include_router(auth.router)
router.include_router(events.router)
router.include_router(shows.router)
router.include_router(queue.router)
router.include_router(bookings.router)
router.include_router(payments.router)
router.include_router(search.router)
router.include_router(seatmap.router)
router.include_router(settings.router)
