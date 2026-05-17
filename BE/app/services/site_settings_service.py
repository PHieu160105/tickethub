"""Dịch vụ đọc/ghi cấu hình website dạng JSON nhẹ."""

from __future__ import annotations

import json
from pathlib import Path
from threading import Lock

from app.schemas.site_settings import SiteSettingsPayload


DATA_DIR = Path(__file__).resolve().parent.parent / "data"
SITE_SETTINGS_FILE = DATA_DIR / "site_settings.json"
_SITE_SETTINGS_LOCK = Lock()

DEFAULT_SITE_SETTINGS = SiteSettingsPayload()


def _write_site_settings(payload: SiteSettingsPayload) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SITE_SETTINGS_FILE.write_text(
        json.dumps(payload.model_dump(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def load_site_settings() -> SiteSettingsPayload:
    """Đọc cấu hình website đã lưu hoặc tạo file mặc định khi thiếu/sai định dạng."""

    with _SITE_SETTINGS_LOCK:
        if not SITE_SETTINGS_FILE.exists():
            _write_site_settings(DEFAULT_SITE_SETTINGS)
            return DEFAULT_SITE_SETTINGS

        try:
            payload = SiteSettingsPayload.model_validate(
                json.loads(SITE_SETTINGS_FILE.read_text(encoding="utf-8"))
            )
        except (OSError, json.JSONDecodeError, ValueError):
            _write_site_settings(DEFAULT_SITE_SETTINGS)
            return DEFAULT_SITE_SETTINGS

        return payload


def save_site_settings(payload: SiteSettingsPayload) -> SiteSettingsPayload:
    """Lưu cấu hình website đã chuẩn hóa và trả lại payload vừa lưu."""

    with _SITE_SETTINGS_LOCK:
        _write_site_settings(payload)
    return payload
