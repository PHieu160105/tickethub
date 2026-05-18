# TicketRush - Functional Requirements hiện có

Tài liệu này mô tả các yêu cầu chức năng đang được thể hiện trong code hiện tại của TicketRush. Mỗi yêu cầu có mã `FR`, vai trò liên quan, mô tả nghiệp vụ và các file code chính chịu trách nhiệm.

Phạm vi đối chiếu: backend `BE/`, frontend `FE/`, model, schema, service, route, UI page, API wrapper và một số test hợp đồng.

## 1. Tác nhân hệ thống

| Tác nhân | Mô tả |
|---|---|
| Guest | Người chưa đăng nhập. Có thể xem sự kiện, tìm kiếm, xem sơ đồ ghế công khai, nhưng không được giữ ghế/checkout/quản lý vé. |
| Customer | Người dùng đã đăng nhập role `customer`. Có thể đặt vé, vào queue, giữ ghế, checkout, xem/hủy vé, review sự kiện, chat hỗ trợ. |
| Admin | Người dùng role `admin`. Có thể quản lý sự kiện, show, venue, sơ đồ ghế, user, ticket sales, dashboard, site settings và hỗ trợ khách hàng. |
| Hệ thống nền | Worker, cache, rate limit, WebSocket manager và logic tự động xử lý lock hết hạn/queue/realtime. |

File nền tảng:

- `BE/app/models/enums.py`: enum `UserRole`, `Gender`, `EventStatus`, `SeatStatus`, `OrderStatus`, `QueueStatus`.
- `BE/app/api/deps.py`: dependency xác thực JWT, optional user, customer guard, admin guard.
- `FE/src/App.tsx`: route guard customer/admin phía frontend.

## 2. Bảng functional requirements

| Mã | Nhóm chức năng | Mô tả yêu cầu hiện có | Vai trò | File code liên quan |
|---|---|---|---|---|
| FR-01 | Xác thực tài khoản | Hệ thống cho phép customer đăng ký bằng email, mật khẩu, họ tên, giới tính và tuổi. Sau khi đăng ký thành công backend trả JWT và hồ sơ user. | Guest, Customer | `BE/app/api/routes/auth.py`<br>`BE/app/schemas/auth.py`<br>`BE/app/models/user.py`<br>`BE/app/core/security.py`<br>`FE/src/pages/customer/Register.tsx`<br>`FE/src/context/AuthContext.tsx`<br>`FE/src/features/auth/api/authApi.ts` |
| FR-02 | Đăng nhập/đăng xuất | Hệ thống cho phép đăng nhập bằng email/mật khẩu, lưu JWT ở frontend và đăng xuất bằng cách xóa token/user khỏi local storage. | Customer, Admin | `BE/app/api/routes/auth.py`<br>`BE/app/core/security.py`<br>`FE/src/pages/customer/Login.tsx`<br>`FE/src/context/AuthContext.tsx`<br>`FE/src/lib/storage.ts` |
| FR-03 | Đăng nhập social | Hệ thống hỗ trợ đăng nhập Google qua Firebase token và Discord OAuth. Nếu tài khoản social chưa tồn tại, backend tạo user customer tương ứng. | Customer | `BE/app/api/routes/auth.py`<br>`BE/app/core/firebase.py`<br>`BE/app/core/config.py`<br>`FE/src/lib/firebase.ts`<br>`FE/src/context/AuthContext.tsx`<br>`FE/src/pages/customer/Login.tsx`<br>`FE/src/pages/customer/Register.tsx` |
| FR-04 | JWT và phân quyền | Backend xác thực Bearer JWT, lấy user hiện tại, chặn route theo role admin/customer. Frontend cũng guard route `/admin`, `/checkout`, `/profile`, `/tickets`, `/help`, `/settings`. | Customer, Admin, Hệ thống | `BE/app/api/deps.py`<br>`BE/app/core/security.py`<br>`FE/src/App.tsx`<br>`FE/src/context/AuthContext.tsx` |
| FR-05 | Hồ sơ cá nhân | Customer xem và cập nhật `full_name`, `gender`, `age`. Email chỉ hiển thị, không có API đổi email. Số điện thoại có xuất hiện ở một số form UI nhưng chưa được lưu trong model/schema backend. | Customer | `BE/app/api/routes/auth.py`<br>`BE/app/schemas/auth.py`<br>`BE/app/models/user.py`<br>`FE/src/pages/customer/CustomerProfile.tsx`<br>`FE/src/context/AuthContext.tsx` |
| FR-06 | Tra cứu user phía admin | Admin xem danh sách user có phân trang, tìm theo tên/email, lọc theo role và xem tổng số vé từng user đã mua. Hiện chưa có CRUD user/admin lock user. | Admin | `BE/app/api/routes/admin.py`<br>`BE/app/schemas/admin.py`<br>`BE/app/models/user.py`<br>`FE/src/pages/admin/Users.tsx`<br>`FE/src/lib/api.ts` |
| FR-07 | Quản lý sự kiện | Admin tạo, xem, sửa, xóa mềm event. Event lưu metadata: `title`, `description`, `category`, `cover_image_url`, `start_date`, `end_date`, `status`, `slug`, `is_deleted`. | Admin | `BE/app/api/routes/admin.py`<br>`BE/app/services/event_service.py`<br>`BE/app/models/event.py`<br>`BE/app/schemas/event.py`<br>`FE/src/pages/admin/Events.tsx` |
| FR-08 | Upload ảnh sự kiện | Admin upload ảnh bìa event dạng `jpg/jpeg/png/webp`, backend lưu thành data URL để frontend preview/sử dụng. | Admin | `BE/app/api/routes/admin.py`<br>`BE/app/schemas/admin.py`<br>`FE/src/pages/admin/Events.tsx`<br>`FE/src/lib/api.ts` |
| FR-09 | Trạng thái sự kiện | Event và Show có trạng thái `draft`, `live`, `closed`. Public event list chỉ hiển thị các event phù hợp logic service và bỏ qua bản ghi soft-deleted. | Admin, Guest, Customer | `BE/app/models/enums.py`<br>`BE/app/models/event.py`<br>`BE/app/services/event_service.py`<br>`BE/app/api/routes/events.py`<br>`BE/app/api/routes/admin.py` |
| FR-10 | Hiển thị danh sách sự kiện public | Guest/customer xem danh sách event, tìm kiếm theo từ khóa, lọc category, lọc khoảng ngày và phân trang bằng `limit/offset`. | Guest, Customer | `BE/app/api/routes/events.py`<br>`BE/app/services/event_service.py`<br>`BE/app/schemas/event.py`<br>`FE/src/pages/customer/Home.tsx`<br>`FE/src/pages/customer/Search.tsx`<br>`FE/src/features/events/api/eventsApi.ts` |
| FR-11 | Chi tiết sự kiện | Người dùng xem chi tiết event theo slug/id, gồm metadata event và danh sách show thuộc event. | Guest, Customer | `BE/app/api/routes/events.py`<br>`BE/app/services/event_service.py`<br>`BE/app/schemas/event.py`<br>`FE/src/pages/customer/EventDetail.tsx` |
| FR-12 | Review sự kiện | Customer xem danh sách review theo phân trang và tạo review mới gồm rating, nội dung, ảnh tùy chọn. | Customer | `BE/app/api/routes/events.py`<br>`BE/app/models/review.py`<br>`BE/app/schemas/review.py`<br>`FE/src/pages/customer/EventDetail.tsx`<br>`FE/src/features/events/api/eventsApi.ts` |
| FR-13 | Quản lý show | Admin tạo, xem, sửa, xóa mềm show thuộc một event. Show là đơn vị bán vé thực tế, lưu `title`, `description`, `venue`, `start_at`, `end_at`, `status`. | Admin | `BE/app/api/routes/admin.py`<br>`BE/app/services/event_service.py`<br>`BE/app/models/event.py`<br>`BE/app/schemas/event.py`<br>`FE/src/pages/admin/Events.tsx` |
| FR-14 | Cấu hình bán vé theo show | Admin cấu hình `hold_minutes`, `queue_enabled`, `queue_release_batch`, `max_active_queue_tokens` theo show. Booking, queue và seat lock đều dùng `show_id`. | Admin, Customer, Hệ thống | `BE/app/models/event.py`<br>`BE/app/schemas/event.py`<br>`BE/app/services/event_service.py`<br>`BE/app/services/booking_service.py`<br>`BE/app/services/queue_service.py`<br>`FE/src/pages/admin/Events.tsx` |
| FR-15 | Nguồn sơ đồ ghế của show | Khi tạo show, admin có thể dùng free seat plan hoặc clone inventory từ venue layout. Việc clone tạo zone/seat/polygon cho show từ layout mẫu. | Admin | `BE/app/services/event_service.py`<br>`BE/app/api/routes/admin.py`<br>`BE/app/models/event.py`<br>`BE/app/models/venue.py`<br>`FE/src/pages/admin/Events.tsx` |
| FR-16 | Thống kê show | Admin xem thống kê từng show: tổng ghế, sold/locked/available, occupancy, vé đã phát hành, vé hủy, doanh thu và thống kê theo zone. | Admin | `BE/app/api/routes/admin.py`<br>`BE/app/schemas/admin.py`<br>`FE/src/pages/admin/Events.tsx`<br>`FE/src/pages/admin/SeatPlanner.tsx` |
| FR-17 | Quản lý venue | Admin CRUD venue gồm tên, địa chỉ, thành phố, loại venue, sức chứa, kích thước nền và trạng thái active. Xóa venue hiện là đổi `is_active` thay vì xóa vật lý. | Admin | `BE/app/api/routes/venues.py`<br>`BE/app/models/venue.py`<br>`BE/app/schemas/venue.py`<br>`FE/src/pages/admin/Venues.tsx`<br>`FE/src/lib/api.ts` |
| FR-18 | Upload và xử lý nền venue | Admin upload background `SVG/PNG/JPG/WEBP`. Nếu là SVG, backend có processor để sanitize, parse kích thước, nhận diện seat/section cơ sở và tạo SVG processed. | Admin | `BE/app/api/routes/venues.py`<br>`BE/app/services/map_processor.py`<br>`BE/app/models/venue.py`<br>`FE/src/pages/admin/Venues.tsx` |
| FR-19 | Quản lý layout venue | Admin tạo, xem, sửa, xóa layout thuộc venue. Layout lưu tên, mô tả, `svg_data`, thứ tự hiển thị. | Admin | `BE/app/api/routes/venues.py`<br>`BE/app/models/venue.py`<br>`BE/app/schemas/venue.py`<br>`FE/src/pages/admin/Venues.tsx` |
| FR-20 | Quản lý section layout | Admin tạo, xem, sửa, xóa section thuộc layout. Section lưu mã khu, tên khu, màu, giá cơ sở và thứ tự. | Admin | `BE/app/api/routes/venues.py`<br>`BE/app/models/venue.py`<br>`BE/app/schemas/venue.py`<br>`FE/src/pages/admin/Venues.tsx` |
| FR-21 | Template seat và polygon venue | Admin tạo ghế mẫu đơn lẻ, tạo bulk theo pattern, sync create/update/delete, admin-lock ghế mẫu và quản lý polygon gắn section để tái sử dụng cho show. | Admin | `BE/app/api/routes/venues.py`<br>`BE/app/models/seat.py`<br>`BE/app/models/venue.py`<br>`BE/app/schemas/venue.py`<br>`FE/src/pages/admin/Venues.tsx`<br>`FE/src/components/admin/InteractiveSeatCanvas.tsx` |
| FR-22 | Quản lý zone theo show | Admin xem/tạo/sửa/xóa zone của show, có thể tạo zone khởi tạo cho planner tự do, regenerate ghế theo cấu hình zone và chặn xóa khi vướng dữ liệu bán/giữ ghế. | Admin | `BE/app/api/routes/admin.py`<br>`BE/app/services/event_service.py`<br>`BE/app/models/event.py`<br>`BE/app/schemas/event.py`<br>`FE/src/pages/admin/SeatPlanner.tsx`<br>`FE/src/components/ui/ZoneModal.tsx` |
| FR-23 | Quản lý ghế theo show | Admin tạo ghế lẻ, tạo bulk theo pattern `straight/arc`, cập nhật tọa độ/xoay/giá/zone/section/admin lock, xóa ghế và sync batch nhiều thay đổi trong một transaction. | Admin | `BE/app/api/routes/admin.py`<br>`BE/app/models/seat.py`<br>`BE/app/schemas/event.py`<br>`FE/src/pages/admin/SeatPlanner.tsx`<br>`FE/src/components/admin/InteractiveSeatCanvas.tsx` |
| FR-24 | Polygon theo show | Admin tạo/sửa/xóa polygon overlay của show để hiển thị vùng ghế trên sơ đồ tự do/canvas. | Admin | `BE/app/api/routes/admin.py`<br>`BE/app/models/event.py`<br>`BE/app/schemas/event.py`<br>`FE/src/pages/admin/SeatPlanner.tsx` |
| FR-25 | Seat matrix public | Guest/customer/admin xem matrix ghế theo show, gồm zone, giá, trạng thái, thông tin `is_locked_by_me`. Admin có thể thấy thêm thông tin người giữ/người mua trong response. | Guest, Customer, Admin | `BE/app/api/routes/seatmap.py`<br>`BE/app/services/event_service.py`<br>`BE/app/schemas/event.py`<br>`FE/src/pages/customer/SeatSelection.tsx`<br>`FE/src/components/customer/CustomerSeatMap.tsx` |
| FR-26 | Seat map public | Hệ thống cung cấp seat map dạng free-form gồm background, sections, zones, polygons, seats, tọa độ và trạng thái để render canvas/sơ đồ ghế. | Guest, Customer, Admin | `BE/app/api/routes/seatmap.py`<br>`BE/app/services/inventory_service.py`<br>`BE/app/schemas/seatmap.py`<br>`FE/src/pages/customer/SeatSelection.tsx`<br>`FE/src/components/customer/CustomerSeatMap.tsx` |
| FR-27 | Vòng đời trạng thái ghế | Ghế có trạng thái nghiệp vụ `available`, `locked`, `sold`; ngoài ra có cờ `is_admin_locked` để admin khóa ghế khỏi booking. | Customer, Admin, Hệ thống | `BE/app/models/enums.py`<br>`BE/app/models/seat.py`<br>`BE/app/services/booking_service.py`<br>`BE/app/api/routes/admin.py` |
| FR-28 | Virtual queue | Customer tham gia queue theo show, nhận token, trạng thái `waiting/admitted/expired/completed`, vị trí queue và hạn admitted. | Customer, Hệ thống | `BE/app/api/routes/queue.py`<br>`BE/app/services/queue_service.py`<br>`BE/app/models/queue.py`<br>`BE/app/schemas/queue.py`<br>`FE/src/pages/customer/VirtualQueue.tsx`<br>`FE/src/features/booking/api/queueApi.ts` |
| FR-29 | Heartbeat queue | Customer gửi heartbeat để giữ phiên admitted/queue token. Nếu token hết hạn, hệ thống buộc join lại hoặc chặn lock/checkout. | Customer, Hệ thống | `BE/app/api/routes/queue.py`<br>`BE/app/services/queue_service.py`<br>`FE/src/pages/customer/VirtualQueue.tsx`<br>`FE/src/hooks/useWebSocketHeartbeat.ts` |
| FR-30 | Admit queue theo batch | Worker nền admit user từ waiting sang admitted theo batch và giới hạn active slot bằng cấu hình show. | Hệ thống | `BE/app/services/queue_service.py`<br>`BE/app/workers/tasks.py`<br>`BE/app/models/event.py` |
| FR-31 | Kiểm tra queue trước booking | Nếu show bật queue, backend yêu cầu queue token hợp lệ trước khi lock/checkout. Nếu show tắt queue, customer có thể thao tác booking trực tiếp. | Customer, Hệ thống | `BE/app/services/queue_service.py`<br>`BE/app/services/booking_service.py`<br>`BE/app/api/routes/bookings.py` |
| FR-32 | Giữ ghế tạm thời | Customer chọn một hoặc nhiều ghế và lock tạm thời. Backend dùng transaction và row-level lock để chống tranh chấp khi nhiều người giữ cùng ghế. | Customer, Hệ thống | `BE/app/api/routes/bookings.py`<br>`BE/app/services/booking_service.py`<br>`BE/app/models/seat.py`<br>`BE/tests/test_booking_lifecycle.py`<br>`BE/scripts/concurrency_demo.py`<br>`FE/src/pages/customer/SeatSelection.tsx`<br>`FE/src/features/booking/hooks/useBooking.ts` |
| FR-33 | Release ghế | Customer có thể release các ghế do chính mình lock. Worker nền cũng tự release ghế hết hạn hold time. | Customer, Hệ thống | `BE/app/api/routes/bookings.py`<br>`BE/app/services/booking_service.py`<br>`BE/app/workers/tasks.py`<br>`FE/src/pages/customer/SeatSelection.tsx` |
| FR-34 | Checkout vé | Customer checkout các ghế đang lock hợp lệ. Backend tạo `Order`, `OrderItem`, đổi ghế sang `sold`, phát hành `Ticket`, sinh `ticket_code` và `qr_payload`, trả thông tin vé cho frontend. | Customer | `BE/app/api/routes/bookings.py`<br>`BE/app/services/booking_service.py`<br>`BE/app/models/order.py`<br>`BE/app/schemas/booking.py`<br>`FE/src/pages/customer/Checkout.tsx`<br>`FE/src/pages/customer/Confirmation.tsx`<br>`FE/src/features/booking/api/bookingApi.ts` |
| FR-35 | Vé của tôi | Customer xem danh sách vé đã mua và vé đã hủy, tìm theo mã vé/tên event, lọc theo khoảng thời gian, xem QR payload và thông tin show/ghế. | Customer | `BE/app/api/routes/bookings.py`<br>`BE/app/services/booking_service.py`<br>`BE/app/schemas/booking.py`<br>`FE/src/pages/customer/CustomerTicket.tsx`<br>`FE/src/components/ui/TicketCard.tsx` |
| FR-36 | Hủy vé customer | Customer hủy vé của mình. Backend tạo audit `TicketCancellation`, mở lại ghế về `available`, xóa ticket/order item liên quan và cập nhật cache/realtime. Đây là hủy vé trong hệ thống, chưa phải refund tiền thật. | Customer, Hệ thống | `BE/app/api/routes/bookings.py`<br>`BE/app/services/booking_service.py`<br>`BE/app/models/order.py`<br>`FE/src/pages/customer/CustomerTicket.tsx` |
| FR-37 | Xử lý thanh toán hiện tại | Hệ thống có bước checkout server-side mô phỏng thanh toán: tính subtotal từ giá ghế, set order `paid`, set `paid_at`. Chưa tích hợp payment gateway thật. | Customer | `BE/app/services/booking_service.py`<br>`BE/app/models/order.py`<br>`BE/app/schemas/booking.py`<br>`FE/src/pages/customer/Checkout.tsx` |
| FR-38 | Mã giảm giá mức mô phỏng | API/FE có trường `discount_code`, response có `discount_amount`, nhưng backend đang đặt `discount_amount = 0` và chưa áp dụng giảm giá thật. | Customer | `BE/app/schemas/booking.py`<br>`BE/app/services/booking_service.py`<br>`FE/src/features/booking/api/bookingApi.ts`<br>`FE/src/pages/customer/Checkout.tsx` |
| FR-39 | Admin ticket sales | Admin xem lịch sử giao dịch vé, lọc theo event/status và phân trang. | Admin | `BE/app/api/routes/admin.py`<br>`BE/app/schemas/admin.py`<br>`FE/src/pages/admin/Tickets.tsx`<br>`FE/src/lib/api.ts` |
| FR-40 | Doanh thu theo show | Admin xem tổng vé đã bán và doanh thu theo từng show/event. | Admin | `BE/app/api/routes/admin.py`<br>`BE/app/schemas/admin.py`<br>`FE/src/pages/admin/Tickets.tsx`<br>`FE/src/lib/api.ts` |
| FR-41 | Dashboard tổng quan | Admin xem KPI: tổng doanh thu, vé đã bán, vé hủy, event/show active, user đang chờ queue. | Admin | `BE/app/api/routes/admin.py`<br>`BE/app/services/dashboard_service.py`<br>`BE/app/schemas/admin.py`<br>`FE/src/pages/admin/Dashboard.tsx`<br>`FE/src/pages/admin/Analytics.tsx` |
| FR-42 | Analytics doanh thu/khán giả/occupancy | Admin xem doanh thu theo ngày, phân bố audience theo tuổi/giới tính, occupancy theo show/event. | Admin | `BE/app/api/routes/admin.py`<br>`BE/app/services/dashboard_service.py`<br>`FE/src/pages/admin/Dashboard.tsx`<br>`FE/src/pages/admin/Analytics.tsx` |
| FR-43 | Hỗ trợ khách hàng | Customer tạo/lấy thread hỗ trợ của mình, đọc lịch sử, gửi tin nhắn. Admin xem danh sách thread, đọc và trả lời. | Customer, Admin | `BE/app/api/routes/help.py`<br>`BE/app/models/help.py`<br>`BE/app/schemas/help.py`<br>`FE/src/pages/customer/Help.tsx`<br>`FE/src/pages/admin/Help.tsx`<br>`FE/src/lib/api.ts` |
| FR-44 | Chat hỗ trợ realtime | Customer/admin nhận tin nhắn hỗ trợ realtime qua WebSocket theo thread. | Customer, Admin, Hệ thống | `BE/app/api/routes/ws.py`<br>`BE/app/ws/connection_manager.py`<br>`FE/src/pages/customer/Help.tsx`<br>`FE/src/pages/admin/Help.tsx` |
| FR-45 | Seat realtime | Client có thể subscribe WebSocket theo show để nhận cập nhật trạng thái ghế khi lock/release/checkout/cancel/admin edit. | Customer, Admin, Hệ thống | `BE/app/api/routes/ws.py`<br>`BE/app/ws/connection_manager.py`<br>`BE/app/services/booking_service.py`<br>`BE/app/api/routes/admin.py`<br>`FE/src/pages/customer/SeatSelection.tsx`<br>`FE/src/hooks/useWebSocketHeartbeat.ts` |
| FR-46 | Dashboard realtime backend | Backend expose WebSocket admin dashboard và worker có thể broadcast dashboard update khi có admin client. Frontend dashboard hiện chủ yếu dùng REST, chưa subscribe đầy đủ socket này. | Admin, Hệ thống | `BE/app/api/routes/ws.py`<br>`BE/app/ws/connection_manager.py`<br>`BE/app/workers/tasks.py`<br>`FE/src/pages/admin/Dashboard.tsx` |
| FR-47 | Search autocomplete | Hệ thống cung cấp gợi ý tìm kiếm theo scope `events`, `venues`, `users`, `tickets`, `global`. Navbar/admin UI dùng API này để gợi ý nhanh. | Guest, Customer, Admin | `BE/app/api/routes/search.py`<br>`BE/app/schemas/search.py`<br>`FE/src/components/ui/SearchAutocompleteInput.tsx`<br>`FE/src/components/layout/Navbar.tsx`<br>`FE/src/components/layout/AdminLayout.tsx` |
| FR-48 | Favourites | Customer có trang sự kiện yêu thích, thêm/xóa yêu thích từ event detail. Dữ liệu chỉ lưu client-side theo user trong `localStorage`, chưa có backend sync. | Customer | `FE/src/lib/favourites.ts`<br>`FE/src/pages/customer/Favourites.tsx`<br>`FE/src/pages/customer/EventDetail.tsx` |
| FR-49 | Theme customer | Customer có thể đổi theme sáng/tối ở UI. Trạng thái theme lưu local phía frontend. | Customer | `FE/src/context/ThemeContext.tsx`<br>`FE/src/pages/customer/Setting.tsx` |
| FR-50 | Site settings | Public frontend đọc thông tin site/contact/footer từ backend. Admin đọc/cập nhật settings chung; backend lưu vào file JSON. | Guest, Customer, Admin | `BE/app/api/routes/site_settings.py`<br>`BE/app/services/site_settings_service.py`<br>`BE/app/schemas/site_settings.py`<br>`BE/app/data/site_settings.json`<br>`FE/src/components/layout/Footer.tsx`<br>`FE/src/pages/admin/Settings.tsx`<br>`FE/src/lib/siteSettings.ts` |
| FR-51 | Route và layout frontend | Frontend có route riêng cho customer public pages, customer protected pages và admin protected pages. Layout customer/admin tách biệt. | Guest, Customer, Admin | `FE/src/App.tsx`<br>`FE/src/components/layout/CustomerLayout.tsx`<br>`FE/src/components/layout/AdminLayout.tsx`<br>`FE/src/components/layout/Navbar.tsx`<br>`FE/src/components/layout/AdminSidebar.tsx`<br>`FE/src/components/layout/CustomerSidebar.tsx` |
| FR-52 | Cache dữ liệu | Backend có cache TTL cho event list/detail, show seats, my tickets và invalidate khi event/show/seat/ticket thay đổi. | Hệ thống | `BE/app/core/cache.py`<br>`BE/app/services/event_service.py`<br>`BE/app/services/booking_service.py`<br>`BE/app/api/routes/admin.py`<br>`BE/app/api/routes/seatmap.py` |
| FR-53 | Rate limit | Backend áp dụng rate limit cho join queue, queue status, heartbeat, lock, release và checkout để giảm spam API. | Hệ thống | `BE/app/core/rate_limit.py`<br>`BE/app/api/routes/queue.py`<br>`BE/app/api/routes/bookings.py` |
| FR-54 | Worker nền | Khi app chạy, worker định kỳ release lock hết hạn, process virtual queue, cleanup queue hết hạn và push dashboard update khi cần. | Hệ thống | `BE/app/workers/tasks.py`<br>`BE/app/main.py`<br>`BE/app/services/booking_service.py`<br>`BE/app/services/queue_service.py` |
| FR-55 | Bootstrap/seed | Backend có lifespan khởi tạo schema/backfill, seed tài khoản demo admin/customer và dữ liệu mẫu, mount static, expose health check. | Hệ thống | `BE/app/main.py`<br>`BE/app/seed.py`<br>`BE/app/core/db.py` |

## 3. Luồng nghiệp vụ chính

### 3.1 Luồng khách mua vé

1. Guest/customer xem danh sách event ở `FE/src/pages/customer/Home.tsx` hoặc `FE/src/pages/customer/Search.tsx`.
2. Người dùng mở chi tiết event ở `FE/src/pages/customer/EventDetail.tsx` và chọn show.
3. Nếu show bật queue, customer vào `FE/src/pages/customer/VirtualQueue.tsx`, gọi `POST /api/shows/{show_id}/queue/join`.
4. Khi được admitted, customer vào `FE/src/pages/customer/SeatSelection.tsx`, xem seat map/matrix và chọn ghế.
5. Customer lock ghế qua `POST /api/bookings/lock`; backend xử lý tại `BE/app/services/booking_service.py`.
6. Customer checkout ở `FE/src/pages/customer/Checkout.tsx`; backend tạo order/ticket tại `checkout_locked_seats`.
7. Frontend hiển thị xác nhận ở `FE/src/pages/customer/Confirmation.tsx`.
8. Customer xem lại vé/QR ở `FE/src/pages/customer/CustomerTicket.tsx`.

### 3.2 Luồng admin tạo event/show và sơ đồ ghế

1. Admin tạo event ở `FE/src/pages/admin/Events.tsx`, gọi `POST /api/admin/events`.
2. Admin tạo show thuộc event, chọn free seat plan hoặc clone từ venue layout.
3. Nếu dùng venue studio, admin chuẩn bị venue/layout/section/seat/polygon tại `FE/src/pages/admin/Venues.tsx`.
4. Admin vào seat planner `FE/src/pages/admin/SeatPlanner.tsx` để chỉnh zone, ghế, polygon của show.
5. Public/customer xem dữ liệu show qua `GET /api/shows/{show_id}/seats` hoặc `GET /api/shows/{show_id}/seatmap`.

### 3.3 Luồng hủy vé

1. Customer mở `FE/src/pages/customer/CustomerTicket.tsx`.
2. Customer gọi `DELETE /api/bookings/my-tickets/{ticket_id}`.
3. Backend kiểm tra vé thuộc user hiện tại, ghi `TicketCancellation`, trả ghế về `available` và cập nhật cache/WebSocket.
4. Vé đã hủy vẫn có thể xuất hiện trong danh sách `my-tickets` dưới trạng thái `cancelled`.

## 4. Những yêu cầu chưa có hoặc chưa hoàn chỉnh trong code hiện tại

Các mục dưới đây không nên ghi là chức năng đã hoàn thành nếu viết tài liệu đặc tả chính thức, vì code hiện tại chưa hỗ trợ đầy đủ.

| Mã | Chức năng mong muốn/chưa hoàn chỉnh | Trạng thái hiện tại | File chứng cứ |
|---|---|---|---|
| GAP-01 | Gửi vé điện tử đến email và điện thoại sau thanh toán | Chưa có service gửi email/SMS. Checkout chỉ trả ticket/QR trong response và hiển thị trong app. Form checkout có email/phone nhưng payload backend không nhận/lưu các trường này. | `BE/app/schemas/booking.py`<br>`BE/app/services/booking_service.py`<br>`FE/src/pages/customer/Checkout.tsx`<br>`FE/src/features/booking/api/bookingApi.ts` |
| GAP-02 | Lưu thông tin tài khoản thanh toán để hoàn tiền | Chưa có model lưu payment account/card/bank/wallet. `Order` chỉ lưu user, event/show, status, total, paid_at. | `BE/app/models/order.py`<br>`BE/app/models/enums.py`<br>`BE/app/services/booking_service.py` |
| GAP-03 | Refund khi sự kiện bị hủy do lỗi công ty | Chưa có workflow refund, trạng thái `refunded`, refund transaction, hoặc route xử lý event cancellation refund. Hủy vé hiện tại chỉ là customer cancel/audit. | `BE/app/models/order.py`<br>`BE/app/models/enums.py`<br>`BE/app/services/booking_service.py`<br>`BE/app/api/routes/bookings.py` |
| GAP-04 | Quản lý danh sách khách mời/nghệ sĩ biểu diễn | Chưa có model/schema/route/service cho artist, performer, guest list hoặc lineup. | `BE/app/models/event.py`<br>`BE/app/schemas/event.py`<br>`BE/app/api/routes/admin.py` |
| GAP-05 | Mỗi khách mời/nghệ sĩ luôn có 2 backup | Chưa có dữ liệu backup performer và chưa có validation ràng buộc 2 backup/người. | `BE/app/models/event.py`<br>`BE/app/services/event_service.py` |
| GAP-06 | Cùng event ở thành phố khác nhau có lineup khác nhau | Hệ thống đã có `Event -> Show -> Venue(city)`, nhưng vì chưa có lineup nên chưa thể cấu hình danh sách nghệ sĩ khác nhau theo show/city. | `BE/app/models/event.py`<br>`BE/app/models/venue.py` |
| GAP-07 | Số điện thoại trong hồ sơ customer | Register/checkout UI có input phone, footer có contact phone, nhưng `User`, `RegisterRequest`, `UpdateProfileRequest`, `UserResponse` không có trường phone. | `BE/app/models/user.py`<br>`BE/app/schemas/auth.py`<br>`FE/src/pages/customer/Register.tsx`<br>`FE/src/pages/customer/Checkout.tsx` |
| GAP-08 | Payment gateway thật | Checkout hiện là xác nhận nội bộ, tự set order `paid`, không có payment provider, webhook, transaction id hoặc verify thanh toán. | `BE/app/services/booking_service.py`<br>`FE/README.md`<br>`FE/src/pages/customer/Checkout.tsx` |
| GAP-09 | Discount thật | `discount_code` có trong schema/API nhưng backend chưa tính giảm giá; `discount_amount` luôn bằng 0. | `BE/app/schemas/booking.py`<br>`BE/app/services/booking_service.py`<br>`FE/src/features/booking/api/bookingApi.ts` |
| GAP-10 | Trang payments riêng | Route `/payments` chỉ redirect sang `/settings`; không có trang nghiệp vụ payment method. | `FE/src/App.tsx`<br>`FE/src/pages/customer/Payments.tsx` |
| GAP-11 | Lọc giá ở Search | Search page có UI liên quan giá nhưng backend event list không có filter giá thực tế. | `BE/app/api/routes/events.py`<br>`BE/app/services/event_service.py`<br>`FE/src/pages/customer/Search.tsx` |
| GAP-12 | Xuất báo cáo admin tickets | UI có ý tưởng export nhưng chưa có API export/report file hoàn chỉnh. | `FE/src/pages/admin/Tickets.tsx`<br>`BE/app/api/routes/admin.py` |
| GAP-13 | Admin settings notification/payment/appearance | Tab general lưu thật qua site settings; các tab còn lại chủ yếu là UI/local state, chưa nối backend đầy đủ. | `FE/src/pages/admin/Settings.tsx`<br>`BE/app/api/routes/site_settings.py` |
| GAP-14 | Đồng bộ favourites backend | Yêu thích sự kiện chỉ lưu `localStorage`, chưa có bảng/API favourites. | `FE/src/lib/favourites.ts`<br>`FE/src/pages/customer/Favourites.tsx` |

## 5. Ghi chú thiết kế dữ liệu quan trọng

- `Event` là thực thể cha để gom nhiều `Show`. Code chính: `BE/app/models/event.py`.
- `Show` là đơn vị bán vé thực tế. Queue, seat, order, ticket đều bám theo `show_id`. Code chính: `BE/app/models/event.py`, `BE/app/services/booking_service.py`, `BE/app/services/queue_service.py`.
- `Venue` và `VenueLayout` là nguồn template để tạo sơ đồ ghế tái sử dụng. Code chính: `BE/app/models/venue.py`, `BE/app/api/routes/venues.py`.
- `Seat` vừa dùng cho ghế template venue layout, vừa dùng cho ghế thật của show thông qua các khóa `show_id`, `venue_layout_id`, `section_id`, `zone_id`. Code chính: `BE/app/models/seat.py`.
- `Order`, `OrderItem`, `Ticket` biểu diễn checkout và vé điện tử. Code chính: `BE/app/models/order.py`.
- Hệ thống hiện chưa lưu payment account/refund account và chưa có entity artist/performer/guest.

## 6. File kiểm thử liên quan

| Nhóm | File test |
|---|---|
| Booking lifecycle, lock/checkout/cancel | `BE/tests/test_booking_lifecycle.py` |
| Virtual queue | `BE/tests/test_virtual_queue.py` |
| Admin seats | `BE/tests/test_admin_seats.py` |
| Venue API | `BE/tests/test_venue_api.py` |
| Seat visibility contract | `BE/tests/test_seat_visibility_contract.py` |
| Search contract | `BE/tests/test_search_contract.py` |
| Auth contract | `BE/tests/test_auth_contract.py` |
| Config contract | `BE/tests/test_config_contract.py` |
| SVG/map processor | `BE/tests/test_map_processor.py` |

