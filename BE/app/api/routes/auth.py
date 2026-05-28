"""Khai báo các route xác thực, hồ sơ cá nhân và đăng nhập mạng xã hội."""

import json
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.db import get_db_session
from app.core.google_auth import GoogleTokenError, verify_google_access_token
from app.core.security import (
    TokenDecodeError,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import (
    AuthTokenResponse,
    GoogleTokenRequest,
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    UpdateProfileRequest,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _build_auth_response(user: User) -> AuthTokenResponse:
    """Tạo cặp access/refresh token cho một user đã xác thực."""

    user_id = str(user.id)
    return AuthTokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
        user=UserResponse.model_validate(user),
    )


def _frontend_auth_redirect(access_token: str, refresh_token: str, user: UserResponse) -> RedirectResponse:
    """Chuyển hướng về frontend kèm access token và hồ sơ người dùng đã encode.

    Input:
    - `access_token`: JWT nội bộ của TicketRush.
    - `user`: hồ sơ user đã chuẩn hóa bằng Pydantic schema.

    Output:
    - HTTP 302 redirect về trang login để frontend lưu token.

    Cách hoạt động:
    - Serialize user thành JSON gọn.
    - URL-encode token và user để truyền an toàn qua query string.
    """

    encoded_user = quote(json.dumps(user.model_dump(mode="json"), separators=(",", ":")))
    url = (
        f"{settings.frontend_app_url.rstrip('/')}/login"
        f"?access_token={quote(access_token)}"
        f"&refresh_token={quote(refresh_token)}"
        f"&user={encoded_user}"
    )
    return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)


def _frontend_auth_error_redirect(message: str) -> RedirectResponse:
    """Chuyển hướng về frontend với thông điệp lỗi OAuth đã encode.

    Input:
    - `message`: nội dung lỗi thân thiện cho frontend hiển thị.

    Output:
    - HTTP 302 redirect về `/login?oauth_error=...`.

    Cách hoạt động:
    - Không trả lỗi JSON vì đây là callback trình duyệt từ nhà cung cấp OAuth.
    - Encode message để tránh query string bị vỡ bởi khoảng trắng/ký tự đặc biệt.
    """

    url = f"{settings.frontend_app_url.rstrip('/')}/login?oauth_error={quote(message)}"
    return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)


@router.post("/register", response_model=AuthTokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, session: AsyncSession = Depends(get_db_session)) -> AuthTokenResponse:
    """Đăng ký tài khoản khách hàng mới và trả về JWT.

    Input:
    - Họ tên, email, mật khẩu và thông tin hồ sơ cơ bản.

    Output:
    - JWT truy cập và hồ sơ người dùng vừa tạo.

    Cách hoạt động:
    - Kiểm tra email trùng.
    - Băm mật khẩu.
    - Tạo user với role `customer`.
    """

    existing = await session.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email đã tồn tại")

    user = User(
        full_name=payload.full_name,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role=UserRole.CUSTOMER,
        gender=payload.gender,
        age=payload.age,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    return _build_auth_response(user)


@router.post("/login", response_model=AuthTokenResponse)
async def login(payload: LoginRequest, session: AsyncSession = Depends(get_db_session)) -> AuthTokenResponse:
    """Đăng nhập bằng email và mật khẩu rồi trả JWT truy cập.

    Input:
    - `payload.email`: email người dùng nhập.
    - `payload.password`: mật khẩu chữ rõ lấy từ form đăng nhập.

    Output:
    - JWT truy cập và hồ sơ user nếu thông tin chính xác.

    Cách hoạt động:
    - Tìm user theo email đã chuyển về chữ thường.
    - So sánh mật khẩu bằng hàm hash, không so sánh chữ rõ.
    - Tạo access token chứa `user.id` trong claim `sub`.
    """

    user = await session.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email hoặc mật khẩu không đúng")

    return _build_auth_response(user)


@router.post("/google-token", response_model=AuthTokenResponse)
async def google_auth(payload: GoogleTokenRequest, session: AsyncSession = Depends(get_db_session)) -> AuthTokenResponse:
    """Xác thực Google access token và đổi sang JWT nội bộ của TicketRush.

    Input:
    - `payload.access_token`: Google access token do frontend nhận sau đăng nhập Google.

    Output:
    - JWT nội bộ TicketRush và hồ sơ user.

    Cách hoạt động:
    - Gọi Google userinfo để xác minh token thật/giả.
    - Tìm user theo `google_id`, nếu chưa có thì fallback theo email.
    - Tự tạo user customer khi đây là lần social login đầu tiên.
    """
    try:
        profile = await verify_google_access_token(payload.access_token)
    except GoogleTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google token không hợp lệ")

    google_id = str(profile.get("sub") or "").strip()
    email = str(profile.get("email") or "").strip().lower()
    name = str(profile.get("name") or email or "Google User").strip()
    email_verified = profile.get("email_verified")

    if not google_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google token thiếu sub")
    if email and email_verified is False:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email Google chưa được xác minh")

    user = await session.scalar(select(User).where(User.google_id == google_id))

    if not user and email:
        user = await session.scalar(select(User).where(User.email == email))

    if not user:
        user = User(
            full_name=name or email or "Google User",
            email=email or f"google_{google_id}@google.local",
            password_hash="SOCIAL_LOGIN",
            google_id=google_id,
            role=UserRole.CUSTOMER,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
    elif not user.google_id:
        user.google_id = google_id
        await session.commit()
        await session.refresh(user)

    return _build_auth_response(user)


@router.get("/zalo/login")
async def zalo_login() -> RedirectResponse:
    """Temporary Zalo OAuth entrypoint kept for the public auth surface.

    The actual Zalo OAuth handshake is not wired in this refactor phase yet.
    """

    if not settings.zalo_client_id or not settings.zalo_client_secret:
        return _frontend_auth_error_redirect("Dang nhap Zalo chua duoc cau hinh")

    return _frontend_auth_error_redirect("Dang nhap Zalo se duoc bo sung o phase tiep theo")


@router.get("/zalo/callback")
async def zalo_callback() -> RedirectResponse:
    """Temporary Zalo OAuth callback placeholder."""

    return _frontend_auth_error_redirect("Dang nhap Zalo chua san sang tren backend")


@router.post("/refresh", response_model=AuthTokenResponse)
async def refresh_token(payload: RefreshTokenRequest, session: AsyncSession = Depends(get_db_session)) -> AuthTokenResponse:
    """Đổi refresh token hợp lệ lấy cặp access/refresh token mới."""

    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Refresh token không hợp lệ hoặc đã hết hạn",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        token_payload = decode_refresh_token(payload.refresh_token)
    except TokenDecodeError as exc:
        raise credentials_exc from exc

    user_id = int(token_payload["sub"])
    user = await session.scalar(select(User).where(User.id == user_id))
    if not user:
        raise credentials_exc

    return _build_auth_response(user)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    """Trả về hồ sơ của người dùng đang đăng nhập."""

    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    payload: UpdateProfileRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Cho phép người dùng đã đăng nhập cập nhật thông tin hồ sơ cá nhân."""

    current_user.full_name = payload.full_name
    current_user.gender = payload.gender
    current_user.age = payload.age

    await session.commit()
    await session.refresh(current_user)
    return UserResponse.model_validate(current_user)
