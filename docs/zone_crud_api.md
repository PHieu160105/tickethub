# Zone CRUD API Specification

## Overview

Thêm 4 API endpoints để quản lý SeatZone sau khi event đã được tạo.

---

## Endpoints

### 1. GET /admin/events/{event_key}/zones

**Description**: Lấy danh sách tất cả zones của một event.

**Access**: Admin only

**Response**:
```json
[
  {
    "id": 1,
    "code": "VIP",
    "name": "VIP Zone",
    "row_count": 8,
    "seats_per_row": 12,
    "price": 1500000.00,
    "color": "#024ddf"
  }
]
```

---

### 2. POST /admin/events/{event_key}/zones

**Description**: Tạo mới một zone cho event.

**Access**: Admin only

**Request Body**:
```json
{
  "code": "A",
  "name": "Premium A",
  "row_count": 10,
  "seats_per_row": 15,
  "price": 990000,
  "color": "#3569f9"
}
```

**Validation**:
- `code`: required, 1-30 chars, unique trong event đó
- `name`: required, 1-100 chars
- `row_count`: required, 1-40
- `seats_per_row`: required, 1-60
- `price`: required, > 0
- `color`: optional, default "#024ddf", max 20 chars

**Behavior**:
- Tạo zone mới
- Tự động generate seats theo row_count × seats_per_row
- Seats được tạo với status = AVAILABLE
- Seats price = zone price

**Response**:
```json
{
  "id": 2,
  "code": "A",
  "name": "Premium A",
  "row_count": 10,
  "seats_per_row": 15,
  "price": 990000.00,
  "color": "#3569f9"
}
```

**Error Cases**:
- 404: Event not found
- 409: Zone code đã tồn tại trong event đó
- 400: Không thể thêm zone khi event đã có người mua vé

---

### 3. PATCH /admin/events/{event_key}/zones/{zone_id}

**Description**: Cập nhật thông tin zone.

**Access**: Admin only

**Request Body**:
```json
{
  "name": "VIP Section",
  "price": 2000000,
  "color": "#ff0000"
}
```

**Validation**:
- Chỉ cập nhật các fields được gửi lên
- Không cho phép thay đổi `row_count` và `seats_per_row` nếu đã có seats được bán

**Behavior**:
- Cập nhật zone metadata
- Nếu price thay đổi, các seats chưa bán sẽ được cập nhật theo

**Response**: Zone đã cập nhật

**Error Cases**:
- 404: Zone not found
- 400: Không thể thay đổi row/seats khi đã có vé bán

---

### 4. DELETE /admin/events/{event_key}/zones/{zone_id}

**Description**: Xóa một zone và tất cả seats trong zone đó.

**Access**: Admin only

**Behavior**:
- Chỉ cho phép xóa nếu zone không có seats đã bán (status = SOLD)
- Xóa tất cả seats trong zone
- Xóa zone

**Response**:
```json
{
  "detail": "Zone deleted successfully"
}
```

**Error Cases**:
- 404: Zone not found
- 400: Zone có seats đã bán, không thể xóa

---

## Implementation Notes

### 1. Schema Updates

Thêm schema mới trong `schemas/event.py`:

```python
class SeatZoneUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    price: Decimal | None = Field(default=None, gt=0)
    color: str | None = Field(default=None, max_length=20)
```

### 2. Service Functions

Trong `services/event_service.py` cần thêm:

```python
async def create_zone_for_event(session, event_id, zone_data)
async def update_zone(session, zone_id, update_data)
async def delete_zone(session, zone_id)
```

### 3. Seat Generation Logic

Khi tạo zone mới, cần generate seats:

```python
for row_idx in range(zone.row_count):
    for seat_num in range(zone.seats_per_row):
        seat = Seat(
            event_id=event_id,
            zone_id=zone.id,
            row_index=row_idx,
            row_label=get_row_label(row_idx),  # A, B, C...
            seat_number=seat_num + 1,
            seat_label=f"{get_row_label(row_idx)}{seat_num + 1}",
            price=zone.price,
            status=SeatStatus.AVAILABLE
        )
        session.add(seat)
```

### 4. Validation

- Kiểm tra zone_code unique trong event trước khi tạo
- Kiểm tra event chưa có orders trước khi thêm zone mới
- Kiểm tra zone không có sold seats trước khi xóa