### 📄 MARKDOWN DÀNH CHO AI KIỂM TRA FRONTEND

```markdown
# CHECKLIST TÍNH NĂNG FRONTEND - DỰ ÁN TICKETRUSH

Bạn là một Senior Frontend Engineer. Nhiệm vụ của bạn là đọc kỹ codebase tôi cung cấp và đánh dấu các tính năng đã được implement bằng cách đổi `[ ]` thành `[x]`. 
Nếu tính năng nào chưa có, hãy giữ nguyên `[ ]` và ghi chú ngắn gọn lý do hoặc cách để cải thiện ở dòng dưới.

## 1. Chức năng giao diện cho Khán giả (Customer)
- [ ] **Tìm kiếm & xem sự kiện:** Có trang hiển thị danh sách sự kiện và cho phép tìm kiếm/lọc.
- [ ] **Xem thông tin chi tiết sự kiện:** Hiển thị đầy đủ mô tả, thời gian, địa điểm của sự kiện.
- [ ] **Xem sơ đồ chỗ ngồi trực quan:** Hiển thị sơ đồ ghế dựa trên dữ liệu "Ma trận ghế" (ví dụ: Khu A - 10 hàng x 15 ghế).
- [ ] **Tương tác chọn ghế:** Cho phép user click vào ghế trên sơ đồ để chọn. Hiển thị rõ ràng trạng thái visul của ghế (Ví dụ: Xanh = Trống, Đỏ/Gray = Đã có người chọn/Locked, Vàng = Đang chọn bởi mình).
- [ ] **Giao diện Thanh toán (Checkout):** Hiển thị trang tóm tắt đơn hàng (các ghế đã chọn, tổng tiền) và có nút "XÁC NHẬN" (Fake payment - không cần tích hợp cổng thanh toán thật).
- [ ] **Hiển thị Vé điện tử (E-ticket):** Sau khi "xác nhận" thành công, hiển thị vé chứa mã QR Code.
- [ ] **Quản lý vé:** Có trang danh sách các vé đã mua của user.

## 2. Chức năng giao diện cho Admin (Ban tổ chức)
- [ ] **Tạo mới sự kiện:** Form nhập liệu các thông tin cơ bản của sự kiện.
- [ ] **Cấu hình sơ đồ ghế (Ma trận ghế):** Giao diện cho phép Admin khai báo các khu vực (Zone), số hàng, số cột cho mỗi khu vực, và gán giá tiền tương ứng cho từng loại ghế.
- [ ] **Real-time Dashboard (Doanh thu & Lấp đầy):** Hiển thị biểu đồ biến động doanh thu và tình trạng ghế đã bán/đang giữ theo thời gian thực mà không cần F5.
- [ ] **Thống kê khán giả:** Hiển thị biểu đồ thống kê theo độ tuổi và giới tính của những người đã mua vé.

## 3. Yêu cầu Kỹ thuật đặc thù (Frontend Techniques)
- [ ] **Cập nhật trạng thái ghế Real-time (Không F5):** Sử dụng WebSocket hoặc Polling để tự động đổi màu trạng thái ghế (từ xanh sang xám) khi có người khác giữ chỗ thành công.
- [ ] **Xử lý Countdown Timer (Đồng hồ đếm ngược):** Sau khi user click giữ chỗ thành công, hiển thị đồng hồ đếm ngược 10 phút trên giao diện. Hết giờ phải có cảnh báo và tự động chuyển trạng thái.
- [ ] **Giao diện Hàng chờ Ảo (Virtual Waiting Room):** 
  - Hiển thị trang "Phòng chờ" khi hệ thống báo quá tải.
  - Hiển thị thông báo dạng: "Bạn đang ở vị trí thứ [X] trong hàng đợi. Vui lòng không tải lại trang...".
  - Tự động chuyển hướng (redirect) sang trang chọn ghế khi hệ thống cấp token/quyền truy cập (nhận được signal từ backend).

---
### KẾT QUẢ ĐÁNH GIÁ CỦA AI:
*(AI sẽ điền phần này)*
- Tỷ lệ hoàn thành: ...%
- Các điểm thiếu sót lớn: ...
- Đề xuất cải thiện: ...
```

---