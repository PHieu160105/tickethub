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

# `pwd_context` là bộ băm mật khẩu dùng chung; PBKDF2 ổn định giữa nhiều môi trường chạy.
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# `settings` chứa secret key, thuật toán JWT và thời hạn token đã đọc từ cấu hình môi trường.
settings = get_settings()


class TokenDecodeError(Exception):
    """Lỗi nội bộ khi JWT không giải mã được hoặc thiếu thông tin bắt buộc."""



def hash_password(password: str) -> str:
    """Băm mật khẩu thô trước khi lưu vào cơ sở dữ liệu.

    Input:
    - `password`: mật khẩu người dùng nhập ở form đăng ký.

    Output:
    - Chuỗi hash một chiều; không thể đảo ngược về mật khẩu gốc.

    Cách hoạt động:
    - `passlib` tự sinh salt và chạy thuật toán PBKDF2.
    - Database chỉ lưu kết quả hash, không lưu mật khẩu chữ rõ.
    """

    return pwd_context.hash(password)



def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Đối chiếu mật khẩu thô với giá trị băm đã lưu.

    Input:
    - `plain_password`: mật khẩu người dùng vừa nhập khi đăng nhập.
    - `hashed_password`: mật khẩu đã băm lấy từ database.

    Output:
    - `True` nếu mật khẩu khớp, ngược lại là `False`.

    Cách hoạt động:
    - Không tự so sánh chuỗi thủ công.
    - Giao cho `passlib` kiểm tra đúng thuật toán và salt đã dùng khi hash.
    """

    return pwd_context.verify(plain_password, hashed_password)



def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    """Tạo JWT đã ký cho người dùng đã xác thực.

    Input:
    - `subject`: định danh user, trong project này là `user.id` dạng chuỗi.
    - `expires_delta`: thời lượng sống tùy chỉnh; nếu không truyền thì dùng cấu hình mặc định.

    Output:
    - Chuỗi JWT để frontend lưu và gửi kèm các request cần đăng nhập.

    Cách hoạt động:
    - Tạo payload gồm `sub` là user id và `exp` là thời điểm hết hạn.
    - Ký payload bằng `secret_key` để client không thể tự sửa nội dung token.
    """

    # `expire_at` là thời điểm token hết hạn; dùng UTC để tránh lệch múi giờ giữa server.
    expire_at = datetime.now(UTC) + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))

    # `sub` là claim chuẩn của JWT, thường dùng để lưu "chủ thể" của token.
    payload: dict[str, Any] = {"sub": subject, "exp": expire_at}

    # `jwt.encode` ký payload bằng secret key; kết quả là chuỗi token gửi về frontend.
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)



def decode_access_token(token: str) -> dict[str, Any]:
    """Giải mã và kiểm tra payload của JWT.

    Input:
    - `token`: chuỗi JWT frontend gửi lên trong header `Authorization: Bearer ...`.

    Output:
    - Dict payload đã được xác thực chữ ký và thời hạn.

    Cách hoạt động:
    - `jwt.decode` kiểm tra token có đúng secret key, đúng thuật toán và chưa hết hạn.
    - Sau khi giải mã, hàm bắt buộc payload phải có `sub` để biết user nào đang gọi API.
    """

    try:
        # Nếu token bị sửa, hết hạn hoặc ký sai secret key, thư viện sẽ ném `JWTError`.
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError as exc:
        raise TokenDecodeError("Token truy cập không hợp lệ hoặc đã hết hạn") from exc

    if "sub" not in payload:
        raise TokenDecodeError("Token thiếu định danh người dùng")

    return payload
