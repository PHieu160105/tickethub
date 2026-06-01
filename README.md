# TicketRush - Fullstack Flash-Sale Ticketing Platform

TicketRush là hệ thống phân phối vé điện tử được xây dựng fullstack:
- **Frontend:** React (`FE/`)
- **Backend:** FastAPI + PostgreSQL (`BE/`)
- **Infra local:** Docker Compose chỉ dùng cho Postgres và Redis


## 1) Cách chạy chuẩn cho đồ án này

```bash
docker compose up -d postgres redis

cd BE
python3 -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

cd FE
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`

Lưu ý:

- Không chạy frontend/backend bằng Docker trong flow local mặc định.
- `docker compose stop` giờ chỉ tác động vào hạ tầng `postgres` và `redis`, không đụng tới app local.
- Có sẵn task VS Code trong `.vscode/tasks.json` để chạy đúng flow local này.
- Redis Docker đang được publish ra host tại `127.0.0.1:6380`, và `.env` đã được cấu hình đồng bộ theo cổng này.

## 2) Tài khoản seed mặc định
- Admin: `admin@ticketrush.com` / `Admin@123`
- Customer: `customer@ticketrush.com` / `Customer@123`
- VNPay test: 9704198526191432198 - NGUYEN VAN A - 07/15 - 123456

## 3) Chạy local từng phần

### Backend
```bash
cd BE
python3 -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd FE
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

## 4) Kiểm thử đã chạy

### Backend
```bash
cd BE
PYTHONPATH=. ../.venv/bin/pytest -q
```

### Frontend
```bash
cd FE
npm run build
npm run lint
```

## 5) Checklist requirement đối chiếu

### 5.1 Vai trò nghiệp vụ
- **Customer:** tìm kiếm event, xem seat map, giữ ghế, checkout, xem QR ticket, cập nhật profile ở My Account
- **Admin:** tạo/sửa/xóa event, upload ảnh event, xem dashboard realtime, xem seat inspector theo từng ghế

### 5.2 Trải nghiệm sơ đồ ghế (4.1)
- FE có seat matrix trực quan theo zone/row/seat
- Admin khai báo ma trận ghế theo form zone config
- Realtime cập nhật trạng thái ghế qua WebSocket (không cần F5)

### 5.3 Database concurrency (4.2)
- `booking_service.lock_seats` dùng row-level lock `with_for_update()`
- Lock/checkout/release được commit atomically
- Tránh bán trùng ghế khi concurrent requests

### 5.4 Vòng đời vé (4.3)
- Trạng thái ghế: `available -> locked -> sold` hoặc `locked -> available` (released)
- Hold timeout mặc định 10 phút
- Background worker quét lock quá hạn và tự động release
- Checkout là xác nhận nội bộ (không tích hợp payment gateway thật)

### 5.5 Virtual Queue (4.4)
- Waiting room page hiển thị vị trí hàng đợi
- Hệ thống cấp quyền theo batch (`queue_release_batch`, mặc định 50)
- Token queue bắt buộc cho event bật queue trước khi thao tác lock/checkout

### 5.6 Thiết kế/UI/UX
- Bám design system (palette, spacing, glass, gradient, editorial tone)
- Responsive mobile/desktop
- URL routing rõ ràng theo `slug` event
- Hỗ trợ chuyển theme Light/Dark ngay trên top nav

### 5.7 Hiệu năng frontend
- Fetch JSON API bằng axios
- Cập nhật UI theo state, không reload full page
- WebSocket cho realtime seat/dashboard

### 5.8 Phong cách tổ chức production
- Tách layer rõ: router / service / model / schema
- FE tổ chức theo pages/components/hooks/lib/types
- Code có docstring/comment ở luồng nghiệp vụ quan trọng
- README chi tiết riêng cho `FE` và `BE`

### 5.9 An ninh
- JWT auth
- Password hashing
- Role-based access control (admin/customer)
- Guard protected routes ở cả FE và BE
- Booking API chỉ cho customer; admin không thể lock/release/checkout vé

### 5.10 OOP/DB independence
- ORM với SQLAlchemy models (hướng đối tượng)
- Tách business logic khỏi API layer

## 6) Tài liệu chi tiết
- Backend docs: [BE/README.md](./BE/README.md)
- Frontend docs: [FE/README.md](./FE/README.md)
