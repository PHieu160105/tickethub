# Guide Backend TicketRush

## 1. Mục tiêu của tài liệu này

Tài liệu này dành cho người mới học backend, FastAPI, SQLAlchemy hoặc chưa quen kiến trúc show-based của dự án.

Đây là file guide backend chuẩn nên đọc.

Các file tên gần giống như `guide_BE.md` hoặc `guide_FE.md` có thể xem là tài liệu cũ hoặc bản nháp, không cần ưu tiên.

Mục tiêu:

- Giúp bạn hiểu backend được tổ chức như thế nào.
- Giúp bạn biết file nào là đầu mối thật sự.
- Giúp bạn hiểu model dữ liệu và pipeline request.
- Giúp bạn sửa logic booking/queue/admin mà không làm gãy các phần liên quan.

Backend hiện chạy tại:

- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`

Cách chạy đúng trong môi trường local:

- Chạy backend bằng `bash`
- Chạy frontend bằng `bash`
- Chỉ dùng Docker Compose cho hạ tầng `postgres` và `redis`
- Redis Docker của dự án hiện publish ra host ở `127.0.0.1:6380`

## 2. Bức tranh tổng thể

Backend dùng:

- FastAPI
- SQLAlchemy async
- PostgreSQL
- Redis
- WebSocket cho realtime
- Worker nền cho queue và release lock

Kiến trúc nghiệp vụ hiện tại là:

- `Event` là thực thể cha để mô tả nội dung sự kiện.
- `Show` là đơn vị bán vé thực sự.
- `SeatZone` và `Seat` gắn với `Show`.
- `QueueEntry` gắn với `Show`.
- `Order`, `OrderItem`, `Ticket` gắn với vòng đời mua vé theo `Show`.

Đây là điểm quan trọng nhất của backend hiện tại.

Nếu bạn vẫn nghĩ “event là thứ bán vé trực tiếp”, bạn sẽ đọc lệch toàn bộ service và test.

## 3. Thứ tự nên đọc

Nếu là người mới, nên đọc theo thứ tự này:

1. `BE/app/main.py`
2. `BE/app/api/router.py`
3. `BE/app/api/deps.py`
4. `BE/app/core/config.py`
5. `BE/app/core/db.py`
6. `BE/app/models/event.py`
7. `BE/app/models/seat.py`
8. `BE/app/models/order.py`
9. `BE/app/models/queue.py`
10. `BE/app/schemas/event.py`
11. `BE/app/schemas/booking.py`
12. `BE/app/schemas/queue.py`
13. `BE/app/services/event_service.py`
14. `BE/app/services/queue_service.py`
15. `BE/app/services/booking_service.py`
16. `BE/app/services/inventory_service.py`
17. `BE/app/api/routes/events.py`
18. `BE/app/api/routes/queue.py`
19. `BE/app/api/routes/bookings.py`
20. `BE/app/api/routes/admin.py`

Lý do:

- `main.py` cho bạn biết app khởi động ra sao.
- `router.py` cho bạn biết route nào đang được mount.
- `models` cho bạn biết dữ liệu thật.
- `schemas` cho bạn biết contract request/response.
- `services` cho bạn biết business logic thật.
- `routes` cho bạn biết HTTP layer chỉ là lớp mỏng gọi service nào.

## 4. Cấu trúc thư mục backend

### `BE/app/main.py`

Đây là entrypoint của backend.

Nó làm các việc chính:

- Tạo ứng dụng FastAPI.
- Gắn CORS.
- Mount router API.
- Mount WebSocket route.
- Mount static files.
- Tạo bảng khi startup.
- Chạy các bước “ensure schema compatibility”.
- Seed demo data.
- Khởi động worker orchestration.

Đây là file đầu tiên bạn cần đọc nếu backend không boot hoặc startup treo.

### `BE/app/api/router.py`

File này gom toàn bộ route lại dưới prefix `/api`.

Nó mount các route:

- auth
- events
- shows
- queue
- bookings
- admin
- search
- venues
- seatmap
- help
- site settings

Nếu endpoint không xuất hiện trên Swagger, kiểm tra file này trước.

### `BE/app/api/deps.py`

Chứa dependency dùng chung:

- lấy DB session
- lấy user hiện tại từ JWT
- guard customer
- guard admin

Khi gặp lỗi quyền truy cập hoặc lỗi token, hãy đọc file này.

### `BE/app/core/`

#### `config.py`

Tập trung toàn bộ cấu hình môi trường:

- database
- redis
- cors
- jwt
- frontend url
- oauth config

Đây là file đầu mối cho môi trường chạy.

#### `db.py`

Tạo SQLAlchemy async engine và session maker.

Nếu backend không nói chuyện được với database, file này là nơi cần kiểm tra ngay.

#### `security.py`

Xử lý:

- hash password
- verify password
- tạo access token

#### `rate_limit.py`

Rate limit cơ bản cho route queue, booking, auth nếu có áp dụng.

#### `cache.py`

Quản lý cache namespace cho:

- event list/detail
- show seats
- user tickets

#### `redis_client.py`

Kết nối Redis dùng cho cache và các tác vụ hỗ trợ.

### `BE/app/models/`

Đây là lớp ORM, mô tả database.

#### `event.py`

Quan trọng nhất của domain hiện tại.

Chứa:

- `Event`
- `Show`
- `SeatZone`
- `ShowPolygon`

Bạn phải nắm chắc file này để hiểu kiến trúc show-based.

#### `seat.py`

Chứa model ghế cụ thể.

Các field quan trọng:

- `show_id`
- `zone_id`
- `seat_label`
- `status`
- `lock_expires_at`
- `locked_by_user_id`
- `is_admin_locked`
- `x_coord`
- `y_coord`
- `rotation`

#### `order.py`

Chứa:

- `Order`
- `OrderItem`
- `Ticket`
- `TicketCancellation`

Đây là nơi mô tả vòng đời mua vé.

#### `queue.py`

Chứa `QueueEntry`.

Quan trọng cho hàng chờ ảo:

- `token`
- `status`
- `position_hint`
- `admitted_at`
- `expires_at`
- `last_seen_at`

#### `user.py`

Thông tin user, role, social IDs.

#### `venue.py`

Venue studio:

- venue
- layout
- section
- polygon

#### `help.py`, `review.py`

Module hỗ trợ và review.

### `BE/app/schemas/`

Đây là hợp đồng dữ liệu.

#### File quan trọng nên đọc trước

- `event.py`
- `booking.py`
- `queue.py`
- `seatmap.py`
- `auth.py`
- `admin.py`
- `venue.py`

Khi API lỗi `422`, gần như chắc chắn bạn cần đối chiếu file schema tương ứng.

### `BE/app/services/`

Đây là tầng business logic thật sự.

#### `event_service.py`

Rất quan trọng.

Nó xử lý:

- tạo event
- tạo show
- clone inventory từ venue layout
- tạo zone
- lấy event detail
- lấy show detail
- build seat matrix

Nếu route event/show trả dữ liệu sai, bạn phải đọc file này.

#### `queue_service.py`

Xử lý:

- join queue
- get queue status
- heartbeat token
- ensure queue access
- mark queue completed
- process virtual queue
- cleanup queue rows cũ

Đây là trung tâm của virtual waiting room.

#### `booking_service.py`

Xử lý:

- lock seat
- release seat
- checkout
- fetch my tickets
- cancel ticket
- release expired locks

Đây là trung tâm của vòng đời booking.

#### `inventory_service.py`

Xử lý seatmap có tọa độ cho frontend canvas.

Nếu seat matrix đúng nhưng seatmap canvas sai, hãy đọc file này.

#### `dashboard_service.py`

Tính toán:

- dashboard summary
- revenue series
- audience distribution

#### `map_processor.py`

Xử lý SVG background thành dữ liệu seat/section khi làm venue studio.

### `BE/app/api/routes/`

HTTP layer.

Mỗi route file nên mỏng và chủ yếu gọi service.

#### `auth.py`

- register
- login
- firebase token login
- discord oauth
- me
- update profile

#### `events.py`

- list event
- event detail
- show detail
- event reviews

#### `queue.py`

- join queue
- poll queue status
- heartbeat token

#### `bookings.py`

- lock
- release
- checkout
- my tickets
- cancel ticket

#### `seatmap.py`

- trả seatmap theo `show_id`

#### `admin.py`

File lớn nhất của API.

Nó xử lý:

- event CRUD
- show CRUD
- zone CRUD
- seat CRUD
- seat sync
- show polygon CRUD
- image upload
- dashboard stats
- admin user/ticket analytics

Khi đọc file này, nên đọc theo feature cụ thể chứ không đọc một mạch từ đầu đến cuối.

#### `venues.py`

Venue studio:

- venue CRUD
- layout CRUD
- section CRUD
- template seat CRUD
- template polygon CRUD
- background upload/process

### `BE/app/workers/tasks.py`

Worker nền chạy các việc định kỳ:

- release lock hết hạn
- process queue
- cleanup queue
- broadcast admin dashboard summary

Nếu bạn thấy ghế bị lock nhưng không tự nhả sau timeout, file này là nơi cần kiểm tra.

### `BE/app/ws/connection_manager.py`

Quản lý WebSocket connection cho:

- seat realtime
- admin dashboard realtime
- help center realtime

## 5. Model nghiệp vụ cốt lõi

Đây là chuỗi quan hệ quan trọng nhất:

1. `User`
2. `Event`
3. `Show`
4. `SeatZone`
5. `Seat`
6. `QueueEntry`
7. `Order`
8. `OrderItem`
9. `Ticket`
10. `TicketCancellation`

Hiểu ngắn gọn:

- User vào hệ thống.
- Event là “vỏ nội dung”.
- Show là “phiên bán vé”.
- SeatZone và Seat là inventory của show.
- QueueEntry là quyền vào booking.
- Order và OrderItem là giao dịch.
- Ticket là vé đã phát hành.
- TicketCancellation là log hủy vé.

## 6. Luồng request quan trọng

### Luồng 1: List event public

1. Request vào `routes/events.py`.
2. Route gọi `list_live_events` trong `event_service.py`.
3. Service query `Event`.
4. Service build response card.
5. Response được cache theo namespace public.

### Luồng 2: Queue

1. Customer gọi `POST /api/shows/{show_id}/queue/join`.
2. Route trong `routes/queue.py` lấy show.
3. `queue_service.join_show_queue` tạo hoặc tái sử dụng queue token.
4. User poll `GET /status/{token}`.
5. Worker định kỳ gọi `process_virtual_queue`.
6. Khi admitted, user mới được phép lock/checkout.

### Luồng 3: Lock ghế

1. Customer gọi `POST /api/bookings/lock`.
2. `booking_service.lock_seats` lấy `show_id`.
3. Service gọi `ensure_queue_access`.
4. Service `SELECT ... FOR UPDATE` trên ghế.
5. Ghế hợp lệ được chuyển sang `locked`.
6. Cache seat bị invalidate.
7. WebSocket broadcast cập nhật realtime.

### Luồng 4: Checkout

1. Customer gọi `POST /api/bookings/checkout`.
2. Service kiểm tra ghế đang lock bởi đúng user.
3. Tạo `Order`.
4. Tạo `OrderItem`.
5. Tạo `Ticket`.
6. Chuyển ghế sang `sold`.
7. Queue token được đánh dấu `completed`.
8. Invalidate cache và broadcast realtime.

### Luồng 5: Cancel ticket

1. Customer gọi `DELETE /api/bookings/my-tickets/{ticket_id}`.
2. Service tạo `TicketCancellation`.
3. Ghế được trả về `available`.
4. Vé active bị gỡ khỏi danh sách active và xuất hiện ở lịch sử cancelled.

### Luồng 6: Admin venue layout clone sang show

1. Admin tạo venue/layout/section/template seats.
2. Admin tạo event metadata.
3. Admin tạo show gắn `venue_id` và `venue_layout_id`.
4. `create_show_with_inventory` gọi `_clone_layout_inventory`.
5. Template seats được clone thành inventory thật của show.

## 7. File nào bắt buộc đọc kỹ

- `BE/app/main.py`
- `BE/app/api/router.py`
- `BE/app/models/event.py`
- `BE/app/models/seat.py`
- `BE/app/models/order.py`
- `BE/app/schemas/event.py`
- `BE/app/services/event_service.py`
- `BE/app/services/queue_service.py`
- `BE/app/services/booking_service.py`
- `BE/app/api/routes/admin.py`

## 8. File nào có thể đọc sau

- `BE/alembic/README`
- `BE/alembic/script.py.mako`
- migration cũ trong `BE/alembic/versions/`
- `BE/scripts/concurrency_demo.py`
- một phần file `help.py`, `review.py`, `site_settings.py`

Lý do:

- Chúng không phải điểm vào logic chính của booking flow.
- Người mới dễ bị loãng nếu đọc quá sớm.

## 9. Cách chạy local nên hiểu như thế nào

Theo trạng thái hiện tại của môi trường:

- Frontend chạy bằng `bash` trên `5173`
- Backend chạy bằng `bash` trên `8000`
- PostgreSQL đang dùng ở `5432`
- Redis Docker hiện đang map host `6380 -> container 6379`

Khi chạy backend local trong môi trường hiện tại, cần bảo đảm `REDIS_URL` trỏ đúng tới Redis host port thật.

Ví dụ:

```bash
cd BE
REDIS_URL=redis://127.0.0.1:6380/0 ../.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Điểm cần nhớ:

- Backend local không nên trùng port với container backend cũ.
- Nếu port `8000` hoặc `5173` bị Docker chiếm, phải giải phóng port trước khi chạy local.

## 10. Test suite backend

Hiện test backend đã được cập nhật theo contract show-based.

Kết quả vòng verify gần nhất:

- `36 passed`

Bộ test hiện bao phủ các mảng:

- auth contract
- config contract
- search contract
- seat visibility contract
- booking lifecycle
- virtual queue
- admin seat endpoints
- venue API
- SVG map processor

## 11. Quy trình debug backend nên dùng

Khi backend lỗi, nên đi theo thứ tự:

1. Xem request đi vào route file nào.
2. Xem route gọi service nào.
3. Mở schema request/response.
4. Mở model liên quan.
5. Đối chiếu query SQLAlchemy trong service.
6. Kiểm tra dependency auth/admin/customer.
7. Nếu là realtime, kiểm tra WebSocket manager.
8. Nếu là timeout/lock không tự nhả, kiểm tra worker tasks.

## 12. Tóm tắt cho người mới

Nếu bạn chỉ có 30 phút để hiểu backend, hãy nhớ:

- `main.py` là nơi app boot và seed dữ liệu.
- `router.py` cho biết endpoint nào tồn tại.
- `Event` là cha, `Show` mới là đơn vị bán vé thật.
- `queue_service.py` giữ virtual waiting room.
- `booking_service.py` giữ lock/checkout/cancel ticket.
- `inventory_service.py` giữ seatmap canvas.
- `admin.py` là route file lớn nhất và nhạy cảm nhất.

Chỉ cần nắm chắc các điểm đó, bạn đã hiểu phần lớn xương sống backend của TicketRush.
