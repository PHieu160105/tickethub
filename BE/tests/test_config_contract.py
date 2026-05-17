"""Kiểm thử quy ước cấu hình môi trường."""

from app.core.config import Settings


def test_default_cors_origins_cover_standard_and_fallback_frontend_ports():
    """CORS local mặc định phải bao phủ cả cổng frontend chuẩn và cổng dự phòng."""

    settings = Settings(database_url="sqlite+aiosqlite:///:memory:", _env_file=None)

    assert "http://localhost:5173" in settings.allowed_origins
    assert "http://127.0.0.1:5173" in settings.allowed_origins
    assert "http://localhost:5174" in settings.allowed_origins
    assert "http://127.0.0.1:5174" in settings.allowed_origins


def test_dev_cors_regex_allows_localhost_fallback_ports():
    """CORS môi trường phát triển vẫn phải chạy khi frontend đổi cổng do trùng cổng cục bộ."""

    settings = Settings(database_url="sqlite+aiosqlite:///:memory:", _env_file=None)

    assert settings.allowed_origin_regex == r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"


def test_production_disables_localhost_wildcard_cors_regex():
    """Môi trường production không được mở wildcard localhost qua biểu thức chính quy CORS."""

    settings = Settings(
        database_url="sqlite+aiosqlite:///:memory:",
        environment="production",
        _env_file=None,
    )

    assert settings.allowed_origin_regex is None
