"""Khởi tạo Firebase Admin SDK và xác thực Firebase ID token."""

from typing import Any

import firebase_admin
from firebase_admin import credentials
from firebase_admin.auth import verify_id_token

from app.core.config import get_settings

_settings = get_settings()

_firebase_app: firebase_admin.App | None = None


def _get_firebase_creds() -> dict[str, Any]:
    """Dựng dict credentials Firebase từ cấu hình môi trường.

    Input:
    - Không nhận tham số; đọc giá trị từ `_settings`.

    Output:
    - Dict có dạng service account để `firebase_admin.credentials.Certificate` sử dụng.

    Cách hoạt động:
    - Private key trong `.env` thường lưu ký tự xuống dòng dạng `\\n`.
    - Hàm chuyển `\\n` về newline thật để Firebase Admin SDK đọc được khóa.
    """
    return {
        "type": "service_account",
        "project_id": _settings.firebase_project_id,
        "private_key": _settings.firebase_private_key.replace("\\n", "\n"),
        "client_email": _settings.firebase_client_email,
        "token_uri": "https://oauth2.googleapis.com/token",
    }


def get_firebase_app() -> firebase_admin.App:
    """Lấy hoặc khởi tạo singleton Firebase app.

    Input:
    - Không nhận tham số.

    Output:
    - Instance Firebase Admin app dùng chung trong toàn backend.

    Cách hoạt động:
    - Nếu app chưa tồn tại, tạo credentials rồi gọi `initialize_app`.
    - Nếu đã khởi tạo, trả lại app cũ để tránh lỗi khởi tạo trùng.
    """
    global _firebase_app
    if _firebase_app is None:
        creds = credentials.Certificate(_get_firebase_creds())
        _firebase_app = firebase_admin.initialize_app(creds)
    return _firebase_app


def verify_firebase_token(id_token: str) -> dict[str, Any]:
    """Xác thực Firebase ID token và trả về claim đã giải mã.

    Input:
    - `id_token`: token Firebase client gửi lên sau khi đăng nhập social.

    Output:
    - Dict claim đã được Firebase xác thực, thường có `uid`, `email`, `name`.

    Cách hoạt động:
    - Đảm bảo Firebase app đã được khởi tạo.
    - Gọi SDK chính thức `verify_id_token`; lỗi xác thực sẽ được route caller chuyển thành HTTP 401.
    """
    app = get_firebase_app()
    return verify_id_token(id_token, app=app)


class FirebaseTokenError(Exception):
    """Được ném ra khi xác thực Firebase token thất bại."""
