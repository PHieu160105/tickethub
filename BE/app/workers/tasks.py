"""Điều phối các worker nền cho giải phóng lock, admit queue và phát dashboard realtime."""

import asyncio
import logging
from datetime import timezone, datetime

from app.core.cache import public_api_cache, show_seat_cache_namespace
from app.core.db import AsyncSessionLocal
from app.services.booking_service import release_expired_locks
from app.services.admission_service import evaluate_waiting_room_health, expire_inactive_admitted_tokens, record_db_error
from app.services.dashboard_service import broadcast_dashboard_update
from app.services.queue_service import cleanup_expired_queue_entries, process_virtual_queue
from app.ws.connection_manager import seat_ws_manager

logger = logging.getLogger(__name__)


class WorkerOrchestrator:
    """Điều phối các công việc nền chạy tuần hoàn trong vòng đời FastAPI.

    Input:
    - Không nhận tham số từ bên ngoài khi khởi tạo mặc định.

    Output:
    - Một vòng lặp async nền chịu trách nhiệm chạy các tác vụ housekeeping nghiệp vụ.

    Cách hoạt động:
    - Tác vụ nền chạy theo chu kỳ vài giây.
    - Mỗi vòng lặp mở session riêng cho từng nhóm công việc để cô lập lỗi.
    - Nếu một tác vụ lỗi, worker ghi log rồi tiếp tục vòng kế tiếp thay vì làm sập backend.
    """

    def __init__(self) -> None:
        # Cờ async cho biết worker đã nhận yêu cầu dừng từ lifecycle của FastAPI.
        self._stop_event = asyncio.Event()

        # Task nền thật sự; giữ reference để không bị garbage collector hủy giữa chừng.
        self._task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        """Khởi động vòng lặp worker nếu hiện chưa chạy."""

        if self._task and not self._task.done():
            return

        # Mỗi lần start phải xóa cờ dừng cũ để vòng lặp `_run_loop` được chạy lại.
        self._stop_event.clear()
        self._task = asyncio.create_task(self._run_loop(), name="ticketrush-background-workers")

    async def stop(self) -> None:
        """Phát tín hiệu dừng worker và chờ tắt an toàn."""

        self._stop_event.set()
        if self._task:
            await self._task

    async def _run_loop(self) -> None:
        """Chạy toàn bộ job nền trong một vòng lặp async hợp tác."""

        while not self._stop_event.is_set():
            try:
                async with AsyncSessionLocal() as session:
                    # Job 1: mở lại các ghế hết hạn giữ chỗ và gom payload theo từng show.
                    released_by_show = await release_expired_locks(session)
                    for show_id, payload in released_by_show.items():
                        # Seat map public bị cache nên phải xóa cache trước khi phát WebSocket.
                        await public_api_cache.invalidate_namespace(show_seat_cache_namespace(show_id))
                        await seat_ws_manager.broadcast_seat_changes(show_id, payload)
                    if released_by_show:
                        await broadcast_dashboard_update()

                async with AsyncSessionLocal() as session:
                    # Job 2: đo DB health để tự bật/tắt Waiting Room.
                    await evaluate_waiting_room_health(session)

                async with AsyncSessionLocal() as session:
                    # Job 3: thu hồi token admitted không còn heartbeat.
                    expired_queue_count = await expire_inactive_admitted_tokens(session)
                    if expired_queue_count:
                        await broadcast_dashboard_update()

                async with AsyncSessionLocal() as session:
                    # Job 4: xét hàng đợi ảo và admit thêm user khi còn slot.
                    admitted_count = await process_virtual_queue(session)
                    if admitted_count:
                        await broadcast_dashboard_update()

                async with AsyncSessionLocal() as session:
                    # Job 5: dọn queue token hết hạn để bảng queue không phình mãi.
                    deleted_count = await cleanup_expired_queue_entries(session)
                    if deleted_count:
                        await broadcast_dashboard_update()
            except Exception:  # pragma: no cover - ghi log phòng vệ khi worker chạy thật
                await record_db_error()
                logger.exception("Vòng lặp worker nền gặp lỗi")

            # Nghỉ ngắn giữa các vòng để giảm tải CPU/database nhưng vẫn đủ realtime cho demo.
            await asyncio.sleep(3)


worker_orchestrator = WorkerOrchestrator()
