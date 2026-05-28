from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.db import AsyncSessionLocal
from app.models.enums import UserRole
from app.services.dashboard_service import dump_dashboard_stream, get_dashboard_stream
from app.ws.connection_manager import admin_ws_manager

from ._shared import resolve_ws_user

router = APIRouter()


@router.websocket("/ws/admin/dashboard")
async def admin_dashboard_ws(websocket: WebSocket, token: str | None = None) -> None:
    if not token:
        await websocket.close(code=1008, reason="Bat buoc co token xac thuc")
        return

    user = await resolve_ws_user(token)
    if not user or user.role != UserRole.ADMIN:
        await websocket.close(code=1008, reason="Yeu cau quyen admin")
        return

    connected = await admin_ws_manager.connect(user.id, websocket)
    if not connected:
        return

    try:
        async with AsyncSessionLocal() as session:
            payload = await get_dashboard_stream(session)
            await websocket.send_json({"type": "dashboard_update", "payload": dump_dashboard_stream(payload)})

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await admin_ws_manager.disconnect(user.id, websocket)
