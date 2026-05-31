"""Auth and profile schemas."""

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import Gender, UserType


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    gender: Gender = Gender.OTHER
    age: int = Field(ge=10, le=100)


class LoginRequest(BaseModel):
    email: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    user_type: UserType
    gender: Gender
    age: int

    model_config = ConfigDict(from_attributes=True)


class AuthTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class UpdateProfileRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    gender: Gender = Gender.OTHER
    age: int = Field(ge=10, le=100)


class GoogleTokenRequest(BaseModel):
    access_token: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(min_length=1)
