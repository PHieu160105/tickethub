"""TicketRush FastAPI application entrypoint."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api.router import api_router
from app.api.routes import ws
from app.core.config import get_settings
from app.core.db import engine
from app.models import Base
from app.seed import seed_demo_data
from app.workers.tasks import worker_orchestrator

settings = get_settings()


async def _ensure_cover_image_url_text_column() -> None:
    """Migrate events.cover_image_url to TEXT for large data URLs."""

    async with engine.begin() as conn:
        column_type = await conn.scalar(
            text(
                """
                SELECT data_type
                FROM information_schema.columns
                WHERE table_schema = 'ticket_rush'
                  AND table_name = 'events'
                  AND column_name = 'cover_image_url'
                """
            )
        )

        if column_type and column_type.lower() != "text":
            await conn.execute(
                text(
                    """
                    ALTER TABLE ticket_rush.events
                    ALTER COLUMN cover_image_url TYPE TEXT
                    """
                )
            )


async def _ensure_seats_admin_lock_column() -> None:
    """Add seats.is_admin_locked for older databases without a migration run."""

    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS ticket_rush.seats
                ADD COLUMN IF NOT EXISTS is_admin_locked BOOLEAN NOT NULL DEFAULT FALSE
                """
            )
        )


async def _ensure_template_seat_columns_are_nullable() -> None:
    """Allow venue template seats to exist without binding to one event."""

    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS ticket_rush.seats
                ALTER COLUMN event_id DROP NOT NULL
                """
            )
        )
        await conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS ticket_rush.seats
                ALTER COLUMN zone_id DROP NOT NULL
                """
            )
        )


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Initialize schema/seed data and start background workers."""

    async with engine.begin() as conn:
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS ticket_rush"))
        await conn.execute(text("ALTER TABLE IF EXISTS ticket_rush.events ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE"))

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all, checkfirst=True)
    await _ensure_cover_image_url_text_column()
    await _ensure_seats_admin_lock_column()
    await _ensure_template_seat_columns_are_nullable()

    from app.core.db import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        await seed_demo_data(session)

    await worker_orchestrator.start()

    yield

    await worker_orchestrator.stop()
    await engine.dispose()


app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)

static_root = Path(__file__).resolve().parent / "static"
static_root.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_root), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(ws.router)


@app.exception_handler(ValueError)
async def value_error_handler(_: Request, exc: ValueError) -> JSONResponse:
    """Return consistent validation-style payload for ValueError exceptions."""

    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"detail": str(exc)})


@app.exception_handler(Exception)
async def global_exception_handler(_: Request, __: Exception) -> JSONResponse:
    """Return sanitized fallback payload for unexpected runtime errors."""

    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"detail": "Internal server error"})


@app.get("/health")
async def health() -> dict[str, str]:
    """Liveness probe endpoint with DB connectivity check."""

    from sqlalchemy import text

    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))

    return {"status": "ok", "db": "connected"}
