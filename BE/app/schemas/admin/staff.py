from pydantic import BaseModel, EmailStr, Field

from app.models.enums import Gender


class EventStaffCreateRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    staff_code: str = Field(min_length=2, max_length=50)
    gender: Gender = Gender.OTHER
    age: int = Field(default=18, ge=18, le=100)


class EventStaffStatusRequest(BaseModel):
    is_active: bool


class EventStaffResponse(BaseModel):
    user_id: int
    full_name: str
    email: EmailStr
    staff_code: str
    is_active: bool
    created_at: str
