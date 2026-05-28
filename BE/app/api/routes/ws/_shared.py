from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.core.security import TokenDecodeError, decode_access_token
from app.models.user import User


async def resolve_ws_user(token: str) -> User | None:
    try:
        payload = decode_access_token(token)
    except TokenDecodeError:
        return None

    user_id = int(payload["sub"])
    async with AsyncSessionLocal() as session:
        return await session.scalar(select(User).where(User.id == user_id))
