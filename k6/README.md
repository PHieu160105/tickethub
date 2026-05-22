# TicketRush k6 Tests

Các script này dùng để kiểm tra thực tế Waiting Room và tải đọc seat matrix.

## Yêu cầu

- Cài k6: <https://k6.io/docs/get-started/installation/>
- Backend đang chạy, mặc định `http://localhost:8000`
- DB đã seed demo data và có `SHOW_ID` hợp lệ

## Biến môi trường chung

```powershell
$env:BASE_URL="http://localhost:8000"
$env:API_PREFIX="/api"
$env:SHOW_ID="1"
```

## Chạy nhanh

## Test UI trên localhost:5173

Backend chính của bạn chạy `http://localhost:8000`, frontend chạy `http://localhost:5173`.
Redis Docker đang expose ra host port `6380`, nên `.env` cần là:

```env
REDIS_PORT=6380
```

Sau khi đổi `.env`, restart backend để process `8000` đọc lại Redis config.

Bật Waiting Room cho một show cụ thể và giới hạn số user được vào màn chọn ghế cùng lúc:

```powershell
powershell -ExecutionPolicy Bypass -File k6/waiting-room-local.ps1 -ShowId 1 -ActiveUsers 10 -ReleaseBatch 10 -PressureUsers 20
```

Nếu muốn chọn bằng event slug, script sẽ lấy show đầu tiên của event đó:

```powershell
powershell -ExecutionPolicy Bypass -File k6/waiting-room-local.ps1 -EventKey "ten-su-kien" -ActiveUsers 10 -ReleaseBatch 10 -PressureUsers 20
```

Ý nghĩa tham số:

- `ShowId`: buổi diễn cần test Waiting Room.
- `EventKey`: slug event, dùng khi không muốn nhớ `ShowId`.
- `ActiveUsers`: số người tối đa được giữ token `ADMITTED` cùng lúc.
- `ReleaseBatch`: mỗi lượt worker sẽ cấp tối đa bao nhiêu người.
- `PressureUsers`: số VU k6 tạo áp lực vào seat route, không spam login/register.
- `ResetQueue`: expire các token waiting/admitted hiện có của show trước khi test.
- `NoPressure`: chỉ bật Waiting Room và set cấu hình, không chạy k6.

Tắt Waiting Room và đưa show về mặc định:

```powershell
powershell -ExecutionPolicy Bypass -File k6/waiting-room-stop.ps1 -ShowId 1 -ActiveUsers 200 -ReleaseBatch 50
```

Chuẩn bị nhanh một hàng chờ thật để test tay bằng trình duyệt:

```powershell
powershell -ExecutionPolicy Bypass -File k6/prepare-manual-queue.ps1 -ShowId 2 -ActiveUsers 10 -ReleaseBatch 1 -QueueUsers 100
```

Script này sẽ:

- expire toàn bộ token `WAITING`/`ADMITTED` cũ của show.
- set `max_active_queue_tokens` và `queue_release_batch`.
- bật Waiting Room trong Redis.
- chạy k6 tạo user vào queue rồi dừng nhanh, để còn người `WAITING` cho bạn vào test bằng nick thật.

Smoke test backend, auth và seat route:

```powershell
k6 run k6/smoke.js
```

Load đọc seat matrix. Khi hệ thống vào Waiting Room, script chấp nhận `429 WAITING_ROOM_REQUIRED` là hành vi đúng:

```powershell
$env:VUS="100"
$env:HOLD="2m"
k6 run k6/seat-read-load.js
```

Giữ tải để test UI phòng chờ bằng trình duyệt thật, không tạo user ảo nên ít làm nghẽn login/join queue hơn:

```powershell
$env:VUS="80"
$env:HOLD="10m"
k6 run k6/waiting-room-seat-pressure.js
```

Kiểm tra guard Waiting Room. Để demo rõ, bật state bằng Redis trước:

```powershell
redis-cli SET waiting_room:state waiting_room
k6 run k6/waiting-room-guard.js
redis-cli SET waiting_room:state normal
```

Kiểm tra luồng join/poll/admitted/heartbeat:

```powershell
$env:VUS="20"
$env:ITERATIONS="20"
$env:QUEUE_WAIT_TIMEOUT_SECONDS="120"
k6 run k6/queue-flow.js
```

Kiểm tra luồng được vào phòng chờ rồi giữ ghế. Mặc định script sẽ release ghế sau khi lock để không tạo đơn hàng thật:

```powershell
$env:VUS="5"
$env:ITERATIONS="5"
k6 run k6/booking-lock-flow.js
```

Nếu muốn test checkout mô phỏng thật, bật `CHECKOUT=true`:

```powershell
$env:CHECKOUT="true"
k6 run k6/booking-lock-flow.js
```

## Script

- `smoke.js`: kiểm tra backend sống, login/register test user, gọi `/shows/:id/seats`.
- `seat-read-load.js`: tạo tải đọc seat matrix để quan sát latency, lỗi DB, và Waiting Room gate.
- `waiting-room-seat-pressure.js`: tạo áp lực vào seat route để test UI người dùng thật mà không spam auth/register.
- `waiting-room-guard.js`: xác nhận khi đang Waiting Room thì route nặng trả `WAITING_ROOM_REQUIRED`, còn queue endpoints vẫn hoạt động.
- `queue-flow.js`: mô phỏng user vào phòng chờ, poll trạng thái, heartbeat và vào seat matrix khi được admit.
- `booking-lock-flow.js`: mô phỏng user được admit, lấy ghế available đầu tiên, lock ghế, rồi release hoặc checkout nếu bật `CHECKOUT=true`.
- `prepare-manual-queue.ps1`: chuẩn bị dữ liệu queue thật cho test tay trên frontend.

## Ghi chú

- Mỗi VU dùng email dạng `k6-...@ticketrush-load.example.com`; nếu user đã tồn tại script sẽ login lại.
- Nếu `queue-flow.js` timeout, thường là worker chưa chạy, batch/active token quá nhỏ, hoặc chưa có user nào được admit trong thời gian cấu hình.
- Với test overload tự động, không set Redis thủ công; chạy `seat-read-load.js` với VUS cao và quan sát backend logs/Redis state.
