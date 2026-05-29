"""Entry point for the FastAPI application."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api.router import api_router
from app.api.routes import ws
from app.core.cache import EVENT_DETAIL_CACHE_NAMESPACE, EVENT_LIST_CACHE_NAMESPACE, public_api_cache
from app.core.config import get_settings
from app.core.db import engine
from app.models import Base
from app.seed import seed_demo_data
from app.workers.tasks import worker_orchestrator

settings = get_settings()


async def _prepare_database() -> None:
    async with engine.begin() as conn:
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS ticket_rush"))
        await conn.run_sync(Base.metadata.create_all, checkfirst=True)


async def _invalidate_bootstrap_caches() -> None:
    await public_api_cache.invalidate_namespace(EVENT_LIST_CACHE_NAMESPACE)
    await public_api_cache.invalidate_namespace(EVENT_DETAIL_CACHE_NAMESPACE)
    await public_api_cache.invalidate_pattern("cache:shows:seats:*")


@asynccontextmanager
async def lifespan(_: FastAPI):
    await _prepare_database()

    from app.core.db import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        await seed_demo_data(session)

    await _invalidate_bootstrap_caches()
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
    allow_origin_regex=settings.allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(ws.router)


@app.exception_handler(ValueError)
async def value_error_handler(_: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"detail": str(exc)})


@app.exception_handler(Exception)
async def global_exception_handler(_: Request, __: Exception) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"detail": "Lỗi nội bộ máy chủ"})


@app.get("/health")
async def health() -> dict[str, str]:
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))
    return {"status": "ok", "db": "connected"}
