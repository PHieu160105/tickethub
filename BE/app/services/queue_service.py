"""Thuật toán hàng đợi ảo và kiểm soát quyền vào luồng đặt vé.

File này chứa toàn bộ logic quản lý phòng chờ ảo (virtual waiting room).
Khi một show có quá nhiều người truy cập cùng lúc, hệ thống sẽ:
1. Xếp người dùng vào hàng đợi WAITING
2. Cấp lượt ADMITTED theo batch (mỗi đợt 50 người, mỗi 3 giây)
3. Người được ADMITTED có 15 phút để chọn ghế và thanh toán
4. Hết 15 phút không mua → EXPIRED, trả slot cho người khác
"""

# ============================================================
# IMPORTS TỪ THƯ VIỆN CHUẨN PYTHON (built-in - có sẵn trong Python)
# ============================================================
from datetime import timezone, datetime, timedelta
#   datetime  : module xử lý ngày giờ của Python
#   timezone.utc       : hằng số đại diện múi giờ timezone.utc+0 (Python 3.11+)
#               Dùng để gắn timezone cho datetime, tránh lỗi so sánh
#   timedelta : class biểu diễn KHOẢNG THỜI GIAN
#               vd: timedelta(minutes=15) = 15 phút
#                   timedelta(hours=24)   = 24 giờ

from uuid import uuid4
#   uuid4()   : hàm sinh chuỗi UUID ngẫu nhiên phiên bản 4
#               Mỗi lần gọi cho ra chuỗi KHÁC NHAU, đảm bảo unique toàn cầu
#               Dùng để tạo token hàng đợi - mỗi user một token duy nhất
#               vd: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

# ============================================================
# IMPORTS TỪ THƯ VIỆN BÊN NGOÀI (cài qua pip install)
# ============================================================
from fastapi import HTTPException, status
from redis.exceptions import RedisError
#   HTTPException : class của FastAPI để ném lỗi HTTP
#                   Dùng khi muốn trả về lỗi cho client (400, 403, 404, 429...)
#   status        : module chứa hằng số mã trạng thái HTTP
#                   vd: status.HTTP_404_NOT_FOUND = 404
#                       status.HTTP_429_TOO_MANY_REQUESTS = 429

from sqlalchemy import case, delete, func, select, text, update
#   case   : hàm tạo biểu thức CASE WHEN trong SQL
#            vd: case((condition, value), else_=fallback)
#   delete : hàm tạo câu lệnh DELETE trong SQL
#            vd: delete(QueueEntry) → DELETE FROM queue_entries
#   func   : cầu nối gọi các hàm SQL của database
#            vd: func.count() → COUNT()
#                func.sum()   → SUM()
#                func.coalesce() → COALESCE()
#   select : hàm tạo câu lệnh SELECT trong SQL
#            vd: select(QueueEntry) → SELECT * FROM queue_entries
#   update : hàm tạo câu lệnh UPDATE trong SQL
#            vd: update(QueueEntry) → UPDATE queue_entries

from sqlalchemy.ext.asyncio import AsyncSession
#   AsyncSession : class phiên làm việc BẤT ĐỒNG BỘ với database
#                  Mọi thao tác với database qua AsyncSession đều cần await
#                  vd: await session.execute(...)
#                      await session.scalar(...)
#                      await session.commit()

# ============================================================
# IMPORTS TỪ NỘI BỘ DỰ ÁN (code tự viết trong project TicketRush)
# ============================================================
from app.core.config import get_settings
from app.core.redis_client import get_redis_client
#   get_settings() : hàm tự viết trong app/core/config.py
#                    Trả về object Settings chứa mọi cấu hình của app
#                    Đã được cache bằng @lru_cache nên gọi nhiều lần không tốn chi phí
#                    Trong file này dùng để lấy:
#                    - settings.queue_admit_ttl_minutes (thời gian sống token ADMITTED, default=15)

from app.models.enums import EventStatus, QueueStatus
#   EventStatus : enum tự viết trong app/models/enums.py
#                 Các giá trị: DRAFT, LIVE, PUBLISHED, CANCELLED, COMPLETED
#                 Dùng để lọc show đang hoạt động
#   QueueStatus : enum tự viết trong app/models/enums.py
#                 Các giá trị: WAITING, ADMITTED, EXPIRED, COMPLETED
#                 Đây là 4 trạng thái trong vòng đời của một queue entry

from app.models.event import Show
#   Show : ORM model tự viết trong app/models/event.py
#          Đại diện cho bảng shows trong database
#          Mỗi Show là một buổi diễn có thể bán vé
#          Queue được cấu hình ở mức backend settings, không lưu trên show.

from app.models.queue import QueueEntry
#   QueueEntry : ORM model tự viết trong app/models/queue.py
#                Đại diện cho bảng queue_entries trong database
#                Mỗi record là MỘT NGƯỜI đang trong hàng đợi của một show
#                Chứa: token, status, created_at, admitted_at, expires_at...

from app.schemas.queue import QueueJoinResponse, QueueStatusResponse
#   QueueJoinResponse   : Pydantic schema tự viết trong app/schemas/queue.py
#                         Định dạng JSON trả về khi user gọi API join queue
#                         Gồm: token, status, position, message, admitted_until
#   QueueStatusResponse : Pydantic schema tự viết trong app/schemas/queue.py
#                         Định dạng JSON trả về khi user poll trạng thái queue
#                         Gồm: token, status, position, message, admitted_until

# ============================================================
# KHỞI TẠO SINGLETON SETTINGS
# ============================================================
settings = get_settings()
QUEUE_LOCK_NAMESPACE = 7042
#   Gọi get_settings() MỘT LẦN ở module level để lấy object Settings
#   Object này được cache bởi @lru_cache trong config.py
#   Dùng để đọc các cấu hình như: queue_admit_ttl_minutes, queue_batch_size_default...
#   Biến module-level: tồn tại suốt vòng đời app, tất cả request dùng chung
_memory_active_sessions: dict[int, dict[int, datetime]] = {}


# ============================================================
# HÀM TIỆN ÍCH
# ============================================================

def _as_utc(value: datetime | None) -> datetime | None:
    """Chuẩn hóa thời gian thiếu timezone thành timezone.utc-aware để so sánh an toàn.
    
    VẤN ĐỀ: Database PostgreSQL thường trả về datetime KHÔNG có múi giờ (naive datetime).
    Nếu so sánh naive datetime với timezone.utc-aware datetime (có timezone), Python sẽ ném lỗi:
    "TypeError: can't compare offset-naive and offset-aware datetimes"
    
    GIẢI PHÁP: Hàm này kiểm tra và gắn múi giờ timezone.utc nếu datetime chưa có.
    
    Đầu vào:
    - `value`: datetime từ database, có thể có hoặc không có timezone.
        
    Đầu ra:
    - Datetime đã có timezone timezone.utc, hoặc None nếu đầu vào là None.
    """

    # Kiểm tra value có phải None không
    # None: Python built-in constant, đại diện cho "không có giá trị"
    if value is None:
        return None  # Trả về None, không cần xử lý gì thêm
    
    # Toán tử 3 ngôi của Python: <true_value> if <condition> else <false_value>
    # value.tzinfo: thuộc tính của Python datetime object
    #   - Nếu datetime có timezone: tzinfo là timezone object (vd: timezone.utc, +07:00)
    #   - Nếu datetime naive: tzinfo là None
    # value.replace(tzinfo=timezone.utc): method của datetime, tạo bản sao với timezone mới
    #   - Không thay đổi object gốc, trả về object mới
    # timezone.utc: hằng số từ module datetime (Python 3.11+), đại diện múi giờ timezone.utc+0
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    #      └── ĐÃ có tzinfo → giữ nguyên, trả về luôn
    #                           └── CHƯA có tzinfo → gắn timezone.utc vào rồi trả về


def _show_active_users_key(show_id: int) -> str:
    """Sinh Redis key lưu tập người dùng đang quan tâm đến một show."""

    return f"queue:show:{show_id}:active-users"


def _show_active_user_session_key(show_id: int, user_id: int) -> str:
    """Sinh Redis key TTL cho một user đang mở luồng mua vé của show."""

    return f"queue:show:{show_id}:active-user:{user_id}"


async def track_show_active_user(show_id: int, user_id: int) -> None:
    """Ghi nhận một user đang quan tâm đến show để quyết định có cần bật queue hay không.

    Input:
    - `show_id`: buổi diễn đang được xem hoặc chuẩn bị đặt vé.
    - `user_id`: người dùng hiện tại.

    Output:
    - Không trả dữ liệu; Redis sẽ tự hết hạn dấu vết hoạt động sau một khoảng ngắn.

    Cách hoạt động:
    - Lưu `user_id` vào một Redis set theo show.
    - Tạo key phiên riêng có TTL để biết user nào đã rời trang hoặc mất kết nối.
    - Nếu Redis tạm thời không sẵn sàng, backend bỏ qua tracking để không làm hỏng luồng đặt vé.
    """

    redis = get_redis_client()
    set_key = _show_active_users_key(show_id)
    session_key = _show_active_user_session_key(show_id, user_id)
    ttl_seconds = settings.queue_active_user_ttl_seconds
    try:
        await redis.sadd(set_key, str(user_id))
        await redis.set(session_key, "1", ex=ttl_seconds)
        await redis.expire(set_key, ttl_seconds * 2)
    except RedisError:
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
        _memory_active_sessions.setdefault(show_id, {})[user_id] = expires_at
        return


async def get_show_active_user_count(show_id: int) -> int:
    """Đếm số user còn hoạt động trong cửa sổ ngắn của một show.

    Input:
    - `show_id`: buổi diễn cần kiểm tra tải truy cập.

    Output:
    - Số user còn có key TTL hợp lệ trong Redis.

    Cách hoạt động:
    - Đọc tập user theo show.
    - Với từng user, kiểm tra key phiên riêng còn tồn tại không.
    - User đã hết TTL sẽ bị xóa khỏi set để lần sau đếm nhẹ hơn.
    """

    redis = get_redis_client()
    set_key = _show_active_users_key(show_id)
    try:
        members = await redis.smembers(set_key)
    except RedisError:
        now = datetime.now(timezone.utc)
        sessions = _memory_active_sessions.get(show_id, {})
        active_user_ids = [user_id for user_id, expires_at in sessions.items() if expires_at > now]
        _memory_active_sessions[show_id] = {user_id: sessions[user_id] for user_id in active_user_ids}
        return len(active_user_ids)

    active_count = 0
    for raw_user_id in members:
        try:
            user_id = int(raw_user_id)
        except (TypeError, ValueError):
            await redis.srem(set_key, raw_user_id)
            continue

        session_key = _show_active_user_session_key(show_id, user_id)
        try:
            exists = await redis.exists(session_key)
        except RedisError:
            return active_count

        if exists:
            active_count += 1
        else:
            await redis.srem(set_key, raw_user_id)

    return active_count


async def _waiting_queue_count(session: AsyncSession, show_id: int) -> int:
    """Đếm số người đang chờ trong DB cho một show."""

    count = await session.scalar(
        select(func.count(QueueEntry.id)).where(
            QueueEntry.show_id == show_id,
            QueueEntry.status == QueueStatus.WAITING,
        )
    )
    return int(count or 0)


async def _queue_position(session: AsyncSession, entry: QueueEntry) -> int:
    if entry.status != QueueStatus.WAITING:
        return 0

    waiting_ids = list(
        await session.scalars(
            select(QueueEntry.id)
            .where(
                QueueEntry.show_id == entry.show_id,
                QueueEntry.status == QueueStatus.WAITING,
            )
            .order_by(QueueEntry.created_at.asc(), QueueEntry.id.asc())
        )
    )
    try:
        return waiting_ids.index(entry.id) + 1
    except ValueError:
        return int(entry.position_hint or 0)


async def _active_admitted_count(session: AsyncSession, show_id: int, now: datetime) -> int:
    """Đếm số token đã được cấp lượt và còn hạn."""

    count = await session.scalar(
        select(func.count(QueueEntry.id)).where(
            QueueEntry.show_id == show_id,
            QueueEntry.status == QueueStatus.ADMITTED,
            QueueEntry.expires_at.is_not(None),
            QueueEntry.expires_at > now,
        )
    )
    return int(count or 0)


async def _has_valid_admitted_entry(session: AsyncSession, show_id: int, user_id: int, now: datetime) -> bool:
    """Kiểm tra user hiện tại đã có quyền vào chọn ghế còn hạn hay chưa.

    Đầu vào:
    - `session`: phiên database đang dùng.
    - `show_id`: buổi diễn cần kiểm tra quyền vào.
    - `user_id`: người dùng đang thao tác.
    - `now`: thời điểm hiện tại theo timezone.utc để so sánh hạn token.

    Đầu ra:
    - `True` nếu user đã có bản ghi ADMITTED còn hạn, ngược lại trả `False`.
    """

    entry_id = await session.scalar(
        select(QueueEntry.id).where(
            QueueEntry.show_id == show_id,
            QueueEntry.user_id == user_id,
            QueueEntry.status == QueueStatus.ADMITTED,
            QueueEntry.expires_at.is_not(None),
            QueueEntry.expires_at > now,
        )
    )
    return entry_id is not None


async def get_queue_requirement_details(
    session: AsyncSession,
    show: Show,
    user_id: int | None = None,
) -> tuple[bool, int, int]:
    """Cho biết show hiện có bắt buộc qua phòng chờ hay không.

    Input:
    - `session`: phiên DB đang dùng.
    - `show`: buổi diễn cần kiểm tra.
    - `user_id`: user hiện tại, nếu có thì được ghi nhận vào cửa sổ active user.

    Output:
    - Tuple gồm `required`, `active_users`, `threshold`.

    Cách hoạt động:
    - Nếu admin tắt queue cho show thì luôn cho đi thẳng.
    - Nếu queue bật, hệ thống chỉ yêu cầu phòng chờ khi số active user chạm ngưỡng
      hoặc đang có người chờ để giữ đúng thứ tự FIFO.
    """

    threshold = settings.queue_active_threshold_default
    now = datetime.now(timezone.utc)
    if user_id is not None and await _has_valid_admitted_entry(session, show.id, user_id, now):
        active_users = await get_show_active_user_count(show.id)
        return False, active_users, threshold

    if user_id is not None:
        await track_show_active_user(show.id, user_id)

    active_users = await get_show_active_user_count(show.id)
    waiting_count = await _waiting_queue_count(session, show.id)
    required = active_users >= threshold or waiting_count > 0
    return required, active_users, threshold


async def is_show_queue_required(session: AsyncSession, show: Show, user_id: int | None = None) -> bool:
    """Trả về `True` nếu show hiện phải ép user đi qua phòng chờ."""

    required, _, _ = await get_queue_requirement_details(session, show, user_id)
    return required


# ============================================================
# HÀM NỘI BỘ CHỈ DÙNG TRONG FILE NÀY
# ============================================================

async def _acquire_show_queue_lock(session: AsyncSession, show_id: int) -> None:
    """Khóa giao dịch theo show để chống admit vượt slot khi nhiều request/worker song song.    
    MỤC ĐÍCH: Đếm xem có bao nhiêu người ĐỨNG TRƯỚC entry này trong hàng đợi.
    Kết quả dùng để hiển thị cho user: "Bạn đang ở vị trí số X trong hàng đợi".
    
    NGUYÊN TẮC XẾP HÀNG:
    1. Ai vào trước (created_at nhỏ hơn) → đứng trước
    2. Nếu vào cùng giây → ai có ID nhỏ hơn → đứng trước (tie-break)
       (ID là khóa chính tự tăng, ai insert trước có ID nhỏ hơn)
    
    Đầu vào:
    - `session`: phiên kết nối database bất đồng bộ.
    - `entry`: bản ghi hàng đợi cần tính vị trí.
        
    Đầu ra:
    - Vị trí trong hàng đợi (1, 2, 3...), hoặc 0 nếu entry không còn WAITING.
    """


    bind = session.get_bind()
    if bind.dialect.name != "postgresql":
        return
    await session.execute(
        text("SELECT pg_advisory_xact_lock(:namespace, :show_id)"),
        {"namespace": QUEUE_LOCK_NAMESPACE, "show_id": show_id},
    )


async def _try_acquire_show_queue_lock(session: AsyncSession, show_id: int) -> bool:
    """Thử khóa theo show nhưng không để request user chờ trên connection DB."""

    bind = session.get_bind()
    if bind.dialect.name != "postgresql":
        return True
    return bool(
        await session.scalar(
            text("SELECT pg_try_advisory_xact_lock(:namespace, :show_id)"),
            {"namespace": QUEUE_LOCK_NAMESPACE, "show_id": show_id},
        )
    )


# ============================================================
# HÀM PUBLIC (được gọi từ API routes)
# ============================================================

async def join_show_queue(session: AsyncSession, show: Show, user_id: int) -> QueueJoinResponse:
    """Đưa người dùng vào hàng đợi của một buổi diễn.

    MỤC ĐÍCH: Hàm chính xử lý khi user bấm nút "Vào mua vé" ở show có bật queue.
    
    CÁC TÌNH HUỐNG CÓ THỂ XẢY RA:
    1. User đã có token ADMITTED còn hạn → DÙNG LẠI, cho vào mua ngay
    2. User đã có token WAITING → DÙNG LẠI, báo vị trí hiện tại
    3. User chưa có token + còn slot trống + không ai chờ → CẤP ADMITTED NGAY
    4. User chưa có token + hết slot hoặc có người chờ → XẾP WAITING
    
    Input:
    - `show`: buổi diễn cần kiểm soát lượng truy cập.
    - `user_id`: tài khoản khách đang xin lượt đặt vé.

    Output:
    - Token hàng đợi, trạng thái hiện tại, vị trí chờ và thời hạn vào nếu đã được cấp lượt.

    Cách hoạt động:
    - Nếu người dùng còn token hợp lệ thì tái sử dụng để tránh tạo nhiều lượt chờ ảo.
    - Nếu buổi diễn còn slot active thì cấp trạng thái `ADMITTED` ngay.
    - Nếu đang quá tải thì tạo bản ghi `WAITING`; worker nền sẽ cấp lượt theo batch.
    """
    lock_acquired = await _try_acquire_show_queue_lock(session, show.id)


    # ============================================================
    # BƯỚC 2: LẤY THỜI GIAN HIỆN TẠI THEO timezone.utc
    # ============================================================
    # datetime.now(timezone.utc): Python built-in
    #   Lấy thời gian hiện tại với timezone timezone.utc
    #   Dùng timezone.utc để đồng bộ giữa server và database, tránh lệch múi giờ
    now = datetime.now(timezone.utc)

    # ============================================================
    # BƯỚC 3: TÌM PHIẾU CŨ CÒN GIÁ TRỊ CỦA USER NÀY
    # ============================================================
    # Mục đích: Tránh tạo nhiều phiếu cho cùng 1 user trong cùng 1 show
    # Nếu user F5 hoặc thoát ra vào lại → dùng lại phiếu cũ, giữ vị trí
    existing = await session.scalar(
        # select(QueueEntry): SQLAlchemy - SELECT * FROM queue_entries
        select(QueueEntry)
        .where(
            # Điều kiện 1: Cùng show - QueueEntry.show_id là ForeignKey đến shows.id
            QueueEntry.show_id == show.id,
            # Điều kiện 2: Cùng user - QueueEntry.user_id là ForeignKey đến users.id
            QueueEntry.user_id == user_id,
            # Điều kiện 3: Status là WAITING hoặc ADMITTED (còn giá trị)
            # .in_() là SQLAlchemy method: WHERE column IN (value1, value2)
            # QueueStatus.WAITING: enum tự viết
            # QueueStatus.ADMITTED: enum tự viết
            QueueEntry.status.in_([QueueStatus.WAITING, QueueStatus.ADMITTED]),
        )
        # .order_by(): SQLAlchemy - ORDER BY
        # QueueEntry.created_at.desc(): sắp xếp GIẢM DẦN (mới nhất lên đầu)
        # Phòng trường hợp user có nhiều phiếu (hiếm) → lấy phiếu mới nhất
        .order_by(QueueEntry.created_at.desc())
    )
    # session.scalar(): SQLAlchemy AsyncSession method
    #   Thực thi query, trả về 1 object HOẶC None
    #   Nếu có nhiều dòng → tự động lấy dòng đầu tiên

    # ============================================================
    # BƯỚC 4: XỬ LÝ KHI TÌM THẤY PHIẾU CŨ
    # ============================================================
    if existing:
        # Chuẩn hóa timezone của expires_at bằng hàm tự viết _as_utc()
        # existing.expires_at: cột DATETIME trong bảng queue_entries
        #   Có thể None nếu chưa được ADMITTED (WAITING không có expires_at)
        existing_expires = _as_utc(existing.expires_at)

        # ----------------------------------------------------------
        # Case A: ADMITTED + CÒN HẠN → Cho vào mua ngay
        # ----------------------------------------------------------
        # existing.status: cột enum trong queue_entries (WAITING/ADMITTED/EXPIRED/COMPLETED)
        # QueueStatus.ADMITTED: đã được cấp lượt vào mua
        # existing_expires: thời hạn của lượt (sau 15 phút thì hết hạn)
        # existing_expires > now: CÒN HẠN (chưa tới giờ hết hạn)
        if existing.status == QueueStatus.ADMITTED and existing_expires and existing_expires > now:
            # QueueJoinResponse: Pydantic schema tự viết trong app/schemas/queue.py
            #   Fields: token, status, position, message, admitted_until
            return QueueJoinResponse(
                token=existing.token,           # Token cũ, dùng lại
                status=existing.status,          # ADMITTED
                position=0,                      # Được vào rồi → vị trí = 0
                message="Bạn đã được cấp lượt. Hãy tiếp tục sang bước chọn ghế.",
                admitted_until=existing_expires, # Thời hạn còn lại để mua vé
            )

        # ----------------------------------------------------------
        # Case B: WAITING → Vẫn phải chờ, báo vị trí
        # ----------------------------------------------------------
        if existing.status == QueueStatus.WAITING:
            return QueueJoinResponse(
                token=existing.token,           # Token cũ, dùng lại
                status=existing.status,          # WAITING
                position=existing.position_hint,  # Vị trí gần nhất do join/worker cập nhật
                message="Bạn đang ở phòng chờ. Vui lòng giữ trang này mở.",
            )

        # ----------------------------------------------------------
        # Case C (ẩn): ADMITTED nhưng HẾT HẠN
        #   existing_expires là None HOẶC existing_expires < now
        #   → KHÔNG vào 2 if trên → KHÔNG return
        #   → Code rơi xuống dưới → TẠO PHIẾU MỚI
        # ----------------------------------------------------------

    # ============================================================
    # BƯỚC 5: TẠO PHIẾU MỚI
    # (khi không tìm thấy phiếu cũ hoặc phiếu cũ đã hết hạn)
    # ============================================================

    # ĐẾM SỐ NGƯỜI ĐANG WAITING trong show này
    # Mục đích: Để tính position_hint (vị trí dự kiến) cho người mới
    waiting_count = await session.scalar(
        # func.count(QueueEntry.id): SQLAlchemy gọi hàm COUNT của SQL
        #   Đếm số dòng thỏa điều kiện
        select(func.count(QueueEntry.id)).where(
            QueueEntry.show_id == show.id,
            QueueEntry.status == QueueStatus.WAITING,  # Chỉ đếm người đang chờ
        )
    )
    # int() Python built-in: chuyển về số nguyên
    # waiting_count or 0: nếu None → 0, nếu có giá trị → giữ nguyên
    waiting_count = int(waiting_count or 0)

    # ĐẾM SỐ NGƯỜI ĐANG ADMITTED CÒN HẠN
    # Mục đích: Để biết còn slot trống không
    active_admitted_count = 0
    if lock_acquired:
        active_admitted_count = await session.scalar(
            select(func.count(QueueEntry.id)).where(
                QueueEntry.show_id == show.id,
                QueueEntry.status == QueueStatus.ADMITTED,      # Đã được cấp lượt
                QueueEntry.expires_at.is_not(None),              # Phải có thời hạn (không NULL)
                QueueEntry.expires_at > now,                     # Chưa hết hạn
            )
        )
        active_admitted_count = int(active_admitted_count or 0)
    # ============================================================
    # TẠO OBJECT QueueEntry MỚI (chưa INSERT vào database)
    # ============================================================
    # QueueEntry: ORM model tự viết trong app/models/queue.py
    entry = QueueEntry(
        event_id=show.event_id,                # show.event_id: ForeignKey đến events.id
        show_id=show.id,                       # show.id: khóa chính của show
        user_id=user_id,                       # user_id: ID của user đang xin vào
        token=str(uuid4()),                    # uuid4(): Python built-in - tạo token unique
                                                # str(): chuyển UUID object thành chuỗi
        status=QueueStatus.WAITING,            # Mặc định là WAITING (có thể đổi ở dưới)
        position_hint=waiting_count + 1,       # Vị trí dự kiến = số người đang chờ + 1
    )

    # ============================================================
    # KIỂM TRA CÓ ĐƯỢC VÀO NGAY KHÔNG
    # Điều kiện: CÒN SLOT TRỐNG VÀ KHÔNG CÓ AI ĐANG CHỜ
    # ============================================================
    # max_active_tokens: lấy từ backend settings (không lưu trên show)
    #   Số người TỐI ĐA được vào khu vực chọn ghế cùng lúc (default backend)
    # Điều kiện 1: active_admitted_count < max → còn slot
    # Điều kiện 2: waiting_count == 0 → không ai đang xếp hàng (công bằng FIFO)
    max_active_tokens = settings.queue_max_active_tokens_default
    if lock_acquired and active_admitted_count < max_active_tokens and waiting_count == 0:
        # Được vào ngay → đổi trạng thái từ WAITING thành ADMITTED
        entry.status = QueueStatus.ADMITTED         # Enum tự viết
        entry.admitted_at = now                      # Ghi nhận thời điểm được cấp lượt
        # settings.queue_admit_ttl_minutes: từ config (app/core/config.py)
        #   Mặc định = 15 phút - thời gian user có để chọn ghế và thanh toán
        # timedelta(minutes=...): Python built-in - tạo khoảng thời gian
        entry.expires_at = now + timedelta(minutes=settings.queue_admit_ttl_minutes)
        entry.last_seen_at = now                     # Đánh dấu user đang online

    # ============================================================
    # LƯU VÀO DATABASE
    # ============================================================
    session.add(entry)        # SQLAlchemy: thêm object vào session (pending, chưa INSERT)
    await session.commit()    # SQLAlchemy: thực thi INSERT vào database thật
                              #   Sau dòng này, entry đã có trong DB
    await session.refresh(entry)  # SQLAlchemy: load lại từ DB để lấy giá trị auto-generated
                                  #   vd: id (auto-increment), created_at (default)

    # Tính lại vị trí thật sau khi insert để tránh sai lệch khi nhiều người vào queue gần như cùng lúc.
    current_position = await _queue_position(session, entry)
    entry.position_hint = current_position
    await session.commit()

    # Trả về WAITING để frontend hiển thị phòng chờ; worker sẽ cấp lượt theo batch.
    return QueueJoinResponse(
        token=entry.token,                  # Token mới tạo
        status=entry.status,                 # WAITING
        position=current_position,           # Vị trí thật trong hàng đợi
        message=f"Bạn đang ở vị trí thứ {current_position} trong hàng đợi. Vui lòng không tải lại trang.",
    )


async def get_queue_status(session: AsyncSession, show_id: int, token: str, user_id: int) -> QueueStatusResponse:
    """Lấy trạng thái mới nhất để frontend polling màn phòng chờ.
    
    MỤC ĐÍCH: Frontend gọi API này LIÊN TỤC (mỗi 2-3 giây) để:
    - Biết vị trí hiện tại trong hàng (nếu còn WAITING)
    - Biết khi nào được vào (khi chuyển sang ADMITTED)
    - Biết khi nào hết hạn (EXPIRED) hoặc hoàn tất (COMPLETED)
    
    Đây là cơ chế POLLING: frontend chủ động hỏi backend "trạng thái của tôi thế nào?"
    """

    # Tìm phiếu queue entry dựa trên 3 thông tin: show_id, token, user_id
    # Cả 3 phải KHỚP để đảm bảo bảo mật (không ai xem được queue của người khác)
    entry = await session.scalar(
        select(QueueEntry).where(
            QueueEntry.show_id == show_id,    # Cùng show
            QueueEntry.token == token,         # Token phải khớp chính xác
            QueueEntry.user_id == user_id,      # User phải khớp chính xác
        )
    )
    
    # KHÔNG TÌM THẤY phiếu → trả về EXPIRED
    # Có thể do: token bị xóa, user bị đuổi, hoặc token không tồn tại
    if not entry:
        return QueueStatusResponse(  # Pydantic schema tự viết
            token=token,              # Trả lại token để client biết token nào bị lỗi
            status=QueueStatus.EXPIRED,
            message="Phiên hàng đợi không còn tồn tại. Vui lòng tham gia lại phòng chờ.",
        )

    # Lấy thời gian hiện tại và chuẩn hóa expires_at
    now = datetime.now(timezone.utc)                    # Python built-in
    entry_expires = _as_utc(entry.expires_at)   # Hàm tự viết: đảm bảo có timezone

    # Nếu ADMITTED nhưng đã HẾT HẠN → cập nhật thành EXPIRED ngay
    # Đây là "lazy cleanup": chỉ đánh dấu EXPIRED khi user poll,
    # thay vì worker phải quét liên tục
    if entry.status == QueueStatus.ADMITTED and entry_expires and entry_expires < now:
        entry.status = QueueStatus.EXPIRED  # Đổi trạng thái
        await session.commit()               # Lưu ngay vào DB

    # ============================================================
    # TRẢ VỀ RESPONSE THEO TỪNG TRẠNG THÁI
    # ============================================================

    # WAITING: đang xếp hàng → trả vị trí
    if entry.status == QueueStatus.WAITING:
        return QueueStatusResponse(  # Pydantic schema tự viết
            token=entry.token,
            status=entry.status,
            position=entry.position_hint,
            # f-string Python: chèn biến vào chuỗi
            message=f"Bạn đang ở vị trí {entry.position_hint} trong hàng đợi. Vui lòng không tải lại trang.",

        )

    # ADMITTED: được vào rồi → trả thời hạn
    if entry.status == QueueStatus.ADMITTED:
        return QueueStatusResponse(  # Pydantic schema tự viết
            token=entry.token,
            status=entry.status,
            admitted_until=entry_expires,  # Thời hạn còn lại (15 phút từ lúc được cấp)
            message="Đã đến lượt của bạn. Bạn có thể vào màn chọn ghế.",
        )

    # COMPLETED: đã mua vé xong
    if entry.status == QueueStatus.COMPLETED:
        return QueueStatusResponse(
            token=entry.token,
            status=entry.status,
            message="Phiên truy cập đặt vé đã hoàn tất.",
        )

    # Mặc định: EXPIRED hoặc các trạng thái khác
    return QueueStatusResponse(
        token=entry.token,
        status=entry.status,
        message="Token hàng đợi đã hết hạn. Vui lòng tham gia lại phòng chờ.",
    )


async def heartbeat_queue_token(session: AsyncSession, show_id: int, token: str, user_id: int) -> QueueEntry:
    """Gia hạn mốc hoạt động gần nhất cho người dùng đã được cấp lượt.
    
    MỤC ĐÍCH: Frontend gọi API này định kỳ để "báo còn sống" (heartbeat).
    - Cập nhật last_seen_at để hệ thống biết user vẫn đang online
    - Nếu user không gọi heartbeat trong thời gian dài → có thể coi là bỏ cuộc
    - Hiện tại chủ yếu dùng để gia hạn last_seen_at, không gia hạn expires_at
    """

    # Tìm phiếu queue
    entry = await session.scalar(
        select(QueueEntry).where(
            QueueEntry.show_id == show_id,
            QueueEntry.token == token,
            QueueEntry.user_id == user_id,
        )
    )
    
    # Không tìm thấy → 404 Not Found
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy lượt hàng đợi")
    
    # Chỉ ADMITTED mới được heartbeat
    # WAITING không cần heartbeat vì chưa được vào
    if entry.status != QueueStatus.ADMITTED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Lượt hàng đợi chưa được cấp quyền vào")

    now = datetime.now(timezone.utc)                       # Python built-in
    entry_expires = _as_utc(entry.expires_at)       # Hàm tự viết
    
    # Nếu đã hết hạn → chuyển EXPIRED + báo lỗi 410 Gone
    # 410 Gone: khác 404 - tài nguyên đã từng tồn tại nhưng giờ không còn
    if entry_expires and entry_expires < now:
        entry.status = QueueStatus.EXPIRED
        await session.commit()
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Quyền vào từ hàng đợi đã hết hạn")

    # Còn hạn → cập nhật last_seen_at để đánh dấu user còn online
    entry.last_seen_at = now
    await session.commit()
    await session.refresh(entry)  # Load lại từ DB để lấy dữ liệu mới nhất
    entry.expires_at = entry_expires  # Gán lại expires_at đã chuẩn hóa timezone
    return entry  # Trả về ORM object cho caller (route sẽ chuyển thành response)


async def leave_queue_token(session: AsyncSession, show_id: int, token: str, user_id: int) -> bool:
    """Hủy lượt hàng đợi đang hoạt động khi người dùng rời luồng mua vé."""

    entry = await session.scalar(
        select(QueueEntry).where(
            QueueEntry.show_id == show_id,
            QueueEntry.token == token,
            QueueEntry.user_id == user_id,
            QueueEntry.status.in_([QueueStatus.WAITING, QueueStatus.ADMITTED]),
        )
    )
    if not entry:
        return False

    entry.status = QueueStatus.EXPIRED
    entry.expires_at = datetime.now(timezone.utc)
    await session.commit()
    return True


async def ensure_queue_access(session: AsyncSession, show: Show, user_id: int, queue_token: str | None) -> None:
    """Chặn thao tác giữ/thanh toán ghế nếu thiếu token hàng đợi đã được cấp lượt.
    
    MỤC ĐÍCH: Đây là hàm GÁC CỔNG - được gọi từ lock_seats() và checkout_locked_seats()
    trong booking_service.py. Đảm bảo CHỈ những user đã qua queue và được ADMITTED
    mới được phép giữ ghế và thanh toán.
    
    CÁC BƯỚC KIỂM TRA:
    1. Show có bật queue không? → Không → cho qua luôn (return)
    2. Có token không? → Không → 429 Too Many Requests
    3. Token có tồn tại trong DB không? → Không → 403 Forbidden
    4. Đã được ADMITTED chưa? → Chưa (còn WAITING) → 429
    5. Còn hạn không? → Hết hạn → 410 Gone + cập nhật EXPIRED
    """

    if not queue_token:
        return

    # Tìm phiếu queue trong database
    # Cần khớp CẢ 3: show_id, token, user_id
    entry = await session.scalar(
        select(QueueEntry).where(
            QueueEntry.show_id == show.id,
            QueueEntry.token == queue_token,
            QueueEntry.user_id == user_id,
        )
    )
    
    # Token không tồn tại hoặc không khớp user → 403 Forbidden
    # 403: "Bạn không có quyền" - token sai hoặc của người khác
    if not entry:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token hàng đợi không hợp lệ")

    now = datetime.now(timezone.utc)  # Python built-in
    
    # Chưa được ADMITTED (còn WAITING) → không cho lock ghế
    # QueueStatus.ADMITTED: enum tự viết - trạng thái được vào
    if entry.status != QueueStatus.ADMITTED:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Bạn vẫn đang ở phòng chờ")
    
    # Kiểm tra thời hạn của token ADMITTED
    entry_expires = _as_utc(entry.expires_at)  # Hàm tự viết: chuẩn hóa timezone
    if entry_expires and entry_expires < now:
        # Hết hạn → cập nhật EXPIRED trong DB luôn
        entry.status = QueueStatus.EXPIRED
        await session.commit()
        # 410 Gone: tài nguyên đã hết hạn, không còn khả dụng
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Token hàng đợi đã hết hạn")

    # Tất cả OK → cập nhật last_seen_at (đánh dấu user đang hoạt động)
    # Không commit ở đây, để caller (lock_seats/checkout) commit trong transaction của họ
    entry.last_seen_at = now


async def mark_queue_completed(session: AsyncSession, show_id: int, user_id: int, queue_token: str | None) -> None:
    """Đánh dấu lượt hàng đợi đã hoàn tất sau khi thanh toán thành công.
    
    MỤC ĐÍCH: Sau khi user checkout thành công (đã mua vé), đánh dấu
    phiếu queue là COMPLETED. Phiếu COMPLETED sẽ không bị worker đuổi.
    """

    # Không có token → show không bật queue, không cần làm gì
    if not queue_token:
        return  # Python built-in: thoát hàm

    # Tìm phiếu queue
    entry = await session.scalar(
        select(QueueEntry).where(
            QueueEntry.show_id == show_id,
            QueueEntry.token == queue_token,
            QueueEntry.user_id == user_id,
        )
    )
    
    # Không tìm thấy → có thể đã bị cleanup, không sao
    if not entry:
        return

    # Đổi trạng thái thành COMPLETED
    # QueueStatus.COMPLETED: enum tự viết - đã hoàn tất mua vé
    entry.status = QueueStatus.COMPLETED
    entry.expires_at = datetime.now(timezone.utc)  # Ghi nhận thời điểm hoàn tất


async def process_virtual_queue(session: AsyncSession) -> int:
    """Worker định kỳ cấp lượt cho người dùng đang chờ theo batch cấu hình.
    
    MỤC ĐÍCH: Hàm này được worker gọi MỖI 3 GIÂY (trong app/workers/tasks.py).
    Đây là TRÁI TIM của hệ thống queue - nơi xử lý hàng đợi cho TẤT CẢ các show.
    
    Với MỖI show đang chạy có bật queue:
    1. ĐUỔI người ADMITTED đã hết hạn (quá 15 phút không mua)
    2. ĐẾM còn bao nhiêu slot trống
    3. CHO VÀO tối đa batch_size người WAITING đầu hàng (FIFO)
    4. CẬP NHẬT position_hint cho những người còn chờ
    
    Đầu ra:
    - Tổng số thay đổi đã thực hiện để worker ghi log, không ảnh hưởng logic nghiệp vụ.
    """

    now = datetime.now(timezone.utc)      # Python built-in: thời gian hiện tại
    updated_entries = 0           # Python int: biến đếm tổng số thay đổi
    
    # ============================================================
    # LẤY TẤT CẢ SHOW ĐANG CHẠY CÓ BẬT QUEUE
    # ============================================================
    # list(): Python built-in - chuyển iterator thành list (thực thi query ngay)
    shows = list(
        await session.scalars(
            select(Show).where(
                Show.is_deleted.is_(False),          # Chưa bị xóa mềm
                Show.status.in_([                    # Đang ở trạng thái hoạt động
                    EventStatus.LIVE,                # Đang diễn ra
                    EventStatus.DRAFT,               # Nháp nhưng đã public
                ]),
            )
        )
    )

    # ============================================================
    # XỬ LÝ TỪNG SHOW MỘT
    # ============================================================
    for show in shows:
        await _acquire_show_queue_lock(session, show.id)
        # ----------------------------------------------------------
        # BƯỚC 1: ĐUỔI NGƯỜI ADMITTED ĐÃ HẾT HẠN
        # SQL: UPDATE queue_entries
        #      SET status = 'EXPIRED'
        #      WHERE show_id = ? 
        #        AND status = 'ADMITTED'
        #        AND expires_at IS NOT NULL
        #        AND expires_at < NOW()
        # ----------------------------------------------------------
        expired_result = await session.execute(
            update(QueueEntry)  # SQLAlchemy: bắt đầu câu UPDATE
            .where(
                QueueEntry.show_id == show.id,                # Cùng show
                QueueEntry.status == QueueStatus.ADMITTED,     # Đang được vào
                QueueEntry.expires_at.is_not(None),            # Có thời hạn
                QueueEntry.expires_at < now,                   # ĐÃ QUÁ HẠN
            )
            .values(status=QueueStatus.EXPIRED)  # Đổi thành EXPIRED
        )
        # expired_result.rowcount: số dòng bị UPDATE (Python int hoặc None)
        # rowcount or 0: nếu None → 0, nếu có → giữ nguyên
        updated_entries += expired_result.rowcount or 0

        # ----------------------------------------------------------
        # BƯỚC 2: ĐẾM SỐ NGƯỜI ADMITTED CÒN HẠN
        # SQL: SELECT COUNT(*) FROM queue_entries
        #      WHERE show_id = ?
        #        AND status = 'ADMITTED'
        #        AND expires_at IS NOT NULL
        #        AND expires_at > NOW()
        # ----------------------------------------------------------
        active_admitted_count = await _active_admitted_count(session, show.id, now)

        # ----------------------------------------------------------
        # BƯỚC 3: TÍNH SLOT TRỐNG VÀ BATCH SIZE
        # ----------------------------------------------------------
        max_active_tokens = settings.queue_max_active_tokens_default
        release_batch = settings.queue_batch_size_default
        # max_active_tokens/release_batch là cấu hình cố định của backend để admin không chỉnh sai từng show.
        # max(a, 0): Python built-in - đảm bảo không âm

        available_slots = max(max_active_tokens - active_admitted_count, 0)
        
        # release_batch: số người tối đa được cho vào mỗi đợt
        # min(a, b): Python built-in - lấy số nhỏ hơn
        batch_size = min(release_batch, available_slots)

        # Không còn slot → bỏ qua show này, xử lý show tiếp theo
        if batch_size <= 0:
            continue  # Python built-in: nhảy sang vòng lặp tiếp theo

        # ----------------------------------------------------------
        # BƯỚC 4: LẤY NGƯỜI WAITING ĐẦU HÀNG (FIFO)
        # SQL: SELECT * FROM queue_entries
        #      WHERE show_id = ? AND status = 'WAITING'
        #      ORDER BY created_at ASC
        #      LIMIT <batch_size>
        # ----------------------------------------------------------
        waiting_entries = list(
            await session.scalars(
                select(QueueEntry)
                .where(
                    QueueEntry.show_id == show.id,
                    QueueEntry.status == QueueStatus.WAITING,  # Đang chờ
                )
                .order_by(QueueEntry.created_at.asc())  # ASC: ai chờ lâu nhất lên đầu
                .limit(batch_size)                      # Chỉ lấy tối đa batch_size người
            )
        )

        # ----------------------------------------------------------
        # BƯỚC 5: CẤP LƯỢT CHO TỪNG NGƯỜI
        # ----------------------------------------------------------
        # enumerate(): Python built-in
        #   Duyệt list kèm index
        #   start=1: index bắt đầu từ 1 (thay vì 0 mặc định)
        for index, entry in enumerate(waiting_entries, start=1):
            entry.status = QueueStatus.ADMITTED         # Đổi trạng thái: WAITING → ADMITTED
            entry.admitted_at = now                      # Ghi nhận thời điểm được cấp lượt
            # settings.queue_admit_ttl_minutes: từ config (default=15 phút)
            entry.expires_at = now + timedelta(minutes=settings.queue_admit_ttl_minutes)
            entry.last_seen_at = now                     # Đánh dấu user đang online
            entry.position_hint = index                  # Vị trí trong đợt này (1, 2, 3...)
            updated_entries += 1                         # Tăng biến đếm

        admitted_now = len(waiting_entries)
        if admitted_now:
            await session.execute(
                update(QueueEntry)
                .where(
                    QueueEntry.show_id == show.id,
                    QueueEntry.status == QueueStatus.WAITING,
                )
                .values(
                    position_hint=case(
                        (QueueEntry.position_hint > admitted_now, QueueEntry.position_hint - admitted_now),
                        else_=1,
                    )
                )
            )

    # ============================================================
    # COMMIT TẤT CẢ THAY ĐỔI
    # ============================================================
    await session.commit()  # SQLAlchemy: lưu tất cả thay đổi vào database
    
    # Trả về tổng số thay đổi đã thực hiện
    return updated_entries


async def cleanup_expired_queue_entries(session: AsyncSession) -> int:
    """Xóa các bản ghi hàng đợi đã quá hạn lâu để bảng queue không phình vô hạn.
    
    MỤC ĐÍCH: Dọn dẹp định kỳ - xóa các queue entry đã EXPIRED quá 24 giờ.
    Việc này giữ cho bảng queue_entries không bị phình to vô hạn theo thời gian.
    
    Đầu ra:
    - Số dòng đã xóa.
    """

    # Tính mốc cutoff: 24 giờ trước
    # datetime.now(timezone.utc): Python built-in
    # timedelta(hours=24): Python built-in - khoảng 24 giờ
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    
    # SQL: DELETE FROM queue_entries
    #      WHERE expires_at IS NOT NULL
    #        AND expires_at < <cutoff>
    result = await session.execute(
        delete(QueueEntry)  # SQLAlchemy: bắt đầu câu DELETE
        .where(
            QueueEntry.expires_at.is_not(None),  # Phải có thời hạn (đã từng được set)
            QueueEntry.expires_at < cutoff,      # Quá hạn > 24 giờ
        )
    )
    
    await session.commit()  # SQLAlchemy: thực thi DELETE
    
    # result.rowcount: số dòng đã xóa (Python int hoặc None)
    return result.rowcount or 0  # None → 0
