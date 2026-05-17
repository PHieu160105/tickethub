"""Endpoint gợi ý tìm kiếm hợp nhất cho sự kiện, địa điểm, user và vé.

Ghi chú:
- File này là route HTTP; phần làm sạch từ khóa nằm trong `app/core/search.py`.
- Kết quả dùng cho ô autocomplete, nên cần nhanh, ít dữ liệu và cùng một schema.
"""

# FastAPI import: khai báo router, dependency và query parameter.
from fastapi import APIRouter, Depends, Query

# SQLAlchemy import: `select` dựng câu SQL, `or_` ghép điều kiện OR.
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

# Các import dưới đây là code tự viết trong project.
from app.core.db import get_db_session
from app.core.search import sanitize_search_query
from app.models.event import Event
from app.models.order import Ticket
from app.models.user import User
from app.models.venue import Venue
from app.schemas.search import SearchSuggestionItem

# URL cuối cùng là `/api/search/suggest`.
router = APIRouter(prefix="/search", tags=["search"])


@router.get("/suggest", response_model=list[SearchSuggestionItem])
async def suggest(
    q: str = Query(min_length=1, max_length=120),
    scope: str = Query(default="global"),
    limit: int = Query(default=8, ge=1, le=20),
    session: AsyncSession = Depends(get_db_session),
) -> list[SearchSuggestionItem]:
    """Trả danh sách gợi ý tìm kiếm theo phạm vi được chọn.

    Input:
    - `q`: từ khóa người dùng nhập trên ô search/autocomplete.
    - `scope`: nhóm dữ liệu cần tìm, ví dụ `events`, `venues`, `users`, `tickets` hoặc `global`.
    - `limit`: số lượng gợi ý tối đa trả về.

    Output:
    - Danh sách item đồng nhất gồm nhãn hiển thị, giá trị điều hướng, loại item và metadata.

    Cách hoạt động:
    - Chuẩn hóa từ khóa trước khi query.
    - Tìm lần lượt theo từng nhóm, chỉ tìm nhóm tiếp theo nếu danh sách chưa đủ `limit`.
    - Cắt kết quả cuối cùng về đúng `limit` để frontend không phải tự xử lý dư dữ liệu.
    """

    # Làm sạch từ khóa để loại khoảng trắng thừa và chặn chuỗi quá dài.
    query = sanitize_search_query(q)
    if not query:
        return []

    # Route này đang dùng pattern đơn giản để giữ tương thích contract hiện tại của autocomplete.
    pattern = f"%{query}%"
    # `items` là danh sách response tích lũy từ nhiều bảng khác nhau.
    items: list[SearchSuggestionItem] = []

    if scope in {"events", "global"}:
        # Gợi ý sự kiện public: bỏ event đã soft-delete, tìm theo tiêu đề/địa điểm/danh mục.
        rows = list(
            await session.scalars(
                select(Event)
                .where(Event.is_deleted.is_(False), or_(Event.title.ilike(pattern), Event.venue.ilike(pattern), Event.category.ilike(pattern)))
                .order_by(Event.start_date.asc(), Event.id.asc())
                .limit(limit)
            )
        )
        # Map từng Event ORM sang schema gợi ý thống nhất cho frontend.
        items.extend(
            [
                SearchSuggestionItem(label=row.title, value=row.slug, item_type="event", meta={"venue": row.venue, "id": row.id})
                for row in rows
            ]
        )

    if scope in {"venues", "global"} and len(items) < limit:
        # Chỉ query venue khi kết quả hiện tại chưa đủ limit để giảm tải database.
        rows = list(await session.scalars(select(Venue).where(Venue.name.ilike(pattern)).order_by(Venue.name.asc()).limit(limit)))
        items.extend([SearchSuggestionItem(label=row.name, value=str(row.id), item_type="venue", meta={"city": row.city}) for row in rows])

    if scope in {"users", "global"} and len(items) < limit:
        # User search phục vụ admin/global command palette, tìm theo họ tên hoặc email.
        rows = list(
            await session.scalars(select(User).where(or_(User.full_name.ilike(pattern), User.email.ilike(pattern))).order_by(User.created_at.desc()).limit(limit))
        )
        items.extend([SearchSuggestionItem(label=row.full_name, value=row.email, item_type="user", meta={"id": row.id}) for row in rows])

    if scope in {"tickets", "global"} and len(items) < limit:
        # Ticket search phục vụ đối soát mã vé.
        rows = list(await session.scalars(select(Ticket).where(Ticket.ticket_code.ilike(pattern)).order_by(Ticket.id.desc()).limit(limit)))
        items.extend([SearchSuggestionItem(label=row.ticket_code, value=row.ticket_code, item_type="ticket", meta={"id": row.id}) for row in rows])

    # Bảo vệ lần cuối để response không vượt limit dù nhiều scope cùng trả dữ liệu.
    return items[:limit]
