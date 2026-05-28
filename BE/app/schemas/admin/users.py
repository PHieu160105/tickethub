from pydantic import BaseModel


class AdminUserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    gender: str
    age: int
    total_tickets: int
    registered_at: str


class PaginatedAdminUsersResponse(BaseModel):
    items: list[AdminUserResponse]
    total: int
    limit: int
    offset: int
