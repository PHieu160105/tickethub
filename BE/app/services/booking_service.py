"""Xử lý nghiệp vụ giữ ghế, thanh toán, phát hành vé và giải phóng lock quá hạn."""

# ============================================================
# IMPORTS TỪ THƯ VIỆN PYTHON (built-in)
# ============================================================
from datetime import UTC, datetime, timedelta  # Python built-in: xử lý thời gian
from decimal import Decimal                     # Python built-in: số thập phân chính xác cho tiền tệ
from uuid import uuid4                          # Python built-in: sinh chuỗi UUID ngẫu nhiên

# ============================================================
# IMPORTS TỪ THƯ VIỆN BÊN NGOÀI (cài qua pip)
# ============================================================
from fastapi import HTTPException, status        # FastAPI: ném lỗi HTTP và mã trạng thái
from sqlalchemy import func, or_, select         # SQLAlchemy: hàm SQL (COUNT, SUM...), OR, SELECT
from sqlalchemy.ext.asyncio import AsyncSession  # SQLAlchemy: phiên làm việc async với database

# ============================================================
# IMPORTS TỪ NỘI BỘ DỰ ÁN (tự viết)
# ============================================================
from app.core.cache import (
    public_api_cache,                 # Tự viết: đối tượng cache toàn cục cho API public
    show_seat_cache_namespace,        # Tự viết: tạo cache key cho sơ đồ ghế của show
    user_ticket_cache_namespace,      # Tự viết: tạo cache key cho vé của user
)
from app.core.search import build_ilike_pattern  # Tự viết: tạo pattern tìm kiếm LIKE không phân biệt hoa thường
from app.models.enums import OrderStatus, SeatStatus  # Tự viết: enum trạng thái đơn hàng và ghế
from app.models.event import Event, SeatZone, Show     # Tự viết: ORM models cho sự kiện, vùng ghế, buổi diễn
from app.models.order import (
    Order,              # Tự viết: ORM model đơn hàng
    OrderItem,          # Tự viết: ORM model dòng đơn hàng
    Ticket,             # Tự viết: ORM model vé
    TicketCancellation, # Tự viết: ORM model lịch sử hủy vé
)
from app.models.seat import Seat                     # Tự viết: ORM model ghế
from app.schemas.booking import (
    CheckoutItemResponse,  # Tự viết: Pydantic schema response cho từng mục thanh toán
    CheckoutResponse,      # Tự viết: Pydantic schema response tổng thanh toán
    LockSeatsResponse,     # Tự viết: Pydantic schema response cho kết quả giữ ghế
    MyTicketResponse,      # Tự viết: Pydantic schema response cho vé của tôi
)
from app.services.queue_service import (
    ensure_queue_access,    # Tự viết: hàm kiểm tra quyền vào từ hàng đợi
    mark_queue_completed,   # Tự viết: hàm đánh dấu hoàn tất hàng đợi sau thanh toán
)
from app.ws.connection_manager import seat_ws_manager  # Tự viết: WebSocket manager cho cập nhật ghế realtime


def _as_utc(value: datetime | None) -> datetime | None:
    """Chuẩn hóa `datetime` từ tầng DB về dạng có timezone UTC.

    Input:
    - `value`: thời gian có thể là naive hoặc timezone-aware.

    Output:
    - `datetime` đã có timezone UTC hoặc `None` nếu đầu vào rỗng.

    Cách hoạt động:
    - Nếu DB driver trả về giá trị naive, hàm sẽ gắn `UTC` để các phép so sánh thời gian an toàn.
    """

    # `None` là built-in constant của Python
    if value is None:
        return None
    
    # `value.tzinfo` là thuộc tính của Python datetime: None nếu không có múi giờ
    # `value.replace()` là method của Python datetime: tạo bản sao với tham số mới
    # `UTC` là hằng số từ thư viện datetime (Python 3.11+)
    return value if value.tzinfo else value.replace(tzinfo=UTC)


async def _get_show_or_404(session: AsyncSession, show_id: int) -> Show:
    """Tìm buổi diễn theo ID, ném lỗi 404 nếu không tồn tại hoặc đã bị xóa mềm.
    
    Input:
    - `session`: SQLAlchemy AsyncSession (từ thư viện) - phiên kết nối database
    - `show_id`: int - ID của buổi diễn cần tìm
    
    Output:
    - `Show`: ORM object (tự viết) nếu tìm thấy
    - Ném HTTPException 404 (FastAPI) nếu không tìm thấy
    """

    # `select(Show)` là SQLAlchemy (thư viện): tạo câu SELECT
    # `.where()` là SQLAlchemy: thêm điều kiện WHERE
    # `Show.id` là SQLAlchemy Mapped column (tự định nghĩa trong model)
    # `Show.is_deleted.is_(False)` là SQLAlchemy: kiểm tra cột boolean = False
    # `session.scalar()` là SQLAlchemy AsyncSession: thực thi query, trả về 1 giá trị hoặc None
    show = await session.scalar(select(Show).where(Show.id == show_id, Show.is_deleted.is_(False)))
    
    # `HTTPException` là FastAPI (thư viện): tạo response lỗi HTTP
    # `status.HTTP_404_NOT_FOUND` là FastAPI (thư viện): mã trạng thái 404
    if not show:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy buổi diễn")
    
    return show


async def lock_seats(
    session: AsyncSession,      # SQLAlchemy: phiên async để query database
    user_id: int,                # Python built-in: ID người dùng
    show_id: int,                # Python built-in: ID buổi diễn
    seat_ids: list[int],         # Python built-in: danh sách ID ghế muốn giữ
    queue_token: str | None,     # Python built-in: token hàng đợi (có thể None nếu show không bật queue)
) -> LockSeatsResponse:          # Tự viết: Pydantic schema response
    """Giữ ghế cho người dùng bằng row-level lock để tránh bán trùng.

    Input:
    - `session`: phiên làm việc với cơ sở dữ liệu.
    - `user_id`: người dùng đang giữ ghế.
    - `show_id`: show đang thao tác.
    - `seat_ids`: danh sách ghế muốn giữ.
    - `queue_token`: token queue nếu show bật hàng đợi.

    Output:
    - Danh sách ghế giữ thành công, ghế thất bại và thông điệp kết quả.

    Cách hoạt động:
    - Khóa hàng dữ liệu ghế bằng `FOR UPDATE`.
    - Kiểm tra ghế đã bán, bị admin khóa hoặc đang bị người khác giữ.
    - Ghi thời gian hết hạn lock và broadcast thay đổi ghế sau khi commit.
    """

    # `set()` là Python built-in: tạo tập hợp, tự động loại bỏ trùng lặp
    # Kiểm tra xem có ghế nào bị gửi trùng ID không
    if len(set(seat_ids)) != len(seat_ids):
        # `HTTPException` là FastAPI (thư viện)
        # `status.HTTP_400_BAD_REQUEST` là FastAPI
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Danh sách ghế gửi lên bị trùng mã")

    # Gọi hàm tự viết: kiểm tra show có tồn tại không
    show = await _get_show_or_404(session, show_id)
    # Gọi hàm tự viết: kiểm tra user có quyền truy cập từ queue không
    await ensure_queue_access(session, show, user_id, queue_token)

    # `datetime.now(UTC)` là Python built-in: lấy thời gian hiện tại theo múi giờ UTC
    now = datetime.now(UTC)
    # `timedelta` là Python built-in: khoảng thời gian
    # `show.hold_minutes` là cột trong model Show (tự viết): số phút được giữ ghế
    expires_at = now + timedelta(minutes=show.hold_minutes)
    
    # Khởi tạo các biến kết quả (Python built-in types)
    locked_ids: list[int] = []
    failed_ids: list[int] = []
    changed_seats: list[dict[str, int | str | None]] = []

    try:
        # ============================================================
        # SQLAlchemy query với FOR UPDATE để khóa hàng
        # ============================================================
        # `select(Seat)` là SQLAlchemy: SELECT từ bảng seats
        # `.where()` là SQLAlchemy: điều kiện WHERE
        # `Seat.id.in_(seat_ids)` là SQLAlchemy: WHERE id IN (...)
        # `.order_by(Seat.id.asc())` là SQLAlchemy: ORDER BY id ASC
        # `.with_for_update()` là SQLAlchemy: thêm FOR UPDATE để khóa hàng
        # `session.scalars()` là SQLAlchemy: thực thi query, trả về iterator các object
        # `list()` là Python built-in: chuyển iterator thành list
        seats = list(
            await session.scalars(
                select(Seat)
                .where(Seat.show_id == show_id, Seat.id.in_(seat_ids))
                .order_by(Seat.id.asc())
                .with_for_update()
            )
        )

        # Set comprehension (Python built-in): lấy tập hợp ID các ghế tìm thấy
        found_ids = {seat.id for seat in seats}
        # Kiểm tra ghế nào trong danh sách gửi lên nhưng không tồn tại trong DB
        for seat_id in seat_ids:
            if seat_id not in found_ids:
                failed_ids.append(seat_id)

        # Duyệt từng ghế tìm thấy để kiểm tra trạng thái
        for seat in seats:
            # `seat.is_admin_locked` là cột trong model Seat (tự viết): ghế bị admin khóa
            # `SeatStatus.SOLD` là enum tự viết: trạng thái đã bán
            if seat.is_admin_locked or seat.status == SeatStatus.SOLD:
                failed_ids.append(seat.id)
                continue

            # `_as_utc()` là hàm tự viết: chuẩn hóa timezone
            lock_expires = _as_utc(seat.lock_expires_at)
            
            # Kiểm tra ghế đang bị người KHÁC giữ và CÒN HẠN
            # `SeatStatus.LOCKED` là enum tự viết
            # `seat.locked_by_user_id` là cột trong model Seat (tự viết)
            if (
                seat.status == SeatStatus.LOCKED
                and seat.locked_by_user_id != user_id
                and (lock_expires is None or lock_expires > now)  # None coi như khóa vĩnh viễn
            ):
                failed_ids.append(seat.id)
                continue

            # Ghế hợp lệ → tiến hành giữ
            seat.status = SeatStatus.LOCKED               # Đổi trạng thái
            seat.locked_by_user_id = user_id              # Gán người giữ
            seat.lock_expires_at = expires_at             # Gán thời hạn
            locked_ids.append(seat.id)                     # Thêm vào danh sách thành công
            
            # Tạo payload để broadcast qua WebSocket
            changed_seats.append(
                {
                    "id": seat.id,
                    "status": SeatStatus.LOCKED.value,     # `.value` lấy giá trị string của enum
                    "lock_expires_at": seat.lock_expires_at.isoformat(),  # `.isoformat()` là Python datetime method
                    "locked_by_user_id": user_id,
                }
            )

        # `session.commit()` là SQLAlchemy: lưu thay đổi vào database
        await session.commit()
    except Exception:
        # `session.rollback()` là SQLAlchemy: hoàn tác nếu có lỗi
        await session.rollback()
        raise  # Python built-in: ném lại lỗi để tầng trên xử lý

    # Sau khi commit thành công → xóa cache và broadcast
    if changed_seats:
        # `public_api_cache.invalidate_namespace()` là tự viết: xóa cache theo namespace
        # `show_seat_cache_namespace(show_id)` là tự viết: tạo cache key cho show
        await public_api_cache.invalidate_namespace(show_seat_cache_namespace(show_id))
        # `seat_ws_manager.broadcast_seat_changes()` là tự viết: gửi WebSocket
        await seat_ws_manager.broadcast_seat_changes(show_id=show_id, payload=changed_seats)

    # `LockSeatsResponse` là Pydantic schema tự viết
    # `sorted()` là Python built-in: sắp xếp danh sách
    # `set()` là Python built-in: loại bỏ trùng lặp
    return LockSeatsResponse(
        locked_seat_ids=locked_ids,
        failed_seat_ids=sorted(set(failed_ids)),
        message="Đã giữ ghế thành công" if locked_ids else "Không có ghế nào được giữ",
    )


async def release_seats(session: AsyncSession, user_id: int, show_id: int, seat_ids: list[int]) -> int:
    """Trả lại các ghế đang bị chính người dùng hiện tại giữ.

    Input:
    - `session`, `user_id`, `show_id`, `seat_ids`.

    Output:
    - Số lượng ghế được trả thành công.

    Cách hoạt động:
    - Chỉ những ghế ở trạng thái `locked` và thuộc `locked_by_user_id` hiện tại mới được mở khóa.
    - Sau commit sẽ xóa cache seatmap và broadcast trạng thái mới.
    """

    # Khởi tạo danh sách thay đổi để broadcast
    changed_seats: list[dict[str, int | str | None]] = []
    try:
        # SQLAlchemy query với FOR UPDATE
        # Giống lock_seats: khóa hàng, sắp xếp, chỉ lấy ghế trong danh sách
        seats = list(
            await session.scalars(
                select(Seat)
                .where(Seat.show_id == show_id, Seat.id.in_(seat_ids))
                .order_by(Seat.id.asc())
                .with_for_update()
            )
        )

        count = 0  # Python built-in: biến đếm
        for seat in seats:
            # Chỉ thả ghế nếu ghế đang LOCKED và do CHÍNH user này giữ
            if seat.status != SeatStatus.LOCKED or seat.locked_by_user_id != user_id:
                continue

            # Đưa ghế về trạng thái AVAILABLE
            seat.status = SeatStatus.AVAILABLE     # Enum tự viết
            seat.locked_by_user_id = None          # Xóa người giữ
            seat.lock_expires_at = None            # Xóa thời hạn
            count += 1                             # Tăng biến đếm
            
            # Tạo payload WebSocket
            changed_seats.append(
                {
                    "id": seat.id,
                    "status": SeatStatus.AVAILABLE.value,
                    "lock_expires_at": None,
                    "locked_by_user_id": None,
                }
            )

        await session.commit()  # SQLAlchemy: lưu thay đổi
    except Exception:
        await session.rollback()  # SQLAlchemy: hoàn tác
        raise

    # Xóa cache và broadcast nếu có thay đổi
    if changed_seats:
        await public_api_cache.invalidate_namespace(show_seat_cache_namespace(show_id))
        await seat_ws_manager.broadcast_seat_changes(show_id=show_id, payload=changed_seats)

    return count  # Python built-in: trả về số ghế đã thả


async def checkout_locked_seats(
    session: AsyncSession,
    user_id: int,
    show_id: int,
    queue_token: str | None,
    discount_code: str | None = None,  # Tự viết: mã giảm giá (hiện chưa xử lý giảm giá thực tế)
) -> CheckoutResponse:  # Tự viết: Pydantic schema
    """Xác nhận checkout và chuyển ghế đang giữ thành ghế đã bán một cách nguyên tử.

    Input:
    - `session`, `user_id`, `show_id`.
    - `queue_token`: token queue hợp lệ nếu show bật hàng đợi.
    - `discount_code`: mã giảm giá, hiện mới lưu nhận biết chứ chưa tính giảm giá thật.

    Output:
    - `CheckoutResponse` chứa đơn hàng, tổng tiền, thời gian thanh toán và danh sách vé đã phát hành.

    Cách hoạt động:
    - Lấy toàn bộ ghế người dùng đang giữ trong show bằng `FOR UPDATE`.
    - Loại bỏ lock đã hết hạn.
    - Tạo `Order`, `OrderItem`, `Ticket`.
    - Đổi trạng thái ghế sang `sold`, commit và broadcast thay đổi.
    """

    # Kiểm tra show tồn tại và quyền truy cập queue
    show = await _get_show_or_404(session, show_id)  # Tự viết
    await ensure_queue_access(session, show, user_id, queue_token)  # Tự viết

    now = datetime.now(UTC)  # Python built-in
    checkout_items: list[CheckoutItemResponse] = []  # Tự viết: schema
    changed_seats: list[dict[str, int | str | None]] = []  # Python built-in types

    try:
        # SQLAlchemy query: lấy TẤT CẢ ghế user này đang giữ trong show
        seats = list(
            await session.scalars(
                select(Seat)
                .where(
                    Seat.show_id == show_id,
                    Seat.locked_by_user_id == user_id,  # Chỉ lấy ghế của user này
                    Seat.status == SeatStatus.LOCKED,    # Chỉ lấy ghế đang LOCKED
                )
                .order_by(Seat.id.asc())
                .with_for_update()  # SQLAlchemy: FOR UPDATE
            )
        )

        # Phân loại ghế: còn hạn vs hết hạn
        valid_seats: list[Seat] = []
        for seat in seats:
            lock_expires = _as_utc(seat.lock_expires_at)  # Tự viết: chuẩn hóa timezone
            # Nếu ghế đã hết hạn → thả về AVAILABLE
            if lock_expires and lock_expires < now:
                seat.status = SeatStatus.AVAILABLE
                seat.locked_by_user_id = None
                seat.lock_expires_at = None
                changed_seats.append(
                    {
                        "id": seat.id,
                        "status": SeatStatus.AVAILABLE.value,
                        "lock_expires_at": None,
                        "locked_by_user_id": None,
                    }
                )
                continue  # Bỏ qua ghế này, không tính vào thanh toán
            valid_seats.append(seat)  # Ghế còn hạn → được thanh toán

        # Nếu không còn ghế hợp lệ nào → báo lỗi
        if not valid_seats:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không có ghế đang giữ hợp lệ để thanh toán")

        # Lấy thông tin vùng ghế (zone) để hiển thị
        # Set comprehension: lấy các zone_id duy nhất từ danh sách ghế
        zone_ids = {seat.zone_id for seat in valid_seats if seat.zone_id is not None}
        # SQLAlchemy query: lấy tên các zone
        zone_rows = await session.execute(select(SeatZone.id, SeatZone.name).where(SeatZone.id.in_(zone_ids))) if zone_ids else None
        # Dict comprehension (Python built-in): tạo map {zone_id: zone_name}
        zone_map = {zone_id: zone_name for zone_id, zone_name in (zone_rows.all() if zone_rows else [])}

        # Tính tiền
        # `Decimal(str(seat.price))` chuyển float → string → Decimal để tránh sai số
        # `sum()` là Python built-in
        subtotal_amount = sum(Decimal(str(seat.price)) for seat in valid_seats)
        discount_amount = Decimal("0")  # Decimal từ thư viện decimal
        total_amount = subtotal_amount - discount_amount  # Hiện tại áp dụng giảm giá

        # ============================================================
        # Tạo ĐƠN HÀNG (Order)
        # ============================================================
        order = Order(  # Tự viết: ORM model
            user_id=user_id,
            event_id=show.event_id,
            show_id=show_id,
            status=OrderStatus.PAID,     # Enum tự viết: trạng thái đã thanh toán
            total_amount=total_amount,
            paid_at=now,
        )
        session.add(order)       # SQLAlchemy: thêm vào session
        await session.flush()    # SQLAlchemy: đẩy SQL xuống DB để lấy order.id nhưng chưa commit

        # ============================================================
        # Tạo DÒNG ĐƠN HÀNG (OrderItem) cho từng ghế
        # ============================================================
        # List comprehension (Python built-in): tạo list OrderItem
        order_items = [OrderItem(order_id=order.id, seat_id=seat.id, price=seat.price) for seat in valid_seats]
        session.add_all(order_items)  # SQLAlchemy: thêm nhiều object
        await session.flush()         # SQLAlchemy: đẩy SQL để lấy order_item.id

        # ============================================================
        # Tạo VÉ (Ticket) cho từng ghế
        # ============================================================
        tickets: list[Ticket] = []
        # `zip()` là Python built-in: ghép cặp 2 list
        # `strict=False` là Python 3.10+: không bắt 2 list cùng độ dài
        for seat, order_item in zip(valid_seats, order_items, strict=False):
            # Tạo mã vé: TR-20260515-A1B2C3D4E5F6
            # `now.strftime('%Y%m%d')` là Python datetime method
            # `uuid4().hex[:12].upper()` là Python uuid: 12 ký tự hex viết hoa
            ticket_code = f"TR-{now.strftime('%Y%m%d')}-{uuid4().hex[:12].upper()}"
            qr_payload = f"ticketrush://ticket/{ticket_code}"  # Deep link cho app
            
            tickets.append(
                Ticket(  # Tự viết: ORM model
                    order_item_id=order_item.id,
                    ticket_code=ticket_code,
                    qr_payload=qr_payload,
                    issued_at=now,
                )
            )

            # Tạo response item cho client
            checkout_items.append(
                CheckoutItemResponse(  # Tự viết: Pydantic schema
                    seat_id=seat.id,
                    seat_label=seat.seat_label,
                    zone_name=zone_map.get(seat.zone_id, "Chưa phân khu"),  # `.get()` là Python dict method
                    price=Decimal(str(seat.price)),
                    ticket_code=ticket_code,
                    qr_payload=qr_payload,
                )
            )

            # Đổi trạng thái ghế thành SOLD
            seat.status = SeatStatus.SOLD         # Enum tự viết
            seat.locked_by_user_id = None         # Xóa người giữ
            seat.lock_expires_at = None           # Xóa thời hạn
            changed_seats.append(
                {
                    "id": seat.id,
                    "status": SeatStatus.SOLD.value,
                    "lock_expires_at": None,
                    "locked_by_user_id": None,
                }
            )

        session.add_all(tickets)  # SQLAlchemy: thêm tất cả vé

        # Đánh dấu queue completed (nếu có)
        await mark_queue_completed(session, show_id=show_id, user_id=user_id, queue_token=queue_token)
        await session.commit()  # SQLAlchemy: LƯU TẤT CẢ
    except Exception:
        await session.rollback()  # SQLAlchemy: hoàn tác nếu có lỗi
        raise

    # Xóa cache và broadcast
    if changed_seats:
        await public_api_cache.invalidate_namespace(show_seat_cache_namespace(show_id))
        await seat_ws_manager.broadcast_seat_changes(show_id=show_id, payload=changed_seats)
    await public_api_cache.invalidate_namespace(user_ticket_cache_namespace(user_id))

    # Trả về response
    return CheckoutResponse(  # Tự viết: Pydantic schema
        order_id=order.id,
        order_status=order.status,
        total_amount=Decimal(str(order.total_amount)),
        discount_amount=discount_amount,
        discount_code=discount_code,
        paid_at=order.paid_at or now,  # `or` là Python operator: nếu None thì dùng now
        items=checkout_items,
    )


async def fetch_my_tickets(
    session: AsyncSession,
    user_id: int,
    search: str | None = None,        # Python built-in: từ khóa tìm kiếm
    start_from: datetime | None = None, # Python built-in: lọc từ ngày
    end_to: datetime | None = None,     # Python built-in: lọc đến ngày
    limit: int = 20,                    # Python built-in: số lượng tối đa
    offset: int = 0,                    # Python built-in: vị trí bắt đầu (phân trang)
) -> list[MyTicketResponse]:            # Tự viết: Pydantic schema
    """Trả về danh sách vé đã mua và lịch sử hủy vé của người dùng.

    Input:
    - `user_id`, bộ lọc tìm kiếm, khoảng thời gian, phân trang.

    Output:
    - Danh sách `MyTicketResponse` đã gộp cả vé còn hiệu lực và vé đã hủy.

    Cách hoạt động:
    - Chạy hai truy vấn riêng cho vé active và vé cancelled.
    - Áp dụng bộ lọc text và thời gian.
    - Chuẩn hóa dữ liệu trả về để frontend hiển thị thống nhất.
    """

    # ============================================================
    # Query vé ACTIVE (còn hiệu lực)
    # ============================================================
    # SQLAlchemy: JOIN nhiều bảng để lấy đầy đủ thông tin vé
    # `.join()` là SQLAlchemy: INNER JOIN
    # `.outerjoin()` là SQLAlchemy: LEFT OUTER JOIN (zone có thể NULL)
    active_stmt = (
        select(Ticket, Order, Event, Show, OrderItem, Seat, SeatZone)
        .join(OrderItem, Ticket.order_item_id == OrderItem.id)
        .join(Order, OrderItem.order_id == Order.id)
        .join(Show, Order.show_id == Show.id)
        .join(Event, Show.event_id == Event.id)
        .join(Seat, OrderItem.seat_id == Seat.id)
        .outerjoin(SeatZone, Seat.zone_id == SeatZone.id)
        .where(Order.user_id == user_id)
        .order_by(Ticket.issued_at.desc())  # Mới nhất lên đầu
    )

    # ============================================================
    # Query vé CANCELLED (đã hủy)
    # ============================================================
    cancelled_stmt = (
        select(TicketCancellation, Event, Show, Seat, SeatZone)
        .join(Show, TicketCancellation.show_id == Show.id)
        .join(Event, Show.event_id == Event.id)
        .join(Seat, TicketCancellation.seat_id == Seat.id)
        .outerjoin(SeatZone, Seat.zone_id == SeatZone.id)
        .where(TicketCancellation.user_id == user_id)
        .order_by(TicketCancellation.canceled_at.desc())  # Mới nhất lên đầu
    )

    # ============================================================
    # Áp dụng bộ lọc TÌM KIẾM (nếu có)
    # ============================================================
    # `build_ilike_pattern()` là tự viết: tạo pattern LIKE không phân biệt hoa thường
    pattern = build_ilike_pattern(search)
    if pattern:
        # `or_()` là SQLAlchemy: toán tử OR
        # `.ilike()` là SQLAlchemy: LIKE không phân biệt hoa thường
        # `escape="\\"` là tham số cho ILIKE: ký tự escape
        active_stmt = active_stmt.where(
            or_(
                Ticket.ticket_code.ilike(pattern, escape="\\"),
                Event.title.ilike(pattern, escape="\\"),
                Show.title.ilike(pattern, escape="\\"),
            )
        )
        cancelled_stmt = cancelled_stmt.where(
            or_(
                TicketCancellation.ticket_code.ilike(pattern, escape="\\"),
                Event.title.ilike(pattern, escape="\\"),
                Show.title.ilike(pattern, escape="\\"),
            )
        )

    # ============================================================
    # Áp dụng bộ lọc THỜI GIAN (nếu có)
    # ============================================================
    if start_from:
        active_stmt = active_stmt.where(Show.start_at >= start_from)
        cancelled_stmt = cancelled_stmt.where(Show.start_at >= start_from)

    if end_to:
        active_stmt = active_stmt.where(Show.start_at <= end_to)
        cancelled_stmt = cancelled_stmt.where(Show.start_at <= end_to)

    # ============================================================
    # Thực thi query với LIMIT và OFFSET (phân trang)
    # ============================================================
    # `.limit()` là SQLAlchemy: giới hạn số dòng
    # `.offset()` là SQLAlchemy: bỏ qua N dòng đầu
    # `.all()` là SQLAlchemy: lấy tất cả kết quả
    active_rows = (await session.execute(active_stmt.limit(limit).offset(offset))).all()
    cancelled_rows = (await session.execute(cancelled_stmt.limit(limit).offset(offset))).all()

    # ============================================================
    # Chuẩn hóa dữ liệu ACTIVE thành response
    # ============================================================
    # List comprehension (Python built-in) với tuple unpacking
    active_tickets = [
        MyTicketResponse(  # Tự viết: Pydantic schema
            ticket_id=ticket.id,
            ticket_code=ticket.ticket_code,
            qr_payload=ticket.qr_payload,
            event_id=event.id,
            event_slug=event.slug,
            event_title=event.title,
            show_id=show.id,
            show_title=show.title,
            show_start_at=show.start_at,
            show_end_at=show.end_at,
            event_cover_image_url=event.cover_image_url,
            venue=show.venue,
            seat_label=seat.seat_label,
            # Ternary expression (Python): nếu zone có thì lấy name, không thì "Khu vực chung"
            zone_name=zone.name if zone else "Khu vực chung",
            price=Decimal(str(order_item.price)),
            order_id=order.id,
            seat_status=seat.status,
            ticket_status="active",  # Đánh dấu vé còn hiệu lực
            issued_at=ticket.issued_at,
        )
        # Tuple unpacking (Python): gán từng cột trong kết quả SQL vào biến
        for ticket, order, event, show, order_item, seat, zone in active_rows
    ]

    # ============================================================
    # Chuẩn hóa dữ liệu CANCELLED thành response
    # ============================================================
    cancelled_tickets = [
        MyTicketResponse(  # Tự viết: Pydantic schema
            cancellation_id=cancel.id,  # Vé đã hủy có cancellation_id
            ticket_code=cancel.ticket_code,
            qr_payload=None,            # Vé hủy không còn QR
            event_id=event.id,
            event_slug=event.slug,
            event_title=event.title,
            show_id=show.id,
            show_title=show.title,
            show_start_at=show.start_at,
            show_end_at=show.end_at,
            event_cover_image_url=event.cover_image_url,
            venue=show.venue,
            seat_label=seat.seat_label,
            zone_name=zone.name if zone else "Khu vực chung",
            price=Decimal(str(cancel.canceled_price)),  # Giá lúc hủy
            order_id=cancel.order_id,
            seat_status=seat.status,
            ticket_status="cancelled",   # Đánh dấu vé đã hủy
            canceled_at=cancel.canceled_at,
        )
        for cancel, event, show, seat, zone in cancelled_rows
    ]

    # ============================================================
    # Gộp và sắp xếp
    # ============================================================
    combined = active_tickets + cancelled_tickets  # Python list concatenation
    # `sorted()` là Python built-in: sắp xếp
    # `key=lambda` là Python: hàm ẩn danh để lấy giá trị so sánh
    # `or` là Python: lấy canceled_at, nếu None thì lấy issued_at, nếu None thì dùng timestamp 0
    # `datetime.fromtimestamp(0)` là Python: ngày 1/1/1970 (epoch)
    # `reverse=True`: mới nhất lên đầu
    return sorted(
        combined,
        key=lambda item: item.canceled_at or item.issued_at or datetime.fromtimestamp(0),
        reverse=True,
    )


async def cancel_ticket(session: AsyncSession, user_id: int, ticket_id: int) -> None:
    """Hủy một vé thuộc người dùng hiện tại và đưa ghế đã bán về kho ghế trống.

    Input:
    - `session`: SQLAlchemy AsyncSession
    - `user_id`: int - ID người dùng
    - `ticket_id`: int - ID vé cần hủy

    Output:
    - None; ném HTTPException nếu không tìm thấy vé
    """

    # SQLAlchemy query: JOIN 4 bảng, FOR UPDATE để khóa hàng
    row = (
        await session.execute(
            select(Ticket, OrderItem, Order, Seat)
            .join(OrderItem, Ticket.order_item_id == OrderItem.id)
            .join(Order, OrderItem.order_id == Order.id)
            .join(Seat, OrderItem.seat_id == Seat.id)
            .where(Ticket.id == ticket_id, Order.user_id == user_id)  # Phải là vé của user này
            .with_for_update()  # SQLAlchemy: khóa hàng
        )
    ).first()  # `.first()` là SQLAlchemy: lấy dòng đầu tiên hoặc None

    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy vé")

    # Tuple unpacking (Python): gán 4 object từ kết quả query
    ticket, order_item, order, seat = row
    
    canceled_at = datetime.now(UTC)  # Python built-in
    # Tạo payload cho WebSocket
    changed_seat = {
        "id": seat.id,
        "status": SeatStatus.AVAILABLE.value,
        "lock_expires_at": None,
        "locked_by_user_id": None,
    }

    try:
        # Đưa ghế về trạng thái AVAILABLE
        seat.status = SeatStatus.AVAILABLE
        seat.locked_by_user_id = None
        seat.lock_expires_at = None

        # Tạo bản ghi lịch sử hủy vé
        session.add(
            TicketCancellation(  # Tự viết: ORM model
                ticket_code=ticket.ticket_code,
                user_id=order.user_id,
                event_id=order.event_id,
                show_id=order.show_id,
                order_id=order.id,
                seat_id=seat.id,
                canceled_price=order_item.price,  # Giá lúc hủy
                canceled_at=canceled_at,
            )
        )

        # Xóa vé và dòng đơn hàng (soft delete bằng cách xóa hẳn + lưu lịch sử)
        await session.delete(ticket)       # SQLAlchemy: xóa object
        await session.delete(order_item)   # SQLAlchemy: xóa object
        await session.flush()              # SQLAlchemy: đẩy SQL nhưng chưa commit

        # Tính lại tổng tiền đơn hàng sau khi xóa
        # `func.coalesce()` là SQLAlchemy: COALESCE(NULL, 0) → nếu SUM NULL thì trả 0
        # `func.sum()` là SQLAlchemy: SUM()
        total_amount = await session.scalar(
            select(func.coalesce(func.sum(OrderItem.price), 0)).where(OrderItem.order_id == order.id)
        )
        updated_total = Decimal(str(total_amount or 0))
        order.total_amount = updated_total
        
        # Nếu đơn hàng không còn dòng nào → đánh dấu CANCELLED
        if updated_total <= Decimal("0"):
            order.status = OrderStatus.CANCELLED  # Enum tự viết

        await session.commit()  # SQLAlchemy: lưu tất cả
    except Exception:
        await session.rollback()  # SQLAlchemy: hoàn tác
        raise

    # Xóa cache và broadcast
    await public_api_cache.invalidate_namespace(user_ticket_cache_namespace(user_id))
    await seat_ws_manager.broadcast_seat_changes(show_id=seat.show_id or 0, payload=[changed_seat])
    await public_api_cache.invalidate_namespace(show_seat_cache_namespace(seat.show_id or 0))


async def release_expired_locks(session: AsyncSession) -> dict[int, list[dict[str, int | str | None]]]:
    """Job nền mở khóa các ghế đã vượt quá thời hạn giữ.
    
    Hàm này được worker gọi định kỳ mỗi 3 giây.

    Input:
    - `session`: SQLAlchemy AsyncSession

    Output:
    - Dictionary map show_id → danh sách payload WebSocket cho các ghế đã mở khóa
    """

    now = datetime.now(UTC)  # Python built-in
    
    # SQLAlchemy query: tìm tất cả ghế LOCKED đã hết hạn
    seats = list(
        await session.scalars(
            select(Seat)
            .where(
                Seat.show_id.is_not(None),              # Phải thuộc show nào đó
                Seat.status == SeatStatus.LOCKED,       # Đang bị khóa
                Seat.lock_expires_at.is_not(None),      # Có thời hạn (không phải khóa admin)
                Seat.lock_expires_at < now,             # ĐÃ QUÁ HẠN
            )
            .with_for_update()  # SQLAlchemy: khóa hàng
        )
    )

    if not seats:
        return {}  # Python built-in: dict rỗng

    # Dictionary (Python built-in): nhóm payload theo show_id
    show_payloads: dict[int, list[dict[str, int | str | None]]] = {}
    try:
        for seat in seats:
            # Đưa ghế về AVAILABLE
            seat.status = SeatStatus.AVAILABLE
            seat.locked_by_user_id = None
            seat.lock_expires_at = None
            
            # `.setdefault()` là Python dict method: lấy list nếu có, không có thì tạo list rỗng
            show_payloads.setdefault(seat.show_id or 0, []).append(
                {
                    "id": seat.id,
                    "status": SeatStatus.AVAILABLE.value,
                    "lock_expires_at": None,
                    "locked_by_user_id": None,
                }
            )
        await session.commit()  # SQLAlchemy: lưu tất cả
    except Exception:
        await session.rollback()  # SQLAlchemy: hoàn tác
        raise

    # Dictionary comprehension (Python): lọc bỏ show_id = 0
    return {show_id: payload for show_id, payload in show_payloads.items() if show_id}