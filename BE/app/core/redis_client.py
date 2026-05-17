"""Khởi tạo Redis client dùng chung với hướng xử lý mềm khi Redis tạm thời không sẵn sàng."""

from __future__ import annotations

from redis.asyncio import Redis

from app.core.config import get_settings

settings = get_settings()

# Biến module-level này giữ Redis client duy nhất để tránh tạo kết nối mới cho từng request.
_redis_client: Redis | None = None


def get_redis_client() -> Redis:
    """Trả về Redis client dùng chung cho toàn ứng dụng.

    Input:
    - Không nhận tham số từ caller, đọc cấu hình qua `Settings`.

    Output:
    - Một đối tượng `Redis` async đã cấu hình timeout ngắn để không làm nghẽn request.

    Cách hoạt động:
    - Client chỉ được tạo một lần theo kiểu singleton nội bộ.
    - URL Redis dùng giá trị đã được `Settings.resolved_redis_url` chuẩn hóa.
    """

    global _redis_client
    if _redis_client is None:
        # URL đã được chuẩn hóa ở `Settings`, ví dụ môi trường cục bộ dùng Redis Docker trên port 6380.
        redis_url = settings.resolved_redis_url

        # `decode_responses=True` giúp Redis trả string thay vì bytes, code nghiệp vụ đọc dễ hơn.
        _redis_client = Redis.from_url(
            redis_url,
            decode_responses=True,
            # Timeout ngắn để Redis lỗi không kéo sập request API chính.
            socket_connect_timeout=0.25,
            socket_timeout=0.25,
            retry_on_timeout=False,
            # Health check định kỳ giữ kết nối sống khi worker chạy lâu.
            health_check_interval=30,
        )
    return _redis_client
