# TicketRush Frontend (React)

Frontend React cho TicketRush, bám theo bộ thiết kế trong thư mục `stitch`:
- Home / Event discovery
- Seat map booking realtime
- Virtual queue waiting room
- Admin dashboard realtime
- Admin event management (seat matrix form)
- My tickets + QR

## 1) Stack
- React 19 + TypeScript + Vite
- React Router
- Axios
- WebSocket (native)
- `qrcode.react`
- CSS custom theme theo design system “Digital Concierge”

## 2) Cấu trúc thư mục

```txt
FE/
├─ src/
│  ├─ main.tsx                   # App bootstrap + router + auth provider
│  ├─ App.tsx                    # Route map toàn app
│  ├─ styles/
│  │  └─ index.css               # Design tokens + responsive styles
│  ├─ lib/
│  │  ├─ api.ts                  # Axios client + API wrappers
│  │  └─ storage.ts              # local/session storage helpers
│  ├─ hooks/
│  │  ├─ useAuth.tsx             # Auth context + login/register/logout
│  │  └─ useWebSocketHeartbeat.ts# WS hook + ping keepalive
│  ├─ components/
│  │  ├─ TopNav.tsx
│  │  ├─ Footer.tsx
│  │  ├─ ProtectedRoute.tsx
│  │  ├─ AdminSidebar.tsx
│  │  ├─ EventCard.tsx
│  │  └─ SeatLegend.tsx
│  ├─ pages/
│  │  ├─ HomePage.tsx
│  │  ├─ LoginPage.tsx
│  │  ├─ RegisterPage.tsx
│  │  ├─ MyAccountPage.tsx
│  │  ├─ QueuePage.tsx
│  │  ├─ SeatBookingPage.tsx
│  │  ├─ MyTicketsPage.tsx
│  │  ├─ AdminDashboardPage.tsx
│  │  └─ AdminEventsPage.tsx
│  └─ types.ts                   # Shared TS interfaces
├─ Dockerfile
└─ package.json
```

## 3) Route map
- `/` : landing + event search
- `/login` : login
- `/register` : register
- `/my-account` : profile self-service page
- `/events/:eventKey/queue` : waiting room
- `/events/:eventKey/seats` : seat booking screen
- `/my-tickets` : customer ticket management + QR
- `/admin/dashboard` : admin realtime dashboard
- `/admin/events` : admin create/manage events

## 4) Tính năng đã triển khai

### Customer
- Tìm kiếm và xem danh sách sự kiện
- Vào hàng chờ ảo khi event bật queue
- Chọn ghế trực quan theo ma trận
- Realtime seat updates qua WebSocket (không cần F5)
- Lock/release ghế
- Checkout xác nhận đơn hàng (không cần payment gateway thật)
- Quản lý vé điện tử và QR
- Cập nhật thông tin cá nhân ở My Account

### Admin
- Tạo sự kiện mới
- Sửa/xóa sự kiện đã release
- Cấu hình seat matrix theo zone (rows, seats/row, price, color)
- Theo dõi dashboard realtime (summary + chart + occupancy + demographics)
- Seat inspector: chọn nhiều ghế (kể cả ghế sold) để xem info người mua/đang giữ ghế
- Join queue để monitor seat map nhưng không được confirm checkout

## 5) Giao diện và design
- Dùng palette + layering theo `stitch/DESIGN.md`
- Không dùng divider cứng làm bố cục chính
- Typography Inter + Manrope
- Layout responsive mobile/desktop
- Background gradient + glass nav để giữ “brand soul”
- Có nút chuyển theme Light/Dark trực tiếp trên thanh điều hướng

## 6) Chạy local

```bash
cd FE
npm install
npm run dev
```

Mặc định chạy tại `http://localhost:5173`.

## 7) Build & lint

```bash
cd FE
npm run build
npm run lint
```

Kết quả hiện tại: build và lint đều pass.

## 8) Biến môi trường
Dùng file `.env` ở root:
- `VITE_API_BASE_URL`
- `VITE_WS_BASE_URL`

## 9) Gợi ý sử dụng nhanh
1. Đăng nhập customer seed: `customer@ticketrush.com / Customer@123`
2. Chọn event ở Home -> queue -> seat booking -> checkout
3. Vào `My Tickets` để xem QR
4. Đăng nhập admin seed: `admin@ticketrush.com / Admin@123`
5. Mở `Admin Dashboard` và `Admin Events` để quản trị
