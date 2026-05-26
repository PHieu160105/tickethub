"""Cung cấp hàm băm mật khẩu và tiện ích tạo/giải mã JWT.

Ghi chú cho người đọc chưa chuyên IT:
- Mật khẩu không bao giờ được lưu dạng chữ rõ trong cơ sở dữ liệu.
- JWT là chuỗi token đã ký, frontend gửi lại token này trong header `Authorization`.
- Backend giải mã JWT để biết request đang thuộc về user nào mà không cần lưu session trên server.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
settings = get_settings()


class TokenDecodeError(Exception):
    """Lỗi nội bộ khi JWT không giải mã được hoặc thiếu thông tin bắt buộc."""


def _create_token(subject: str, expires_delta: timedelta, *, purpose: str) -> str:
    """Tạo JWT đã ký cho một mục đích xác định."""

    expire_at = datetime.now(UTC) + expires_delta
    payload: dict[str, Any] = {"sub": subject, "exp": expire_at, "purpose": purpose}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def hash_password(password: str) -> str:
    """Băm mật khẩu thô trước khi lưu vào cơ sở dữ liệu."""

    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Đối chiếu mật khẩu thô với giá trị băm đã lưu."""

    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    """Tạo access token JWT đã ký cho người dùng đã xác thực."""

    return _create_token(
        subject,
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes),
        purpose="access",
    )


def create_refresh_token(subject: str, expires_delta: timedelta | None = None) -> str:
    """Tạo refresh token JWT đã ký để xin cặp token mới khi access token hết hạn."""

    return _create_token(
        subject,
        expires_delta or timedelta(minutes=settings.refresh_token_expire_minutes),
        purpose="refresh",
    )


def decode_access_token(token: str) -> dict[str, Any]:
    """Giải mã và kiểm tra access token JWT."""

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError as exc:
        raise TokenDecodeError("Token truy cập không hợp lệ hoặc đã hết hạn") from exc

    if "sub" not in payload:
        raise TokenDecodeError("Token thiếu định danh người dùng")
    if payload.get("purpose") != "access":
        raise TokenDecodeError("Token không đúng loại truy cập")

    return payload


def decode_refresh_token(token: str) -> dict[str, Any]:
    """Giải mã và kiểm tra refresh token JWT."""

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError as exc:
        raise TokenDecodeError("Refresh token không hợp lệ hoặc đã hết hạn") from exc

    if "sub" not in payload:
        raise TokenDecodeError("Refresh token thiếu định danh người dùng")
    if payload.get("purpose") != "refresh":
        raise TokenDecodeError("Refresh token không đúng loại")

    return payload
