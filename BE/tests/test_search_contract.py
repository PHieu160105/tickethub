"""Kiểm thử quy ước API tìm kiếm."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.search import suggest


@pytest.mark.asyncio
async def test_event_search_uses_mapped_event_date_columns(db_session: AsyncSession, sample_event):
    """Tìm kiếm public không được sắp xếp bằng thuộc tính ngày giờ cũ chỉ tồn tại trong mã Python."""

    items = await suggest(q=sample_event.title[:4], scope="events", limit=8, session=db_session)

    assert items
    assert items[0].item_type == "event"
    assert items[0].value == str(sample_event.id)
