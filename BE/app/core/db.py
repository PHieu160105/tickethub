"""Khởi tạo engine cơ sở dữ liệu, session async và dependency cấp request."""

from collections.abc import AsyncGenerator
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

settings = get_settings()

from sqlalchemy.pool import NullPool

engine = create_async_engine(
    settings.database_url,
    future=True,
    poolclass=NullPool,
    connect_args={
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
        # Mỗi prepared statement được đặt tên động để an toàn khi chạy qua PgBouncer.
        "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
    },
)
AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Cấp một `AsyncSession` cho mỗi request backend.

    Input:
    - Không nhận tham số trực tiếp, được FastAPI inject như dependency.

    Output:
    - Một phiên SQLAlchemy async sống trong phạm vi request hiện tại.

    Cách hoạt động:
    - Mỗi request mở một session riêng.
    - Session tự đóng khi request kết thúc để tránh rò rỉ kết nối.
    """

    async with AsyncSessionLocal() as session:
        yield session
