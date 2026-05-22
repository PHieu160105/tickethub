"""Schema xác thực và hồ sơ người dùng."""

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import Gender, UserRole


class RegisterRequest(BaseModel):
    """Payload đăng ký tài khoản khách hàng."""

    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    gender: Gender = Gender.OTHER
    age: int = Field(ge=10, le=100)


class LoginRequest(BaseModel):
    """Payload đăng nhập bằng email và mật khẩu."""

    email: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    """Dữ liệu hồ sơ người dùng trả về frontend."""

    id: int
    full_name: str
    email: EmailStr
    role: UserRole
    gender: Gender
    age: int

    model_config = ConfigDict(from_attributes=True)


class AuthTokenResponse(BaseModel):
    """Dữ liệu phản hồi xác thực gồm JWT và hồ sơ người dùng."""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class UpdateProfileRequest(BaseModel):
    """Payload người dùng tự cập nhật hồ sơ cá nhân."""

    full_name: str = Field(min_length=2, max_length=120)
    gender: Gender = Gender.OTHER
    age: int = Field(ge=10, le=100)


class GoogleTokenRequest(BaseModel):
    """Payload xác minh Google access token."""

    access_token: str
