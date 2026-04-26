"""Background workers for lock release, queue admission, and dashboard streaming."""

import asyncio
import logging

from app.core.cache import event_seat_cache_namespace, public_api_cache
from app.core.db import AsyncSessionLocal
from app.services.booking_service import release_expired_locks
from app.services.dashboard_service import get_dashboard_summary
from app.services.queue_service import cleanup_expired_queue_entries, process_virtual_queue
from app.ws.connection_manager import admin_ws_manager, seat_ws_manager

logger = logging.getLogger(__name__)


class WorkerOrchestrator:
    """Coordinates periodic background jobs within FastAPI lifespan."""

    def __init__(self) -> None:
        self._stop_event = asyncio.Event()
        self._task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        """Start worker loop if not running."""

        if self._task and not self._task.done():
            return
        self._stop_event.clear()
        self._task = asyncio.create_task(self._run_loop(), name="ticketrush-background-workers")

    async def stop(self) -> None:
        """Signal worker loop to stop and wait for graceful shutdown."""

        self._stop_event.set()
        if self._task:
            await self._task

    async def _run_loop(self) -> None:
        """Execute all periodic jobs in one cooperative async loop."""

        while not self._stop_event.is_set():
            try:
                async with AsyncSessionLocal() as session:
                    released_by_event = await release_expired_locks(session)
                    for event_id, payload in released_by_event.items():
                        await public_api_cache.invalidate_namespace(event_seat_cache_namespace(event_id))
                        await seat_ws_manager.broadcast_seat_changes(event_id, payload)

                async with AsyncSessionLocal() as session:
                    await process_virtual_queue(session)

                async with AsyncSessionLocal() as session:
                    await cleanup_expired_queue_entries(session)

                if admin_ws_manager.has_clients():
                    async with AsyncSessionLocal() as session:
                        summary = await get_dashboard_summary(session)
                        await admin_ws_manager.broadcast(summary.model_dump())
            except Exception:  # pragma: no cover - defensive runtime logging
                logger.exception("Background worker iteration failed")

            await asyncio.sleep(3)


worker_orchestrator = WorkerOrchestrator()
