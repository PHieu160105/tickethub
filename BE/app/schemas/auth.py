"""Authentication and user schemas."""

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import Gender, UserRole


class RegisterRequest(BaseModel):
    """Payload for customer registration."""

    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    gender: Gender = Gender.OTHER
    age: int = Field(ge=10, le=100)


class LoginRequest(BaseModel):
    """Payload for login."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    """Public user profile data."""

    id: int
    full_name: str
    email: EmailStr
    role: UserRole
    gender: Gender
    age: int

    model_config = ConfigDict(from_attributes=True)


class AuthTokenResponse(BaseModel):
    """JWT auth response data."""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class UpdateProfileRequest(BaseModel):
    """Payload for user self-service profile update."""

    full_name: str = Field(min_length=2, max_length=120)
    gender: Gender = Gender.OTHER
    age: int = Field(ge=10, le=100)


class FirebaseTokenRequest(BaseModel):
    """Payload for Firebase ID token verification."""

    id_token: str
