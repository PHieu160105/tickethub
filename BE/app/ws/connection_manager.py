"""In-memory WebSocket connection managers."""

import asyncio
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

MAX_CONNECTIONS_PER_USER = 5


class SeatWebSocketManager:
    """Handles fan-out of seat status updates for each show room."""

    def __init__(self) -> None:
        self._rooms: dict[int, set[WebSocket]] = defaultdict(set)
        self._user_connections: dict[int, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, show_id: int, user_id: int, websocket: WebSocket) -> bool:
        """Accept and register a seat-map WebSocket client."""

        async with self._lock:
            if len(self._user_connections[user_id]) >= MAX_CONNECTIONS_PER_USER:
                await websocket.close(code=4004, reason="Too many connections")
                return False

        await websocket.accept()
        async with self._lock:
            self._rooms[show_id].add(websocket)
            self._user_connections[user_id].add(websocket)
        return True

    async def disconnect(self, show_id: int, user_id: int, websocket: WebSocket) -> None:
        """Remove socket from the show room."""

        async with self._lock:
            self._rooms[show_id].discard(websocket)
            self._user_connections[user_id].discard(websocket)

    async def broadcast_seat_changes(self, show_id: int, payload: list[dict[str, Any]]) -> None:
        """Push seat delta updates to all listeners of a show."""

        if not payload:
            return

        dead_connections: list[WebSocket] = []
        for websocket in list(self._rooms.get(show_id, set())):
            try:
                await websocket.send_json({"type": "seat_changes", "show_id": show_id, "payload": payload})
            except Exception:
                dead_connections.append(websocket)

        if dead_connections:
            async with self._lock:
                for conn in dead_connections:
                    self._rooms[show_id].discard(conn)
                for user_connections in self._user_connections.values():
                    user_connections.difference_update(dead_connections)


class AdminWebSocketManager:
    """Broadcast dashboard summary updates to connected admin dashboards."""

    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()
        self._user_connections: dict[int, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, user_id: int, websocket: WebSocket) -> bool:
        """Accept and track one dashboard socket."""

        async with self._lock:
            if len(self._user_connections[user_id]) >= MAX_CONNECTIONS_PER_USER:
                await websocket.close(code=4004, reason="Too many connections")
                return False

        await websocket.accept()
        async with self._lock:
            self._clients.add(websocket)
            self._user_connections[user_id].add(websocket)
        return True

    async def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        """Drop disconnected dashboard socket."""

        async with self._lock:
            self._clients.discard(websocket)
            self._user_connections[user_id].discard(websocket)

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
                for user_connections in self._user_connections.values():
                    user_connections.difference_update(dead_connections)


seat_ws_manager = SeatWebSocketManager()
admin_ws_manager = AdminWebSocketManager()


class HelpWebSocketManager:
    """Broadcast help chat messages to subscribers of a thread."""

    def __init__(self) -> None:
        self._rooms: dict[int, set[WebSocket]] = defaultdict(set)
        self._user_connections: dict[int, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, thread_id: int, user_id: int, websocket: WebSocket) -> bool:
        async with self._lock:
            if len(self._user_connections[user_id]) >= MAX_CONNECTIONS_PER_USER:
                await websocket.close(code=4004, reason="Too many connections")
                return False
        await websocket.accept()
        async with self._lock:
            self._rooms[thread_id].add(websocket)
            self._user_connections[user_id].add(websocket)
        return True

    async def disconnect(self, thread_id: int, user_id: int, websocket: WebSocket) -> None:
        async with self._lock:
            self._rooms[thread_id].discard(websocket)
            self._user_connections[user_id].discard(websocket)

    async def broadcast_message(self, thread_id: int, payload: dict[str, Any]) -> None:
        dead_connections: list[WebSocket] = []
        for websocket in list(self._rooms.get(thread_id, set())):
            try:
                await websocket.send_json({"type": "help_message", "thread_id": thread_id, "payload": payload})
            except Exception:
                dead_connections.append(websocket)

        if dead_connections:
            async with self._lock:
                for conn in dead_connections:
                    self._rooms[thread_id].discard(conn)
                for user_connections in self._user_connections.values():
                    user_connections.difference_update(dead_connections)


help_ws_manager = HelpWebSocketManager()
