---

```markdown
# PROMPT: Implement Seat Map System for TicketRush

## 1. PREREQUISITE - READ PROJECT FIRST

BEFORE writing any code, you MUST read the existing project structure to understand:
- What framework is being used (FastAPI/Flask/Django? React/Vue/Angular?)
- What database ORM is being used (SQLAlchemy, Prisma, TypeORM?)
- What authentication system exists (JWT? Session?)
- What existing models/tables already exist (Event, Seat, Order, User?)
- What folder structure convention is followed
- What existing API patterns are used (response format, error handling)

Read these locations:
- `README.md` or project docs
- `models/` or `database/` folder
- `api/` or `routes/` folder  
- `services/` folder if exists
- Frontend `src/` structure
- Any existing migration files

DO NOT proceed to implementation until you have documented what already exists.

---

## 2. REQUIREMENTS SUMMARY

Implement an **interactive seat map system** with 2 modes:

| Mode | User | Purpose |
|------|------|---------|
| **Admin Builder** | Admin | Upload SVG background, draw polygon zones, place seats (single OR bulk array), export coordinates |
| **Customer View** | Buyer | View seat map, zoom/pan, select seats, see real-time status |

### Core Features

1. **SVG Background**: Upload venue floorplan → stored on Cloudinary → rendered as background
2. **Polygon Zones**: Admin draws polygons to define VIP/Premium/Standard areas
3. **Seat Placement - 2 modes**:
   - **Single Click**: Click từng vị trí trên nền để thêm 1 ghế
   - **Bulk Array**: Nhập tham số (rows, cols, gap, pattern) để sinh hàng loạt ghế xếp thẳng hàng hoặc vòng cung
4. **Coordinate System**: All positions stored as percentage (0-100%) for responsiveness
5. **Customer Renderer**: PixiJS WebGL for smooth 60fps
6. **Seat Locking**: PostgreSQL `SELECT FOR UPDATE` during booking
7. **Real-time**: Simple WebSocket or polling

---

## 3. SEAT PLACEMENT - CHI TIẾT 2 CHẾ ĐỘ

### Chế độ 1: Single Click (Thêm ghế lẻ)

**Cách dùng:**
- Chọn tool "➕ Add Seat" 
- Click lên vị trí bất kỳ trên nền SVG
- Ghế được tạo ngay tại tọa độ click

**Dữ liệu sinh ra:**
```json
{
  "label": "A1",
  "x": 15.5,
  "y": 20.0,
  "rotation": 0,
  "section_id": 1
}
```

**API:**
```
POST /api/admin/venues/{id}/seats/single
Body: {"label": "A1", "x": 15.5, "y": 20.0, "section_id": 1}
```

---

### Chế độ 2: Bulk Array (Xếp hàng loạt)

**Cách dùng:**
- Chọn tool "📐 Array" 
- Mở form nhập tham số
- Nhấn "Generate" → sinh toàn bộ ghế 1 lúc

**Các pattern hỗ trợ:**

| Pattern | Mô tả | Tham số |
|---------|-------|---------|
| **straight** | Xếp thẳng hàng, vuông góc | rows, cols, gap_x, gap_y, start_x, start_y |
| **arc** | Xếp vòng cung hướng sân khấu | + center_x, center_y, radius, start_angle, end_angle |
| **zigzag** | Hàng đan chéo tiết kiệm không gian | rows, cols, gap_x, gap_y |

**Form nhập liệu:**
```
Pattern: [Straight ▼]
Rows: [10]    
Cols: [20]
Gap X: [3.5]  
Gap Y: [4.0]
Start X: [15] 
Start Y: [20]
Label prefix: [A]

[Generate Seats]
```

**Thuật toán Straight Pattern:**
```python
for row in range(rows):
    for col in range(cols):
        x = start_x + col * gap_x
        y = start_y + row * gap_y
        rotation = 0
        label = f"{prefix}{row+1}-{col+1}"
```

**Thuật toán Arc Pattern:**
```python
for row in range(rows):
    radius = base_radius + row * gap_y
    seats_in_row = cols + row * 2  # Hàng sau rộng hơn
    for col in range(seats_in_row):
        angle = start_angle + (end_angle - start_angle) * col / (seats_in_row - 1)
        rad = math.radians(angle)
        x = center_x + radius * math.sin(rad)
        y = center_y + radius * math.cos(rad)
        rotation = angle  # Ghế xoay hướng tâm
        label = f"{prefix}{row+1}-{col+1}"
```

**API:**
```
POST /api/admin/venues/{id}/seats/bulk
Body: {
  "section_id": 1,
  "pattern": "straight",  // "straight" | "arc" | "zigzag"
  "rows": 10,
  "cols": 20,
  "start_x": 15.0,
  "start_y": 20.0,
  "gap_x": 3.5,
  "gap_y": 4.0,
  "label_prefix": "A",
  // Chỉ cho arc:
  "arc_config": {
    "center_x": 50,
    "center_y": 10,
    "radius": 30,
    "start_angle": -60,
    "end_angle": 60
  }
}
```

**Response:**
```json
{
  "created_count": 200,
  "seats": [
    {"id": 1, "label": "A1-1", "x": 15.0, "y": 20.0},
    {"id": 2, "label": "A1-2", "x": 18.5, "y": 20.0},
    ...
  ]
}
```

---

## 4. DATABASE SCHEMA TO ADD

Read existing schema first. Add these tables/columns:

```sql
-- New tables
CREATE TABLE venues (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    svg_url TEXT,                    -- Cloudinary URL
    cloudinary_id VARCHAR(255),      -- For deletion
    viewbox_width INTEGER DEFAULT 1000,
    viewbox_height INTEGER DEFAULT 600,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sections (
    id SERIAL PRIMARY KEY,
    venue_id INTEGER REFERENCES venues(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(30) NOT NULL,
    color VARCHAR(7) DEFAULT '#3b82f6',
    price_base DECIMAL(12,2) NOT NULL,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE polygons (
    id SERIAL PRIMARY KEY,
    venue_id INTEGER REFERENCES venues(id) ON DELETE CASCADE,
    section_id INTEGER REFERENCES sections(id),
    label VARCHAR(100),
    points JSONB NOT NULL  -- [{"x": 10, "y": 20}, ...]
);

-- Modify existing seats table (or create if not exists)
ALTER TABLE seats ADD COLUMN IF NOT EXISTS x DECIMAL(6,2);
ALTER TABLE seats ADD COLUMN IF NOT EXISTS y DECIMAL(6,2);
ALTER TABLE seats ADD COLUMN IF NOT EXISTS rotation DECIMAL(5,2) DEFAULT 0;
ALTER TABLE seats ADD COLUMN IF NOT EXISTS section_id INTEGER REFERENCES sections(id);
ALTER TABLE seats ADD COLUMN IF NOT EXISTS venue_id INTEGER REFERENCES venues(id);

-- Modify existing events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_id INTEGER REFERENCES venues(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS layout_svg_url TEXT;
```

---

## 5. API ENDPOINTS TO IMPLEMENT

### Admin APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/venues` | Create venue |
| POST | `/api/admin/venues/{id}/upload-svg` | Upload SVG to Cloudinary |
| GET | `/api/admin/venues` | List venues |
| GET | `/api/admin/venues/{id}` | Get venue with sections |
| POST | `/api/admin/venues/{id}/sections` | Create section |
| POST | `/api/admin/venues/{id}/seats/single` | **Add 1 seat** |
| POST | `/api/admin/venues/{id}/seats/bulk` | **Bulk add seats (array)** |
| POST | `/api/admin/venues/{id}/polygons` | Save polygon zone |
| GET | `/api/admin/venues/{id}/seats` | List all seats for editing |
| PATCH | `/api/admin/seats/{id}` | Update seat position/label |
| DELETE | `/api/admin/seats/{id}` | Delete seat |

### Customer APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events/{event_key}/seatmap` | Get full seat map |
| POST | `/api/events/{event_key}/lock` | Lock seats |
| POST | `/api/events/{event_key}/unlock` | Unlock seats |
| WS | `/ws/events/{event_key}` | WebSocket updates |

---

## 6. FRONTEND - ADMIN BUILDER UI

### Layout: Sidebar (left 320px) + Canvas (remaining)

**Sidebar sections:**

1. **Upload SVG**
   - Input file accept=".svg"
   - Upload → Cloudinary → preview

2. **Sections Management**
   - List sections (VIP, Premium, Standard)
   - Add/Edit/Delete section
   - Fields: name, code, color picker, price

3. **Tools (Radio toggle)**
   ```
   [➕ Add Seat]  [🔍 Select]  [🔷 Polygon]  [📐 Array]
   ```

4. **Tool Config Panel** (thay đổi theo tool đang chọn)

   **Khi chọn "➕ Add Seat":**
   ```
   Auto-label prefix: [A]
   Next label: A1
   ```

   **Khi chọn "📐 Array":**
   ```
   Pattern: [Straight ▼]
   Rows: [10]    Cols: [20]
   Gap X: [3.5]  Gap Y: [4.0]
   Start X: [15] Start Y: [20]
   Label prefix: [A]
   
   [Generate Seats]
   
   Preview: Sẽ tạo 200 ghế (10x20)
   ```

5. **Seat List**
   - Hiển thị 50 ghế mới nhất
   - Click để focus canvas đến ghế đó
   - Hiển thị: label, section color, x, y

6. **Actions**
   - [💾 Save All] - POST to backend
   - [📥 Export CSV]
   - [🗑️ Clear All]

### Canvas behavior

| Tool | Click | Drag | Scroll |
|------|-------|------|--------|
| **➕ Add Seat** | Tạo 1 ghế tại vị trí click | Không | Zoom |
| **🔍 Select** | Chọn ghế / polygon | Kéo ghế đã chọn hoặc pan nền | Zoom |
| **🔷 Polygon** | Thêm điểm polygon | Kéo điểm đã có | Zoom |
| **📐 Array** | Đặt điểm bắt đầu (start_x, start_y) | Không | Zoom |

---

## 7. FRONTEND - CUSTOMER VIEW

**Layout:** Sidebar (left 280px) + PixiJS Canvas

**Sidebar:**
- Event info
- Section filters (checkbox)
- Selected seats list
- Total price
- [Checkout]

**PixiJS Canvas:**
- SVG background sprite
- Polygon overlays (8% opacity)
- Seat circles:
  - Màu theo section
  - Available: đầy màu
  - Selected (bạn chọn): màu amber + viền trắng
  - Locked (ngưởi khác): xám 40%
- Hover: scale 1.3x + tooltip DOM
- Click: select/deselect

---

## 8. CLOUDINARY INTEGRATION

```python
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

# Upload SVG
result = cloudinary.uploader.upload(
    file.file,
    public_id=f"venues/{venue_id}/bg",
    resource_type="raw",
    folder="ticketrush"
)
# Save: result["secure_url"], result["public_id"]
```

---

## 9. IMPLEMENTATION ORDER

### Phase 1: Database & Models
- [ ] Read existing models
- [ ] Create Venue, Section, Polygon models
- [ ] Add columns to Seat, Event models
- [ ] Create migration

### Phase 2: Backend - Admin APIs
- [ ] Cloudinary upload
- [ ] Venue CRUD
- [ ] Section CRUD
- [ ] **POST /seats/single** (1 ghế)
- [ ] **POST /seats/bulk** (hàng loạt - straight pattern trước)
- [ ] Polygon CRUD

### Phase 3: Frontend - Admin Builder
- [ ] Layout sidebar + canvas
- [ ] SVG upload + display
- [ ] Tool switching
- [ ] **Single click add seat**
- [ ] Drag to move
- [ ] **Array form + generate**
- [ ] Polygon drawing
- [ ] Connect APIs

### Phase 4: Backend - Customer APIs
- [ ] GET /seatmap
- [ ] Lock/unlock with transaction

### Phase 5: Frontend - Customer View
- [ ] PixiJS setup
- [ ] Render seats
- [ ] Zoom/pan/select

### Phase 6: Polish
- [ ] Arc pattern
- [ ] Zigzag pattern
- [ ] WebSocket

---

## 10. CONSTRAINTS

1. **Read first** - MUST read existing project before coding
2. **Follow conventions** - Use same patterns as existing code
3. **No over-engineering:**
   - PostgreSQL `SELECT FOR UPDATE` for lock (no Redis)
   - Cloudinary free tier for file storage
   - No CDN beyond Cloudinary
4. **Coordinates:** Percentage 0-100 in DB, convert to pixels in frontend
5. **Reuse auth** - Use existing auth system, admin endpoints need admin role

---

## 11. QUESTIONS TO ASK IF UNCLEAR

1. What is the existing Seat model structure?
2. What is the existing Event model structure?
3. What auth system is used and how to check admin role?
4. What is the frontend framework and folder structure?
5. Are there existing WebSocket implementations?
6. What is the existing API response wrapper format?

DO NOT GUESS. Ask if unclear.
```

---