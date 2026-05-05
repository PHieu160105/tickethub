# TicketRush Backend Report (presentation)

## 1) Tong quan
TicketRush la he thong ban ve su kien theo mo hinh flash-sale. Backend duoc thiet ke de giai 3 bai toan chinh:
- Chong dat trung ghe khi nhieu nguoi click cung luc.
- Quan ly vong doi ghe/ve ro rang (giu ghe, thanh toan, ban ve).
- Virtual queue de giam tai khi luong truy cap cao.

## 2) Kien truc tong the
Backend theo kieu layer ro rang:
- API layer (FastAPI): nhan request, validate, route den service.
- Service layer: xu ly nghiep vu (dat ghe, queue, checkout, thong ke).
- Model layer: ORM SQLAlchemy cho PostgreSQL.
- Auth + role: JWT va role customer/admin.
- Cache nho (in-memory TTL): giam load cho list event va seat map.
- Realtime: WebSocket push thay doi ghe va dashboard admin.
- Background worker: chay dinh ky de release lock, admit queue, cleanup.

## 3) Data model chinh
- users: thong tin tai khoan, role.
- events: thong tin su kien + cau hinh queue + hold time.
- seat_zones: khu ghe (VIP/A/B), row/seat, gia.
- seats: tung ghe cu the, trang thai va lock info.
- orders + order_items + tickets: du lieu thanh toan va ve.
- queue_entries: hang doi (waiting/admitted/expired/completed).

Trang thai quan trong:
- Seat: available -> locked -> sold (hoac locked -> available khi het han).
- Queue: waiting -> admitted -> completed/expired.

## 4) Workflow va pipeline nghiep vu

### 4.1 Tao event (admin)
1) Admin tao event va khai bao zone/so hang/so ghe.
2) He thong sinh ma ghe theo mau: CODE-ROWSEAT (VD: VIP-A12).
3) Tat ca ghe duoc tao o trang thai available.

### 4.2 Duyet event + seat map
1) FE goi list event (co cache TTL de giam load).
2) Vao event detail, lay danh sach zone + seat matrix.
3) Admin xem seat map co them thong tin user dang giu/mua ghe.

### 4.3 Virtual queue (neu event bat queue)
1) User join queue -> nhan token.
2) Neu con slot, duoc admit ngay; neu khong thi vao waiting.
3) FE polling status; khi admitted thi duoc vao trang dat ghe.
4) Worker dinh ky admit theo batch (queue_release_batch).
5) Token co TTL va heartbeat de giu phien hop le.

### 4.4 Dat ghe va checkout
1) User chon ghe -> API lock ghe.
2) Ghe chuyen sang locked, co lock_expires_at.
3) User checkout -> ghe chuyen sang sold, sinh ticket.
4) Neu user khong checkout kip, worker se release ve available.
5) Moi thay doi ghe duoc push realtime qua WebSocket.

## 5) Dat ghe va tuong tranh (quan trong nhat)
Muc tieu: khong de 2 nguoi mua cung 1 ghe.

Cach lam:
- Khi lock ghe, he thong dung row-level lock (SELECT ... FOR UPDATE) trong transaction.
- Chi ghe con available (hoac da het han lock) moi duoc chuyen sang locked.
- Neu ghe da sold hoac dang locked boi nguoi khac, request se bi tu choi.

Minh hoa tinh huong 2 nguoi click cung luc:
1) User A va User B goi lock ghe X gan nhu dong thoi.
2) Database chi cho 1 transaction giu row lock truoc.
3) Transaction cua A cap nhat ghe X sang locked va commit.
4) Transaction cua B vao sau se doc thay ghe da locked/sold -> fail.
5) Ket qua: chi 1 nguoi lock thanh cong, khong co dat trung.

Co che an toan bo sung:
- lock_expires_at: neu qua han giu ghe, worker se release.
- checkout cung dung row-level lock de dam bao chi ghe dang locked boi chinh user moi thanh sold.
- seat map luon duoc dong bo realtime qua WebSocket.

## 6) Background worker (pipeline dinh ky)
Moi 3 giay, worker chay 1 vong:
- Release lock het han -> update seat + push WebSocket.
- Admit queue theo batch.
- Cleanup queue het han.
- Neu admin dashboard dang mo, push thong ke realtime.

## 7) Kiem thu
Backend co test cho:
- Booking lifecycle (lock -> checkout -> release).
- Virtual queue.
- Security/role guard.

## 8) Ket luan
Backend TicketRush tap trung giai quyet bai toan flash-sale:
- Dat ghe an toan trong moi truong tuong tranh.
- Quan ly vong doi ghe/ve minh bach.
- Queue + realtime giup he thong on dinh va user trainghiem tot.
