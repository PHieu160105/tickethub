"""TicketRush FastAPI application entrypoint."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router, ws_router
from app.core.config import get_settings
from app.core.db import engine
from app.models import Base
from app.seed import seed_demo_data
from app.workers.tasks import worker_orchestrator

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Initialize schema/seed data and start background workers."""

    from sqlalchemy import text
    async with engine.begin() as conn:
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS ticket_rush"))
        await conn.run_sync(Base.metadata.create_all)

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
app.include_router(ws_router)


@app.get("/health")
async def health() -> dict[str, str]:
    """Liveness probe endpoint."""

    return {"status": "ok"}
