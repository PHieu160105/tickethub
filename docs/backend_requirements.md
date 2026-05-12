# BACKEND REQUIREMENTS CHECKLIST - TicketRush

## 1. Tổng quan Backend

Backend của TicketRush phải phục vụ nền tảng phân phối vé điện tử cho các sự kiện âm nhạc / giải trí. Hệ thống cần hỗ trợ:

- Quản lý sự kiện.
- Quản lý sơ đồ ghế.
- Quản lý vé điện tử.
- Xử lý giữ ghế trong thời gian ngắn.
- Xử lý tình huống nhiều người dùng cùng tranh chấp một ghế.
- Tự động nhả ghế khi quá hạn thanh toán.
- Cung cấp dữ liệu realtime hoặc gần realtime cho Frontend.
- Hỗ trợ Admin theo dõi doanh thu, tình trạng lấp đầy ghế và thống kê khán giả.
- Có khả năng chịu tải trong tình huống flash sale.

Mục tiêu quan trọng nhất của Backend là đảm bảo **một ghế không thể bị bán cho nhiều người**, kể cả khi có nhiều request đồng thời cùng chọn một ghế.

---

## 2. Vai trò người dùng và phân quyền

### 2.1. Customer - Khán giả

Backend cần hỗ trợ Customer thực hiện các chức năng sau:

- Đăng ký / đăng nhập tài khoản.
- Tìm kiếm sự kiện.
- Xem danh sách sự kiện.
- Xem chi tiết sự kiện.
- Xem sơ đồ ghế của sự kiện.
- Chọn ghế.
- Giữ chỗ trong thời gian quy định.
- Checkout giả lập.
- Xác nhận thanh toán.
- Nhận vé điện tử.
- Xem danh sách vé đã mua.
- Xem chi tiết vé điện tử kèm QR Code.

### 2.2. Admin - Chủ hệ thống / Ban tổ chức

Backend cần hỗ trợ Admin có toàn quyền quản trị nền tảng:

- Tạo mới sự kiện.
- Cập nhật thông tin sự kiện.
- Xóa hoặc ẩn sự kiện nếu cần.
- Cấu hình sơ đồ ghế cho từng sự kiện.
- Khai báo ma trận ghế.
- Chia khu vực ghế.
- Gán giá tiền cho từng loại ghế / khu vực.
- Theo dõi doanh thu theo thời gian thực hoặc gần realtime.
- Theo dõi trạng thái lấp đầy ghế.
- Xem thống kê khán giả theo độ tuổi.
- Xem thống kê khán giả theo giới tính.
- Quản lý danh sách vé / đơn hàng.

### 2.3. Phân quyền API

Backend cần có cơ chế phân quyền rõ ràng:

- API Customer chỉ cho phép người dùng thao tác trên dữ liệu của chính họ.
- API Admin chỉ cho phép tài khoản có quyền Admin truy cập.
- API tạo / sửa / xóa sự kiện chỉ Admin được sử dụng.
- API cấu hình sơ đồ ghế chỉ Admin được sử dụng.
- API xem dashboard doanh thu chỉ Admin được sử dụng.
- API giữ ghế chỉ Customer đã đăng nhập được sử dụng.
- API checkout chỉ Customer sở hữu ghế đang giữ được sử dụng.
- API xem vé chỉ Customer sở hữu vé hoặc Admin được xem.

---

## 3. Xác thực và bảo mật

### 3.1. Authentication

Backend cần có hệ thống xác thực người dùng:

- Có chức năng đăng ký.
- Có chức năng đăng nhập.
- Có chức năng đăng xuất nếu kiến trúc yêu cầu.
- Sử dụng session hoặc JWT.
- Token / session phải xác định được user hiện tại.
- Token / session phải xác định được role của user.
- API cần kiểm tra authentication trước khi xử lý các thao tác cần đăng nhập.

### 3.2. Authorization

Backend cần kiểm tra quyền truy cập:

- Customer không được truy cập API Admin.
- Customer không được sửa thông tin sự kiện.
- Customer không được tự thay đổi trạng thái vé thành Sold nếu không đi qua checkout hợp lệ.
- Customer không được xem vé của người khác.
- Admin có thể quản lý sự kiện, ghế, vé, đơn hàng và dashboard.
- Các API nhạy cảm cần kiểm tra role trước khi xử lý.

### 3.3. Bảo mật dữ liệu

Backend nên có:

- Hash password.
- Validate input.
- Chống SQL Injection thông qua ORM, query builder hoặc prepared statement.
- Không trả về password hash trong API response.
- Không để lộ thông tin nhạy cảm trong error message.
- Kiểm tra ownership với các tài nguyên như order, ticket, locked seat.
- Có xử lý lỗi tập trung.

---

## 4. Quản lý sự kiện

### 4.1. Entity Event

Backend cần có mô hình dữ liệu cho sự kiện, tối thiểu gồm:

- `id`
- `title`
- `description`
- `location`
- `startTime`
- `endTime`
- `saleStartTime`
- `saleEndTime`
- `bannerImage`
- `status`
- `createdAt`
- `updatedAt`

Có thể bổ sung:

- `category`
- `organizerName`
- `venueName`
- `isPublished`
- `maxTickets`
- `metadata`

### 4.2. API cho Customer

Backend cần cung cấp API:

- Lấy danh sách sự kiện.
- Tìm kiếm sự kiện theo từ khóa.
- Lọc sự kiện theo thời gian, địa điểm hoặc trạng thái nếu có.
- Xem chi tiết sự kiện.
- Xem sơ đồ ghế của một sự kiện.

Checklist:

- [ ] Có API lấy danh sách sự kiện.
- [ ] Có API tìm kiếm sự kiện.
- [ ] Có API xem chi tiết sự kiện.
- [ ] Có API trả về sơ đồ ghế của sự kiện.
- [ ] API không trả về dữ liệu nội bộ không cần thiết.
- [ ] API có phân trang nếu danh sách sự kiện lớn.

### 4.3. API cho Admin

Backend cần cung cấp API:

- Tạo sự kiện.
- Cập nhật sự kiện.
- Xóa / hủy / ẩn sự kiện.
- Publish / unpublish sự kiện.
- Xem danh sách sự kiện do Admin quản lý.

Checklist:

- [ ] Admin tạo được sự kiện mới.
- [ ] Admin cập nhật được thông tin sự kiện.
- [ ] Admin xóa hoặc ẩn được sự kiện.
- [ ] Admin cấu hình được thời gian mở bán.
- [ ] Admin cấu hình được trạng thái sự kiện.
- [ ] API Admin có kiểm tra quyền Admin.

---

## 5. Quản lý sơ đồ ghế

### 5.1. Yêu cầu chính

Theo đề bài, khi Admin thiết lập sự kiện, Admin có thể khai báo một “ma trận ghế”, ví dụ: Khu A có 10 hàng, mỗi hàng 15 ghế. Backend cần hỗ trợ lưu trữ và sinh sơ đồ ghế từ cấu hình này.

### 5.2. Entity Seat Area

Backend cần có mô hình dữ liệu cho khu vực ghế:

- `id`
- `eventId`
- `name`
- `rowCount`
- `seatsPerRow`
- `price`
- `seatType`
- `createdAt`
- `updatedAt`

Ví dụ:

```json
{
  "eventId": "event_001",
  "name": "Khu A",
  "rowCount": 10,
  "seatsPerRow": 15,
  "price": 1500000,
  "seatType": "VIP"
}