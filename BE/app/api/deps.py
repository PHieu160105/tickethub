"""Các dependency dùng lại cho xác thực và phân quyền API.

Ghi chú:
- FastAPI dependency là hàm được tự động chạy trước route chính.
- File này gom logic lấy user từ JWT và chặn quyền admin/customer ở một nơi duy nhất.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.core.security import TokenDecodeError, decode_access_token
from app.models.enums import UserRole
from app.models.user import User

# Dependency bắt buộc token; route dùng biến này sẽ trả 401 nếu thiếu `Authorization`.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Dependency token tùy chọn; route public vẫn chạy được khi guest chưa đăng nhập.
oauth2_optional_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def get_current_user(
    session: AsyncSession = Depends(get_db_session),
    token: str = Depends(oauth2_scheme),
) -> User:
    """Lấy user hiện tại từ Bearer token bắt buộc.

    Input:
    - `session`: phiên database do FastAPI inject.
    - `token`: JWT lấy từ header `Authorization`.

    Output:
    - Bản ghi `User` tương ứng với `sub` trong JWT.

    Cách hoạt động:
    - Giải mã token bằng `decode_access_token`.
    - Lấy `user.id` từ claim `sub`.
    - Query database để đảm bảo user vẫn tồn tại.
    """

    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Thông tin đăng nhập không hợp lệ hoặc đã hết hạn",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # Token hợp lệ sẽ trả payload; token sai/hết hạn sẽ bị chuyển thành HTTP 401.
        payload = decode_access_token(token)
    except TokenDecodeError as exc:
        raise credentials_exc from exc

    # `sub` được tạo từ `user.id` khi login/register, vì vậy có thể ép về int để query.
    user_id = int(payload["sub"])
    user = await session.scalar(select(User).where(User.id == user_id))
    if not user:
        raise credentials_exc

    return user


async def get_current_active_admin(current_user: User = Depends(get_current_user)) -> User:
    """Chỉ cho phép tài khoản admin truy cập route quản trị.

    Input:
    - `current_user`: user đã xác thực từ `get_current_user`.

    Output:
    - Chính user đó nếu role là `ADMIN`.

    Cách hoạt động:
    - FastAPI chạy `get_current_user` trước.
    - Hàm này kiểm tra role và trả 403 nếu không phải admin.
    """

    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chỉ tài khoản quản trị mới được truy cập")
    return current_user


async def get_current_customer(current_user: User = Depends(get_current_user)) -> User:
    """Chỉ cho phép khách hàng thực hiện các thao tác đặt vé.

    Input:
    - `current_user`: user đã xác thực từ `get_current_user`.

    Output:
    - Chính user đó nếu role là `CUSTOMER`.

    Cách hoạt động:
    - Dùng chung cơ chế JWT với admin.
    - Chặn tài khoản admin vô tình gọi các API dành riêng cho customer.
    """

    if current_user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chỉ tài khoản khách hàng mới được thực hiện thao tác này")
    return current_user


async def get_optional_current_user(
    session: AsyncSession = Depends(get_db_session),
    token: str | None = Depends(oauth2_optional_scheme),
) -> User | None:
    """Lấy user hiện tại nếu request có token, còn guest thì trả `None`.

    Input:
    - `session`: phiên database.
    - `token`: JWT tùy chọn; có thể không tồn tại trên request public.

    Output:
    - `User` nếu token hợp lệ, hoặc `None` nếu guest/ token lỗi.

    Cách hoạt động:
    - Route public như xem seat map gọi dependency này để hỗ trợ cả guest và user.
    - Token lỗi không làm route public fail, vì mục tiêu là "có thì nhận diện, không có thì xem như guest".
    """

    if not token:
        return None

    try:
        # Route public không nên trả 401 chỉ vì localStorage còn token cũ đã hết hạn.
        payload = decode_access_token(token)
    except TokenDecodeError:
        return None

    user_id = int(payload["sub"])
    return await session.scalar(select(User).where(User.id == user_id))
