from base64 import b64encode
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_admin
from app.core.db import get_db_session
from app.models.performer import Performer
from app.models.user import User
from app.schemas.admin import UploadImageResponse
from app.schemas.performer import (
    AdminShowPerformerResponse,
    PerformerDetailResponse,
    PerformerSuggestionResponse,
    ShowPerformerBulkUpdateRequest,
)
from app.services.event_query_service import get_show_by_id
from app.services.performer_service import (
    list_admin_show_performers,
    suggest_performers,
    update_show_performer_lineup,
)

from ._shared import _invalidate_show_cache

router = APIRouter()


@router.get("/shows/{show_id}/performers", response_model=list[AdminShowPerformerResponse])
async def get_admin_show_performers(
    show_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> list[AdminShowPerformerResponse]:
    await get_show_by_id(session, show_id)
    return await list_admin_show_performers(session, show_id)


@router.put("/shows/{show_id}/performers", response_model=list[AdminShowPerformerResponse])
async def save_admin_show_performers(
    show_id: int,
    payload: ShowPerformerBulkUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> list[AdminShowPerformerResponse]:
    show = await get_show_by_id(session, show_id)
    rows = await update_show_performer_lineup(session, show, payload.performers)
    try:
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    await _invalidate_show_cache(show.id)
    return rows


@router.get("/performers/suggest", response_model=list[PerformerSuggestionResponse])
async def suggest_admin_performers(
    q: str = Query(..., min_length=1, max_length=255),
    limit: int = Query(default=8, ge=1, le=20),
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> list[PerformerSuggestionResponse]:
    return await suggest_performers(session, q, limit)


@router.get("/performers/{performer_id}", response_model=PerformerDetailResponse)
async def get_admin_performer_detail(
    performer_id: int,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_active_admin),
) -> PerformerDetailResponse:
    performer = await session.get(Performer, performer_id)
    if performer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay performer")
    return PerformerDetailResponse.model_validate(performer)


@router.post("/performers/upload-image", response_model=UploadImageResponse)
async def upload_performer_image(
    file: UploadFile = File(...),
    _: User = Depends(get_current_active_admin),
) -> UploadImageResponse:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Chi cho phep upload file anh")

    extension = Path(file.filename or "").suffix.lower()
    if extension not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dinh dang duoc ho tro: jpg, jpeg, png, webp")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Anh phai co dung luong khong qua 10MB")

    base64_content = b64encode(content).decode("ascii")
    image_url = f"data:{file.content_type};base64,{base64_content}"
    return UploadImageResponse(image_url=image_url)
