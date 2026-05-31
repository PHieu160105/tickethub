from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.models.enums import EventStatus, UserType
from app.models.event import Show
from app.ws.connection_manager import seat_ws_manager

from ._shared import resolve_ws_user

router = APIRouter()


@router.websocket("/ws/shows/{show_id}/seats")
async def show_seat_ws(websocket: WebSocket, show_id: int, token: str | None = None) -> None:
    user = await resolve_ws_user(token) if token else None
    if token and not user:
        await websocket.close(code=1008, reason="Token xac thuc khong hop le")
        return

    async with AsyncSessionLocal() as session:
        show = await session.scalar(select(Show).where(Show.id == show_id, Show.is_deleted.is_(False)))

    if not show:
        await websocket.close(code=1008, reason="Khong tim thay buoi dien")
        return
    is_internal_user = bool(user and user.user_type in {UserType.EVENT_STAFF, UserType.SYSTEM_ADMIN})
    if not is_internal_user and show.status != EventStatus.LIVE:
        await websocket.close(code=1008, reason="Buoi dien dang duoc cap nhat")
        return

    connected = await seat_ws_manager.connect(show.id, user.id if user else None, websocket)
    if not connected:
        return

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await seat_ws_manager.disconnect(show.id, user.id if user else None, websocket)
