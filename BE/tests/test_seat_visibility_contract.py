"""Kiểm thử quy ước hiển thị ghế cho khách chưa đăng nhập và người đã đăng nhập."""

import pytest

from app.services.event_service import get_show_seat_matrix
from app.services.inventory_service import get_seatmap


@pytest.mark.asyncio
async def test_anonymous_seat_matrix_does_not_mark_available_seats_as_mine(db_session, sample_show):
    """Khách chưa đăng nhập không được bị đánh dấu sở hữu ghế do so sánh giá trị rỗng sai."""

    _, seats = await get_show_seat_matrix(db_session, sample_show.id, current_user_id=None)

    assert seats
    assert all(seat["is_locked_by_me"] is False for seat in seats)


@pytest.mark.asyncio
async def test_anonymous_seatmap_does_not_mark_available_seats_as_mine(db_session, sample_show):
    """Dữ liệu sơ đồ ghế của khách chưa đăng nhập phải giữ cờ sở hữu là sai cho mọi ghế."""

    seatmap = await get_seatmap(db_session, sample_show.id, current_user_id=None)

    assert seatmap["seats"]
    assert all(seat["is_locked_by_me"] is False for seat in seatmap["seats"])
