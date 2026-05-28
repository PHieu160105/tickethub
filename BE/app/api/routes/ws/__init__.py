from fastapi import APIRouter

from . import dashboard, seats

router = APIRouter(tags=["websocket"])
router.include_router(seats.router)
router.include_router(dashboard.router)
