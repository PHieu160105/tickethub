# TicketRush Backend (FastAPI + PostgreSQL)

Backend production-style cho nền tảng TicketRush, tập trung vào 3 bài toán quan trọng:

1. Chống race condition khi giữ ghế (`SELECT ... FOR UPDATE` + transaction)
2. Quản lý vòng đời vé (`available -> locked -> sold/released`)
3. Virtual Queue cho flash-sale traffic cao

## 1) Stack
- FastAPI
- SQLAlchemy 2.0 (async)
- PostgreSQL (`asyncpg`)
- JWT auth
- Background worker nội bộ (release lock + queue admission)
- WebSocket realtime (seat updates + admin dashboard)

## 2) Cấu trúc thư mục

```txt
BE/
├─ app/
│  ├─ main.py                    # App entrypoint + lifespan
│  ├─ seed.py                    # Seed admin/customer + event mẫu
│  ├─ api/
│  │  ├─ deps.py                 # get_current_user, admin guard
│  │  ├─ router.py               # Gom router API + WS
│  │  └─ routes/
│  │     ├─ auth.py              # Login/register/me
│  │     ├─ events.py            # Event list/detail/seat matrix
│  │     ├─ queue.py             # Waiting room endpoints
│  │     ├─ bookings.py          # lock/release/checkout/my-tickets
│  │     ├─ admin.py             # Event CRUD + dashboard + detail stats
│  │     └─ ws.py                # WebSocket endpoints
│  ├─ core/
│  │  ├─ config.py               # Pydantic settings
│  │  ├─ db.py                   # Async engine/session
│  │  └─ security.py             # Hash + JWT helpers
│  ├─ models/
│  │  ├─ enums.py                # role/status enums
│  │  ├─ user.py                 # users
│  │  ├─ event.py                # events + seat_zones
│  │  ├─ seat.py                 # seats
│  │  ├─ order.py                # orders/order_items/tickets
│  │  └─ queue.py                # queue_entries
│  ├─ schemas/                   # Pydantic request/response models
│  ├─ services/
│  │  ├─ event_service.py        # slug + seat matrix generation
│  │  ├─ booking_service.py      # row-lock seat flow
│  │  ├─ queue_service.py        # queue algorithm
│  │  └─ dashboard_service.py    # analytics aggregator
│  ├─ workers/
│  │  └─ tasks.py                # periodic jobs loop
│  └─ ws/
│     └─ connection_manager.py   # WS connection fan-out
├─ scripts/
│  └─ concurrency_demo.py        # script test race lock
├─ tests/
│  ├─ conftest.py
│  ├─ test_booking_lifecycle.py
│  ├─ test_virtual_queue.py
│  └─ test_security.py
├─ requirements.txt
└─ Dockerfile
```

## 3) Database design

### Bảng chính
- `users`: customer/admin, profile age/gender
- `events`: thông tin sự kiện + cấu hình queue
- `seat_zones`: ma trận theo khu (VIP/A/B...)
- `seats`: từng ghế cụ thể + trạng thái lock/sold
- `orders`, `order_items`: checkout records
- `tickets`: QR payload + ticket code
- `queue_entries`: trạng thái waiting/admitted/expired/completed

### Quan hệ
- 1 `event` -> N `seat_zones`
- 1 `seat_zone` -> N `seats`
- 1 `order` -> N `order_items`
- 1 `order_item` -> 1 `ticket`
- 1 `event` -> N `queue_entries`

## 4) Luồng nghiệp vụ quan trọng

### 4.1 Lock ghế chống race condition
Trong `booking_service.lock_seats`:
- Query ghế với `with_for_update()`
- Check trạng thái từng ghế trong transaction
- Chỉ ghế hợp lệ mới chuyển sang `locked`
- Commit atomically

Khi 2 user lock cùng ghế cùng thời điểm, 1 transaction sẽ thắng, transaction còn lại thấy trạng thái đã đổi và fail.

### 4.2 Vòng đời vé
- `available` -> `locked` khi lock thành công
- `locked` -> `sold` khi checkout xác nhận
- `locked` -> `available` khi quá hạn giữ chỗ

Worker nền chạy 3s/lần để quét và release lock hết hạn.

### 4.3 Virtual queue
- User join queue qua `/events/{event}/queue/join`
- Nếu còn slot (`max_active_queue_tokens`) có thể admitted ngay
- Nếu không, vào `waiting`
- Worker định kỳ admit theo batch (`queue_release_batch`, ví dụ 50/lượt)
- FE polling trạng thái và tự điều hướng vào seat map khi admitted

## 5) API chính

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PATCH /api/auth/me`

### Customer
- `GET /api/events`
- `GET /api/events/{slug_or_id}`
- `GET /api/events/{slug_or_id}/seats`
- `POST /api/bookings/lock`
- `POST /api/bookings/release`
- `POST /api/bookings/checkout`
- `GET /api/bookings/my-tickets`

> Luu y: bookings APIs chi cho role `customer`; admin bi chan o dependency layer.

### Virtual Queue
- `POST /api/events/{event_key}/queue/join`
- `GET /api/events/{event_key}/queue/status/{token}`
- `POST /api/events/{event_key}/queue/heartbeat/{token}`

### Admin
- `POST /api/admin/events`
- `GET /api/admin/events`
- `PATCH /api/admin/events/{event_key}`
- `DELETE /api/admin/events/{event_key}`
- `GET /api/admin/events/{event_key}/stats`
- `GET /api/admin/dashboard/summary`
- `GET /api/admin/dashboard/revenue`
- `GET /api/admin/dashboard/audience`
- `GET /api/admin/dashboard/occupancy`

### WebSocket
- `ws://host:8000/ws/events/{event_key}/seats?token=...`
- `ws://host:8000/ws/admin/dashboard?token=...`

## 6) Seed account mặc định
Khi app khởi động lần đầu:
- Admin: `admin@ticketrush.com` / `Admin@123`
- Customer: `customer@ticketrush.com` / `Customer@123`

## 7) Chạy local

```bash
cd BE
python3 -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 8) Test

```bash
cd BE
python3 -m pytest -q
```

Kết quả hiện tại: `8 passed`.

## 9) Ghi chú production
- Đã tách layer rõ: `routes -> services -> models`
- Auth/role guard ở dependency layer
- Code có docstring/comment cho luồng quan trọng
- Có script mô phỏng race lock: `scripts/concurrency_demo.py`
