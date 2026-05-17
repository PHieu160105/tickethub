"""Kiểm thử các route API quản lý địa điểm."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi import status
from httpx import AsyncClient
from sqlalchemy import select

from app.main import app
from app.models.event import Event, Show
from app.models.seat import Seat
from app.models.venue import Polygon, Section, Venue, VenueLayout
from app.schemas.event import EventCreateRequest, SeatZoneCreate, ShowCreateRequest
from app.services.event_service import create_event, create_show_with_inventory


async def _create_event_and_show(
    db_session,
    admin_user_id: int,
    *,
    event_title: str,
    event_description: str,
    category: str,
    venue_name: str,
    show_date: datetime,
    venue_id: int | None = None,
    venue_layout_id: int | None = None,
    queue_enabled: bool = False,
    zones: list[SeatZoneCreate] | None = None,
) -> tuple[Event, Show]:
    """Tạo một sự kiện cha kèm một buổi diễn theo quy ước dựa trên buổi diễn hiện tại."""

    normalized_show_date = show_date.date()
    event = await create_event(
        db_session,
        admin_user_id,
        EventCreateRequest(
            title=event_title,
            description=event_description,
            category=category,
            start_date=normalized_show_date,
            end_date=normalized_show_date,
            cover_image_url="",
            status="live",
        ),
    )
    show = await create_show_with_inventory(
        db_session,
        event,
        admin_user_id,
        ShowCreateRequest(
            title=f"{event_title} Show",
            description=event_description,
            venue=venue_name,
            show_date=normalized_show_date,
            start_time=show_date.time().replace(hour=18, minute=0, second=0, microsecond=0),
            end_time=show_date.time().replace(hour=20, minute=0, second=0, microsecond=0),
            status="live",
            hold_minutes=10,
            queue_enabled=queue_enabled,
            queue_release_batch=50,
            max_active_queue_tokens=100,
            venue_id=venue_id,
            venue_layout_id=venue_layout_id,
            zones=zones or [],
        ),
    )
    await db_session.commit()
    await db_session.refresh(event)
    await db_session.refresh(show)
    return event, show


@pytest.mark.asyncio
async def test_create_venue(db_session, admin_user):
    """Kiểm thử tạo địa điểm."""
    from app.api.deps import get_db_session

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db_session] = override_get_db

    from app.api.deps import get_current_active_admin

    async def override_get_admin():
        return admin_user

    app.dependency_overrides[get_current_active_admin] = override_get_admin

    try:
        from httpx import ASGITransport
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/admin/venues",
                json={
                    "name": "Test Arena",
                    "address": "123 Main St",
                    "city": "New York",
                    "venue_type": "arena",
                    "capacity": 5000,
                    "width": 1200,
                    "height": 800,
                },
            )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Test Arena"
        assert data["city"] == "New York"
        assert data["venue_type"] == "arena"
        assert data["capacity"] == 5000
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_list_venues(db_session, admin_user):
    """Kiểm thử liệt kê địa điểm."""
    from app.api.deps import get_db_session, get_current_active_admin

    venue = Venue(
        name="Test Theater",
        venue_type="theater",
        city="Los Angeles",
        created_by_user_id=admin_user.id,
    )
    db_session.add(venue)
    await db_session.commit()

    async def override_get_db():
        yield db_session

    async def override_get_admin():
        return admin_user

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_current_active_admin] = override_get_admin

    try:
        from httpx import ASGITransport
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/admin/venues")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) >= 1
        assert any(v["name"] == "Test Theater" for v in data)
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_layout(db_session, admin_user):
    """Kiểm thử tạo bố cục cho địa điểm."""
    from app.api.deps import get_db_session, get_current_active_admin

    venue = Venue(
        name="Test Stadium",
        venue_type="stadium",
        created_by_user_id=admin_user.id,
    )
    db_session.add(venue)
    await db_session.commit()
    await db_session.refresh(venue)

    async def override_get_db():
        yield db_session

    async def override_get_admin():
        return admin_user

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_current_active_admin] = override_get_admin

    try:
        from httpx import ASGITransport
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                f"/api/admin/venues/{venue.id}/layouts",
                json={
                    "name": "Main Floor",
                    "description": "Ground level seating",
                    "sort_order": 1,
                },
            )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Main Floor"
        assert data["venue_id"] == venue.id
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_upload_raster_background_and_block_svg_parse(db_session, admin_user):
    """Ảnh nền raster được upload được nhưng không được xử lý như SVG."""
    from app.api.deps import get_current_active_admin, get_db_session

    venue = Venue(
        name="Background Arena",
        venue_type="arena",
        created_by_user_id=admin_user.id,
    )
    db_session.add(venue)
    await db_session.commit()
    await db_session.refresh(venue)

    async def override_get_db():
        yield db_session

    async def override_get_admin():
        return admin_user

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_current_active_admin] = override_get_admin

    png_bytes = (
        b"\x89PNG\r\n\x1a\n"
        b"\x00\x00\x00\rIHDR"
        b"\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00"
        b"\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00\x00\x00\x04\x00\x01"
        b"\x0b\xe7\x02\x9d\x00\x00\x00\x00IEND\xaeB`\x82"
    )

    try:
        from httpx import ASGITransport

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            upload_response = await client.post(
                f"/api/admin/venues/{venue.id}/upload-background",
                files={"file": ("floorplan.png", png_bytes, "image/png")},
            )
            process_response = await client.post(f"/api/admin/venues/{venue.id}/process")
            detail_response = await client.get(f"/api/admin/venues/{venue.id}")

        assert upload_response.status_code == status.HTTP_200_OK
        assert upload_response.json()["background_type"] == "raster"
        assert process_response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Chỉ có thể phân tích SVG" in process_response.json()["detail"]
        assert detail_response.status_code == status.HTTP_200_OK
        detail = detail_response.json()
        assert detail["background_type"] == "raster"
        assert detail["can_parse_background"] is False
        assert detail["background_source"].startswith("data:image/png;base64,")
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_upload_svg_background_clears_processed_state(db_session, admin_user):
    """Tải SVG mới phải thay nguồn và xóa nền đã xử lý cũ."""
    from app.api.deps import get_current_active_admin, get_db_session

    venue = Venue(
        name="SVG Arena",
        venue_type="arena",
        created_by_user_id=admin_user.id,
        svg_source="<svg viewBox='0 0 100 100'></svg>",
        svg_processed="<svg viewBox='0 0 100 100'><circle cx='1' cy='1' r='1' /></svg>",
    )
    db_session.add(venue)
    await db_session.commit()
    await db_session.refresh(venue)

    async def override_get_db():
        yield db_session

    async def override_get_admin():
        return admin_user

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_current_active_admin] = override_get_admin

    svg_bytes = b"<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><rect x='10' y='10' width='50' height='50' /></svg>"

    try:
        from httpx import ASGITransport

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            upload_response = await client.post(
                f"/api/admin/venues/{venue.id}/upload-background",
                files={"file": ("floorplan.svg", svg_bytes, "image/svg+xml")},
            )
            detail_response = await client.get(f"/api/admin/venues/{venue.id}")

        assert upload_response.status_code == status.HTTP_200_OK
        assert upload_response.json()["background_type"] == "svg"
        detail = detail_response.json()
        assert detail["background_type"] == "svg"
        assert detail["can_parse_background"] is True
        assert detail["background_processed"] is None
        assert "<rect" in detail["background_source"]
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_event_seatmap_includes_background_and_polygons(db_session, admin_user):
    """Seatmap khách hàng phải trả ảnh nền địa điểm và lớp phủ polygon."""
    from app.api.deps import get_db_session

    venue = Venue(
        name="Seatmap Arena",
        venue_type="arena",
        created_by_user_id=admin_user.id,
        svg_source="<svg viewBox='0 0 1000 600'></svg>",
        width=1000,
        height=600,
    )
    db_session.add(venue)
    await db_session.flush()

    layout = VenueLayout(
        venue_id=venue.id,
        name="Main Layout",
        sort_order=0,
    )
    db_session.add(layout)
    await db_session.flush()

    section = Section(
        venue_layout_id=layout.id,
        name="VIP",
        code="VIP",
        color="#ff4d4f",
        price_base=150,
        sort_order=0,
    )
    db_session.add(section)
    await db_session.flush()

    polygon = Polygon(
        venue_id=venue.id,
        venue_layout_id=layout.id,
        section_id=section.id,
        label="VIP Zone",
        points=[{"x": 10, "y": 10}, {"x": 30, "y": 10}, {"x": 20, "y": 25}],
    )
    db_session.add(polygon)
    db_session.add(
        Seat(
            event_id=None,
            zone_id=None,
            row_index=1,
            row_label="A",
            seat_number=1,
            seat_label="A1",
            price=0,
            x_coord=22.5,
            y_coord=33.5,
            rotation=15,
            section_id=section.id,
            venue_layout_id=layout.id,
        )
    )

    event, show = await _create_event_and_show(
        db_session,
        admin_user.id,
        event_title="Seatmap Arena Live",
        event_description="Seat map payload test event",
        category="concert",
        venue_name=venue.name,
        show_date=datetime.now(UTC) + timedelta(days=2),
        venue_id=venue.id,
        venue_layout_id=layout.id,
        queue_enabled=True,
    )

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db_session] = override_get_db

    try:
        from httpx import ASGITransport

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get(f"/api/shows/{show.id}/seatmap")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["event_slug"] == event.slug
        assert data["queue_enabled"] is True
        assert data["background"]["type"] == "svg"
        assert data["background"]["width"] == 1000
        assert data["background"]["height"] == 600
        assert data["polygons"][0]["label"] == "VIP Zone"
        assert data["polygons"][0]["zone_name"] == "VIP"
        assert data["seats"][0]["label"] == "A1"
        assert data["seats"][0]["x"] == 22.5
        assert data["seats"][0]["y"] == 33.5
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_section(db_session, admin_user):
    """Kiểm thử tạo khu vực trong bố cục."""
    from app.api.deps import get_db_session, get_current_active_admin

    venue = Venue(
        name="Test Arena",
        venue_type="arena",
        created_by_user_id=admin_user.id,
    )
    db_session.add(venue)
    await db_session.commit()
    await db_session.refresh(venue)

    layout = VenueLayout(
        venue_id=venue.id,
        name="Main Floor",
    )
    db_session.add(layout)
    await db_session.commit()
    await db_session.refresh(layout)

    async def override_get_db():
        yield db_session

    async def override_get_admin():
        return admin_user

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_current_active_admin] = override_get_admin

    try:
        from httpx import ASGITransport
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                f"/api/admin/layouts/{layout.id}/sections",
                json={
                    "name": "VIP",
                    "code": "VIP",
                    "color": "#ff0000",
                    "price_base": 500.00,
                    "sort_order": 1,
                },
            )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "VIP"
        assert data["code"] == "VIP"
        from decimal import Decimal
        assert Decimal(str(data["price_base"])) == Decimal("500.00")
        assert data["venue_layout_id"] == layout.id
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_and_list_layout_seats(db_session, admin_user):
    """Kiểm thử tạo ghế mẫu địa điểm và liệt kê theo bố cục."""
    from app.api.deps import get_current_active_admin, get_db_session

    venue = Venue(
        name="Seat Builder Arena",
        venue_type="arena",
        created_by_user_id=admin_user.id,
    )
    db_session.add(venue)
    await db_session.commit()
    await db_session.refresh(venue)

    layout = VenueLayout(
        venue_id=venue.id,
        name="Main Floor",
    )
    db_session.add(layout)
    await db_session.commit()
    await db_session.refresh(layout)

    section = Section(
        venue_layout_id=layout.id,
        name="VIP",
        code="VIP",
        color="#ff0000",
        price_base=500,
        sort_order=1,
    )
    db_session.add(section)
    await db_session.commit()
    await db_session.refresh(section)

    async def override_get_db():
        yield db_session

    async def override_get_admin():
        return admin_user

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_current_active_admin] = override_get_admin

    try:
        from httpx import ASGITransport
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            create_response = await client.post(
                f"/api/admin/venues/{venue.id}/seats/single",
                json={
                    "layout_id": layout.id,
                    "section_id": section.id,
                    "label": "A1",
                    "x": 12.5,
                    "y": 18.75,
                    "rotation": 0,
                    "is_admin_locked": True,
                },
            )
            list_response = await client.get(f"/api/admin/venues/{venue.id}/seats", params={"layout_id": layout.id})

        assert create_response.status_code == status.HTTP_200_OK
        created = create_response.json()
        assert created["label"] == "A1"
        assert created["section_id"] == section.id
        assert created["is_admin_locked"] is True
        assert list_response.status_code == status.HTTP_200_OK
        seats = list_response.json()
        assert len(seats) == 1
        assert seats[0]["label"] == "A1"
        assert seats[0]["section_name"] == "VIP"
        assert seats[0]["is_admin_locked"] is True
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_event_from_venue_layout_clones_template_seats(db_session, admin_user):
    """Tạo sự kiện phải hỗ trợ sơ đồ ghế từ bố cục địa điểm dù không dùng khu vực ghế kiểu cũ."""

    venue = Venue(
        name="Venue Mode Arena",
        venue_type="arena",
        created_by_user_id=admin_user.id,
    )
    db_session.add(venue)
    await db_session.commit()
    await db_session.refresh(venue)

    layout = VenueLayout(
        venue_id=venue.id,
        name="Main Layout",
    )
    db_session.add(layout)
    await db_session.commit()
    await db_session.refresh(layout)

    section = Section(
        venue_layout_id=layout.id,
        name="VIP",
        code="VIP",
        color="#ff0000",
        price_base=750,
        sort_order=1,
    )
    db_session.add(section)
    await db_session.commit()
    await db_session.refresh(section)

    db_session.add_all(
        [
            Seat(
                event_id=None,
                zone_id=None,
                row_index=1,
                row_label="A",
                seat_number=1,
                seat_label="A1",
                price=0,
                x_coord=10,
                y_coord=20,
                rotation=0,
                section_id=section.id,
                venue_layout_id=layout.id,
                is_admin_locked=True,
            ),
            Seat(
                event_id=None,
                zone_id=None,
                row_index=1,
                row_label="A",
                seat_number=2,
                seat_label="A2",
                price=0,
                x_coord=14,
                y_coord=20,
                rotation=0,
                section_id=section.id,
                venue_layout_id=layout.id,
                is_admin_locked=False,
            ),
        ]
    )
    await db_session.commit()

    event, show = await _create_event_and_show(
        db_session,
        admin_user.id,
        event_title="Venue Seatmap Event",
        event_description="Event that uses a venue layout template",
        category="Concert",
        venue_name=venue.name,
        show_date=datetime.now(UTC) + timedelta(days=1),
        venue_id=venue.id,
        venue_layout_id=layout.id,
        zones=[],
    )

    created_event = await db_session.scalar(select(Event).where(Event.id == event.id))
    assert created_event is not None
    assert show.venue_id == venue.id
    assert show.venue_layout_id == layout.id

    event_seats = list(
        await db_session.scalars(
            select(Seat).where(Seat.show_id == show.id).order_by(Seat.seat_label.asc())
        )
    )
    assert [seat.seat_label for seat in event_seats] == ["A1", "A2"]
    assert all(seat.zone_id is not None for seat in event_seats)
    assert all(seat.venue_layout_id == layout.id for seat in event_seats)
    assert all(float(seat.price) == 750.0 for seat in event_seats)
    assert event_seats[0].is_admin_locked is True
    assert event_seats[0].status.value == "locked"
    assert event_seats[1].is_admin_locked is False
    assert event_seats[1].status.value == "available"


@pytest.mark.asyncio
async def test_create_event_with_venue_id_only_uses_venue(db_session, admin_user):
    """Tạo sự kiện phải kiểm tra venue_id kể cả khi không truyền layout."""

    venue = Venue(
        name="Venue Only Arena",
        venue_type="arena",
        created_by_user_id=admin_user.id,
    )
    db_session.add(venue)
    await db_session.commit()
    await db_session.refresh(venue)

    event, show = await _create_event_and_show(
        db_session,
        admin_user.id,
        event_title="Venue Only Event",
        event_description="Event created with venue_id but without a venue layout",
        category="Concert",
        venue_name=venue.name,
        show_date=datetime.now(UTC) + timedelta(days=1),
        venue_id=venue.id,
        zones=[SeatZoneCreate(code="GEN", name="General", row_count=2, seats_per_row=2, price=100, color="#00ff00")],
    )

    assert show.venue_id == venue.id
    assert show.venue_layout_id is None

    event_seats = list(
        await db_session.scalars(
            select(Seat).where(Seat.show_id == show.id).order_by(Seat.seat_label.asc())
        )
    )
    assert len(event_seats) == 4
    assert all(seat.zone_id is not None for seat in event_seats)


@pytest.mark.asyncio
async def test_create_event_with_invalid_venue_id_fails(db_session, admin_user):
    """venue_id không hợp lệ phải bị từ chối khi tạo sự kiện."""

    event = await create_event(
        db_session,
        admin_user.id,
        EventCreateRequest(
            title="Invalid Venue Event",
            description="Event with a non-existing venue_id should fail",
            category="Concert",
            start_date=(datetime.now(UTC) + timedelta(days=1)).date(),
            end_date=(datetime.now(UTC) + timedelta(days=1)).date(),
            cover_image_url="",
            status="live",
        ),
    )

    with pytest.raises(Exception):
        await create_show_with_inventory(
            db_session,
            event,
            admin_user.id,
            ShowCreateRequest(
                title="Invalid Venue Event Show",
                description="Show with a non-existing venue_id should fail",
                venue="Ghost Venue",
                show_date=(datetime.now(UTC) + timedelta(days=1)).date(),
                start_time=datetime.now(UTC).time().replace(hour=18, minute=0, second=0, microsecond=0),
                end_time=datetime.now(UTC).time().replace(hour=20, minute=0, second=0, microsecond=0),
                status="live",
                hold_minutes=10,
                queue_enabled=False,
                queue_release_batch=50,
                max_active_queue_tokens=100,
                venue_id=999999,
                zones=[SeatZoneCreate(code="GEN", name="General", row_count=1, seats_per_row=1, price=10, color="#000000")],
            ),
        )


@pytest.mark.asyncio
async def test_create_and_list_polygons(db_session, admin_user):
    """Kiểm thử lưu vùng polygon cho bố cục địa điểm."""
    from app.api.deps import get_current_active_admin, get_db_session

    venue = Venue(
        name="Polygon Arena",
        venue_type="arena",
        created_by_user_id=admin_user.id,
    )
    db_session.add(venue)
    await db_session.commit()
    await db_session.refresh(venue)

    layout = VenueLayout(
        venue_id=venue.id,
        name="Main Floor",
    )
    db_session.add(layout)
    await db_session.commit()
    await db_session.refresh(layout)

    section = Section(
        venue_layout_id=layout.id,
        name="Premium",
        code="PREM",
        color="#00ffcc",
        price_base=250,
        sort_order=1,
    )
    db_session.add(section)
    await db_session.commit()
    await db_session.refresh(section)

    async def override_get_db():
        yield db_session

    async def override_get_admin():
        return admin_user

    app.dependency_overrides[get_db_session] = override_get_db
    app.dependency_overrides[get_current_active_admin] = override_get_admin

    try:
        from httpx import ASGITransport
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            create_response = await client.post(
                f"/api/admin/venues/{venue.id}/polygons",
                json={
                    "layout_id": layout.id,
                    "section_id": section.id,
                    "label": "Premium Zone",
                    "points": [
                        {"x": 10, "y": 10},
                        {"x": 30, "y": 10},
                        {"x": 25, "y": 25},
                    ],
                },
            )
            list_response = await client.get(f"/api/admin/venues/{venue.id}/polygons", params={"layout_id": layout.id})

        assert create_response.status_code == status.HTTP_200_OK
        created = create_response.json()
        assert created["label"] == "Premium Zone"
        assert created["section_id"] == section.id

        assert list_response.status_code == status.HTTP_200_OK
        polygons = list_response.json()
        assert len(polygons) == 1
        assert polygons[0]["section_name"] == "Premium"
        assert len(polygons[0]["points"]) == 3
    finally:
        app.dependency_overrides.clear()
