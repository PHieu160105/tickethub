"""Nghiệp vụ sự kiện, buổi diễn và sinh ma trận ghế bán vé.

File này chứa các hàm dịch vụ xử lý:
1. Tạo, sửa, xóa sự kiện cha
2. Tạo buổi diễn kèm tồn kho ghế
3. Clone layout từ venue template sang show
4. Lấy danh sách sự kiện, buổi diễn
5. Sinh ma trận ghế cho giao diện người dùng hiển thị
"""

# ============================================================
# IMPORTS TỪ THƯ VIỆN CHUẨN PYTHON (có sẵn trong Python)
# ============================================================
from collections import defaultdict
#   defaultdict: Python có sẵn - từ điển tự động tạo giá trị mặc định khi key chưa tồn tại
#   vd: defaultdict(list) → khi truy cập key mới, tự tạo list rỗng thay vì báo lỗi KeyError

from datetime import UTC, date, datetime, time
#   datetime: mô-đun xử lý ngày giờ
#   UTC: hằng số múi giờ UTC+0
#   date: lớp chỉ lưu NGÀY (không có giờ)
#   datetime: lớp lưu NGÀY + GIỜ
#   time: lớp chỉ lưu GIỜ (không có ngày)

from decimal import Decimal
#   Decimal: Python có sẵn - số thập phân CHÍNH XÁC, dùng cho tiền tệ
#   Tránh sai số kiểu float (0.1 + 0.2 = 0.30000000000000004)

import re
#   re: Python có sẵn - mô-đun xử lý biểu thức chính quy
#   Dùng để tạo định danh URL từ tiêu đề (loại bỏ ký tự đặc biệt)

# ============================================================
# IMPORTS TỪ THƯ VIỆN BÊN NGOÀI (cài qua pip install)
# ============================================================
from fastapi import HTTPException, status
#   HTTPException: lớp của FastAPI để ném lỗi HTTP
#   status: mô-đun chứa hằng số mã trạng thái HTTP

from sqlalchemy import func, select
#   func: cầu nối gọi hàm SQL (COUNT, SUM, MAX, MIN, COALESCE, LOWER...)
#   select: hàm tạo câu lệnh SELECT

from sqlalchemy.ext.asyncio import AsyncSession
#   AsyncSession: lớp phiên làm việc BẤT ĐỒNG BỘ với cơ sở dữ liệu

# ============================================================
# IMPORTS TỪ NỘI BỘ DỰ ÁN (mã tự viết)
# ============================================================
from app.core.search import build_ilike_pattern, sanitize_search_query
#   build_ilike_pattern(): tự viết - tạo mẫu LIKE không phân biệt hoa thường
#   sanitize_search_query(): tự viết - làm sạch truy vấn tìm kiếm, giới hạn độ dài

from app.models.enums import SeatStatus
#   SeatStatus: enum tự viết - AVAILABLE, LOCKED, SOLD

from app.models.event import Event, SeatZone, Show, ShowPolygon
#   Event: ORM model - bảng events (sự kiện cha)
#   SeatZone: ORM model - bảng seat_zones (vùng ghế / hạng vé)
#   Show: ORM model - bảng shows (buổi diễn - đơn vị bán vé)
#   ShowPolygon: ORM model - bảng show_polygons (vùng vẽ tự do trên sơ đồ)

from app.models.order import Order, OrderItem, Ticket
#   Order: ORM model - bảng orders (đơn hàng)
#   OrderItem: ORM model - bảng order_items (dòng đơn hàng)
#   Ticket: ORM model - bảng tickets (vé)

from app.models.seat import Seat
#   Seat: ORM model - bảng seats (ghế cụ thể)

from app.models.user import User
#   User: ORM model - bảng users (người dùng)

from app.models.venue import Polygon, Section, Venue, VenueLayout
#   Polygon: ORM model - bảng polygons (vùng vẽ trong venue template)
#   Section: ORM model - bảng sections (khu vực trong venue template)
#   Venue: ORM model - bảng venues (địa điểm)
#   VenueLayout: ORM model - bảng venue_layouts (bố cục địa điểm)

from app.schemas.event import (
    EventCardResponse,          # lược đồ Pydantic: phản hồi thẻ sự kiện
    EventCreateRequest,         # lược đồ Pydantic: yêu cầu tạo sự kiện
    EventDetailResponse,        # lược đồ Pydantic: phản hồi chi tiết sự kiện
    SeatPurchaseInfoResponse,   # lược đồ Pydantic: thông tin người mua ghế
    SeatResponse,               # lược đồ Pydantic: phản hồi thông tin ghế
    SeatUserInfoResponse,       # lược đồ Pydantic: thông tin user
    SeatZoneCreate,             # lược đồ Pydantic: yêu cầu tạo vùng ghế
    SeatZoneUpdate,             # lược đồ Pydantic: yêu cầu cập nhật vùng ghế
    SeatZoneResponse,           # lược đồ Pydantic: phản hồi vùng ghế
    ShowCreateRequest,          # lược đồ Pydantic: yêu cầu tạo buổi diễn
    ShowSummaryResponse,        # lược đồ Pydantic: phản hồi tóm tắt buổi diễn
)


# ============================================================
# HÀM TIỆN ÍCH
# ============================================================

def slugify(text: str) -> str:
    """Sinh định danh URL thân thiện từ tiêu đề sự kiện.
    
    MỤC ĐÍCH: Chuyển tiêu đề tiếng Việt/có dấu thành chuỗi phù hợp URL.
    vd: "Nhạc kịch Lés Misérables" → "nhac-kich-les-miserables"
    
    Đầu vào:
        text: str - tiêu đề sự kiện cần chuyển đổi
        
    Đầu ra:
        str - định danh URL phù hợp, hoặc "event" nếu chuỗi rỗng
    """

    # re.sub(): Python có sẵn - thay thế pattern bằng chuỗi khác
    #   pattern r"[^a-zA-Z0-9]+": 1 hoặc nhiều ký tự KHÔNG phải chữ cái/số
    #   thay bằng dấu gạch ngang "-"
    value = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    #   .strip("-"): Python string method - xóa dấu "-" ở đầu và cuối chuỗi
    #   .lower(): Python string method - chuyển về chữ thường
    
    # Nếu sau khi xử lý chuỗi rỗng → trả về "event" làm giá trị dự phòng
    # Python: chuỗi rỗng "" là falsy → or "event" sẽ trả "event"
    return value or "event"


def row_label_from_index(index: int) -> str:
    """Đổi số thứ tự hàng dạng 1-based thành nhãn hàng kiểu bảng tính: A..Z, AA...
    
    MỤC ĐÍCH: Chuyển số hàng thành chữ cái như Excel.
    vd: 1 → A, 2 → B, 26 → Z, 27 → AA, 28 → AB...
    
    Đầu vào:
        index: int - số thứ tự hàng, bắt đầu từ 1
        
    Đầu ra:
        str - nhãn hàng dạng chữ cái
    """

    label = ""          # Python string: khởi tạo chuỗi rỗng
    value = index       # Python int: gán index vào value để xử lý
    
    # Vòng lặp while: xử lý từ phải sang trái (như chuyển đổi hệ cơ số 26)
    while value > 0:
        # divmod(): Python có sẵn - chia lấy nguyên và dư
        #   value - 1: vì hệ chữ cái bắt đầu từ A=0 (không phải A=1)
        #   remainder: 0-25, tương ứng A-Z
        value, remainder = divmod(value - 1, 26)
        
        # chr(): Python có sẵn - chuyển mã ASCII thành ký tự
        #   65 = 'A', 65 + remainder → 'A' đến 'Z'
        # Cộng vào BÊN TRÁI của label (vì xử lý từ phải sang trái)
        label = chr(65 + remainder) + label
    
    return label


def combine_show_datetime(show_date: date, show_time: time) -> datetime:
    """Ghép ngày diễn và giờ diễn thành `datetime` có múi giờ UTC.
    
    MỤC ĐÍCH: Frontend gửi ngày và giờ riêng biệt, cần ghép lại thành datetime
    để lưu vào database.
    
    Đầu vào:
        show_date: date - ngày diễn
        show_time: time - giờ diễn
        
    Đầu ra:
        datetime - đã ghép ngày + giờ + múi giờ UTC
    """

    # datetime.combine(): Python có sẵn method
    #   Ghép date và time thành datetime
    #   tzinfo=UTC: gắn múi giờ UTC
    return datetime.combine(show_date, show_time, tzinfo=UTC)


def _as_utc(value: datetime | None) -> datetime | None:
    """Chuẩn hóa datetime naive từ DB thành datetime có múi giờ UTC.
    
    MỤC ĐÍCH: Database có thể trả về datetime không có múi giờ.
    Hàm này gắn UTC vào để so sánh an toàn với các datetime khác.
    
    Đầu vào:
        value: datetime | None - thời gian từ database
        
    Đầu ra:
        datetime | None - đã có múi giờ UTC, hoặc None nếu đầu vào None
    """

    # None check: Python có sẵn
    if value is None:
        return None
    
    # value.tzinfo: thuộc tính của Python datetime
    #   None nếu datetime không có múi giờ (naive)
    #   Có giá trị nếu datetime có múi giờ (aware)
    # value.replace(tzinfo=UTC): tạo bản sao với múi giờ mới
    # UTC: hằng số từ datetime module
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def _event_range_to_datetimes(start_date: date, end_date: date) -> tuple[datetime, datetime]:
    """Tạo khoảng thời gian UTC đại diện cho ngày bắt đầu/kết thúc của sự kiện.
    
    MỤC ĐÍCH: Event lưu start_date và end_date (kiểu date).
    Khi cần trả về datetime cho giao diện người dùng, chuyển date thành datetime:
    - start_date → 00:00:00 UTC của ngày đó
    - end_date → 23:59:59 UTC của ngày đó
    
    Đầu vào:
        start_date: date - ngày bắt đầu
        end_date: date - ngày kết thúc
        
    Đầu ra:
        tuple[datetime, datetime] - (bắt đầu lúc 00:00, kết thúc lúc 23:59)
    """

    return (
        # datetime.combine(): Python có sẵn - ghép date và time
        # time.min: Python có sẵn - 00:00:00.000000 (đầu ngày)
        # tzinfo=UTC: gắn múi giờ UTC
        datetime.combine(start_date, time.min, tzinfo=UTC),
        # time.max: Python có sẵn - 23:59:59.999999 (cuối ngày)
        datetime.combine(end_date, time.max, tzinfo=UTC),
    )


def _build_zone_seats(event_id: int, show_id: int, zone: SeatZone, payload: SeatZoneCreate) -> list[Seat]:
    """Sinh toàn bộ model ghế theo cấu hình hàng/cột của một khu vực.
    
    MỤC ĐÍCH: Từ cấu hình zone (số hàng, số ghế mỗi hàng, mã code),
    tạo ra danh sách các Seat object tương ứng.
    
    vd: Zone VIP, row_count=3, seats_per_row=10, code="VIP"
    → Tạo 30 ghế: VIP-A1, VIP-A2... VIP-A10, VIP-B1... VIP-C10
    
    Đầu vào:
        event_id: int - ID sự kiện
        show_id: int - ID buổi diễn
        zone: SeatZone - đối tượng ORM vùng ghế đã tạo
        payload: SeatZoneCreate - dữ liệu cấu hình từ request
        
    Đầu ra:
        list[Seat] - danh sách ghế đã tạo
    """

    seat_models: list[Seat] = []  # Python list: khởi tạo danh sách rỗng
    
    # range(1, payload.row_count + 1): Python có sẵn
    #   Tạo dãy số từ 1 đến row_count (bao gồm)
    #   vd: row_count=3 → range(1, 4) → 1, 2, 3
    for row_index in range(1, payload.row_count + 1):
        # Gọi hàm tự viết: chuyển số hàng thành chữ cái (1→A, 2→B...)
        row_label = row_label_from_index(row_index)
        
        # range(1, payload.seats_per_row + 1): số ghế trong hàng
        for seat_number in range(1, payload.seats_per_row + 1):
            # Tạo nhãn ghế: "MÃ_CODE-CHỮ_HÀNG+SỐ_GHẾ"
            # vd: "VIP-A1", "VIP-A2"...
            # f-string Python: chèn biến vào chuỗi
            seat_label = f"{payload.code}-{row_label}{seat_number}"
            
            # Tạo Seat đối tượng ORM (tự viết trong app/models/seat.py)
            seat_models.append(
                Seat(
                    event_id=event_id,              # Thuộc event nào
                    show_id=show_id,                # Thuộc show nào
                    zone_id=zone.id,                # Thuộc zone nào
                    row_index=row_index,            # Số thứ tự hàng (1-based)
                    row_label=row_label,            # Nhãn hàng (A, B, C...)
                    seat_number=seat_number,        # Số ghế trong hàng
                    seat_label=seat_label,          # Nhãn đầy đủ (VIP-A1)
                    price=payload.price,            # Giá từ cấu hình zone
                    status=SeatStatus.AVAILABLE,    # Mặc định: còn trống
                    #   SeatStatus.AVAILABLE: enum tự viết
                )
            )
    
    return seat_models


def _build_positioned_zone_seats(
    event_id: int,
    show_id: int,
    zone: SeatZone,
    payload: SeatZoneCreate,
    *,
    start_x: float,      # Tham số keyword-only (sau dấu *): tọa độ X bắt đầu
    start_y: float,      # Tọa độ Y bắt đầu
    gap_x: float,        # Khoảng cách giữa các ghế theo trục X
    gap_y: float,        # Khoảng cách giữa các hàng theo trục Y
) -> list[Seat]:
    """Sinh lưới ghế có tọa độ rõ ràng để khởi tạo planner dạng tự do.
    
    MỤC ĐÍCH: Khác với _build_zone_seats, hàm này TÍNH TOÁN TỌA ĐỘ (x, y)
    cho từng ghế để hiển thị trên canvas sơ đồ tự do (free-form seatmap).
    
    Tọa độ tính theo phần trăm (%) của canvas, từ 0.0 đến 100.0.
    
    Đầu vào:
        event_id, show_id, zone, payload: giống _build_zone_seats
        start_x, start_y: tọa độ bắt đầu của ghế đầu tiên (góc trên trái)
        gap_x, gap_y: khoảng cách giữa các ghế/hàng
        
    Đầu ra:
        list[Seat] - danh sách ghế đã có tọa độ
    """

    seat_models: list[Seat] = []  # Python list: khởi tạo rỗng
    
    for row_index in range(1, payload.row_count + 1):
        row_label = row_label_from_index(row_index)  # Hàm tự viết
        
        for seat_number in range(1, payload.seats_per_row + 1):
            seat_label = f"{payload.code}-{row_label}{seat_number}"  # f-string Python
            
            seat_models.append(
                Seat(
                    event_id=event_id,
                    show_id=show_id,
                    zone_id=zone.id,
                    row_index=row_index,
                    row_label=row_label,
                    seat_number=seat_number,
                    seat_label=seat_label,
                    price=payload.price,
                    status=SeatStatus.AVAILABLE,  # Enum tự viết
                    # round(): Python có sẵn - làm tròn số thập phân
                    #   round(x, 2): làm tròn đến 2 chữ số thập phân
                    # Tính tọa độ X: start_x + (số thứ tự ghế - 1) * khoảng cách
                    #   seat_number=1 → X = start_x
                    #   seat_number=2 → X = start_x + gap_x
                    x_coord=round(start_x + (seat_number - 1) * gap_x, 2),
                    # Tính tọa độ Y: start_y + (số thứ tự hàng - 1) * khoảng cách
                    #   row_index=1 → Y = start_y
                    #   row_index=2 → Y = start_y + gap_y
                    y_coord=round(start_y + (row_index - 1) * gap_y, 2),
                    rotation=0.0,  # Mặc định không xoay
                )
            )
    
    return seat_models


def _build_zone_boundary_polygon(
    zone: SeatZone,
    seats: list[Seat],
    *,
    padding: float,                          # Khoảng cách mở rộng ra ngoài
    label: str | None = None,               # Nhãn hiển thị cho polygon
) -> ShowPolygon:
    """Tạo polygon chữ nhật bao quanh nhóm ghế vừa sinh của một khu vực.
    
    MỤC ĐÍCH: Sau khi sinh ghế có tọa độ, tạo một khung chữ nhật bao quanh
    để tô màu và hiển thị vùng ghế trên canvas.
    
    Polygon là hình chữ nhật được tính từ tọa độ min/max của tất cả ghế,
    cộng thêm padding ra ngoài.
    
    Đầu vào:
        zone: SeatZone - vùng ghế
        seats: list[Seat] - danh sách ghế đã sinh
        padding: float - khoảng mở rộng ra ngoài
        label: str | None - nhãn hiển thị
        
    Đầu ra:
        ShowPolygon - đối tượng ORM polygon bao vùng
    """

    # Kiểm tra danh sách ghế không được rỗng
    if not seats:
        # HTTPException: FastAPI class
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể tạo polygon bao vùng khi chưa có ghế"
        )

    # List comprehension (Python): lấy tất cả x_coord từ danh sách ghế
    #   Chỉ lấy những ghế có x_coord không None
    x_values = [float(seat.x_coord) for seat in seats if seat.x_coord is not None]
    # Tương tự cho y_coord
    y_values = [float(seat.y_coord) for seat in seats if seat.y_coord is not None]
    
    # Kiểm tra có ít nhất 1 tọa độ
    if not x_values or not y_values:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể tạo polygon bao vùng khi ghế chưa có tọa độ"
        )

    # min(), max(): Python có sẵn - tìm giá trị nhỏ nhất/lớn nhất
    # round(): Python có sẵn - làm tròn
    # max(0.0, ...): đảm bảo không âm (trong canvas 0-100%)
    left = max(0.0, round(min(x_values) - padding, 2))      # Cạnh trái
    top = max(0.0, round(min(y_values) - padding, 2))       # Cạnh trên
    # min(100.0, ...): đảm bảo không vượt quá canvas
    right = min(100.0, round(max(x_values) + padding, 2))    # Cạnh phải
    bottom = min(100.0, round(max(y_values) + padding, 2))   # Cạnh dưới
    
    # Tạo ShowPolygon đối tượng ORM (tự viết trong app/models/event.py)
    return ShowPolygon(
        show_id=zone.show_id or 0,  # zone.show_id có thể None → fallback 0
        zone_id=zone.id,
        label=label,
        # points: list các điểm tạo thành hình chữ nhật
        #   Theo thứ tự: góc trên-trái → góc trên-phải → góc dưới-phải → góc dưới-trái
        points=[
            {"x": left, "y": top},        # Python dict
            {"x": right, "y": top},
            {"x": right, "y": bottom},
            {"x": left, "y": bottom},
        ],
    )


# ============================================================
# HÀM TẠO SLUG DUY NHẤT
# ============================================================

async def build_unique_slug(session: AsyncSession, title: str) -> str:
    """Tạo slug duy nhất, tự thêm hậu tố số nếu tiêu đề bị trùng.
    
    MỤC ĐÍCH: Đảm bảo mỗi event có slug unique trong database.
    Nếu "nhac-kich" đã tồn tại → tạo "nhac-kich-2", "nhac-kich-3"...
    
    Đầu vào:
        session: AsyncSession - phiên database
        title: str - tiêu đề sự kiện
        
    Đầu ra:
        str - slug duy nhất
    """

    # Gọi hàm tự viết slugify() để tạo slug cơ bản
    base_slug = slugify(title)
    
    # SQLAlchemy: SELECT COUNT(id) FROM events WHERE slug = <base_slug>
    # func.count(Event.id): gọi hàm COUNT của SQL
    # session.scalar(): thực thi query, trả về giá trị đơn (số lượng)
    existing = await session.scalar(
        select(func.count(Event.id)).where(Event.slug == base_slug)
    )
    
    # Nếu chưa có ai dùng slug này → trả về luôn
    # Python: 0 là falsy → not 0 là True → vào if
    if existing == 0:
        return base_slug

    # Nếu đã tồn tại → thêm hậu tố số, bắt đầu từ 2
    suffix = 2  # Python int
    
    # Vòng lặp vô hạn đến khi tìm được slug chưa tồn tại
    while True:
        # f-string Python: tạo slug với hậu tố
        candidate = f"{base_slug}-{suffix}"
        
        # Kiểm tra candidate đã tồn tại chưa
        exists_candidate = await session.scalar(
            select(func.count(Event.id)).where(Event.slug == candidate)
        )
        
        # Nếu chưa tồn tại → trả về
        if exists_candidate == 0:
            return candidate
        
        # Tăng suffix và thử lại
        suffix += 1  # Python: suffix = suffix + 1


# ============================================================
# HÀM PHÂN GIẢI VENUE/LAYOUT
# ============================================================

async def _resolve_event_layout(
    session: AsyncSession,
    venue_id: int | None,           # Python: có thể None
    venue_layout_id: int | None,    # Python: có thể None
) -> tuple[Venue | None, VenueLayout | None]:
    """Lấy cặp địa điểm/bố cục và kiểm tra bố cục có thuộc đúng địa điểm không.
    
    MỤC ĐÍCH: Khi tạo show, admin có thể chọn venue_id và/hoặc venue_layout_id.
    Hàm này kiểm tra tính hợp lệ của cặp này:
    - Nếu chỉ có venue_id → trả về venue, layout=None
    - Nếu có venue_layout_id → kiểm tra layout thuộc venue nào
    - Nếu có cả 2 → kiểm tra layout có thuộc venue không
    
    Đầu vào:
        session: AsyncSession
        venue_id: int | None - ID địa điểm
        venue_layout_id: int | None - ID bố cục
        
    Đầu ra:
        tuple[Venue | None, VenueLayout | None] - cặp (venue, layout)
    """

    # Trường hợp 1: Không có layout_id
    if venue_layout_id is None:
        # Nếu cũng không có venue_id → trả về (None, None)
        if venue_id is None:
            return None, None
        
        # session.get(): SQLAlchemy - lấy object theo khóa chính
        #   Tương đương SELECT * FROM venues WHERE id = venue_id
        venue = await session.get(Venue, venue_id)
        if not venue:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy địa điểm"
            )
        return venue, None

    # Trường hợp 2: Có layout_id → lấy layout trước
    layout = await session.get(VenueLayout, venue_layout_id)
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy bố cục địa điểm"
        )
    
    # Nếu có cả venue_id → kiểm tra layout có thuộc venue này không
    # layout.venue_id: ForeignKey đến venues.id (tự viết trong model)
    if venue_id is not None and layout.venue_id != venue_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bố cục địa điểm không thuộc địa điểm đã chọn"
        )

    # Lấy venue từ layout.venue_id
    venue = await session.get(Venue, layout.venue_id)
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy địa điểm"
        )
    return venue, layout


# ============================================================
# HÀM TẠO EVENT
# ============================================================

async def create_event(
    session: AsyncSession,
    admin_id: int,                    # ID của admin tạo sự kiện
    payload: EventCreateRequest,      # lược đồ Pydantic tự viết: dữ liệu từ request
) -> Event:
    """Tạo sự kiện cha, chưa sinh tồn kho ghế bán vé.
    
    MỤC ĐÍCH: Tạo mới 1 Event. Event là "container" chứa các Show.
    Chưa tạo ghế ở bước này - ghế được tạo khi tạo Show.
    
    Đầu vào:
        session: AsyncSession
        admin_id: int - ID của admin đang thao tác
        payload: EventCreateRequest - dữ liệu sự kiện từ request
        
    Đầu ra:
        Event - đối tượng ORM đã tạo
    """

    # Kiểm tra ngày kết thúc phải >= ngày bắt đầu
    # payload.end_date, payload.start_date: kiểu date (Python có sẵn)
    if payload.end_date < payload.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ngày kết thúc phải cùng ngày hoặc sau ngày bắt đầu"
        )

    # Gọi hàm tự viết: chuyển date → datetime cho cột legacy
    start_at_legacy, end_at_legacy = _event_range_to_datetimes(
        payload.start_date, payload.end_date
    )

    # Tạo Event đối tượng ORM (tự viết trong app/models/event.py)
    event = Event(
        # await build_unique_slug(...): gọi hàm tự viết, tạo slug không trùng
        slug=await build_unique_slug(session, payload.title),
        title=payload.title,
        description=payload.description,
        category=payload.category,
        cover_image_url=payload.cover_image_url,
        start_date=payload.start_date,       # Kiểu date
        end_date=payload.end_date,           # Kiểu date
        status=payload.status,               # Enum tự viết: EventStatus
        created_by_user_id=admin_id,         # Ai tạo
        venue="",                            # Cột legacy, để trống
        start_at_legacy=start_at_legacy,     # Cột legacy
        end_at_legacy=end_at_legacy,         # Cột legacy
    )
    
    session.add(event)       # SQLAlchemy: thêm vào session (pending)
    await session.flush()    # SQLAlchemy: đẩy SQL INSERT xuống DB, lấy event.id
    return event


# ============================================================
# HÀM CLONE LAYOUT TỪ VENUE TEMPLATE SANG SHOW
# ============================================================

async def _clone_layout_inventory(
    session: AsyncSession,
    event: Event,          # Event cha
    show: Show,            # Show cần clone inventory
    layout: VenueLayout,   # Layout mẫu để clone
) -> None:
    """Clone section/ghế/polygon mẫu của venue layout thành tồn kho bán vé cho show.
    
    MỤC ĐÍCH: Khi tạo show từ venue layout template, copy toàn bộ:
    - Sections (khu vực) → SeatZones (vùng ghế bán vé)
    - Seats mẫu → Seats thật trong show
    - Polygons → ShowPolygons
    
    Đây là cơ chế "template inheritance": venue layout là bản mẫu,
    mỗi show clone ra 1 bản riêng để bán vé độc lập.
    
    Đầu vào:
        session: AsyncSession
        event: Event - sự kiện cha
        show: Show - buổi diễn cần clone
        layout: VenueLayout - layout mẫu
    """

    # ============================================================
    # BƯỚC 1: LẤY DỮ LIỆU TỪ VENUE LAYOUT TEMPLATE
    # ============================================================
    
    # Lấy danh sách sections (khu vực) của layout
    # Section: ORM model tự viết trong app/models/venue.py
    #   sort_order: thứ tự sắp xếp (ưu tiên)
    sections = list(
        await session.scalars(
            select(Section)
            .where(Section.venue_layout_id == layout.id)
            .order_by(Section.sort_order.asc(), Section.id.asc())  # Sắp xếp theo thứ tự
        )
    )
    
    # Lấy danh sách ghế mẫu (template seats) của layout
    #   Seat.show_id.is_(None): ghế mẫu KHÔNG thuộc show nào
    #   .nulls_last(): SQLAlchemy - NULL xếp cuối khi sắp xếp
    template_seats = list(
        await session.scalars(
            select(Seat)
            .where(
                Seat.venue_layout_id == layout.id,
                Seat.show_id.is_(None)  # Chỉ lấy ghế MẪU (chưa gán show)
            )
            .order_by(
                Seat.section_id.asc().nulls_last(),  # section_id NULL → xếp cuối
                Seat.seat_label.asc()                # Sắp theo nhãn ghế
            )
        )
    )
    
    # Lấy danh sách polygons mẫu
    template_polygons = list(
        await session.scalars(
            select(Polygon)
            .where(Polygon.venue_layout_id == layout.id)
            .order_by(Polygon.id.asc())
        )
    )

    # ============================================================
    # BƯỚC 2: TẠO SEAT ZONES TỪ SECTIONS
    # ============================================================
    
    # Dictionary Python: map section_id (template) → SeatZone (mới tạo trong show)
    #   dict[int | None, SeatZone]: key là section_id (có thể None), value là SeatZone
    zone_map: dict[int | None, SeatZone] = {}
    
    if sections:
        # Có sections → tạo SeatZone cho từng section
        for section in sections:
            zone = SeatZone(  # ORM model tự viết
                event_id=event.id,
                show_id=show.id,
                code=section.code,          # Mã khu vực (vd: "VIP")
                name=section.name,          # Tên khu vực (vd: "Khu VIP")
                row_count=1,                # Clone không cần row_count (ghế đã có sẵn)
                seats_per_row=1,
                price=section.price_base,   # Giá từ section template
                color=section.color,        # Màu từ section template
            )
            session.add(zone)         # SQLAlchemy: thêm vào session
            await session.flush()     # SQLAlchemy: INSERT để lấy zone.id
            zone_map[section.id] = zone  # Lưu vào map
            
    elif template_seats:
        # Có ghế mẫu nhưng không có sections → tạo 1 zone mặc định
        fallback_zone = SeatZone(
            event_id=event.id,
            show_id=show.id,
            code="GEN",                       # GEN = General
            name="Khu vực chung",
            row_count=1,
            seats_per_row=max(len(template_seats), 1),  # max() Python có sẵn
            price=Decimal("0"),              # Decimal: Python có sẵn - giá 0
            color="#024ddf",                 # Màu xanh mặc định
        )
        session.add(fallback_zone)
        await session.flush()
        zone_map[None] = fallback_zone  # Key None cho ghế không có section

    # ============================================================
    # BƯỚC 3: CLONE GHẾ TỪ TEMPLATE
    # ============================================================
    
    cloned_seats: list[Seat] = []
    for template_seat in template_seats:
        # Tìm zone tương ứng: ưu tiên zone theo section_id, fallback zone None
        # .get(): Python dict method - lấy value theo key, nếu không có trả None (hoặc default)
        zone = zone_map.get(template_seat.section_id) or zone_map.get(None)
        
        # Xác định giá: lấy từ zone (nếu có), không thì lấy từ template seat
        # float(): Python có sẵn - chuyển Decimal sang float
        price = float(zone.price) if zone else float(template_seat.price)
        
        cloned_seats.append(
            Seat(  # ORM model tự viết
                event_id=event.id,
                show_id=show.id,
                zone_id=zone.id if zone else None,
                row_index=template_seat.row_index,
                row_label=template_seat.row_label,
                seat_number=template_seat.seat_number,
                seat_label=template_seat.seat_label,
                price=price,
                # Nếu ghế mẫu bị admin khóa → clone sang cũng LOCKED
                #   Ngược lại → AVAILABLE
                # Ternary operator Python: <true> if <condition> else <false>
                status=SeatStatus.LOCKED if template_seat.is_admin_locked else SeatStatus.AVAILABLE,
                x_coord=template_seat.x_coord,          # Copy tọa độ
                y_coord=template_seat.y_coord,
                rotation=template_seat.rotation,        # Copy góc xoay
                section_id=template_seat.section_id,
                venue_layout_id=template_seat.venue_layout_id,
                is_admin_locked=template_seat.is_admin_locked,
            )
        )

    if cloned_seats:
        session.add_all(cloned_seats)  # SQLAlchemy: thêm nhiều object 1 lần
        await session.flush()

    # ============================================================
    # BƯỚC 4: CLONE POLYGONS TỪ TEMPLATE
    # ============================================================
    
    cloned_polygons: list[ShowPolygon] = []
    for template_polygon in template_polygons:
        # Tìm zone tương ứng cho polygon
        zone = zone_map.get(template_polygon.section_id) or zone_map.get(None)
        
        cloned_polygons.append(
            ShowPolygon(  # ORM model tự viết trong app/models/event.py
                show_id=show.id,
                zone_id=zone.id if zone else None,
                label=template_polygon.label,
                points=template_polygon.points,  # Copy nguyên points (JSON)
            )
        )

    if cloned_polygons:
        session.add_all(cloned_polygons)
        await session.flush()


# ============================================================
# HÀM TẠO SHOW + INVENTORY
# ============================================================

async def create_show_with_inventory(
    session: AsyncSession,
    event: Event,              # Event cha
    admin_id: int,             # Admin tạo show
    payload: ShowCreateRequest, # lược đồ Pydantic tự viết: dữ liệu tạo show
) -> Show:
    """Tạo một buổi diễn có thể bán vé và khởi tạo tồn kho ghế.
    
    MỤC ĐÍCH: Hàm chính tạo Show - đơn vị bán vé thực tế.
    Tùy vào cấu hình:
    - Nếu có venue_layout_id → clone từ template
    - Nếu có zones trong payload → tạo zone + sinh ghế từ cấu hình
    
    Đầu vào:
        session: AsyncSession
        event: Event - sự kiện cha
        admin_id: int - admin tạo show
        payload: ShowCreateRequest - dữ liệu từ request
        
    Đầu ra:
        Show - đối tượng ORM đã tạo
    """

    # Kiểm tra ngày diễn phải nằm trong khoảng ngày của event
    # payload.show_date: date - ngày diễn
    # event.start_date, event.end_date: date - khoảng ngày của event
    if payload.show_date < event.start_date or payload.show_date > event.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ngày diễn phải nằm trong khoảng ngày của sự kiện"
        )

    # Gọi hàm tự viết: ghép ngày + giờ thành datetime
    start_at = combine_show_datetime(payload.show_date, payload.start_time)
    end_at = combine_show_datetime(payload.show_date, payload.end_time)
    
    # Kiểm tra giờ kết thúc > giờ bắt đầu
    if end_at <= start_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Giờ kết thúc phải sau giờ bắt đầu"
        )

    # Gọi hàm tự viết: kiểm tra venue/layout hợp lệ
    venue, layout = await _resolve_event_layout(
        session, payload.venue_id, payload.venue_layout_id
    )

    # Tạo Show đối tượng ORM (tự viết trong app/models/event.py)
    show = Show(
        event_id=event.id,
        title=payload.title,
        description=payload.description,
        # Nếu payload.venue có giá trị → dùng; không → lấy từ venue.name; không có nữa → ""
        # Python or operator: lấy giá trị truthy đầu tiên
        venue=payload.venue if payload.venue else (venue.name if venue else ""),
        start_at=start_at,                               # Datetime UTC
        end_at=end_at,                                   # Datetime UTC
        status=payload.status,                           # Enum EventStatus
        hold_minutes=payload.hold_minutes,               # Số phút giữ ghế
        queue_enabled=payload.queue_enabled,             # Bật queue?
        queue_release_batch=payload.queue_release_batch, # Batch size
        max_active_queue_tokens=payload.max_active_queue_tokens,  # Max người vào
        created_by_user_id=admin_id,
        venue_id=venue.id if venue else None,            # FK đến venues
        venue_layout_id=layout.id if layout else None,   # FK đến venue_layouts
    )
    
    session.add(show)        # SQLAlchemy: thêm vào session
    await session.flush()    # SQLAlchemy: INSERT để lấy show.id

    # Nếu có layout → clone inventory từ template
    if layout:
        await _clone_layout_inventory(session, event, show, layout)
        return show

    # Nếu không có layout → tạo zone + sinh ghế từ payload.zones
    seat_models: list[Seat] = []
    for zone_payload in payload.zones:
        # Tạo SeatZone object
        zone = SeatZone(  # ORM model tự viết
            event_id=event.id,
            show_id=show.id,
            code=zone_payload.code,
            name=zone_payload.name,
            row_count=zone_payload.row_count,
            seats_per_row=zone_payload.seats_per_row,
            price=zone_payload.price,
            color=zone_payload.color,
        )
        session.add(zone)
        await session.flush()
        
        # Nếu zone_payload.generate_seats == True → sinh ghế tự động
        if zone_payload.generate_seats:
            # .extend(): Python list method - thêm nhiều phần tử vào list
            # Gọi hàm tự viết _build_zone_seats() để tạo ghế
            seat_models.extend(
                _build_zone_seats(event.id, show.id, zone, zone_payload)
            )

    # Thêm tất cả ghế vào session
    if seat_models:
        session.add_all(seat_models)
        await session.flush()
        
    return show


# ============================================================
# HÀM LIỆT KÊ SHOWS CỦA EVENT
# ============================================================

async def list_event_shows(
    session: AsyncSession,
    event_id: int,
    include_deleted: bool = False,  # Python bool: có lấy show đã xóa không
) -> list[Show]:
    """Liệt kê các buổi diễn con của một sự kiện.
    
    MỤC ĐÍCH: Lấy tất cả show thuộc 1 event, sắp xếp theo thời gian.
    
    Đầu vào:
        session: AsyncSession
        event_id: int - ID của event cha
        include_deleted: bool - có lấy show đã xóa mềm không
        
    Đầu ra:
        list[Show] - danh sách show
    """

    # SQLAlchemy: SELECT * FROM shows WHERE event_id = ?
    stmt = select(Show).where(Show.event_id == event_id)
    
    # Nếu không include_deleted → thêm điều kiện is_deleted = False
    if not include_deleted:
        stmt = stmt.where(Show.is_deleted.is_(False))  # .is_() SQLAlchemy: kiểm tra False
    
    # Sắp xếp theo thời gian bắt đầu, rồi đến ID
    stmt = stmt.order_by(Show.start_at.asc(), Show.id.asc())
    
    # list(): Python có sẵn - thực thi query và chuyển thành list
    return list(await session.scalars(stmt))


# ============================================================
# HÀM TẢI SHOWS CHO NHIỀU EVENT (tránh N+1 query)
# ============================================================

async def list_shows_for_event_ids(
    session: AsyncSession,
    event_ids: list[int],                     # Python list: danh sách ID events
    *,
    include_deleted: bool = False,
) -> dict[int, list[Show]]:
    """Tải hàng loạt buổi diễn của nhiều sự kiện để tránh truy vấn lặp N+1.
    
    MỤC ĐÍCH: Khi hiển thị danh sách events kèm shows, thay vì query từng event một
    (N+1 query problem), dùng 1 query duy nhất cho tất cả events rồi nhóm lại.
    
    Đầu vào:
        session: AsyncSession
        event_ids: list[int] - danh sách ID events
        include_deleted: bool
        
    Đầu ra:
        dict[int, list[Show]] - map event_id → danh sách show của event đó
    """

    # Nếu danh sách rỗng → trả về dict rỗng (tránh query vô ích)
    if not event_ids:
        return {}  # Python dict rỗng

    # SQLAlchemy: SELECT * FROM shows WHERE event_id IN (?, ?, ...)
    stmt = select(Show).where(Show.event_id.in_(event_ids))  # .in_() SQLAlchemy
    
    if not include_deleted:
        stmt = stmt.where(Show.is_deleted.is_(False))
    
    # Sắp xếp theo event_id → start_at → id
    stmt = stmt.order_by(Show.event_id.asc(), Show.start_at.asc(), Show.id.asc())

    # defaultdict(list): Python có sẵn
    #   Khi truy cập key chưa tồn tại → tự tạo list rỗng
    grouped: dict[int, list[Show]] = defaultdict(list)
    
    # Duyệt từng show, nhóm theo event_id
    for show in await session.scalars(stmt):
        grouped[show.event_id].append(show)  # Python list append
    
    return grouped


async def list_event_max_prices_for_event_ids(
    session: AsyncSession,
    event_ids: list[int],
) -> dict[int, float]:
    """Tổng hợp giá ghế lớn nhất của từng sự kiện từ bảng seats."""

    if not event_ids:
        return {}

    rows = (
        await session.execute(
            select(
                Seat.event_id,
                func.max(Seat.price).label("max_price"),
            )
            .where(Seat.event_id.in_(event_ids))
            .group_by(Seat.event_id)
        )
    ).all()

    return {int(row.event_id): float(row.max_price or 0) for row in rows if row.event_id is not None}


# ============================================================
# HÀM LẤY SHOW THEO ID
# ============================================================

async def get_show_by_id(
    session: AsyncSession,
    show_id: int,
    include_deleted: bool = False,
) -> Show:
    """Lấy buổi diễn theo ID số.
    
    Đầu vào:
        session: AsyncSession
        show_id: int - ID buổi diễn
        include_deleted: bool
        
    Đầu ra:
        Show - đối tượng ORM
        
    Raises:
        HTTPException 404 nếu không tìm thấy
    """

    stmt = select(Show).where(Show.id == show_id)
    if not include_deleted:
        stmt = stmt.where(Show.is_deleted.is_(False))
    
    show = await session.scalar(stmt)  # SQLAlchemy: trả về 1 object hoặc None
    if not show:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy buổi diễn"
        )
    return show


# ============================================================
# HÀM LIỆT KÊ ZONES CỦA SHOW
# ============================================================

async def list_show_zones(session: AsyncSession, show_id: int) -> list[SeatZone]:
    """Liệt kê toàn bộ khu vực ghế của một buổi diễn theo thứ tự ổn định.
    
    Đầu vào:
        session: AsyncSession
        show_id: int
        
    Đầu ra:
        list[SeatZone] - danh sách vùng ghế
    """

    return list(
        await session.scalars(
            select(SeatZone)
            .where(SeatZone.show_id == show_id)
            .order_by(SeatZone.id.asc())  # Sắp theo ID (thứ tự tạo)
        )
    )


# ============================================================
# HÀM TẠO SEAT ZONE
# ============================================================

async def create_show_zone(
    session: AsyncSession,
    show: Show,
    payload: SeatZoneCreate,  # lược đồ Pydantic tự viết
) -> SeatZone:
    """Tạo một khu vực ghế và tùy chọn sinh sẵn ghế cho khu vực đó.
    
    MỤC ĐÍCH: Admin thêm vùng ghế mới cho show (vd: thêm khu VIP).
    
    Đầu vào:
        session: AsyncSession
        show: Show - buổi diễn
        payload: SeatZoneCreate - dữ liệu vùng ghế
        
    Đầu ra:
        SeatZone - đối tượng ORM đã tạo
    """

    # Kiểm tra trùng mã code trong cùng show
    # func.lower(): SQLAlchemy - gọi hàm LOWER() của SQL (không phân biệt hoa thường)
    #   vd: "vip" và "VIP" → coi là trùng
    existing = await session.scalar(
        select(func.count(SeatZone.id)).where(
            SeatZone.show_id == show.id,
            func.lower(SeatZone.code) == payload.code.lower()
        )
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mã khu vực đã tồn tại trong buổi diễn này"
        )

    # Tạo SeatZone object
    zone = SeatZone(  # ORM model tự viết
        event_id=show.event_id,
        show_id=show.id,
        code=payload.code,
        name=payload.name,
        row_count=payload.row_count,
        seats_per_row=payload.seats_per_row,
        price=payload.price,
        color=payload.color,
    )
    session.add(zone)
    await session.flush()

    # Nếu yêu cầu sinh ghế tự động
    if payload.generate_seats:
        # Gọi hàm tự viết _build_zone_seats() để tạo danh sách ghế
        session.add_all(
            _build_zone_seats(show.event_id, show.id, zone, payload)
        )
        await session.flush()
        
    return zone


# ============================================================
# HÀM TẠO ZONE KHỞI TẠO CHO PLANNER TỰ DO
# ============================================================

async def create_initial_show_zone(
    session: AsyncSession,
    show: Show,
    payload: SeatZoneCreate,
) -> SeatZone:
    """Tạo khu vực khởi tạo cho planner tự do, gồm ghế mẫu và polygon bao vùng.
    
    MỤC ĐÍCH: Khi tạo show free-form (không dùng venue layout template),
    tạo zone đầu tiên với ghế có TỌA ĐỘ sẵn để admin dễ chỉnh sửa.
    
    Đầu vào:
        session: AsyncSession
        show: Show
        payload: SeatZoneCreate
        
    Đầu ra:
        SeatZone - đã tạo kèm ghế và polygon
    """

    # Chỉ dùng cho show KHÔNG có venue layout (free-form)
    if show.venue_layout_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Khu vực khởi tạo chỉ dùng cho buổi diễn thiết kế tự do"
        )

    # Các tham số tọa độ (Python float)
    start_x = 20.0   # Bắt đầu từ 20% canvas
    start_y = 20.0   # Bắt đầu từ 20% canvas
    gap_x = 3.0      # Khoảng cách ghế 3%
    gap_y = 3.0      # Khoảng cách hàng 3%
    padding = 1.0    # Padding cho polygon bao

    # Kiểm tra không vượt quá canvas (100%)
    max_x = start_x + (payload.seats_per_row - 1) * gap_x
    max_y = start_y + (payload.row_count - 1) * gap_y
    if max_x + padding > 100.0 or max_y + padding > 100.0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Khu vực khởi tạo vượt khỏi canvas với số hàng và số ghế mỗi hàng hiện tại"
        )

    # Tạo zone trước (không sinh ghế vội)
    # **payload.model_dump(): Python unpacking - giải nén payload thành kwargs
    #   generate_seats=False: tắt sinh ghế ở bước này
    zone = await create_show_zone(
        session, show,
        SeatZoneCreate(**payload.model_dump(), generate_seats=False)
    )
    
    # Gọi hàm tự viết: sinh ghế CÓ TỌA ĐỘ
    seats = _build_positioned_zone_seats(
        show.event_id, show.id, zone, payload,
        start_x=start_x, start_y=start_y,
        gap_x=gap_x, gap_y=gap_y,
    )
    
    if seats:
        session.add_all(seats)
        await session.flush()
        
        # Gọi hàm tự viết: tạo polygon bao vùng
        session.add(
            _build_zone_boundary_polygon(
                zone, seats,
                padding=padding,
                label=zone.name,
            )
        )
        await session.flush()
        
    return zone


# ============================================================
# HÀM CẬP NHẬT SEAT ZONE
# ============================================================

async def update_show_zone(
    session: AsyncSession,
    show: Show,
    zone_id: int,
    payload: SeatZoneUpdate,  # lược đồ Pydantic tự viết
) -> SeatZone:
    """Cập nhật khu vực ghế và tùy chọn sinh lại ghế nếu chưa có ghế bị giữ/bán.
    
    MỤC ĐÍCH: Admin sửa cấu hình zone (giá, màu, số hàng...).
    Nếu yêu cầu regenerate_seats → xóa ghế cũ, sinh lại.
    Nhưng CHỈ làm được nếu chưa có ghế nào SOLD hoặc LOCKED trong zone.
    
    Đầu vào:
        session: AsyncSession
        show: Show
        zone_id: int
        payload: SeatZoneUpdate
        
    Đầu ra:
        SeatZone - đã cập nhật
    """

    # Tìm zone, đảm bảo thuộc show này
    zone = await session.scalar(
        select(SeatZone).where(
            SeatZone.id == zone_id,
            SeatZone.show_id == show.id,
        )
    )
    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy khu vực ghế"
        )

    # Kiểm tra trùng mã code (loại trừ chính zone này)
    duplicate = await session.scalar(
        select(func.count(SeatZone.id)).where(
            SeatZone.show_id == show.id,
            SeatZone.id != zone.id,  # Không tính chính nó
            func.lower(SeatZone.code) == payload.code.lower(),
        )
    )
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mã khu vực đã tồn tại trong buổi diễn này"
        )

    # Cập nhật các trường cơ bản
    zone.code = payload.code
    zone.name = payload.name
    zone.row_count = payload.row_count
    zone.seats_per_row = payload.seats_per_row
    zone.price = payload.price
    zone.color = payload.color

    # Nếu không yêu cầu sinh lại ghế → trả về luôn
    if not payload.regenerate_seats:
        return zone

    # Kiểm tra có ghế nào đã bán hoặc đang giữ không
    # SeatStatus.SOLD, SeatStatus.LOCKED: enum tự viết
    blocked = await session.scalar(
        select(func.count(Seat.id)).where(
            Seat.zone_id == zone.id,
            Seat.status.in_([SeatStatus.SOLD, SeatStatus.LOCKED]),
        )
    )
    if blocked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể cập nhật khu vực khi đã có ghế bán hoặc đang giữ"
        )

    # Xóa ghế cũ
    existing_seats = list(
        await session.scalars(select(Seat).where(Seat.zone_id == zone.id))
    )
    for seat in existing_seats:
        await session.delete(seat)  # SQLAlchemy: xóa object
    await session.flush()

    # Sinh lại ghế mới
    # payload.model_dump(exclude={"regenerate_seats"}): bỏ field regenerate_seats
    session.add_all(
        _build_zone_seats(
            show.event_id, show.id, zone,
            SeatZoneCreate(
                **payload.model_dump(exclude={"regenerate_seats"}),
                generate_seats=True
            ),
        )
    )
    await session.flush()
    return zone


# ============================================================
# HÀM XÓA SEAT ZONE
# ============================================================

async def delete_show_zone(
    session: AsyncSession,
    show: Show,
    zone_id: int,
) -> None:
    """Xóa khu vực nếu khu vực chưa có ghế đã bán hoặc đang giữ.
    
    Đầu vào:
        session: AsyncSession
        show: Show
        zone_id: int
    """

    # Tìm zone thuộc show
    zone = await session.scalar(
        select(SeatZone).where(
            SeatZone.id == zone_id,
            SeatZone.show_id == show.id,
        )
    )
    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy khu vực ghế"
        )

    # Kiểm tra có ghế đã bán/đang giữ không
    blocked = await session.scalar(
        select(func.count(Seat.id)).where(
            Seat.zone_id == zone.id,
            Seat.status.in_([SeatStatus.SOLD, SeatStatus.LOCKED]),
        )
    )
    if blocked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể xóa khu vực khi đã có ghế bán hoặc đang giữ"
        )

    await session.delete(zone)  # SQLAlchemy: xóa zone
    await session.flush()


# ============================================================
# HÀM LIỆT KÊ EVENTS PUBLIC
# ============================================================

async def list_live_events(
    session: AsyncSession,
    search: str | None,           # Python: từ khóa tìm kiếm (có thể None)
    category: str | None,         # Python: lọc theo thể loại (có thể None)
    start_from: datetime | None,  # Python: lọc từ ngày (có thể None)
    end_to: datetime | None,      # Python: lọc đến ngày (có thể None)
    limit: int = 30,              # Python int: số lượng tối đa
    offset: int = 0,              # Python int: vị trí bắt đầu (phân trang)
) -> list[Event]:
    """Trả danh sách sự kiện public kèm bộ lọc tìm kiếm/thể loại/thời gian.
    
    MỤC ĐÍCH: API public GET /api/events - liệt kê sự kiện cho khách xem.
    
    Đầu vào:
        session: AsyncSession
        search: str | None - từ khóa tìm kiếm trong tiêu đề
        category: str | None - lọc theo thể loại
        start_from: datetime | None - lọc từ thời điểm này
        end_to: datetime | None - lọc đến thời điểm này
        limit: int - giới hạn số lượng
        offset: int - vị trí bắt đầu
        
    Đầu ra:
        list[Event] - danh sách events
    """

    # SQLAlchemy: SELECT * FROM events WHERE is_deleted = FALSE
    stmt = select(Event).where(Event.is_deleted.is_(False))
    stmt = stmt.order_by(Event.start_date.asc(), Event.id.asc())

    # Áp dụng bộ lọc tìm kiếm (nếu có)
    # build_ilike_pattern(): hàm tự viết - tạo pattern LIKE
    pattern = build_ilike_pattern(search)
    if pattern:
        # .ilike(): SQLAlchemy - LIKE không phân biệt hoa thường
        #   escape="\\": ký tự escape cho LIKE
        stmt = stmt.where(Event.title.ilike(pattern, escape="\\"))

    # Áp dụng bộ lọc thể loại (nếu có)
    if category:
        # sanitize_search_query(): hàm tự viết - làm sạch query
        normalized_category = sanitize_search_query(category, max_length=80)
        if normalized_category:
            stmt = stmt.where(Event.category.ilike(normalized_category))

    # Áp dụng bộ lọc thời gian (nếu có)
    if start_from:
        # .date(): Python datetime method - lấy phần date
        stmt = stmt.where(Event.start_date >= start_from.date())

    if end_to:
        stmt = stmt.where(Event.start_date <= end_to.date())

    # Phân trang: LIMIT và OFFSET
    stmt = stmt.limit(limit).offset(offset)  # SQLAlchemy
    
    return list(await session.scalars(stmt))


# ============================================================
# HÀM LẤY EVENT THEO SLUG HOẶC ID
# ============================================================

async def get_event_by_slug_or_id(
    session: AsyncSession,
    slug_or_id: str,              # Python string: slug hoặc ID dạng chuỗi
    include_deleted: bool = False,
) -> Event:
    """Lấy sự kiện bằng slug trên URL hoặc ID số.
    
    MỤC ĐÍCH: API có thể nhận slug (chuỗi) hoặc ID (số).
    Hàm này tự phân biệt: nếu là số → tìm theo ID; nếu là chữ → tìm theo slug.
    
    Đầu vào:
        session: AsyncSession
        slug_or_id: str - "nhac-kich" hoặc "42"
        include_deleted: bool
        
    Đầu ra:
        Event - đối tượng ORM
        
    Raises:
        HTTPException 404 nếu không tìm thấy
    """

    # .isdigit(): Python string method - kiểm tra chuỗi toàn số không
    #   "42".isdigit() → True
    #   "nhac-kich".isdigit() → False
    if slug_or_id.isdigit():
        # int(): Python có sẵn - chuyển chuỗi thành số
        stmt = select(Event).where(Event.id == int(slug_or_id))
    else:
        stmt = select(Event).where(Event.slug == slug_or_id)

    if not include_deleted:
        stmt = stmt.where(Event.is_deleted.is_(False))

    event = await session.scalar(stmt)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy sự kiện"
        )
    return event


# ============================================================
# HÀM BUILD RESPONSE (chuyển ORM → lược đồ Pydantic)
# ============================================================

async def build_show_summary_response(show: Show) -> ShowSummaryResponse:
    """Chuyển một buổi diễn sang schema response ngắn gọn.
    
    MỤC ĐÍCH: Chuyển đối tượng ORM → lược đồ Pydantic để trả JSON cho client.
    
    Đầu vào:
        show: Show - đối tượng ORM
        
    Đầu ra:
        ShowSummaryResponse - lược đồ Pydantic
    """

    # .model_validate(): Pydantic method - tự động map các field trùng tên
    return ShowSummaryResponse.model_validate(show)


async def build_event_card_response(
    session: AsyncSession,
    event: Event,
    shows: list[Show] | None = None,  # Python: có thể None (sẽ tự load)
    max_price: float | None = None,
) -> EventCardResponse:
    """Dựng payload thẻ sự kiện, có bổ sung thông tin từ các buổi diễn con.
    
    MỤC ĐÍCH: Tạo response cho màn hình danh sách events.
    Mỗi event card hiển thị: tên, ảnh, địa điểm, có queue không...
    
    Đầu vào:
        session: AsyncSession
        event: Event
        shows: list[Show] | None - nếu None thì tự load từ DB
        
    Đầu ra:
        EventCardResponse - lược đồ Pydantic
    """

    # Nếu không truyền shows → tự load
    if shows is None:
        shows = await list_event_shows(session, event.id)  # Hàm tự viết

    if max_price is None:
        max_price = float(
            (
                await session.scalar(
                    select(func.max(Seat.price)).where(Seat.event_id == event.id)
                )
            )
            or 0
        )

    # Gọi hàm tự viết: chuyển date → datetime cho response
    start_at, end_at = _event_range_to_datetimes(event.start_date, event.end_date)

    # Lấy danh sách venue từ các show (chỉ lấy show có venue)
    # List comprehension Python: [show.venue for show in shows if show.venue]
    distinct_venues = [show.venue for show in shows if show.venue]
    
    # Xác định venue_summary
    if not distinct_venues:
        venue_summary = event.venue or "Chưa cập nhật"  # Python or operator
    elif len(set(distinct_venues)) == 1:
        # set(): Python có sẵn - loại bỏ trùng lặp
        # Nếu tất cả show cùng 1 venue → hiển thị tên venue đó
        venue_summary = distinct_venues[0]
    else:
        venue_summary = "Nhiều địa điểm"

    # Tạo Pydantic response
    return EventCardResponse(
        id=event.id,
        slug=event.slug,
        title=event.title,
        description=event.description,
        category=event.category,
        venue=venue_summary,
        start_at=start_at,
        end_at=end_at,
        cover_image_url=event.cover_image_url,
        status=event.status,
        created_at=event.created_at,
        # any(): Python có sẵn - kiểm tra có ít nhất 1 show bật queue
        queue_enabled=any(show.queue_enabled for show in shows),
        max_price=max_price,
    )


async def build_event_detail_response(
    session: AsyncSession,
    event: Event,
) -> EventDetailResponse:
    """Dựng payload chi tiết sự kiện kèm danh sách buổi diễn.
    
    MỤC ĐÍCH: Tạo response cho màn hình chi tiết event (có danh sách shows).
    
    Đầu vào:
        session: AsyncSession
        event: Event
        
    Đầu ra:
        EventDetailResponse - lược đồ Pydantic
    """

    # Load danh sách shows của event
    shows = await list_event_shows(session, event.id)
    
    # Tạo card response trước
    card = await build_event_card_response(session, event, shows=shows)
    
    # **card.model_dump(): Python unpacking - giải nén toàn bộ field của card
    #   vào EventDetailResponse, rồi thêm field shows
    # List comprehension: chuyển mỗi show → ShowSummaryResponse
    return EventDetailResponse(
        **card.model_dump(),
        shows=[await build_show_summary_response(show) for show in shows],
    )


async def build_show_detail_response(
    session: AsyncSession,
    show: Show,
) -> dict[str, object]:
    """Dựng payload chi tiết một buổi diễn cho FE/admin.
    
    MỤC ĐÍCH: Tạo response chi tiết show (có zones, thông tin event cha).
    
    Đầu vào:
        session: AsyncSession
        show: Show
        
    Đầu ra:
        dict - dictionary chứa thông tin chi tiết show
    """

    # Lấy event cha
    event = await session.get(Event, show.event_id)
    
    # Gọi hàm tự viết: lấy danh sách zones
    zones, _ = await get_show_seat_matrix(session, show.id)
    
    # Python dict: tạo response thủ công
    return {
        "id": show.id,
        "event_id": show.event_id,
        "title": show.title,
        "description": show.description,
        "venue": show.venue,
        "start_at": show.start_at,
        "end_at": show.end_at,
        "status": show.status,
        "queue_enabled": show.queue_enabled,
        "venue_id": show.venue_id,
        "venue_layout_id": show.venue_layout_id,
        # Python or: nếu event None → dùng giá trị rỗng
        "event_slug": event.slug if event else "",
        "event_title": event.title if event else "",
        "hold_minutes": show.hold_minutes,
        "queue_release_batch": show.queue_release_batch,
        "max_active_queue_tokens": show.max_active_queue_tokens,
        "zones": zones,
    }


# ============================================================
# HÀM LẤY MA TRẬN GHẾ (SEAT MATRIX)
# ============================================================

async def get_show_seat_matrix(
    session: AsyncSession,
    show_id: int,
    current_user_id: int | None = None,        # Python: user đang xem (None = guest)
    include_user_details: bool = False,         # Python: có lấy thông tin user không
) -> tuple[list[SeatZoneResponse], list[SeatResponse]]:
    """Lấy ma trận ghế của một buổi diễn kèm thông tin sở hữu lock nếu cần.

    MỤC ĐÍCH: API chính để giao diện người dùng hiển thị sơ đồ ghế.
    Trả về danh sách zones + danh sách ghế với đầy đủ trạng thái.
    
    Đầu vào:
    - `show_id`: buổi diễn cần xem.
    - `current_user_id`: user đang xem, có thể rỗng cho guest.
    - `include_user_details`: bật khi admin cần xem người giữ/người mua ghế.

    Đầu ra:
    - Danh sách khu vực và danh sách ghế đã chuẩn hóa trạng thái.

    Cách hoạt động:
    - Ghế lock hết hạn được trả về trạng thái còn trống ở payload.
    - Guest luôn nhận `is_locked_by_me=False`.
    - Admin có thể nhận thông tin người giữ và người mua để inspect ghế.
    """

    # ============================================================
    # BƯỚC 1: LẤY DANH SÁCH ZONES VÀ SEATS
    # ============================================================
    zones = list(
        await session.scalars(
            select(SeatZone)
            .where(SeatZone.show_id == show_id)
            .order_by(SeatZone.id.asc())
        )
    )
    
    seats = list(
        await session.scalars(
            select(Seat)
            .where(Seat.show_id == show_id)
            .order_by(Seat.zone_id, Seat.row_index, Seat.seat_number)
        )
    )

    now = datetime.now(UTC)  # Python có sẵn: thời gian hiện tại
    
    # Chuyển zones thành lược đồ phản hồi
    # .model_validate(): Pydantic method
    zone_responses = [SeatZoneResponse.model_validate(zone) for zone in zones]
    seat_responses: list[SeatResponse] = []

    # ============================================================
    # BƯỚC 2: LẤY THÔNG TIN USER (NẾU CẦN - ADMIN MODE)
    # ============================================================
    locked_user_map: dict[int, SeatUserInfoResponse] = {}
    sold_user_map: dict[int, SeatPurchaseInfoResponse] = {}

    if include_user_details and seats:
        # Lấy danh sách user_id đang giữ ghế
        # Set comprehension Python: tập hợp các locked_by_user_id không None
        locked_user_ids = {
            seat.locked_by_user_id
            for seat in seats
            if seat.locked_by_user_id is not None
        }
        
        if locked_user_ids:
            # SQLAlchemy: lấy thông tin user đang giữ ghế
            user_rows = (
                await session.execute(
                    select(
                        User.id, User.full_name, User.email,
                        User.gender, User.age
                    ).where(User.id.in_(locked_user_ids))
                )
            ).all()
            
            # Dict comprehension Python: tạo map user_id → UserInfo
            locked_user_map = {
                row.id: SeatUserInfoResponse(
                    user_id=row.id,
                    full_name=row.full_name,
                    email=row.email,
                    gender=row.gender,
                    age=row.age,
                )
                for row in user_rows
            }

        # Lấy danh sách seat_id để tìm người mua
        seat_ids = [seat.id for seat in seats]  # List comprehension Python
        
        # SQLAlchemy: JOIN orders + users + tickets để lấy thông tin người mua
        sold_rows = (
            await session.execute(
                select(
                    OrderItem.seat_id,
                    Order.id.label("order_id"),  # .label(): SQLAlchemy - đặt alias
                    User.id.label("user_id"),
                    User.full_name,
                    User.email,
                    User.gender,
                    User.age,
                    Ticket.ticket_code,
                    Ticket.issued_at,
                )
                .join(Order, OrderItem.order_id == Order.id)
                .join(User, Order.user_id == User.id)
                .outerjoin(Ticket, Ticket.order_item_id == OrderItem.id)
                #   outerjoin: LEFT JOIN - có thể chưa có ticket
                .where(OrderItem.seat_id.in_(seat_ids))
            )
        ).all()

        # Dict comprehension: map seat_id → PurchaseInfo
        sold_user_map = {
            row.seat_id: SeatPurchaseInfoResponse(
                user=SeatUserInfoResponse(
                    user_id=row.user_id,
                    full_name=row.full_name,
                    email=row.email,
                    gender=row.gender,
                    age=row.age,
                ),
                order_id=row.order_id,
                ticket_code=row.ticket_code,
                issued_at=_as_utc(row.issued_at),  # Hàm tự viết: chuẩn hóa múi giờ
            )
            for row in sold_rows
        }

    # ============================================================
    # BƯỚC 3: CHUẨN HÓA TRẠNG THÁI TỪNG GHẾ
    # ============================================================
    for seat in seats:
        # Xác định trạng thái hiển thị:
        # - Nếu admin_locked và chưa SOLD → hiển thị LOCKED
        # - Ngược lại → giữ nguyên trạng thái gốc
        # Ternary operator Python
        normalized_status = (
            SeatStatus.LOCKED
            if seat.is_admin_locked and seat.status != SeatStatus.SOLD
            else seat.status
        )
        
        # Chuẩn hóa lock_expires_at
        lock_expires = _as_utc(seat.lock_expires_at)  # Hàm tự viết
        
        # Nếu ghế LOCKED nhưng đã hết hạn → hiển thị AVAILABLE
        if seat.status == SeatStatus.LOCKED and lock_expires and lock_expires < now:
            normalized_status = SeatStatus.AVAILABLE  # Enum tự viết

        # Lấy thông tin người giữ (nếu có và admin mode)
        locked_by_user = None
        if (
            include_user_details
            and normalized_status == SeatStatus.LOCKED
            and seat.locked_by_user_id is not None
        ):
            # .get(): Python dict method - lấy value theo key
            locked_by_user = locked_user_map.get(seat.locked_by_user_id)

        # Lấy thông tin người mua (nếu có và admin mode)
        sold_to_user = (
            sold_user_map.get(seat.id)
            if include_user_details and seat.status == SeatStatus.SOLD
            else None
        )

        # Tạo SeatResponse object
        seat_responses.append(
            SeatResponse(  # lược đồ Pydantic tự viết
                id=seat.id,
                zone_id=seat.zone_id,
                row_index=seat.row_index,
                row_label=seat.row_label,
                seat_number=seat.seat_number,
                seat_label=seat.seat_label,
                price=Decimal(str(seat.price)),  # Decimal Python có sẵn
                status=normalized_status,
                lock_expires_at=lock_expires,
                # Chỉ True nếu user đang đăng nhập VÀ là người giữ ghế này
                is_locked_by_me=(
                    current_user_id is not None
                    and seat.locked_by_user_id == current_user_id
                ),
                is_admin_locked=seat.is_admin_locked,
                locked_by_user=locked_by_user,    # None hoặc UserInfo (admin mode)
                sold_to_user=sold_to_user,        # None hoặc PurchaseInfo (admin mode)
            )
        )

    return zone_responses, seat_responses
