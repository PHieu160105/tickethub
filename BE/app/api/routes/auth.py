"""Khai báo các route xác thực, hồ sơ cá nhân và đăng nhập mạng xã hội."""

from datetime import UTC, datetime, timedelta
import json
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.db import get_db_session
from app.core.google_auth import GoogleTokenError, verify_google_access_token
from app.core.security import create_access_token, hash_password, verify_password
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import AuthTokenResponse, GoogleTokenRequest, LoginRequest, RegisterRequest, UpdateProfileRequest, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()
DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"
DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize"
DISCORD_ME_URL = "https://discord.com/api/users/@me"


def _create_discord_state() -> str:
    """Sinh state chống giả mạo cho luồng OAuth Discord.

    Input:
    - Không nhận tham số; dùng secret key cấu hình của backend.

    Output:
    - Chuỗi JWT ngắn hạn dùng làm `state` gửi sang Discord.

    Cách hoạt động:
    - `purpose` giúp phân biệt token state với access token đăng nhập.
    - `exp` giới hạn state trong 10 phút để giảm rủi ro bị tái sử dụng.
    """

    payload = {
        "purpose": "discord_oauth",
        "exp": datetime.now(UTC) + timedelta(minutes=10),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def _verify_discord_state(state: str) -> None:
    """Xác thực state OAuth Discord trước khi đổi code lấy token.

    Input:
    - `state`: chuỗi frontend nhận lại từ Discord callback.

    Output:
    - Không trả dữ liệu nếu state hợp lệ; ném HTTP 400 nếu sai.

    Cách hoạt động:
    - Giải mã state bằng cùng secret key đã dùng khi tạo.
    - Kiểm tra `purpose` để tránh dùng nhầm token khác làm OAuth state.
    """

    try:
        payload = jwt.decode(state, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="State OAuth Discord không hợp lệ") from exc

    if payload.get("purpose") != "discord_oauth":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="State OAuth Discord không hợp lệ")


def _frontend_auth_redirect(access_token: str, user: UserResponse) -> RedirectResponse:
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
    url = f"{settings.frontend_app_url.rstrip('/')}/login?access_token={quote(access_token)}&user={encoded_user}"
    return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)


def _frontend_auth_error_redirect(message: str) -> RedirectResponse:
    """Chuyển hướng về frontend với thông điệp lỗi OAuth đã encode.

    Input:
    - `message`: nội dung lỗi thân thiện cho frontend hiển thị.

    Output:
    - HTTP 302 redirect về `/login?oauth_error=...`.

    Cách hoạt động:
    - Không trả lỗi JSON vì đây là callback trình duyệt từ Discord.
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

    token = create_access_token(str(user.id))
    return AuthTokenResponse(access_token=token, user=UserResponse.model_validate(user))


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

    token = create_access_token(str(user.id))
    return AuthTokenResponse(access_token=token, user=UserResponse.model_validate(user))


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

    jwt_token = create_access_token(str(user.id))
    return AuthTokenResponse(access_token=jwt_token, user=UserResponse.model_validate(user))


@router.get("/discord/login")
async def discord_login() -> RedirectResponse:
    """Bắt đầu luồng đăng nhập OAuth với Discord.

    Input:
    - Không nhận body; browser gọi trực tiếp route này.

    Output:
    - Redirect sang trang cấp quyền của Discord.

    Cách hoạt động:
    - Kiểm tra cấu hình OAuth.
    - Sinh `state` chống CSRF.
    - Ghép query OAuth chuẩn rồi trả HTTP 302.
    """

    if not settings.discord_client_id or not settings.discord_client_secret:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Chưa cấu hình OAuth Discord")

    state = _create_discord_state()
    params = {
        "client_id": settings.discord_client_id,
        "response_type": "code",
        "redirect_uri": settings.discord_redirect_uri,
        "scope": "identify email",
        "prompt": "consent",
        "state": state,
    }
    query = "&".join(f"{key}={quote(str(value), safe='')}" for key, value in params.items())
    return RedirectResponse(url=f"{DISCORD_AUTHORIZE_URL}?{query}", status_code=status.HTTP_302_FOUND)


@router.get("/discord/callback")
async def discord_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    """Xử lý callback OAuth Discord rồi chuyển người dùng về frontend với JWT nội bộ.

    Input:
    - `code`: mã ủy quyền Discord trả về sau khi user đồng ý.
    - `state`: token chống giả mạo đã sinh ở bước login.
    - `error`: lỗi Discord trả về nếu user từ chối hoặc flow thất bại.

    Output:
    - Redirect về frontend kèm JWT hoặc thông báo lỗi.

    Cách hoạt động:
    - Xác thực state trước để chống callback giả.
    - Đổi `code` lấy access token Discord.
    - Gọi Discord `/users/@me` lấy hồ sơ rồi map sang user TicketRush.
    """

    if error:
        return _frontend_auth_error_redirect(f"Đăng nhập Discord thất bại: {error}")
    if not code or not state:
        return _frontend_auth_error_redirect("Đăng nhập Discord thất bại: thiếu code hoặc state")

    try:
        _verify_discord_state(state)
    except HTTPException:
        return _frontend_auth_error_redirect("Đăng nhập Discord thất bại: state không hợp lệ")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            token_response = await client.post(
                DISCORD_TOKEN_URL,
                data={
                    "client_id": settings.discord_client_id,
                    "client_secret": settings.discord_client_secret,
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": settings.discord_redirect_uri,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            token_response.raise_for_status()
            token_payload = token_response.json()
            access_token = token_payload.get("access_token")
            if not access_token:
                return _frontend_auth_error_redirect("Đăng nhập Discord thất bại: thiếu access token")

            profile_response = await client.get(
                DISCORD_ME_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            profile_response.raise_for_status()
            profile = profile_response.json()
    except httpx.HTTPError:
        return _frontend_auth_error_redirect("Đăng nhập Discord thất bại khi kết nối tới Discord")

    discord_id = str(profile.get("id") or "").strip()
    email = str(profile.get("email") or "").strip().lower()
    display_name = str(profile.get("global_name") or profile.get("username") or email or "Discord User").strip()
    if not discord_id:
        return _frontend_auth_error_redirect("Đăng nhập Discord thất bại: thiếu id tài khoản")

    user = await session.scalar(select(User).where(User.discord_id == discord_id))
    if not user and email:
        user = await session.scalar(select(User).where(User.email == email))

    if not user:
        user = User(
            full_name=display_name,
            email=email or f"discord_{discord_id}@discord.local",
            password_hash="SOCIAL_LOGIN",
            discord_id=discord_id,
            role=UserRole.CUSTOMER,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
    else:
        updates = False
        if not user.discord_id:
            user.discord_id = discord_id
            updates = True
        if not user.full_name and display_name:
            user.full_name = display_name
            updates = True
        if updates:
            await session.commit()
            await session.refresh(user)

    jwt_token = create_access_token(str(user.id))
    return _frontend_auth_redirect(jwt_token, UserResponse.model_validate(user))


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
