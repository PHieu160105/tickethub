"""Database engine/session setup and dependency helpers."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    future=True,
    pool_pre_ping=True,
    pool_size=20,
    max_overflow=30,
    pool_timeout=15,
    pool_recycle=1800,
)
AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield one async SQLAlchemy session per request."""

    async with AsyncSessionLocal() as session:
        yield session
