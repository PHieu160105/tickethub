# TicketRush Frontend Guide

## 1. Muc tieu cua frontend

Frontend cua TicketRush co 2 nhom man hinh:

- Customer app: tim su kien, vao hang doi, chon ghe, thanh toan, xem ve, ho so, tro giup.
- Admin app: tao venue, tao event/show, quan ly seat map, thong ke, user, doanh thu.

Frontend duoc viet bang React + TypeScript + Vite. UI la SPA, toan bo state nghiep vu duoc cap nhat bang REST API va mot phan real-time qua WebSocket/polling.

## 2. Khoi dong ung dung

### 2.1 Stage 1: Browser load entry file

- File: `FE/src/main.tsx`
- Nhiem vu:
  - mount React app vao DOM
  - nap `App.tsx`
- Input:
  - file `index.html`
  - browser environment
- Output:
  - React tree bat dau render

### 2.2 Stage 2: Build route tree

- File: `FE/src/App.tsx`
- Nhiem vu:
  - khai bao `BrowserRouter`
  - chia route customer va route admin
  - dat provider bao ngoai toan app
- Input:
  - current URL
  - auth state tu `AuthProvider`
- Output:
  - man hinh dung voi URL hien tai

Thu tu provider trong `App.tsx`:

1. `ThemeProvider`
2. `LoadingProvider`
3. `AuthProvider`
4. `AppRoutes`

Ly do:

- theme can co san truoc khi render giao dien
- loading co the duoc dung boi cac man hinh
- auth can co san truoc khi xu ly protected route

## 3. So do thu muc frontend

### 3.1 Nhung thu muc quan trong nhat

- `FE/src/main.tsx`
  - diem vao cua app
- `FE/src/App.tsx`
  - route tree va provider tree
- `FE/src/context/`
  - global state dung bang React Context
- `FE/src/lib/`
  - axios client, storage, firebase helper, utility
- `FE/src/features/`
  - hook va API theo domain
- `FE/src/components/`
  - component UI va layout tai su dung
- `FE/src/pages/`
  - component man hinh theo route
- `FE/src/types.ts`
  - contract type lon giua FE va BE
- `FE/src/constants/`
  - API endpoint config, timeout, queue timing

### 3.2 Cach doc source theo thu tu dung

Neu ban la nguoi moi, doc frontend theo chuoi nay:

1. `FE/src/App.tsx`
2. `FE/src/context/AuthContext.tsx`
3. `FE/src/context/ThemeContext.tsx`
4. `FE/src/lib/api.ts`
5. `FE/src/features/events/hooks/useEvents.ts`
6. `FE/src/features/booking/hooks/useBooking.ts`
7. `FE/src/pages/customer/Home.tsx`
8. `FE/src/pages/customer/EventDetail.tsx`
9. `FE/src/pages/customer/VirtualQueue.tsx`
10. `FE/src/pages/customer/SeatSelection.tsx`
11. `FE/src/pages/customer/Checkout.tsx`
12. `FE/src/pages/customer/Confirmation.tsx`
13. `FE/src/pages/admin/Events.tsx`
14. `FE/src/pages/admin/Venues.tsx`
15. `FE/src/pages/admin/SeatPlanner.tsx`

Day la chuoi tu "nguoi dung thay gi" den "du lieu duoc tai va gui nhu the nao".

## 4. Layout va route

### 4.1 Customer layout

- File: `FE/src/components/layout/CustomerLayout.tsx`
- Nhiem vu:
  - render `Navbar`
  - render `Outlet` cua route con
  - render `Footer`
- Input:
  - route customer hien tai
- Output:
  - khung UI thong nhat cho user thong thuong

### 4.2 Admin layout

- File: `FE/src/components/layout/AdminLayout.tsx`
- Nhiem vu:
  - side navigation cho admin
  - top area cho title va action
  - `Outlet` de hien thi page con

### 4.3 Route map

| URL | File | Nhiem vu | Input chinh | Output chinh |
|---|---|---|---|---|
| `/` | `pages/customer/Home.tsx` | landing thuc dung cho customer | event list API | hero + event cards |
| `/search` | `pages/customer/Search.tsx` | tim kiem, loc, phan trang su kien | search params + event API | danh sach event da loc |
| `/event/:eventKey` | `pages/customer/EventDetail.tsx` | xem chi tiet event/show, review | `eventKey` | thong tin event, reviews, CTA dat ve |
| `/queue` | `pages/customer/VirtualQueue.tsx` | phong cho ao | queue token, show id | trang thai cho, cho phep vao mua |
| `/shows/:showId/seats` | `pages/customer/SeatSelection.tsx` | chon ghe | show id, queue token | seat map, lock seats |
| `/checkout` | `pages/customer/Checkout.tsx` | xac nhan thanh toan | seats dang lock | checkout request |
| `/confirmation` | `pages/customer/Confirmation.tsx` | ket qua dat ve | checkout response | ticket summary |
| `/tickets` | `pages/customer/CustomerTicket.tsx` | xem ve da mua/huy | my tickets API | ticket cards |
| `/profile` | `pages/customer/CustomerProfile.tsx` | xem/sua profile | auth user | profile form |
| `/help` | `pages/customer/Help.tsx` | tro giup va chat support | help API | thread + message list |
| `/admin/*` | `pages/admin/*` | he thong quan tri | admin token | CRUD, dashboard, analytics |

## 5. State management

### 5.1 Auth state

- File: `FE/src/context/AuthContext.tsx`
- Nhiem vu:
  - bootstrap user tu token luu trong storage
  - login/register/logout
  - social login qua Firebase token
  - update profile
- Input:
  - token trong local storage
  - response tu `/api/auth/*`
- Output:
  - `user`
  - `isAuthenticated`
  - `isAdmin`
  - auth actions de page goi

Flow:

1. App mount.
2. `AuthProvider` doc token trong storage.
3. Neu co token, goi `authApi.me()`.
4. Neu thanh cong, update user state.
5. Neu that bai, clear storage va dua app ve trang thai guest.

### 5.2 Theme state

- File: `FE/src/context/ThemeContext.tsx`
- Nhiem vu:
  - dong bo dark/light/system
  - cap class/theme token cho app

### 5.3 Loading state

- File: `FE/src/context/LoadingContext.tsx`
- Nhiem vu:
  - luu loading state tong quat neu can

## 6. Lop giao tiep API

### 6.1 Axios client

- File: `FE/src/lib/api.ts`
- Nhiem vu:
  - tao axios instance
  - gan `Authorization` header neu co token
  - retry mot so request co kha nang transient failure
  - chuan hoa thong diep loi tu backend

Input:

- `API_BASE_URL`
- token trong `authStorage`
- request payload tu page/hook

Output:

- typed response cho hook/page
- user-friendly error string khi can

### 6.2 Hai lop API dang cung ton tai

Trong source hien tai co 2 cum API/hook:

1. `FE/src/lib/api.ts`
2. `FE/src/features/*/api/*.ts`

Y nghia:

- app dang o giai doan chuyen doi structure
- page cu va page moi khong dung cung mot tang wrapper
- day khong phai bug blocking, nhung ban can biet khi debug

Khi trace du lieu, luon kiem tra page dang goi hook nao, hook do lai goi API module nao.

## 7. Workflow customer tu dau den cuoi

### 7.1 Browse event

Files:

- `pages/customer/Home.tsx`
- `pages/customer/Search.tsx`
- `features/events/hooks/useEvents.ts`
- `features/events/api/eventsApi.ts` hoac `lib/api.ts`

Flow:

1. Page mount.
2. Hook `useEvents()` chay.
3. Hook goi event list API.
4. Response tra ve mang event card.
5. Page render hero, grid, bo loc, phan trang.

Input:

- optional `search`
- optional `category`

Output:

- `EventCard[]`

### 7.2 View event detail

Files:

- `pages/customer/EventDetail.tsx`
- `features/events/hooks/useEventDetail`

Flow:

1. Route dua vao `eventKey`.
2. FE goi `/api/events/{eventKey}`.
3. Response tra ve thong tin event, danh sach show, review summary.
4. Page cho user chon show de tiep tuc.

Input:

- `eventKey`

Output:

- `EventDetail`

### 7.3 Join queue

Files:

- `pages/customer/VirtualQueue.tsx`
- `hooks/useWebSocketHeartbeat.ts`
- `lib/api.ts` hoac `features/booking/api/queueApi.ts`

Flow:

1. User bam dat ve.
2. FE goi queue join API voi `showId`.
3. Backend tra `queue token`.
4. FE polling status va/hoac gui heartbeat.
5. Khi token duoc admit, FE cho vao man chon ghe.

Input:

- `showId`

Output:

- `QueueJoinResponse`
- `QueueStatusResponse`

### 7.4 Seat selection

Files:

- `pages/customer/SeatSelection.tsx`
- `components/customer/CustomerSeatMap.tsx`
- `components/customer/SeatSelectionSummary.tsx`
- `components/customer/SeatMapLegend.tsx`

Flow:

1. FE nap seat matrix va seat map.
2. User click seat.
3. FE luu selected seat ids tam thoi trong state.
4. FE goi lock API de giu ghe.
5. UI cap nhat ghe nao da lock boi minh, ghe nao unavailable.

Input:

- `showId`
- `queueToken`
- selected `seatIds`

Output:

- danh sach ghe lock thanh cong
- thong bao loi neu ghe vua bi tranh mat

### 7.5 Checkout va confirmation

Files:

- `pages/customer/Checkout.tsx`
- `pages/customer/Confirmation.tsx`
- `features/booking/hooks/useCheckout`

Flow:

1. User xac nhan thanh toan.
2. FE goi checkout API.
3. Backend tao order, order items, tickets.
4. FE nhan `CheckoutResponse`.
5. FE dieu huong sang confirmation.

Input:

- `showId`
- `queueToken`

Output:

- `order_id`
- `tickets[]`

### 7.6 Ticket history

Files:

- `pages/customer/CustomerTicket.tsx`
- `features/booking/hooks/useMyTickets`
- `features/booking/hooks/useCancelTicket`

Flow:

1. Page mount -> fetch my tickets.
2. FE chia thanh `upcoming`, `past`, `cancelled`.
3. User co the huy ve neu nghiep vu cho phep.
4. Sau khi huy, FE refetch de dong bo.

## 8. Workflow admin

### 8.1 Event management

- File: `pages/admin/Events.tsx`
- Nhiem vu:
  - CRUD event
  - CRUD show
  - upload image
  - dieu huong sang seat planner

### 8.2 Venue builder

- File: `pages/admin/Venues.tsx`
- Nhiem vu:
  - tao venue
  - upload background SVG/raster
  - tao layout
  - tao section
  - dat ghe template
  - dat polygon vung

### 8.3 Seat planner

- File: `pages/admin/SeatPlanner.tsx`
- Nhiem vu:
  - chinh ghe cua show cu the
  - bulk create seat
  - lock/unlock seat bang admin
  - quan sat mau trang thai va occupancy

### 8.4 Dashboard and analytics

- Files:
  - `pages/admin/Dashboard.tsx`
  - `pages/admin/Analytics.tsx`
  - `pages/admin/Tickets.tsx`
  - `pages/admin/Users.tsx`

Output:

- summary KPI
- revenue chart
- audience distribution
- user/ticket list cho admin

## 9. Input/output theo tung lop

### 9.1 Page layer

- Input:
  - route params
  - query params
  - global auth/theme state
  - API hook state
- Output:
  - JSX
  - su kien click/change/submit

### 9.2 Hook layer

- Input:
  - page params
  - state values
- Output:
  - `isLoading`
  - `error`
  - `data`
  - action function nhu `refetch`, `checkout`, `cancelTicket`

### 9.3 API layer

- Input:
  - request payload
  - token
- Output:
  - parsed JSON
  - standardized error

## 10. Files quan trong theo use case

### 10.1 Neu muon sua login

Doc theo thu tu:

1. `pages/customer/Login.tsx`
2. `context/AuthContext.tsx`
3. `lib/api.ts`
4. `BE/app/api/routes/auth.py`

### 10.2 Neu muon sua trang chu

Doc theo thu tu:

1. `pages/customer/Home.tsx`
2. `features/events/hooks/useEvents.ts`
3. `features/events/api/eventsApi.ts`
4. `BE/app/api/routes/events.py`
5. `BE/app/services/event_service.py`

### 10.3 Neu muon sua dat ve

Doc theo thu tu:

1. `pages/customer/EventDetail.tsx`
2. `pages/customer/VirtualQueue.tsx`
3. `pages/customer/SeatSelection.tsx`
4. `pages/customer/Checkout.tsx`
5. `features/booking/hooks/useBooking.ts`
6. `BE/app/services/queue_service.py`
7. `BE/app/services/booking_service.py`

### 10.4 Neu muon sua venue/seat editor

Doc theo thu tu:

1. `pages/admin/Venues.tsx`
2. `pages/admin/SeatPlanner.tsx`
3. `components/admin/InteractiveSeatCanvas.tsx`
4. `BE/app/api/routes/venues.py`
5. `BE/app/api/routes/admin.py`
6. `BE/app/services/map_processor.py`

## 11. Build, run, check

### 11.1 Local frontend

```bash
cd FE
npm install
npm run build
npm run lint
```

### 11.2 Docker compose

```bash
docker compose up --build -d
curl http://localhost:8000/health
curl -I http://localhost:5173
docker compose down
```

## 12. Cac diem can nho khi debug

1. Nhieu page customer/admin dung chung component layout, nen bug UI co the nam o component chung chu khong phai page.
2. Auth state duoc luu ca trong memory va local storage. Neu state dung ma UI sai, kiem tra storage.
3. Queue va booking la nghiep vu nhay cam nhat. Neu user than phien "mat ghe", trace tu:
   - `SeatSelection.tsx`
   - booking hook
   - booking API
   - queue token
   - response seat status
4. Co su ton tai cua hai tang API wrapper trong source. Khi refactor sau nay, nen hop nhat de de debug hon.

## 13. Ket luan

Neu ban muon "doc de hieu nhu nguoi viet code", frontend hay duoc nhin nhu chuoi sau:

`Route -> Page -> Hook -> API Client -> Backend Response -> State Update -> UI Render`

Ban chi can trace dung chuoi nay cho moi man hinh la se doc duoc project mot cach co he thong.
