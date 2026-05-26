"""Khởi tạo Redis client dùng chung với hướng xử lý mềm khi Redis tạm thời không sẵn sàng."""

from __future__ import annotations

import asyncio

from redis.asyncio import Redis

from app.core.config import get_settings

settings = get_settings()

# Mỗi event loop cần một Redis client riêng.
# Redis async giữ Future/transport theo loop; dùng chung qua nhiều loop sẽ lỗi trong pytest và worker.
_redis_clients_by_loop: dict[int, Redis] = {}


def get_redis_client() -> Redis:
    """Trả về Redis client dùng chung cho toàn ứng dụng.

    Input:
    - Không nhận tham số từ caller, đọc cấu hình qua `Settings`.

    Output:
    - Một đối tượng `Redis` async đã cấu hình timeout ngắn để không làm nghẽn request.

    Cách hoạt động:
    - Client chỉ được tạo một lần cho mỗi event loop đang chạy.
    - URL Redis dùng giá trị đã được `Settings.resolved_redis_url` chuẩn hóa.
    """

    try:
        loop_key = id(asyncio.get_running_loop())
    except RuntimeError:
        loop_key = 0

    if loop_key not in _redis_clients_by_loop:
        # URL đã được chuẩn hóa ở `Settings`, ví dụ môi trường cục bộ dùng Redis Docker trên port 6380.
        redis_url = settings.resolved_redis_url

        # `decode_responses=True` giúp Redis trả string thay vì bytes, code nghiệp vụ đọc dễ hơn.
        _redis_clients_by_loop[loop_key] = Redis.from_url(
            redis_url,
            decode_responses=True,
            # Timeout ngắn để Redis lỗi không kéo sập request API chính.
            socket_connect_timeout=0.25,
            socket_timeout=0.25,
            retry_on_timeout=False,
            # Health check định kỳ giữ kết nối sống khi worker chạy lâu.
            health_check_interval=30,
        )
    return _redis_clients_by_loop[loop_key]
