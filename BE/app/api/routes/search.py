"""Unified search suggestion endpoint."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.core.search import sanitize_search_query
from app.models.event import Event
from app.models.order import Ticket
from app.models.user import User
from app.models.venue import Venue
from app.schemas.search import SearchSuggestionItem

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/suggest", response_model=list[SearchSuggestionItem])
async def suggest(
    q: str = Query(min_length=1, max_length=120),
    scope: str = Query(default="global"),
    limit: int = Query(default=8, ge=1, le=20),
    session: AsyncSession = Depends(get_db_session),
) -> list[SearchSuggestionItem]:
    query = sanitize_search_query(q)
    if not query:
        return []
    pattern = f"%{query}%"
    items: list[SearchSuggestionItem] = []

    if scope in {"events", "global"}:
        rows = list(
            await session.scalars(
                select(Event)
                .where(Event.is_deleted.is_(False), or_(Event.title.ilike(pattern), Event.venue.ilike(pattern), Event.category.ilike(pattern)))
                .order_by(Event.start_at.asc())
                .limit(limit)
            )
        )
        items.extend(
            [
                SearchSuggestionItem(label=row.title, value=row.slug, item_type="event", meta={"venue": row.venue, "id": row.id})
                for row in rows
            ]
        )

    if scope in {"venues", "global"} and len(items) < limit:
        rows = list(await session.scalars(select(Venue).where(Venue.name.ilike(pattern)).order_by(Venue.name.asc()).limit(limit)))
        items.extend([SearchSuggestionItem(label=row.name, value=str(row.id), item_type="venue", meta={"city": row.city}) for row in rows])

    if scope in {"users", "global"} and len(items) < limit:
        rows = list(
            await session.scalars(select(User).where(or_(User.full_name.ilike(pattern), User.email.ilike(pattern))).order_by(User.created_at.desc()).limit(limit))
        )
        items.extend([SearchSuggestionItem(label=row.full_name, value=row.email, item_type="user", meta={"id": row.id}) for row in rows])

    if scope in {"tickets", "global"} and len(items) < limit:
        rows = list(await session.scalars(select(Ticket).where(Ticket.ticket_code.ilike(pattern)).order_by(Ticket.id.desc()).limit(limit)))
        items.extend([SearchSuggestionItem(label=row.ticket_code, value=row.ticket_code, item_type="ticket", meta={"id": row.id}) for row in rows])

    return items[:limit]
