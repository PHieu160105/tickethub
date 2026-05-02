## Kế Hoạch Thêm Light Theme + Toggle Dark/Light Trong Settings (Customer/Admin)

### Summary
- Xây cơ chế theme dùng chung toàn app FE, hỗ trợ `light` và `dark`.
- Customer và Admin đều có trang `settings` để bật/tắt theme.
- Theme được lưu bằng `localStorage`, khởi tạo theo `system preference`, fallback `dark`.

### Implementation Changes
- Thêm `ThemeProvider` + `useTheme` (context hook) ở tầng root app:
  - Quản lý state `theme: 'light' | 'dark'`.
  - API public: `setTheme(theme)`, `toggleTheme()`.
  - Khi theme đổi, set class vào `document.documentElement` (vd: `dark` cho dark mode, bỏ class cho light).
  - Đọc/ghi `localStorage` key cố định (vd: `ticketrush-theme`).
  - Init flow: nếu có localStorage thì dùng; nếu chưa có thì đọc `prefers-color-scheme`; nếu không xác định thì `dark`.
- Chuẩn hóa style nền và màu global để hỗ trợ 2 mode:
  - Cập nhật `index.css` để tách token dark/light rõ ràng bằng CSS variables hoặc variant theo `.dark`.
  - Đảm bảo `body`, layout wrappers (`CustomerLayout`, `AdminLayout`) không hard-code chỉ dark background.
- Admin settings:
  - Nâng cấp phần “Giao diện” trong `pages/admin/Settings.tsx` từ mock sang điều khiển thật qua `useTheme`.
  - UI toggle 2 lựa chọn `Dark` / `Light`, hiển thị trạng thái đang dùng.
- Customer settings:
  - Tạo route mới `/settings` cho customer.
  - Thêm page customer settings tối thiểu gồm card “Appearance” với toggle `Dark` / `Light` dùng chung `useTheme`.
  - Nối điều hướng từ `CustomerSidebar` mục `settings` sang route mới.
- Router integration:
  - Bọc `AppRoutes` bằng `ThemeProvider` trong `App.tsx`.
  - Thêm route customer `settings` trong `App.tsx`.

### Public APIs / Interfaces
- Thêm context contract:
  - `type ThemeMode = 'light' | 'dark'`
  - `useTheme(): { theme: ThemeMode; setTheme: (mode: ThemeMode) => void; toggleTheme: () => void }`
- Local storage contract:
  - Key: `ticketrush-theme`
  - Value hợp lệ: `'light' | 'dark'`

### Test Plan
- Functional:
  - Đổi theme ở admin settings, toàn bộ UI đổi ngay.
  - Đổi theme ở customer settings, admin/customer giữ cùng trạng thái (global trong cùng browser profile).
  - Refresh trang vẫn giữ theme đã chọn.
  - Xóa localStorage, app tự chọn theo system preference; nếu không lấy được thì dark.
- Routing:
  - Customer vào `/settings` render đúng page.
  - Click mục `settings` trong `CustomerSidebar` điều hướng đúng.
- Regression:
  - Kiểm tra các trang chính (`/`, `/profile`, `/tickets`, `/admin`, `/admin/settings`) không mất readability khi light mode.

### Assumptions
- Chỉ triển khai FE, không lưu theme lên backend.
- Theme là preference toàn app theo browser hiện tại (không tách riêng theo role/user).
- Mặc định ưu tiên theo system, fallback `dark`.
