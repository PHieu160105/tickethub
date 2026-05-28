"""Điểm vào chính để khởi tạo ứng dụng FastAPI của TicketRush."""

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


async def _ensure_cover_image_url_text_column() -> None:
    """Đảm bảo cột `events.cover_image_url` dùng kiểu `TEXT` cho ảnh base64 hoặc URL dài."""

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
    """Đảm bảo bảng ghế có cột `is_admin_locked` cho các cơ sở dữ liệu cũ."""

    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                WITH ranked AS (
                    SELECT id,
                           ROW_NUMBER() OVER (
                               PARTITION BY show_id, user_id
                               ORDER BY created_at DESC, id DESC
                           ) AS rn
                    FROM ticket_rush.queue_entries
                    WHERE status IN ('waiting', 'admitted', 'WAITING', 'ADMITTED')
                      AND show_id IS NOT NULL
                )
                UPDATE ticket_rush.queue_entries q
                SET status = 'expired'
                FROM ranked r
                WHERE q.id = r.id
                  AND r.rn > 1
                """
            )
        )
        await conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS ticket_rush.seats
                ADD COLUMN IF NOT EXISTS is_admin_locked BOOLEAN NOT NULL DEFAULT FALSE
                """
            )
        )


async def _ensure_template_seat_columns_are_nullable() -> None:
    """Cho phép ghế template của venue tồn tại mà chưa cần gắn ngay vào event/show cụ thể."""

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


async def _ensure_user_auth_columns() -> None:
    """Bổ sung các cột social login hiện còn dùng cho bảng người dùng."""

    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS ticket_rush.users
                ADD COLUMN IF NOT EXISTS google_id VARCHAR(255),
                ADD COLUMN IF NOT EXISTS zalo_id VARCHAR(255)
                """
            )
        )
        await conn.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_id
                ON ticket_rush.users (google_id)
                WHERE google_id IS NOT NULL
                """
            )
        )
        await conn.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS ix_users_zalo_id
                ON ticket_rush.users (zalo_id)
                WHERE zalo_id IS NOT NULL
                """
            )
        )


async def _ensure_queue_admission_indexes() -> None:
    """Bổ sung index phục vụ Waiting Room cho các DB cũ."""

    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_queue_entries_active_user_show
                ON ticket_rush.queue_entries (show_id, user_id)
                WHERE status IN ('waiting', 'admitted', 'WAITING', 'ADMITTED')
                  AND show_id IS NOT NULL
                """
            )
        )
        await conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS ix_queue_entries_show_status_created
                ON ticket_rush.queue_entries (show_id, status, created_at)
                """
            )
        )
        await conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS ix_queue_entries_show_user_token
                ON ticket_rush.queue_entries (show_id, user_id, token)
                """
            )
        )


async def _ensure_show_refactor_schema() -> None:
    """Backfill cấu trúc dữ liệu kiểu show-based cho các DB cũ chưa migrate thủ công."""

    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS ticket_rush.events
                ADD COLUMN IF NOT EXISTS start_date DATE,
                ADD COLUMN IF NOT EXISTS end_date DATE
                """
            )
        )
        await conn.execute(
            text(
                """
                UPDATE ticket_rush.events
                SET start_date = COALESCE(start_date, DATE(start_at), CURRENT_DATE),
                    end_date = COALESCE(end_date, DATE(end_at), DATE(start_at), CURRENT_DATE)
                WHERE start_date IS NULL OR end_date IS NULL
                """
            )
        )

        await conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS ticket_rush.seat_zones
                ADD COLUMN IF NOT EXISTS show_id INTEGER
                """
            )
        )
        await conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS ticket_rush.seats
                ADD COLUMN IF NOT EXISTS show_id INTEGER
                """
            )
        )
        await conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS ticket_rush.orders
                ADD COLUMN IF NOT EXISTS show_id INTEGER
                """
            )
        )
        await conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS ticket_rush.queue_entries
                ADD COLUMN IF NOT EXISTS show_id INTEGER
                """
            )
        )
        await conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS ticket_rush.ticket_cancellations
                ADD COLUMN IF NOT EXISTS show_id INTEGER
                """
            )
        )

        await conn.execute(
            text(
                """
                INSERT INTO ticket_rush.shows (
                    event_id, title, description, venue, start_at, end_at, status,
                    hold_minutes, queue_enabled, queue_release_batch, max_active_queue_tokens,
                    created_by_user_id, venue_id, venue_layout_id, is_deleted, created_at, updated_at
                )
                SELECT
                    e.id,
                    e.title,
                    e.description,
                    COALESCE(e.venue, ''),
                    COALESCE(e.start_at, timezone('utc', now())),
                    COALESCE(e.end_at, COALESCE(e.start_at, timezone('utc', now())) + interval '2 hours'),
                    e.status,
                    COALESCE(e.hold_minutes, 10),
                    COALESCE(e.queue_enabled, TRUE),
                    COALESCE(e.queue_release_batch, 50),
                    COALESCE(e.max_active_queue_tokens, 200),
                    e.created_by_user_id,
                    e.venue_id,
                    e.venue_layout_id,
                    COALESCE(e.is_deleted, FALSE),
                    COALESCE(e.created_at, timezone('utc', now())),
                    COALESCE(e.updated_at, timezone('utc', now()))
                FROM ticket_rush.events e
                WHERE NOT EXISTS (
                    SELECT 1 FROM ticket_rush.shows s WHERE s.event_id = e.id
                )
                """
            )
        )

        await conn.execute(
            text(
                """
                UPDATE ticket_rush.seat_zones z
                SET show_id = s.id
                FROM (
                    SELECT DISTINCT ON (event_id) id, event_id
                    FROM ticket_rush.shows
                    ORDER BY event_id, id ASC
                ) s
                WHERE z.show_id IS NULL
                  AND z.event_id IS NOT NULL
                  AND s.event_id = z.event_id
                """
            )
        )
        await conn.execute(
            text(
                """
                UPDATE ticket_rush.seats seat
                SET show_id = s.id
                FROM (
                    SELECT DISTINCT ON (event_id) id, event_id
                    FROM ticket_rush.shows
                    ORDER BY event_id, id ASC
                ) s
                WHERE seat.show_id IS NULL
                  AND seat.event_id IS NOT NULL
                  AND s.event_id = seat.event_id
                """
            )
        )
        await conn.execute(
            text(
                """
                UPDATE ticket_rush.orders o
                SET show_id = s.id
                FROM (
                    SELECT DISTINCT ON (event_id) id, event_id
                    FROM ticket_rush.shows
                    ORDER BY event_id, id ASC
                ) s
                WHERE o.show_id IS NULL
                  AND s.event_id = o.event_id
                """
            )
        )
        await conn.execute(
            text(
                """
                UPDATE ticket_rush.queue_entries q
                SET show_id = s.id
                FROM (
                    SELECT DISTINCT ON (event_id) id, event_id
                    FROM ticket_rush.shows
                    ORDER BY event_id, id ASC
                ) s
                WHERE q.show_id IS NULL
                  AND s.event_id = q.event_id
                """
            )
        )
        await conn.execute(
            text(
                """
                UPDATE ticket_rush.ticket_cancellations tc
                SET show_id = s.id
                FROM (
                    SELECT DISTINCT ON (event_id) id, event_id
                    FROM ticket_rush.shows
                    ORDER BY event_id, id ASC
                ) s
                WHERE tc.show_id IS NULL
                  AND tc.event_id IS NOT NULL
                  AND s.event_id = tc.event_id
                """
            )
        )
        await conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS ticket_rush.seats
                DROP CONSTRAINT IF EXISTS uq_seats_event_id_seat_label
                """
            )
        )
        await conn.execute(
            text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint
                        WHERE conname = 'uq_seats_show_id_seat_label'
                    ) THEN
                        ALTER TABLE ticket_rush.seats
                        ADD CONSTRAINT uq_seats_show_id_seat_label UNIQUE (show_id, seat_label);
                    END IF;
                END $$;
                """
            )
        )


async def _invalidate_bootstrap_caches() -> None:
    """Xóa các cache public dễ bị stale sau khi local DB hoặc seed thay đổi.

    Input:
    - Không nhận tham số; hàm dùng trực tiếp cache store toàn cục của ứng dụng.

    Output:
    - Không trả dữ liệu. Mục tiêu là đảm bảo request đầu tiên sau startup luôn đọc
      đúng dữ liệu mới nhất từ database.

    Cách hoạt động:
    - Xóa namespace danh sách và chi tiết sự kiện.
    - Xóa toàn bộ cache sơ đồ ghế của các show vì những key này phụ thuộc mạnh
      vào seed, migration và trạng thái ghế tại thời điểm chạy local.
    """

    await public_api_cache.invalidate_namespace(EVENT_LIST_CACHE_NAMESPACE)
    await public_api_cache.invalidate_namespace(EVENT_DETAIL_CACHE_NAMESPACE)
    await public_api_cache.invalidate_pattern("cache:shows:seats:*")


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Khởi tạo schema, seed dữ liệu và bật worker nền trong vòng đời ứng dụng.

    Input:
    - FastAPI truyền context lifespan nội bộ, hiện không cần dùng trực tiếp.

    Output:
    - Ứng dụng ở trạng thái sẵn sàng nhận request sau khi hoàn tất bootstrap.

    Cách hoạt động:
    - Tạo schema nếu thiếu.
    - Đồng bộ metadata ORM.
    - Chạy các bước tương thích ngược cho DB cũ.
    - Seed dữ liệu demo.
    - Khởi động worker nền.
    """

    async with engine.begin() as conn:
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS ticket_rush"))
        await conn.execute(text("ALTER TABLE IF EXISTS ticket_rush.events ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE"))

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all, checkfirst=True)
    await _ensure_cover_image_url_text_column()
    await _ensure_seats_admin_lock_column()
    await _ensure_template_seat_columns_are_nullable()
    await _ensure_user_auth_columns()
    await _ensure_show_refactor_schema()
    await _ensure_queue_admission_indexes()

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
    """Chuẩn hóa lỗi `ValueError` về payload thống nhất kiểu validation."""

    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"detail": str(exc)})


@app.exception_handler(Exception)
async def global_exception_handler(_: Request, __: Exception) -> JSONResponse:
    """Trả payload an toàn cho các lỗi runtime không mong muốn."""

    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"detail": "Lỗi nội bộ máy chủ"})


@app.get("/health")
async def health() -> dict[str, str]:
    """Endpoint kiểm tra ứng dụng còn sống và còn kết nối được tới cơ sở dữ liệu."""

    from sqlalchemy import text

    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))

    return {"status": "ok", "db": "connected"}
