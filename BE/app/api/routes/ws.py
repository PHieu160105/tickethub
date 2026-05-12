"""WebSocket endpoints for seat updates and admin realtime dashboard."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.core.security import TokenDecodeError, decode_access_token
from app.models.enums import UserRole
from app.models.event import Show
from app.models.help import HelpThread
from app.models.user import User
from app.services.dashboard_service import get_dashboard_summary
from app.ws.connection_manager import admin_ws_manager, help_ws_manager, seat_ws_manager

router = APIRouter(tags=["websocket"])


async def _resolve_ws_user(token: str) -> User | None:
    """Decode token and fetch user for websocket authentication."""

    try:
        payload = decode_access_token(token)
    except TokenDecodeError:
        return None

    user_id = int(payload["sub"])
    async with AsyncSessionLocal() as session:
        return await session.scalar(select(User).where(User.id == user_id))


@router.websocket("/ws/shows/{show_id}/seats")
async def show_seat_ws(websocket: WebSocket, show_id: int, token: str | None = None) -> None:
    """Push incremental seat updates for one show."""

    if not token:
        await websocket.close(code=1008, reason="Auth token is required")
        return

    user = await _resolve_ws_user(token)
    if not user:
        await websocket.close(code=1008, reason="Invalid auth token")
        return

    async with AsyncSessionLocal() as session:
        show = await session.scalar(select(Show).where(Show.id == show_id, Show.is_deleted.is_(False)))

    if not show:
        await websocket.close(code=1008, reason="Show not found")
        return

    connected = await seat_ws_manager.connect(show.id, user.id, websocket)
    if not connected:
        return

    try:
        while True:
            # Keep socket alive and allow client to ping.
            await websocket.receive_text()
    except WebSocketDisconnect:
        await seat_ws_manager.disconnect(show.id, user.id, websocket)


@router.websocket("/ws/admin/dashboard")
async def admin_dashboard_ws(websocket: WebSocket, token: str | None = None) -> None:
    """Push real-time summary metrics for admin dashboard."""

    if not token:
        await websocket.close(code=1008, reason="Auth token is required")
        return

    user = await _resolve_ws_user(token)
    if not user or user.role != UserRole.ADMIN:
        await websocket.close(code=1008, reason="Admin role required")
        return

    connected = await admin_ws_manager.connect(user.id, websocket)
    if not connected:
        return

    try:
        async with AsyncSessionLocal() as session:
            summary = await get_dashboard_summary(session)
            await websocket.send_json({"type": "dashboard_update", "payload": summary.model_dump()})

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await admin_ws_manager.disconnect(user.id, websocket)


@router.websocket("/ws/help/{thread_id}")
async def help_chat_ws(websocket: WebSocket, thread_id: int, token: str | None = None) -> None:
    """Realtime room for one help thread."""

    if not token:
        await websocket.close(code=1008, reason="Auth token is required")
        return
    user = await _resolve_ws_user(token)
    if not user:
        await websocket.close(code=1008, reason="Invalid auth token")
        return

    async with AsyncSessionLocal() as session:
        thread = await session.scalar(select(HelpThread).where(HelpThread.id == thread_id))
    if not thread:
        await websocket.close(code=1008, reason="Thread not found")
        return
    if user.role != UserRole.ADMIN and thread.customer_id != user.id:
        await websocket.close(code=1008, reason="Forbidden")
        return

    connected = await help_ws_manager.connect(thread_id, user.id, websocket)
    if not connected:
        return
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await help_ws_manager.disconnect(thread_id, user.id, websocket)
