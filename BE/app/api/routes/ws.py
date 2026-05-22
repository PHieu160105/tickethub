"""Endpoint WebSocket cho cập nhật ghế, dashboard realtime và hỗ trợ."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.core.security import TokenDecodeError, decode_access_token
from app.models.enums import EventStatus, UserRole
from app.models.event import Show
from app.models.help import HelpThread
from app.models.user import User
from app.services.dashboard_service import get_dashboard_stream
from app.ws.connection_manager import admin_ws_manager, help_ws_manager, seat_ws_manager

router = APIRouter(tags=["websocket"])


async def _resolve_ws_user(token: str) -> User | None:
    """Giải mã token và lấy người dùng để xác thực WebSocket."""

    try:
        payload = decode_access_token(token)
    except TokenDecodeError:
        return None

    user_id = int(payload["sub"])
    async with AsyncSessionLocal() as session:
        return await session.scalar(select(User).where(User.id == user_id))


@router.websocket("/ws/shows/{show_id}/seats")
async def show_seat_ws(websocket: WebSocket, show_id: int, token: str | None = None) -> None:
    """Đẩy cập nhật ghế tăng dần cho một buổi diễn."""

    user = await _resolve_ws_user(token) if token else None
    if token and not user:
        await websocket.close(code=1008, reason="Token xác thực không hợp lệ")
        return

    async with AsyncSessionLocal() as session:
        show = await session.scalar(select(Show).where(Show.id == show_id, Show.is_deleted.is_(False)))

    if not show:
        await websocket.close(code=1008, reason="Không tìm thấy buổi diễn")
        return
    if (not user or user.role != UserRole.ADMIN) and show.status != EventStatus.LIVE:
        await websocket.close(code=1008, reason="Buổi diễn đang được cập nhật")
        return

    connected = await seat_ws_manager.connect(show.id, user.id if user else None, websocket)
    if not connected:
        return

    try:
        while True:
            # Giữ socket sống và cho phép client gửi ping.
            await websocket.receive_text()
    except WebSocketDisconnect:
        await seat_ws_manager.disconnect(show.id, user.id if user else None, websocket)


@router.websocket("/ws/admin/dashboard")
async def admin_dashboard_ws(websocket: WebSocket, token: str | None = None) -> None:
    """Đẩy chỉ số tổng quan realtime cho dashboard admin."""

    if not token:
        await websocket.close(code=1008, reason="Bắt buộc có token xác thực")
        return

    user = await _resolve_ws_user(token)
    if not user or user.role != UserRole.ADMIN:
        await websocket.close(code=1008, reason="Yêu cầu quyền admin")
        return

    connected = await admin_ws_manager.connect(user.id, websocket)
    if not connected:
        return

    try:
        async with AsyncSessionLocal() as session:
            payload = await get_dashboard_stream(session)
            await websocket.send_json({"type": "dashboard_update", "payload": payload.model_dump()})

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await admin_ws_manager.disconnect(user.id, websocket)


@router.websocket("/ws/help/{thread_id}")
async def help_chat_ws(websocket: WebSocket, thread_id: int, token: str | None = None) -> None:
    """Phòng realtime cho một thread hỗ trợ."""

    if not token:
        await websocket.close(code=1008, reason="Bắt buộc có token xác thực")
        return
    user = await _resolve_ws_user(token)
    if not user:
        await websocket.close(code=1008, reason="Token xác thực không hợp lệ")
        return

    async with AsyncSessionLocal() as session:
        thread = await session.scalar(select(HelpThread).where(HelpThread.id == thread_id))
    if not thread:
        await websocket.close(code=1008, reason="Không tìm thấy thread")
        return
    if user.role != UserRole.ADMIN and thread.customer_id != user.id:
        await websocket.close(code=1008, reason="Không có quyền truy cập")
        return

    connected = await help_ws_manager.connect(thread_id, user.id, websocket)
    if not connected:
        return
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await help_ws_manager.disconnect(thread_id, user.id, websocket)
