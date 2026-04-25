"""In-memory WebSocket connection managers."""

import asyncio
from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class SeatWebSocketManager:
    """Handles fan-out of seat status updates for each event room."""

    def __init__(self) -> None:
        self._rooms: dict[int, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, event_id: int, websocket: WebSocket) -> None:
        """Accept and register a seat-map WebSocket client."""

        await websocket.accept()
        async with self._lock:
            self._rooms[event_id].add(websocket)

    async def disconnect(self, event_id: int, websocket: WebSocket) -> None:
        """Remove socket from the event room."""

        async with self._lock:
            self._rooms[event_id].discard(websocket)

    async def broadcast_seat_changes(self, event_id: int, payload: list[dict[str, Any]]) -> None:
        """Push seat delta updates to all listeners of an event."""

        if not payload:
            return

        dead_connections: list[WebSocket] = []
        for websocket in list(self._rooms.get(event_id, set())):
            try:
                await websocket.send_json({"type": "seat_changes", "event_id": event_id, "payload": payload})
            except Exception:
                dead_connections.append(websocket)

        if dead_connections:
            async with self._lock:
                for conn in dead_connections:
                    self._rooms[event_id].discard(conn)


class AdminWebSocketManager:
    """Broadcast dashboard summary updates to connected admin dashboards."""

    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        """Accept and track one dashboard socket."""

        await websocket.accept()
        async with self._lock:
            self._clients.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        """Drop disconnected dashboard socket."""

        async with self._lock:
            self._clients.discard(websocket)

    def has_clients(self) -> bool:
        """Return whether any admin dashboard websocket is currently connected."""

        return bool(self._clients)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        """Send metrics update to all active admin dashboard sockets."""

        dead_connections: list[WebSocket] = []
        for websocket in list(self._clients):
            try:
                await websocket.send_json({"type": "dashboard_update", "payload": payload})
            except Exception:
                dead_connections.append(websocket)

        if dead_connections:
            async with self._lock:
                for conn in dead_connections:
                    self._clients.discard(conn)


seat_ws_manager = SeatWebSocketManager()
admin_ws_manager = AdminWebSocketManager()
