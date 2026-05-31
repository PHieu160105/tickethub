Tác nhân
Customer, Cổng thanh toán 
Mô tả chức năng
Cho phép customer kiểm tra thông tin người mua, xem tóm tắt đơn hàng, xác nhận thanh toán và thực hiện thanh toán qua cổng thanh toán. Sau khi thanh toán thành công, hệ thống lưu thông tin giao dịch, phát hành vé điện tử và cập nhật trạng thái vé-chỗ thành đã bán. 
Tiền điều kiện
Customer đã đăng nhập; customer đã chọn vé-chỗ và các ghế đang được giữ hợp lệ; thời gian giữ ghế chưa hết hạn. 
Hậu điều kiện
Đơn hàng được tạo; thông tin thanh toán được lưu; vé-chỗ chuyển sang trạng thái đã bán; vé điện tử được phát hành.
Luồng sự kiện chính
1. Customer được chuyển đến màn hình thanh toán sau khi chọn vé-chỗ.
2. Hệ thống hiển thị form thông tin người mua gồm họ tên, email và số điện thoại.
3. Hệ thống hiển thị tóm tắt đơn hàng gồm danh sách ghế, giá từng ghế, số lượng ghế, tổng tiền và thời gian giữ ghế còn lại.
4. Customer kiểm tra hoặc cập nhật thông tin người mua.
5. Customer chọn phương thức thanh toán - cổng thanh toán
6. Customer chọn “Xác nhận thanh toán”.
7. Hệ thống kiểm tra lại thời gian giữ ghế và trạng thái các vé-chỗ.
8. Hệ thống gửi yêu cầu thanh toán sang cổng thanh toán.
9. Cổng thanh toán xử lý giao dịch và trả kết quả về hệ thống.
10. Nếu thanh toán thành công, hệ thống tạo đơn hàng, lưu thông tin giao dịch và tài khoản thanh toán cần thiết.
11. Hệ thống chuyển trạng thái vé-chỗ từ đang giữ sang đã bán.
12. Hệ thống phát hành vé điện tử cho từng vé-chỗ.
13. Hệ thống hiển thị thông báo thanh toán thành công. 
Luồng sự kiện thay thế
- Nếu thời gian giữ ghế đã hết, hệ thống hủy phiên thanh toán và yêu cầu customer quay lại chọn ghế.
- Nếu thông tin người mua thiếu hoặc không hợp lệ, hệ thống yêu cầu nhập lại.
- Nếu customer hủy thanh toán tại cổng thanh toán, hệ thống ghi nhận trạng thái thanh toán chưa hoàn tất.
- Nếu thanh toán thất bại, hệ thống không phát hành vé và thông báo lý do thất bại nếu có.
- Nếu hệ thống đã nhận tiền nhưng lỗi phát hành vé, hệ thống ghi nhận giao dịch để admin xử lý đối soát.



Mục
Nội dung
Tác nhân
Admin, Cổng thanh toán
Mô tả chức năng
Cho phép admin thực hiện hoàn tiền cho các giao dịch đã thanh toán khi sự kiện hoặc buổi diễn bị hủy do lỗi từ phía công ty/tổ chức. 
Tiền điều kiện
Admin đã đăng nhập và có quyền quản trị; sự kiện hoặc buổi diễn đã bị hủy/ngừng tổ chức; hệ thống có các giao dịch đã thanh toán liên quan đến sự kiện/show đó; thông tin giao dịch thanh toán đã được lưu trước đó để phục vụ hoàn tiền. 
Hậu điều kiện
Các giao dịch được xử lý hoàn tiền hoặc cập nhật trạng thái hoàn tiền tương ứng với kết quả xử lý của cổng thanh toán; hệ thống lưu lịch sử hoàn tiền để phục vụ đối soát và tra cứu; hệ thống gửi email hoàn tiền đến customer tương ứng 
Luồng sự kiện chính
1. Admin chọn chức năng “Hoàn tiền” sau khi thực hiện chức năng xóa sự kiện/show.
2. Hệ thống chuyển admin đến trang hoàn tiền của sự kiện/show tương ứng.
3. Hệ thống hiển thị danh sách tất cả giao dịch đã thanh toán, bao gồm thông tin người mua, mã giao dịch, vé/chỗ đã mua, số tiền, phương thức thanh toán và trạng thái hoàn tiền.
4. Admin chọn “Hoàn tiền tất cả”.
5. Hệ thống cập nhật tuần tự các giao dịch đủ điều kiện sang trạng thái “Đang hoàn tiền”.
6. Hệ thống gọi API hoàn tiền của cổng thanh toán.
7. Cổng thanh toán xử lý yêu cầu hoàn tiền và trả kết quả cho hệ thống.
8. Hệ thống cập nhật trạng thái từng giao dịch theo kết quả trả về, ví dụ đã hoàn tiền hoặc hoàn tiền thất bại.
9. Hệ thống ghi nhận lịch sử hoàn tiền và tự động gửi email hoàn tiền cho customer tương ứng.
10. Hệ thống thông báo kết quả xử lý hoàn tiền cho admin.
Luồng sự kiện thay thế
- Nếu admin rời trang khi còn giao dịch chưa xử lý, hệ thống cảnh báo còn giao dịch chưa hoàn tiền.
- Nếu API cổng thanh toán lỗi hoặc timeout, hệ thống giữ giao dịch ở trạng thái đang hoàn tiền hoặc chuyển sang hoàn tiền thất bại để admin xử lý lại.
- Nếu một số giao dịch hoàn tiền thành công và một số thất bại, hệ thống cập nhật trạng thái riêng cho từng giao dịch, không rollback toàn bộ danh sách.


3.1.8.2 Tra cứu giao dịch hoàn tiền

Mục
Nội dung
Tác nhân
EventStaff
Mô tả chức năng
Cho phép staff xem danh sách các giao dịch liên quan đến hoàn tiền, phục vụ việc theo dõi, kiểm tra và đối soát các giao dịch hoàn tiền sau khi sự kiện hoặc show bị hủy. 
Tiền điều kiện
Staff đã đăng nhập và có quyền truy cập chức năng hoàn tiền; hệ thống đã lưu thông tin giao dịch thanh toán; có hoặc chưa có giao dịch hoàn tiền phát sinh. 
Hậu điều kiện
Staff xem được danh sách giao dịch hoàn tiền theo điều kiện lọc; trạng thái hoàn tiền của từng giao dịch được hiển thị rõ để phục vụ kiểm tra và đối soát. 
Luồng sự kiện chính
1. Staff truy cập tab “Quản lý Hoàn tiền” trong trang quản trị.
2. Hệ thống hiển thị danh sách giao dịch hoàn tiền.
3. Hệ thống hiển thị các thông tin chính như mã giao dịch, sự kiện, show, người mua, số tiền thanh toán, số tiền hoàn, phương thức thanh toán, thời gian thanh toán và trạng thái hoàn tiền.
4. Staff chọn bộ lọc theo sự kiện, show, trạng thái hoàn tiền hoặc khoảng thời gian.
5. Hệ thống truy vấn và hiển thị danh sách giao dịch phù hợp với điều kiện lọc.
6. Staff chọn một giao dịch để xem chi tiết nếu cần.
7. Hệ thống hiển thị thông tin chi tiết gồm thông tin vé, người mua, mã thanh toán từ cổng thanh toán và lịch sử xử lý hoàn tiền.
Luồng sự kiện thay thế
- Nếu chưa có giao dịch hoàn tiền, hệ thống hiển thị danh sách rỗng.
- Nếu không có giao dịch phù hợp với bộ lọc, hệ thống thông báo không có kết quả.
- Nếu lỗi tải dữ liệu, hệ thống thông báo lỗi và cho phép Staff làm mới lại.

