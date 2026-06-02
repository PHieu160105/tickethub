"""Nghiep vu quan ly performer va lineup theo show."""

from collections import defaultdict

from fastapi import HTTPException, status
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.search import sanitize_search_query
from app.models.enums import PerformerRole
from app.models.event import Show
from app.models.performer import Performer, ShowPerformer
from app.schemas.performer import (
    AdminShowPerformerResponse,
    PerformerSuggestionResponse,
    PublicShowPerformerResponse,
    ShowPerformerUpsertRequest,
)


def normalize_stage_name(value: str) -> str:
    """Chuan hoa nghe danh de so trung khong phan biet hoa thuong/khoang trang."""

    return " ".join(value.strip().lower().split())


def _coerce_artist_type(value: str | None) -> str | None:
    """Lam sach artist type truoc khi luu."""

    cleaned = (value or "").strip()
    return cleaned or None


def _coerce_image_url(value: str | None) -> str | None:
    """Lam sach data URL anh truoc khi luu."""

    cleaned = (value or "").strip()
    return cleaned or None


def _public_response_from_model(link: ShowPerformer) -> PublicShowPerformerResponse:
    """Map ORM show performer sang response public."""

    return PublicShowPerformerResponse(
        performer_id=link.performer_id,
        stage_name=link.performer.stage_name,
        artist_type=link.performer.artist_type,
        image_url=link.performer.image_url,
        role=link.role,
        sort_order=link.sort_order,
    )


def _admin_response_from_model(link: ShowPerformer) -> AdminShowPerformerResponse:
    """Map ORM show performer sang response quan tri."""

    return AdminShowPerformerResponse(
        show_performer_id=link.id,
        show_id=link.show_id,
        performer_id=link.performer_id,
        stage_name=link.performer.stage_name,
        artist_type=link.performer.artist_type,
        image_url=link.performer.image_url,
        role=link.role,
        sort_order=link.sort_order,
    )


async def list_admin_show_performers(session: AsyncSession, show_id: int) -> list[AdminShowPerformerResponse]:
    """Lay day du lineup cua mot show cho popup admin."""

    role_order = case(
        (ShowPerformer.role == PerformerRole.MAIN, 0),
        (ShowPerformer.role == PerformerRole.GUEST, 1),
        else_=2,
    )

    rows = list(
        await session.scalars(
            select(ShowPerformer)
            .options(selectinload(ShowPerformer.performer))
            .where(ShowPerformer.show_id == show_id)
            .order_by(role_order.asc(), ShowPerformer.sort_order.asc(), ShowPerformer.id.asc())
        )
    )
    return [_admin_response_from_model(row) for row in rows]


async def list_visible_show_performers(session: AsyncSession, show_id: int) -> list[PublicShowPerformerResponse]:
    """Lay performer public cua mot show, an backup."""

    role_order = case(
        (ShowPerformer.role == PerformerRole.MAIN, 0),
        (ShowPerformer.role == PerformerRole.GUEST, 1),
        else_=2,
    )

    rows = list(
        await session.scalars(
            select(ShowPerformer)
            .options(selectinload(ShowPerformer.performer))
            .where(
                ShowPerformer.show_id == show_id,
                ShowPerformer.role.in_([PerformerRole.MAIN, PerformerRole.GUEST]),
            )
            .order_by(role_order.asc(), ShowPerformer.sort_order.asc(), ShowPerformer.id.asc())
        )
    )
    return [_public_response_from_model(row) for row in rows]


async def list_visible_show_performers_for_show_ids(
    session: AsyncSession,
    show_ids: list[int],
) -> dict[int, list[PublicShowPerformerResponse]]:
    """Batch load performer public cho nhieu show de tranh N+1 o event detail."""

    if not show_ids:
        return {}

    role_order = case(
        (ShowPerformer.role == PerformerRole.MAIN, 0),
        (ShowPerformer.role == PerformerRole.GUEST, 1),
        else_=2,
    )

    rows = list(
        await session.scalars(
            select(ShowPerformer)
            .options(selectinload(ShowPerformer.performer))
            .where(
                ShowPerformer.show_id.in_(show_ids),
                ShowPerformer.role.in_([PerformerRole.MAIN, PerformerRole.GUEST]),
            )
            .order_by(ShowPerformer.show_id.asc(), role_order.asc(), ShowPerformer.sort_order.asc(), ShowPerformer.id.asc())
        )
    )

    grouped: dict[int, list[PublicShowPerformerResponse]] = defaultdict(list)
    for row in rows:
        grouped[row.show_id].append(_public_response_from_model(row))
    return grouped


async def suggest_performers(
    session: AsyncSession,
    query: str,
    limit: int = 8,
) -> list[PerformerSuggestionResponse]:
    """Tra goi y performer cho autocomplete admin."""

    sanitized = sanitize_search_query(query)
    if not sanitized:
        return []

    pattern = f"%{sanitized}%"
    rows = list(
        await session.scalars(
            select(Performer)
            .where(Performer.stage_name.ilike(pattern))
            .order_by(Performer.stage_name.asc())
            .limit(max(limit * 3, limit))
        )
    )
    if not rows:
        return []

    performer_ids = [row.id for row in rows]
    usage_counts = {
        performer_id: show_count
        for performer_id, show_count in (
            await session.execute(
                select(ShowPerformer.performer_id, func.count(ShowPerformer.id))
                .where(ShowPerformer.performer_id.in_(performer_ids))
                .group_by(ShowPerformer.performer_id)
            )
        ).all()
    }

    normalized_query = normalize_stage_name(sanitized)

    def rank(row: Performer) -> tuple[int, str]:
        normalized_name = normalize_stage_name(row.stage_name)
        if normalized_name == normalized_query:
            return (0, normalized_name)
        if normalized_name.startswith(normalized_query):
            return (1, normalized_name)
        return (2, normalized_name)

    ranked = sorted(rows, key=rank)[:limit]
    return [
        PerformerSuggestionResponse(
            id=row.id,
            stage_name=row.stage_name,
            artist_type=row.artist_type,
            show_count=int(usage_counts.get(row.id, 0) or 0),
            has_image=bool(row.image_url),
        )
        for row in ranked
    ]


async def _resolve_performer(
    session: AsyncSession,
    item: ShowPerformerUpsertRequest,
) -> Performer:
    """Tim performer co san hoac tao moi theo stage_name."""

    stage_name = item.stage_name.strip()
    normalized = normalize_stage_name(stage_name)
    if not normalized:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nghe danh nghe si khong duoc de trong")

    performer: Performer | None = None
    if item.performer_id is not None:
        performer = await session.get(Performer, item.performer_id)
        if performer is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy performer được chọn")
    else:
        performer = await session.scalar(select(Performer).where(Performer.stage_name_normalized == normalized))

    if performer is None:
        performer = Performer(
            stage_name=stage_name,
            stage_name_normalized=normalized,
            artist_type=_coerce_artist_type(item.artist_type),
            image_url=_coerce_image_url(item.image_url),
        )
        session.add(performer)
        await session.flush()
        return performer

    performer.stage_name = stage_name
    performer.stage_name_normalized = normalized
    performer.artist_type = _coerce_artist_type(item.artist_type)
    performer.image_url = _coerce_image_url(item.image_url)
    await session.flush()
    return performer


async def update_show_performer_lineup(
    session: AsyncSession,
    show: Show,
    performers: list[ShowPerformerUpsertRequest],
) -> list[AdminShowPerformerResponse]:
    """Cap nhat snapshot lineup cua show voi rule main/guest/backup."""

    existing_rows = list(
        await session.scalars(
            select(ShowPerformer)
            .options(selectinload(ShowPerformer.performer))
            .where(ShowPerformer.show_id == show.id)
            .order_by(ShowPerformer.id.asc())
        )
    )
    existing_by_id = {row.id: row for row in existing_rows}
    if not performers:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Show phai co it nhat 1 performer main")

    role_counts = defaultdict(int)
    seen_performer_keys: set[str] = set()
    used_existing_ids: set[int] = set()

    for item in performers:
        role_counts[item.role.value] += 1
        performer_key = f"id:{item.performer_id}" if item.performer_id is not None else f"name:{normalize_stage_name(item.stage_name)}"
        if performer_key in seen_performer_keys:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không được gán trùng performer trong cùng show")
        seen_performer_keys.add(performer_key)

        if item.show_performer_id is not None:
            row = existing_by_id.get(item.show_performer_id)
            if row is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy performer của show để cập nhật")
            if item.show_performer_id in used_existing_ids:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payload performer chua ban ghi trung lap")
            used_existing_ids.add(item.show_performer_id)

    if role_counts[PerformerRole.MAIN.value] < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Show phai co it nhat 1 performer main")

    # Xoa cac association cu khong con xuat hien trong snapshot moi truoc khi insert row moi,
    # tranh vi pham unique (show_id, performer_id) khi user xoa card cu roi them lai cung performer.
    for row in existing_rows:
        if row.id in used_existing_ids:
            continue
        await session.delete(row)

    await session.flush()

    updated_ids: set[int] = set()
    for index, item in enumerate(performers):
        row = existing_by_id.get(item.show_performer_id) if item.show_performer_id is not None else None
        if row is not None and row.role == PerformerRole.MAIN:
            normalized_stage_name = normalize_stage_name(item.stage_name)
            if item.role != PerformerRole.MAIN:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không được đổi role của performer main")
            if item.performer_id is not None and item.performer_id != row.performer_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không được thay đổi performer main đã có của show")
            if normalized_stage_name != row.performer.stage_name_normalized:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không được thay đổi performer main đã có của show")

        performer = await _resolve_performer(session, item)
        if row is not None and row.role == PerformerRole.MAIN and performer.id != row.performer_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không được thay đổi performer main đã có của show")

        if row is None:
            row = ShowPerformer(
                show_id=show.id,
                performer_id=performer.id,
                role=item.role,
                sort_order=item.sort_order if item.sort_order else index,
            )
            session.add(row)
            await session.flush()
        else:
            row.performer_id = performer.id
            row.role = item.role
            row.sort_order = item.sort_order if item.sort_order else index

        updated_ids.add(row.id)

    await session.flush()
    return await list_admin_show_performers(session, show.id)
