# TicketRush - Functional Requirements

## 1. Muc tieu san pham
TicketRush la nen tang ban ve su kien theo thoi gian thuc, tap trung vao:
- Chong tranh chap ghe trong flash-sale.
- Quan ly vong doi seat/ticket ro rang.
- Ho tro virtual queue cho tai cao.
- Tach quyen user/admin theo vai tro va nghiep vu.

## 2. Doi tuong su dung
- Guest (chua dang nhap).
- User/Customer (da dang nhap vai tro customer).
- Admin (da dang nhap vai tro admin).

## 3. Functional Requirements - Guest
### 3.1 Event browsing
- Xem danh sach events.
- Tim kiem event theo tu khoa.
- Loc event theo category.
- Loc event theo khoang thoi gian.
- Chuyen doi giao dien light/dark.

### 3.2 Seat viewing
- Co the vao trang seat map cua event de xem:
  - Trang thai ghe.
  - Gia ghe.
  - Khu vuc/zone.
- Co the click ghe de preview gia trong panel ben phai.
- Khong duoc lock/release/checkout.

### 3.3 Checkout behavior
- Khi guest bam Confirm Checkout thi dieu huong sang trang login.
- Khong hien luong dat ve thanh cong cho guest.

## 4. Functional Requirements - Customer
### 4.1 Auth
- Dang ky tai khoan customer.
- Dang nhap/ dang xuat.
- Lay profile hien tai.
- Cap nhat profile ca nhan (full_name, gender, age) trong My Account.

### 4.2 Queue
- Neu event bat queue: customer co the join queue.
- Xem vi tri queue theo polling.
- Duoc admit vao seat booking khi den luot.

### 4.3 Seat booking
- Lock 1 hoac nhieu ghe con trong.
- Release ghe da lock boi chinh minh.
- Checkout cac ghe da lock hop le.
- Lock timeout tu dong release boi worker.

### 4.4 My Tickets
- Xem danh sach ve da mua.
- Tim ve theo:
  - Ma ve (ticket_code).
  - Ten su kien.
  - Khoang thoi gian event.
- Xem QR payload cua ve.
- Xoa ve da mua va hoan tra seat ve available.

## 5. Functional Requirements - Admin
### 5.1 Event management
- Tao event moi.
- Upload anh event (jpg/jpeg/png/webp).
- Cau hinh seat zones (code/name/rows/seats/price/color).
- Cap nhat event da release (edit metadata + queue settings).
- Xoa event da release.

### 5.2 Event filtering
- Loc danh sach events theo search/category/time range.

### 5.3 Queue + seat monitoring
- Co the join queue cua event de xem tinh trang he thong.
- Co the xem seat map va gia seat nhu che do monitor.
- Khong duoc lock/release/checkout ticket nhu customer.

### 5.4 Seat inspector
- Admin co the chon nhieu seat dong thoi, ke ca seat da sold (mau den), de inspect thong tin.
- Khi admin click vao seat, he thong hien:
  - Status seat.
  - Gia seat.
  - User dang lock seat (neu co).
  - User da mua seat (neu sold), gom thong tin user, order id, ticket code.

### 5.5 Analytics
- Dashboard tong quan:
  - Total revenue.
  - Tickets sold.
  - Active events.
  - Waiting queue users.
- Occupancy snapshot theo event.
- Drilldown thong ke chi tiet theo tung event:
  - Tong seats, sold/locked/available.
  - Occupancy rate.
  - Tickets issued.
  - Revenue.
  - Zone stats (occupancy + range gia).

## 6. Non-functional constraints lien quan den nghiep vu
- Concurrency-safe seat lock (row-level lock).
- Giao tiep realtime seat status qua WebSocket.
- Queue TTL va heartbeat de kiem soat session.
- Role-based access control o ca FE va BE.

## 7. Acceptance Criteria tom tat
- Guest xem duoc seat va gia, bam checkout se den login.
- Admin khong the mua ve qua API bookings.
- Admin van join queue de monitor seat map.
- Admin co the chon nhieu seat (bao gom sold seats) va xem thong tin user mua/giu seat o seat inspector.
- Customer dat/huy ve dung theo vong doi seat.
