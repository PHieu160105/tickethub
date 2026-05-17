# Guide Frontend TicketRush

## 1. Mục tiêu của tài liệu này

Tài liệu này dành cho người mới chưa quen React, Vite, TypeScript hoặc chưa từng đọc code của dự án.

Đây là file guide frontend chuẩn nên đọc.

Các file tên gần giống như `guide_FE.md` hoặc `guide_BE.md` không phải bản ưu tiên khi onboarding.

Mục tiêu:

- Giúp bạn biết phải đọc file nào trước.
- Giúp bạn hiểu luồng dữ liệu của frontend đi từ route tới component, hook và API.
- Giúp bạn phân biệt file quan trọng và file có thể đọc sau.
- Giúp bạn sửa giao diện mà không làm vỡ luồng booking hoặc admin.

Frontend hiện chạy bằng Vite + React + TypeScript tại:

- `http://localhost:5173`

Frontend gọi backend qua:

- `http://localhost:8000/api`

Cách chạy đúng trong môi trường local:

- Chạy frontend bằng `bash`
- Chạy backend bằng `bash`
- Chỉ dùng Docker Compose cho `postgres` và `redis`

## 2. Bức tranh tổng thể

Frontend là một SPA (Single Page Application).

Ứng dụng có 2 khu vực lớn:

- Khu vực khách hàng: xem sự kiện, xem show, vào queue, chọn ghế, checkout, xem vé.
- Khu vực admin: quản lý event, show, venue, seat planner, thống kê, user, help.

Luồng render tổng quát:

1. Trình duyệt vào `FE/src/main.tsx`.
2. `main.tsx` render `FE/src/App.tsx`.
3. `App.tsx` gắn các context toàn cục:
   - `ThemeProvider`
   - `LoadingProvider`
   - `AuthProvider`
4. `App.tsx` khai báo toàn bộ route customer và admin.
5. Mỗi page gọi hook hoặc API client để lấy dữ liệu từ backend.

## 3. Thứ tự nên đọc

Nếu bạn là người mới, nên đọc theo thứ tự này:

1. `FE/src/main.tsx`
2. `FE/src/App.tsx`
3. `FE/src/context/AuthContext.tsx`
4. `FE/src/lib/api.ts`
5. `FE/src/types.ts`
6. `FE/src/pages/customer/Home.tsx`
7. `FE/src/pages/customer/EventDetail.tsx`
8. `FE/src/pages/customer/VirtualQueue.tsx`
9. `FE/src/pages/customer/SeatSelection.tsx`
10. `FE/src/pages/customer/Checkout.tsx`
11. `FE/src/pages/customer/CustomerTicket.tsx`
12. `FE/src/pages/admin/Dashboard.tsx`
13. `FE/src/pages/admin/Events.tsx`
14. `FE/src/pages/admin/Venues.tsx`
15. `FE/src/pages/admin/SeatPlanner.tsx`

Lý do:

- `main.tsx` và `App.tsx` cho bạn biết app được dựng thế nào.
- `AuthContext.tsx` cho bạn biết user/token được giữ ở đâu.
- `lib/api.ts` cho bạn biết frontend đang gọi backend bằng contract nào.
- `types.ts` cho bạn biết shape dữ liệu thật.
- Các page chính cho bạn biết nghiệp vụ được ráp ra sao.

## 4. Cấu trúc thư mục frontend

### `FE/src/main.tsx`

Điểm vào của ứng dụng.

Nhiệm vụ:

- Import CSS gốc.
- Mount React app vào DOM.

Bạn gần như luôn đọc file này đầu tiên, nhưng ít khi phải sửa.

### `FE/src/App.tsx`

Đây là file quan trọng nhất của frontend.

Nó làm 3 việc:

- Gắn provider toàn cục.
- Khai báo route customer.
- Khai báo route admin và guard quyền admin.

Bạn cần đọc kỹ file này để biết:

- URL nào map tới page nào.
- Page nào yêu cầu login.
- Page nào yêu cầu quyền admin.

### `FE/src/context/`

#### `AuthContext.tsx`

Đây là context quan trọng nhất.

Nó quản lý:

- User hiện tại.
- Token hiện tại.
- Trạng thái `isAuthenticated`.
- Trạng thái `isAdmin`.
- Login, register, update profile, logout.
- Nhận token từ external auth flow.

Khi debug lỗi login, logout, redirect sai hoặc gọi API bị `401`, hãy đọc file này trước.

#### `ThemeContext.tsx`

Quản lý theme light/dark.

Nó ghi theme vào `localStorage` và thêm hoặc bỏ class `dark` trên `document.documentElement`.

Đây là file giao diện, không ảnh hưởng logic nghiệp vụ booking.

#### `LoadingContext.tsx`

Context nhỏ dùng để phát tín hiệu loading toàn cục nếu cần.

Hiện vai trò của nó nhẹ hơn `AuthContext`.

### `FE/src/lib/`

#### `api.ts`

File quan trọng bậc hai, sau `App.tsx` và `AuthContext.tsx`.

Nó chứa:

- Axios instance.
- Interceptor tự gắn JWT token.
- Hàm chuẩn hóa lỗi API.
- Toàn bộ API client dùng chung:
  - `authApi`
  - `eventApi`
  - `queueApi`
  - `bookingApi`
  - `adminApi`
  - `seatmapApi`
  - `helpApi`
  - `siteSettingsApi`

Nếu backend đổi route hoặc đổi response JSON, bạn sửa file này trước.

#### `storage.ts`

Quản lý local storage:

- Token auth.
- User profile.
- Queue token.

Nếu app bị lỗi “đăng nhập rồi nhưng reload là mất”, file này là nơi cần kiểm tra.

#### `firebase.ts`

Chứa cấu hình và logic hỗ trợ Google sign-in qua Firebase.

Nếu bạn chỉ học flow email/password trước, có thể đọc file này sau.

#### `favourites.ts`

Quản lý favourite cục bộ ở phía client.

Đây là logic tiện ích, không phải trục nghiệp vụ chính.

### `FE/src/constants/`

#### `api.ts`

Chứa URL và timeout cho API/WS.

#### `index.ts`

Các export gom lại để import tiện hơn.

### `FE/src/types.ts`

Đây là “bản hợp đồng dữ liệu” ở phía frontend.

Nó định nghĩa type cho:

- Event
- Show
- Seat
- Ticket
- Queue
- Admin stats
- Venue layout
- Help center

Nếu bạn không chắc API trả về gì, hãy đọc file này trước khi đọc component.

### `FE/src/features/`

Tầng `features` gom logic theo nghiệp vụ.

#### `features/events/`

- `api/eventsApi.ts`: wrapper gọi event/show endpoints.
- `hooks/useEvents.ts`: hook lấy list event, detail event, seats của show.

#### `features/booking/`

- `api/bookingApi.ts`
- `api/queueApi.ts`
- `hooks/useBooking.ts`

Phần này phục vụ:

- Lock ghế
- Release ghế
- Checkout
- Join queue
- Poll queue

Nếu cần sửa flow mua vé, đây là cụm thư mục phải đọc kỹ.

#### `features/auth/`

Có một phần logic auth cũ hơn trong `features/auth/` và `src/hooks/useAuth.tsx`.

Trong code hiện tại, app chính dùng `src/context/AuthContext.tsx`.

Kết luận:

- `src/context/AuthContext.tsx` là nguồn auth đang dùng thật.
- `features/auth/*` và `src/hooks/useAuth.tsx` nên xem là code phụ hoặc code cũ, đọc sau.

### `FE/src/components/`

#### `components/layout/`

Các khung bố cục chính:

- `CustomerLayout.tsx`
- `AdminLayout.tsx`
- `Navbar.tsx`
- `Footer.tsx`
- `AdminSidebar.tsx`
- `CustomerSidebar.tsx`

Khi chỉnh bố cục, menu hoặc thanh điều hướng, bạn làm ở đây.

#### `components/ui/`

Các component dùng lại:

- Button
- Input
- Card
- Modal
- Badge
- TicketCard
- Toast
- SearchAutocompleteInput
- GlobalLoader

Đây là tầng “giao diện tái sử dụng”.

Nếu muốn thay style đồng bộ, ưu tiên sửa ở đây thay vì copy CSS trong từng page.

#### `components/customer/`

Component chuyên cho seat selection và trang info:

- `CustomerSeatMap.tsx`
- `SeatMapLegend.tsx`
- `SeatSelectionSummary.tsx`
- `InfoSectionNav.tsx`

#### `components/admin/`

Hiện nổi bật nhất là:

- `InteractiveSeatCanvas.tsx`

Đây là component canvas quan trọng cho admin seat planner.

### `FE/src/pages/customer/`

Các page phía khách hàng.

Nên đọc theo thứ tự nghiệp vụ:

- `Home.tsx`
- `Search.tsx`
- `EventDetail.tsx`
- `VirtualQueue.tsx`
- `SeatSelection.tsx`
- `Checkout.tsx`
- `Confirmation.tsx`
- `CustomerTicket.tsx`
- `CustomerProfile.tsx`
- `Help.tsx`
- `Setting.tsx`
- `Info.tsx`

Giải thích vai trò:

- `Home.tsx`: landing page.
- `Search.tsx`: search/filter customer.
- `EventDetail.tsx`: xem event và danh sách show.
- `VirtualQueue.tsx`: hàng chờ ảo.
- `SeatSelection.tsx`: chọn ghế, gọi lock, dùng websocket.
- `Checkout.tsx`: xác nhận checkout.
- `Confirmation.tsx`: hiển thị kết quả sau thanh toán.
- `CustomerTicket.tsx`: vé đã mua, filter/tab, cancel ticket.
- `CustomerProfile.tsx`: cập nhật hồ sơ.
- `Help.tsx`: chat/help center customer.
- `Setting.tsx`: cài đặt cá nhân.
- `Info.tsx`: thông tin tĩnh.
- `Payments.tsx`: hiện chỉ redirect sang settings, chưa có màn hình riêng.

### `FE/src/pages/admin/`

Các page phía admin:

- `Dashboard.tsx`
- `Events.tsx`
- `Venues.tsx`
- `SeatPlanner.tsx`
- `Tickets.tsx`
- `Analytics.tsx`
- `Users.tsx`
- `Help.tsx`
- `Settings.tsx`

Vai trò:

- `Dashboard.tsx`: số liệu tổng quan.
- `Events.tsx`: CRUD event/show.
- `Venues.tsx`: venue studio, layout, section, background, template seat.
- `SeatPlanner.tsx`: planner cho show cụ thể.
- `Tickets.tsx`: doanh thu và bán vé.
- `Analytics.tsx`: biểu đồ/phân tích.
- `Users.tsx`: quản lý người dùng.
- `Help.tsx`: inbox hỗ trợ realtime.
- `Settings.tsx`: cấu hình admin và theme.

## 5. Luồng dữ liệu quan trọng

### Luồng 1: Customer browse event

1. User vào `Home.tsx` hoặc `Search.tsx`.
2. Page gọi `useEvents`.
3. `useEvents` gọi `eventsApi.list`.
4. `eventsApi.list` gọi `GET /api/events`.
5. Kết quả được render bằng `EventCard`.

### Luồng 2: Customer xem chi tiết event

1. User vào route `/event/:eventKey`.
2. `EventDetail.tsx` lấy `eventKey` từ URL.
3. Page gọi `eventApi.detail`.
4. Backend trả event + danh sách show con.
5. User chọn show để vào queue hoặc seat selection.

### Luồng 3: Queue -> chọn ghế -> checkout

1. User vào `VirtualQueue.tsx`.
2. Page gọi `queueApi.join`.
3. Hệ thống nhận `queue token`.
4. Page poll `queueApi.status`.
5. Khi admitted, user vào `/shows/:showId/seats`.
6. `SeatSelection.tsx` gọi:
   - `eventApi.seats`
   - `seatmapApi.get`
7. Khi user bấm checkout:
   - `bookingApi.lock`
   - điều hướng sang `Checkout.tsx`
8. `Checkout.tsx` gọi `bookingApi.checkout`.
9. Sau khi success, app điều hướng sang `Confirmation.tsx`.

### Luồng 4: Realtime seat updates

1. `SeatSelection.tsx` mở WebSocket tới backend.
2. Khi ghế bị lock/release/sold, backend broadcast.
3. UI refresh lại trạng thái seat mà không cần reload trang.

### Luồng 5: Admin quản lý seat planner

1. Admin vào `Events.tsx` hoặc `Venues.tsx`.
2. Chọn event/show cần sửa.
3. Điều hướng tới `SeatPlanner.tsx`.
4. Page gọi admin API để:
   - tạo zone
   - tạo seat đơn
   - bulk generate seat
   - sync seat
   - sửa/xóa seat
   - quản lý polygon

## 6. File nào bắt buộc đọc kỹ

- `FE/src/App.tsx`
- `FE/src/context/AuthContext.tsx`
- `FE/src/lib/api.ts`
- `FE/src/types.ts`
- `FE/src/pages/customer/SeatSelection.tsx`
- `FE/src/pages/customer/Checkout.tsx`
- `FE/src/pages/admin/Events.tsx`
- `FE/src/pages/admin/Venues.tsx`
- `FE/src/pages/admin/SeatPlanner.tsx`

## 7. File nào có thể đọc sau

- `FE/src/mocks/*`
- `FE/src/assets/*`
- `FE/src/pages/customer/Payments.tsx`
- `FE/src/pages/customer/Queue.tsx`
- `FE/src/hooks/useAuth.tsx`
- `FE/src/features/auth/*`

Lý do:

- Chúng không phải trung tâm nghiệp vụ đang chạy chính.
- Một số file là code phụ, mock hoặc luồng mỏng.

## 8. Những điểm cần chú ý khi sửa frontend

### 8.1 Auth thật đang dùng context nào

Dự án có hơn một chỗ chứa auth logic.

Chỗ đang dùng bởi app chính là:

- `FE/src/context/AuthContext.tsx`

Khi sửa login/logout/profile, ưu tiên sửa ở đây trước.

### 8.2 Seat selection là page nhạy cảm nhất

`FE/src/pages/customer/SeatSelection.tsx` là file dễ phát sinh bug nhất vì nó đồng thời quản lý:

- fetch dữ liệu ghế
- seatmap canvas
- websocket
- queue token
- selected seat state
- lock/release/checkout preparation

Khi sửa file này:

- Không được chỉ nhìn UI.
- Phải kiểm tra luôn lock flow và checkout flow.

### 8.3 Admin planner và venue studio rất lớn

Hai file dài nhất hiện tại là:

- `FE/src/pages/admin/SeatPlanner.tsx`
- `FE/src/pages/admin/Venues.tsx`

Khi sửa:

- Tách thay đổi thành từng cụm nhỏ.
- Test lại thao tác kéo/thả, sync, save, undo/redo nếu có liên quan.

### 8.4 Lint hiện đã pass nhưng còn warnings

Warnings chủ yếu là:

- dependency của React hooks
- effect phức tạp trong các màn admin lớn

Điều này không chặn build, nhưng vẫn là vùng cần tiếp tục cải thiện.

## 9. Quy trình debug nên dùng

Khi frontend lỗi, debug theo thứ tự:

1. Mở `App.tsx` xem route có đúng không.
2. Mở page đang lỗi.
3. Xem page gọi hook nào.
4. Mở hook tương ứng.
5. Mở `lib/api.ts` xem endpoint thật.
6. Đối chiếu với backend route/schema.
7. Kiểm tra token trong `storage.ts`.
8. Nếu là seat realtime, kiểm tra luôn WebSocket.

## 10. Tóm tắt cho người mới

Nếu bạn chỉ có 30 phút để hiểu frontend, hãy nhớ:

- `App.tsx` cho biết app có những route nào.
- `AuthContext.tsx` giữ user và token.
- `lib/api.ts` là cầu nối với backend.
- `types.ts` cho biết JSON backend trông ra sao.
- `SeatSelection.tsx` là trung tâm của flow booking.
- `Venues.tsx` và `SeatPlanner.tsx` là trung tâm của flow admin.

Chỉ cần hiểu chắc 6 điểm này, bạn đã nắm được phần lớn frontend của TicketRush.
