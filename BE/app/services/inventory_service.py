"""Dịch vụ dựng sơ đồ ghế có tọa độ cho màn chọn ghế của khách hàng."""

from datetime import UTC, datetime
import math
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import SeatStatus
from app.models.event import Event, SeatZone, Show, ShowPolygon
from app.models.seat import Seat
from app.models.venue import Polygon, Section, Venue


def _as_utc(value: datetime | None) -> datetime | None:
    """Chuẩn hóa thời gian từ DB về UTC-aware để so sánh hạn giữ ghế an toàn."""

    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=UTC)


async def _get_show_or_404(session: AsyncSession, show_id: int) -> Show:
    """Lấy show còn hiệu lực hoặc trả lỗi 404.

    Input:
    - `session`: phiên DB async.
    - `show_id`: ID buổi diễn cần lấy sơ đồ ghế.

    Output:
    - Model `Show` nếu tồn tại và chưa bị soft-delete.

    Cách hoạt động:
    - Query theo `show_id` và `is_deleted = false`.
    - Nếu không có dữ liệu thì ném `HTTPException 404` để route trả lỗi rõ ràng cho frontend.
    """

    show = await session.scalar(select(Show).where(Show.id == show_id, Show.is_deleted.is_(False)))
    if not show:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy buổi diễn")
    return show


def _zone_block_map(zones: list[SeatZone]) -> dict[int, dict[str, float]]:
    """Chia canvas phần trăm thành các khối mặc định khi ghế chưa có tọa độ.

    Input:
    - `zones`: danh sách khu vực vé của một buổi diễn.

    Output:
    - Map `zone_id -> {left, top, width, height}` theo hệ tọa độ phần trăm 0-100.

    Cách hoạt động:
    - Một khu vực thì chiếm một khối lớn.
    - Nhiều khu vực thì xếp thành lưới 2 cột, có margin/gap cố định để frontend vẫn vẽ được sơ đồ.
    """

    if not zones:
        return {}

    cols = 1 if len(zones) == 1 else 2
    rows = max(math.ceil(len(zones) / cols), 1)
    margin_x = 8.0
    margin_y = 8.0
    gap_x = 6.0
    gap_y = 8.0
    block_width = (100.0 - margin_x * 2 - gap_x * (cols - 1)) / cols
    block_height = (100.0 - margin_y * 2 - gap_y * (rows - 1)) / rows

    blocks: dict[int, dict[str, float]] = {}
    for index, zone in enumerate(zones):
        col = index % cols
        row = index // cols
        blocks[zone.id] = {
            "left": margin_x + col * (block_width + gap_x),
            "top": margin_y + row * (block_height + gap_y),
            "width": block_width,
            "height": block_height,
        }
    return blocks


def _generated_xy(seat: Seat, zone: SeatZone | None, block: dict[str, float] | None) -> tuple[float | None, float | None]:
    """Tạo tọa độ tạm cho ghế chưa có `x_coord/y_coord`.

    Input:
    - `seat`: ghế cần hiển thị.
    - `zone`: khu vực chứa ghế nếu có.
    - `block`: khối phần trăm của khu vực trên canvas.

    Output:
    - Cặp tọa độ `(x, y)` theo phần trăm hoặc `(None, None)` nếu không đủ dữ liệu.

    Cách hoạt động:
    - Ưu tiên tọa độ thật do admin tạo.
    - Nếu thiếu tọa độ, nội suy vị trí theo hàng/cột trong khối khu vực.
    """

    if seat.x_coord is not None and seat.y_coord is not None:
        return float(seat.x_coord), float(seat.y_coord)
    if block is None:
        return None, None

    row_count = max(int(zone.row_count if zone else seat.row_index or 1), int(seat.row_index or 1), 1)
    seats_per_row = max(int(zone.seats_per_row if zone else seat.seat_number or 1), int(seat.seat_number or 1), 1)
    row_index = max(int(seat.row_index or 1), 1)
    seat_number = max(int(seat.seat_number or 1), 1)
    usable_width = block["width"] * 0.82
    usable_height = block["height"] * 0.74
    left = block["left"] + (block["width"] - usable_width) / 2
    top = block["top"] + (block["height"] - usable_height) / 2
    x = left + ((seat_number - 0.5) / seats_per_row) * usable_width
    y = top + ((row_index - 0.5) / row_count) * usable_height
    return round(max(0.0, min(100.0, x)), 2), round(max(0.0, min(100.0, y)), 2)


async def get_seatmap(
    session: AsyncSession,
    show_id: int,
    current_user_id: int | None = None,
) -> dict[str, Any]:
    """Trả toàn bộ sơ đồ ghế có tọa độ để frontend render.

    Input:
    - `show_id`: buổi diễn cần xem sơ đồ.
    - `current_user_id`: có thể rỗng khi khách chưa đăng nhập xem preview.

    Output:
    - Dict gồm thông tin show/event, nền venue, khu vực, polygon và danh sách ghế có giá/trạng thái.

    Cách hoạt động:
    - Lấy show, event, venue, zones, sections và polygon overlay.
    - Chuẩn hóa trạng thái ghế lock đã hết hạn về `available` trên payload public.
    - Không đánh dấu `is_locked_by_me` cho guest để tránh lỗi so sánh `NULL = NULL`.
    """

    show = await _get_show_or_404(session, show_id)
    event = await session.get(Event, show.event_id)
    venue: Venue | None = await session.get(Venue, show.venue_id) if show.venue_id else None
    # Lấy toàn bộ khu giá vé trước để dựng map tra cứu nhanh theo `zone_id`.
    zones = list(await session.scalars(select(SeatZone).where(SeatZone.show_id == show.id).order_by(SeatZone.id.asc())))
    zone_map = {
        zone.id: {
            "id": zone.id,
            "name": zone.name,
            "code": zone.code,
            "color": zone.color,
            "price": float(zone.price),
        }
        for zone in zones
    }
    zone_lookup = {zone.id: zone for zone in zones}
    zone_blocks = _zone_block_map(zones)

    # Section chỉ tồn tại khi show được clone từ venue layout.
    sections: list[Section] = []
    if show.venue_layout_id:
        sections = list(
            await session.scalars(
                select(Section)
                .where(Section.venue_layout_id == show.venue_layout_id)
                .order_by(Section.sort_order.asc())
            )
        )

    # Ưu tiên polygon cấp show; nếu chưa có thì fallback polygon từ venue layout.
    venue_polygons: list[Polygon] = []
    if show.venue_layout_id:
        venue_polygons = list(
            await session.scalars(
                select(Polygon)
                .where(Polygon.venue_layout_id == show.venue_layout_id)
                .order_by(Polygon.id.asc())
            )
        )
    show_polygons = list(
        await session.scalars(
            select(ShowPolygon).where(ShowPolygon.show_id == show.id).order_by(ShowPolygon.id.asc())
        )
    )

    # Danh sách ghế là dữ liệu chính để frontend render từng nút ghế trên canvas.
    seats = list(await session.scalars(select(Seat).where(Seat.show_id == show_id).order_by(Seat.section_id, Seat.seat_label)))
    now = datetime.now(UTC)

    section_map = {
        s.id: {
            "id": s.id,
            "name": s.name,
            "code": s.code,
            "color": s.color,
            "price_base": float(s.price_base),
        }
        for s in sections
    }

    seat_responses = []
    section_to_zone: dict[int, int] = {}
    for seat in seats:
        # Admin lock được hiển thị như trạng thái locked để khách không thể chọn.
        normalized_status = SeatStatus.LOCKED if seat.is_admin_locked and seat.status != SeatStatus.SOLD else seat.status
        lock_expires = _as_utc(seat.lock_expires_at)
        if seat.status == SeatStatus.LOCKED and lock_expires and lock_expires < now:
            normalized_status = SeatStatus.AVAILABLE

        # Ghi nhớ section thuộc zone nào để polygon venue vẫn có màu/tên zone khi fallback.
        if seat.section_id is not None and seat.zone_id is not None and seat.section_id not in section_to_zone:
            section_to_zone[seat.section_id] = seat.zone_id

        zone_info = zone_map.get(seat.zone_id or -1)
        generated_x, generated_y = _generated_xy(
            seat,
            zone_lookup.get(seat.zone_id or -1),
            zone_blocks.get(seat.zone_id or -1),
        )

        seat_responses.append(
            {
                "id": seat.id,
                "label": seat.seat_label,
                "x": generated_x,
                "y": generated_y,
                "rotation": float(seat.rotation) if seat.rotation is not None else 0,
                "zone_id": seat.zone_id,
                "zone_name": zone_info.get("name") if zone_info else None,
                "section_id": seat.section_id,
                "section_name": section_map.get(seat.section_id, {}).get("name"),
                "price": float(seat.price),
                "status": normalized_status.value,
                "lock_expires_at": seat.lock_expires_at.isoformat() if seat.lock_expires_at else None,
                "is_locked_by_me": current_user_id is not None and seat.locked_by_user_id == current_user_id,
                "is_admin_locked": seat.is_admin_locked,
            }
        )

    polygon_responses: list[dict[str, Any]] = []
    if show_polygons:
        polygon_responses = [
            {
                "id": polygon.id,
                "zone_id": polygon.zone_id,
                "zone_name": zone_map.get(polygon.zone_id or -1, {}).get("name"),
                "section_id": None,
                "section_name": None,
                "label": polygon.label,
                "points": polygon.points,
            }
            for polygon in show_polygons
        ]
    elif venue_polygons:
        polygon_responses = [
            {
                "id": -polygon.id,
                "zone_id": section_to_zone.get(polygon.section_id) if polygon.section_id is not None else None,
                "zone_name": zone_map.get(section_to_zone.get(polygon.section_id, -1), {}).get("name") if polygon.section_id is not None else None,
                "section_id": polygon.section_id,
                "section_name": section_map.get(polygon.section_id, {}).get("name"),
                "label": polygon.label,
                "points": polygon.points,
            }
            for polygon in venue_polygons
        ]
    return {
        "show_id": show.id,
        "show_title": show.title,
        "event_id": show.event_id,
        "event_slug": event.slug if event else "",
        "event_title": event.title if event else show.title,
        "venue_name": show.venue,
        "queue_enabled": show.queue_enabled,
        "background": {
            "source": venue.background_source if venue else None,
            "type": venue.background_type if venue else None,
            "width": venue.width if venue else None,
            "height": venue.height if venue else None,
        }
        if venue
        else None,
        "zones": [zone_map[zone.id] for zone in zones],
        "sections": [section_map[s.id] for s in sections],
        "polygons": polygon_responses,
        "seats": seat_responses,
        "seat_count": len(seats),
    }
