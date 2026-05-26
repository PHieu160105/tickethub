import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
// ═══════════════════════════════════════════════════════════════
// THƯ VIỆN react-router-dom (package npm, KHÔNG tự viết)
// ═══════════════════════════════════════════════════════════════
// BrowserRouter: component gốc để bọc toàn bộ app, dùng HTML5 History API
//   → URL thật: /login, /admin/events (không có dấu #)
//   → Khi deploy production, server PHẢI cấu hình fallback về index.html
//
// Navigate: component dùng để redirect (chuyển hướng) người dùng
//   → Thuộc tính "to": đường dẫn đích
//   → Thuộc tính "replace" (boolean): 
//     true → thay thế trang hiện tại trong lịch sử trình duyệt (user bấm Back sẽ không quay lại trang cũ)
//     false/mặc định → push vào lịch sử (user bấm Back sẽ quay lại trang trước đó)
//
// Route: component định nghĩa 1 route (1 đường dẫn) trong app
//   → Thuộc tính "path": đường dẫn URL
//   → Thuộc tính "element": component sẽ render khi URL khớp path
//   → Thuộc tính "index": đánh dấu đây là route con mặc định (không cần path)
//
// Routes: component chứa tất cả các Route, chịu trách nhiệm chọn route phù hợp
//   → CHỈ render component của route khớp ĐẦU TIÊN, không render chồng lên nhau
// ═══════════════════════════════════════════════════════════════

import './App.css'
// ═══════════════════════════════════════════════════════════════
// FILE TỰ VIẾT: App.css
// Chứa CSS global cho toàn bộ ứng dụng
// → Import ở đây để style có hiệu lực toàn bộ app
// ═══════════════════════════════════════════════════════════════

import { CustomerLayout } from './components/layout/CustomerLayout'
// ═══════════════════════════════════════════════════════════════
// COMPONENT TỰ VIẾT: CustomerLayout
// Đường dẫn: ./components/layout/CustomerLayout.tsx
// Mục đích: Layout CHUNG cho toàn bộ trang phía khách hàng
// → Chứa header, footer, sidebar (nếu có)
// → Tất cả trang con (Home, Login, Search...) sẽ được render bên trong layout này
// → Dùng React Router <Outlet /> để render nội dung trang con
// ═══════════════════════════════════════════════════════════════

import { AdminLayout } from './components/layout/AdminLayout'
import { QueueSessionGuard } from './components/customer/QueueSessionGuard'

// ═══════════════════════════════════════════════════════════════
// COMPONENT TỰ VIẾT: AdminLayout
// Đường dẫn: ./components/layout/AdminLayout.tsx
// Mục đích: Layout CHUNG cho toàn bộ trang quản trị (admin)
// → Nhận prop "title" để hiển thị tiêu đề trang admin
// → Chứa sidebar menu admin (Dashboard, Events, Users...)
// → Tự động kiểm tra role admin (đã làm ở RequireAdmin bên dưới)
// ═══════════════════════════════════════════════════════════════

import { AuthProvider, useAuth } from './context/AuthContext'
// ═══════════════════════════════════════════════════════════════
// CONTEXT TỰ VIẾT: AuthProvider & useAuth
// AuthProvider: component bọc toàn bộ app, cung cấp context auth
//   → Lưu user, token, các hàm login/logout/register
//   → Lưu token vào localStorage để duy trì đăng nhập khi tải lại trang
// useAuth: hook tự viết để lấy dữ liệu từ AuthContext
//   → Trả về { user, isAuthenticated, isAdmin, login, logout... }
// CÁCH DÙNG:
//   const { user, isAuthenticated, isAdmin } = useAuth()
// ═══════════════════════════════════════════════════════════════

import { ThemeProvider } from './context/ThemeContext'
// ═══════════════════════════════════════════════════════════════
// CONTEXT TỰ VIẾT: ThemeProvider
// Mục đích: Quản lý theme sáng/tối (light/dark mode) cho toàn bộ app
// → Lưu theme vào localStorage để duy trì khi tải lại trang
// → Cung cấp hàm toggleTheme() để chuyển đổi theme
// KIẾN THỨC QUAN TRỌNG:
// → Context là pattern của React để truyền dữ liệu xuống sâu
//   mà không cần truyền props qua từng cấp (prop drilling)
// → Có thể tái sử dụng pattern này cho MỌI dự án React
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// IMPORT CÁC TRANG (PAGES) PHÍA KHÁCH HÀNG - ĐỀU LÀ COMPONENT TỰ VIẾT
// Mỗi file là 1 trang hoàn chỉnh trong thư mục ./pages/customer/
// ─────────────────────────────────────────────────────────────
import Home from './pages/customer/Home'
import EventDetail from './pages/customer/EventDetail'
import Login from './pages/customer/Login'
import Checkout from './pages/customer/Checkout'
import Confirmation from './pages/customer/Confirmation'
import CustomerProfile from './pages/customer/CustomerProfile'
import CustomerTicket from './pages/customer/CustomerTicket'
import Search from './pages/customer/Search'
import SeatSelection from './pages/customer/SeatSelection'
import ErrorPage from './pages/customer/Error'
import VirtualQueue from './pages/customer/VirtualQueue'
import Register from './pages/customer/Register'
import Favourites from './pages/customer/Favourites'
import Help from './pages/customer/Help'
import CustomerSettings from './pages/customer/Setting'
import InfoPage from './pages/customer/Info'

// ─────────────────────────────────────────────────────────────
// IMPORT CÁC TRANG (PAGES) PHÍA ADMIN - ĐỀU LÀ COMPONENT TỰ VIẾT
// Mỗi file là 1 trang trong thư mục ./pages/admin/
// ─────────────────────────────────────────────────────────────
import AdminDashboard from './pages/admin/Dashboard'
import AdminEvents from './pages/admin/Events'
import AdminVenues from './pages/admin/Venues'
import AdminSeatPlanner from './pages/admin/SeatPlanner'
import AdminTickets from './pages/admin/Tickets'
import AdminAnalytics from './pages/admin/Analytics'
import AdminUsers from './pages/admin/Users'
import AdminSettings from './pages/admin/Settings'
import AdminHelp from './pages/admin/Help'

import { LoadingProvider } from '@/context/LoadingContext'
// ═══════════════════════════════════════════════════════════════
// CONTEXT TỰ VIẾT: LoadingProvider
// Mục đích: Quản lý trạng thái loading toàn cục
// → Khi gọi API, set loading = true để hiển thị spinner/skeleton
// → Khi API trả về, set loading = false
// → Giúp UI nhất quán, tránh mỗi trang tự quản lý loading riêng
// KIẾN THỨC QUAN TRỌNG:
// → Pattern này DÙNG ĐƯỢC cho MỌI dự án cần loading indicator toàn cục
// → Có thể mở rộng để quản lý nhiều loại loading khác nhau
// ═══════════════════════════════════════════════════════════════


// ╔══════════════════════════════════════════════════════════════╗
// ║          GUARD COMPONENT: RequireAdmin                       ║
// ╠══════════════════════════════════════════════════════════════╣
// ║ COMPONENT TỰ VIẾT - KIẾN THỨC QUAN TRỌNG (Auth Guard)        ║
// ║ Mục đích: Bảo vệ route admin, chỉ admin mới được vào         ║
// ║ Pattern này dùng được cho MỌI dự án React cần phân quyền     ║
// ║ CÁCH HOẠT ĐỘNG:                                            ║
// ║ 1. Kiểm tra isAuthenticated → chưa đăng nhập: về /login    ║
// ║ 2. Kiểm tra isAdmin → không phải admin: về trang chủ /     ║
// ║ 3. Đủ điều kiện → render children (nội dung bên trong)     ║
// ╚══════════════════════════════════════════════════════════════╝
function RequireAdmin({ children }: { children: React.ReactNode }) {
  // ── GIẢI THÍCH THAM SỐ ──────────────────────────────────
  // { children }: destructuring props object
  // children: React.ReactNode → type của React
  //   ReactNode = MỌI THỨ render được trong React:
  //   JSX, string, number, null, undefined, boolean, array...
  // ─────────────────────────────────────────────────────────

  // ── LẤY DỮ LIỆU TỪ AUTH CONTEXT ─────────────────────────
  const { isAuthenticated, isAdmin } = useAuth()
  // useAuth(): hook tự viết, gọi useContext(AuthContext)
  // isAuthenticated (boolean): true nếu user đã đăng nhập
  //   → Kiểm tra: có token trong localStorage + token còn hạn
  // isAdmin (boolean): true nếu user.role === 'admin'
  //   → Dùng để phân biệt giao diện admin và customer

  // ── KIỂM TRA 1: CHƯA ĐĂNG NHẬP ──────────────────────────
  if (!isAuthenticated) return <Navigate to="/login" replace />
  // !isAuthenticated: phủ định, true nếu user CHƯA đăng nhập
  // Navigate: component của react-router-dom
  //   "to": string → đường dẫn đích "/login"
  //   "replace": true → thay thế trang hiện tại trong history
  //     (user bấm Back sẽ KHÔNG quay lại trang admin)
  // return: component Navigate được render, React Router tự redirect

  // ── KIỂM TRA 2: KHÔNG PHẢI ADMIN ─────────────────────────
  if (!isAdmin) return <Navigate to="/" replace />
  // !isAdmin: true nếu user KHÔNG phải admin (là customer)
  // Redirect về "/" (trang chủ khách hàng)
  // replace: true → xóa trang admin khỏi history

  // ── ĐỦ ĐIỀU KIỆN: RENDER NỘI DUNG BÊN TRONG ─────────────
  return <>{children}</>
  // <>...</>: React Fragment shorthand
  //   Fragment: component ảo, không tạo thẻ HTML thật trong DOM
  //   Dùng để bọc nhiều element mà không thêm thẻ div dư thừa
  // children: nội dung được bọc bởi <RequireAdmin>...</RequireAdmin>
  //   Ví dụ: <AdminLayout /> sẽ được render ở đây
}


// ╔══════════════════════════════════════════════════════════════╗
// ║       GUARD COMPONENT: RequireCustomerAuth                 ║
// ╠══════════════════════════════════════════════════════════════╣
// ║ COMPONENT TỰ VIẾT - KIẾN THỨC QUAN TRỌNG (Auth Guard)     ║
// ║ Mục đích: Bảo vệ route cần đăng nhập customer              ║
// ║ CÁCH HOẠT ĐỘNG:                                            ║
// ║ 1. Chưa đăng nhập → về /login                              ║
// ║ 2. Là admin (đang đăng nhập admin) → về /admin             ║
// ║    (Tránh admin vô tình vào route customer khi đang ở      ║
// ║     tab admin, gây lỗi hiển thị hoặc sai logic)            ║
// ║ 3. Là customer → render nội dung                           ║
// ╚══════════════════════════════════════════════════════════════╝
function RequireCustomerAuth({ children }: { children: React.ReactNode }) {
  // ── LẤY DỮ LIỆU TỪ AUTH CONTEXT ─────────────────────────
  const { isAuthenticated, isAdmin } = useAuth()
  // Giống RequireAdmin, dùng chung useAuth() hook

  // ── KIỂM TRA 1: CHƯA ĐĂNG NHẬP ──────────────────────────
  if (!isAuthenticated) return <Navigate to="/login" replace />

  // ── KIỂM TRA 2: LÀ ADMIN (đã đăng nhập bằng tài khoản admin) ──
  if (isAdmin) return <Navigate to="/admin" replace />
  // isAdmin: true nếu user.role === 'admin'
  // Redirect admin về đúng khu vực admin của họ
  // replace: true → xóa route customer khỏi history

  // ── LÀ CUSTOMER: RENDER NỘI DUNG ─────────────────────────
  return <>{children}</>
}


// ╔══════════════════════════════════════════════════════════════╗
// ║     GUARD COMPONENT: RedirectIfAuthenticated               ║
// ╠══════════════════════════════════════════════════════════════╣
// ║ COMPONENT TỰ VIẾT - KIẾN THỨC QUAN TRỌNG (Auth Guard)     ║
// ║ Mục đích: Chặn user ĐÃ đăng nhập vào trang login/register ║
// ║ LÝ DO: Không hợp lý khi user đã đăng nhập rồi              ║
// ║        mà vẫn truy cập trang đăng nhập/đăng ký             ║
// ║ CÁCH HOẠT ĐỘNG:                                            ║
// ║ 1. Chưa đăng nhập → render bình thường (cho vào login)    ║
// ║ 2. Đã đăng nhập + là admin → redirect về /admin           ║
// ║ 3. Đã đăng nhập + là customer → redirect về /             ║
// ╚══════════════════════════════════════════════════════════════╝
function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  // ── LẤY DỮ LIỆU TỪ AUTH CONTEXT ─────────────────────────
  const { isAuthenticated, isAdmin } = useAuth()

  // ── CHƯA ĐĂNG NHẬP: CHO PHÉP TRUY CẬP ───────────────────
  if (!isAuthenticated) return <>{children}</>
  // !isAuthenticated: user chưa đăng nhập → hợp lệ
  // return children: render trang login hoặc register bình thường

  // ── ĐÃ ĐĂNG NHẬP: REDIRECT VỀ TRANG PHÙ HỢP ─────────────
  return <Navigate to={isAdmin ? '/admin' : '/'} replace />
  // isAdmin ? '/admin' : '/' : toán tử 3 ngôi (ternary operator)
  //   Nếu isAdmin === true → to="/admin" (về trang admin)
  //   Nếu isAdmin === false → to="/" (về trang chủ customer)
  // replace: true → xóa trang login/register khỏi history
}


// ╔══════════════════════════════════════════════════════════════╗
// ║              COMPONENT CHÍNH: AppRoutes                    ║
// ╠══════════════════════════════════════════════════════════════╣
// ║ COMPONENT TỰ VIẾT - KIẾN THỨC QUAN TRỌNG (Router Config)  ║
// ║ Mục đích: Định nghĩa TOÀN BỘ routing của ứng dụng         ║
// ║ ĐÂY LÀ NƠI DUY NHẤT khai báo route - dễ bảo trì, sửa đổi  ║
// ║ Cấu trúc route được tổ chức theo nesting (lồng nhau):      ║
// ║ - Route cha: Layout (CustomerLayout / AdminLayout)         ║
// ║ - Route con: các trang bên trong layout đó                 ║
// ╚══════════════════════════════════════════════════════════════╝
function AppRoutes() {
  return (
    // ── BrowserRouter: component gốc của routing ────────────
    <BrowserRouter>
      <QueueSessionGuard />

      {/*
        BrowserRouter: dùng HTML5 History API
        → URL KHÔNG có dấu # (khác với HashRouter)
        → Server phải cấu hình fallback về index.html cho SPA
        → Các route bên trong sẽ được xử lý bởi React, không phải server
      */}

      {/* ── Routes: container chứa tất cả Route ────────────── */}

      <Routes>
        {/*
          Routes: component của react-router-dom v6
          → Tự động chọn route KHỚP ĐẦU TIÊN để render
          → Thay thế cho <Switch> của react-router-dom v5
          → KHÔNG render nhiều route cùng lúc (chỉ 1 route thắng)
        */}


        {/* ═══════════════════════════════════════════════════
            ROUTE CHA: TRANG KHÁCH HÀNG
            path="/" → URL bắt đầu bằng "/"
            element={<CustomerLayout />} → layout chung cho customer
            Tất cả route con sẽ được render vào <Outlet /> trong CustomerLayout
            ═══════════════════════════════════════════════════ */}
        <Route path="/" element={<CustomerLayout />}>
          {/*
            Route với path="/" và element layout
            → Đây là "layout route" - không có path riêng cho layout
            → CustomerLayout chứa header, footer dùng chung
            → Các route con sẽ thay thế phần <Outlet /> trong layout
          */}

          {/* ── Route index (trang chủ) ────────────────── */}
          <Route index element={<Home />} />
          {/*
            index: boolean attribute (không cần ghi ={true})
            → Route MẶC ĐỊNH khi URL là "/" (khớp chính xác)
            → Tương đương với path="" trong v5
            element={<Home />}: render component Home
              Home: trang chủ, hiển thị danh sách sự kiện nổi bật
          */}

          {/* ── Route login (có guard) ─────────────────── */}
          <Route
            path="login"
            element={
              <RedirectIfAuthenticated>
                <Login />
              </RedirectIfAuthenticated>
            }
          />
          {/*
            path="login": URL sẽ là /login (nối với path cha "/")
            element: bọc Login trong RedirectIfAuthenticated
            → Nếu ĐÃ đăng nhập: tự động redirect về / hoặc /admin
            → Nếu CHƯA đăng nhập: render trang Login bình thường
            Login: component trang đăng nhập (form email + password)
          */}

          {/* ── Route register (có guard) ──────────────── */}
          <Route
            path="register"
            element={
              <RedirectIfAuthenticated>
                <Register />
              </RedirectIfAuthenticated>
            }
          />
          {/*
            path="register": URL /register
            RedirectIfAuthenticated: bọc Register
            → Đã đăng nhập → redirect đi nơi khác
            → Chưa đăng nhập → cho đăng ký
          */}

          {/* ── Route chi tiết sự kiện ─────────────────── */}
          <Route path="event/:eventKey" element={<EventDetail />} />
          {/*
            path="event/:eventKey": URL có tham số động
            :eventKey → URL parameter (tham số URL)
              eventKey: tên tham số, có thể là slug hoặc ID của sự kiện
              Ví dụ: /event/rock-concert-2024 → eventKey = "rock-concert-2024"
                     /event/abc123 → eventKey = "abc123"
            Trong component EventDetail, lấy giá trị bằng:
              import { useParams } from 'react-router-dom'
              const { eventKey } = useParams()
              // useParams(): hook của react-router-dom
              // Trả về object chứa tất cả URL params
          */}

          {/* ── Route phòng chờ ảo ─────────────────────── */}
          <Route path="queue" element={<VirtualQueue />} />
          {/*
            path="queue": URL /queue
            VirtualQueue: component tự viết
            → Hiển thị phòng chờ ảo khi sự kiện quá tải
            → User xếp hàng, đếm ngược thời gian chờ
          */}

          {/* ── Route thanh toán (yêu cầu đăng nhập) ────── */}
          <Route path="checkout" element={<RequireCustomerAuth><Checkout /></RequireCustomerAuth>} />
          {/*
            path="checkout": URL /checkout
            RequireCustomerAuth: guard yêu cầu đăng nhập customer
            → Chưa đăng nhập → redirect /login
            → Là admin → redirect /admin
            Checkout: component trang thanh toán
            → Hiển thị giỏ vé, form thanh toán
          */}

          {/* ── Route xác nhận đặt vé ──────────────────── */}
          <Route path="confirmation" element={<Confirmation />} />
          {/*
            path="confirmation": URL /confirmation
            Confirmation: component trang xác nhận sau khi đặt vé thành công
            → Hiển thị mã vé, QR code, hướng dẫn
            → KHÔNG có guard vì có thể truy cập từ link email/xác nhận
          */}

          {/* ── Route hồ sơ cá nhân (yêu cầu đăng nhập) ── */}
          <Route path="profile" element={<RequireCustomerAuth><CustomerProfile /></RequireCustomerAuth>} />
          {/*
            path="profile": URL /profile
            CustomerProfile: trang thông tin cá nhân của customer
            → Xem/sửa tên, email, avatar, giới tính, tuổi
          */}

          {/* ── Route vé của tôi (yêu cầu đăng nhập) ───── */}
          <Route path="tickets" element={<RequireCustomerAuth><CustomerTicket /></RequireCustomerAuth>} />
          {/*
            path="tickets": URL /tickets
            CustomerTicket: trang danh sách vé đã mua
            → Hiển thị tất cả vé, lọc theo trạng thái
            → Có thể xem chi tiết vé, QR code
          */}

          {/* ── Route yêu thích (yêu cầu đăng nhập) ────── */}
          <Route path="favourites" element={<RequireCustomerAuth><Favourites /></RequireCustomerAuth>} />
          {/*
            path="favourites": URL /favourites
            Favourites: trang danh sách sự kiện yêu thích
            → User đã bấm "tim" các sự kiện quan tâm
          */}

          {/* ── Route redirect /payments → /settings ────── */}
          <Route path="payments" element={<Navigate to="/settings" replace />} />
          {/*
            path="payments": URL /payments (route CŨ, không còn dùng)
            Navigate: component redirect của react-router-dom
            to="/settings": chuyển hướng đến /settings
            replace: true → thay thế trong history
            Mục đích: duy trì backward compatibility (tương thích ngược)
            → Nếu user bookmark /payments cũ → tự động chuyển sang /settings mới
          */}

          {/* ── Route trợ giúp (yêu cầu đăng nhập) ──────── */}
          <Route path="help" element={<RequireCustomerAuth><Help /></RequireCustomerAuth>} />
          {/*
            path="help": URL /help
            Help: trang hướng dẫn, FAQ cho customer
          */}

          {/* ── Route thông tin ────────────────────────── */}
          <Route path="info" element={<InfoPage />} />
          {/*
            path="info": URL /info
            InfoPage: trang thông tin về TicketRush
            → Giới thiệu công ty, điều khoản, chính sách
            → KHÔNG có guard → ai cũng xem được
          */}

          {/* ── Route cài đặt (yêu cầu đăng nhập) ──────── */}
          <Route path="settings" element={<RequireCustomerAuth><CustomerSettings /></RequireCustomerAuth>} />
          {/*
            path="settings": URL /settings
            CustomerSettings: trang cài đặt tài khoản
            → Đổi mật khẩu, cài đặt thông báo, theme...
          */}

          {/* ── Route tìm kiếm ─────────────────────────── */}
          <Route path="search" element={<Search />} />
          {/*
            path="search": URL /search
            Search: trang tìm kiếm sự kiện
            → KHÔNG có guard → ai cũng tìm kiếm được
            → Có thể có query string: /search?q=rock&date=2024-12
          */}

          {/* ── Route chọn ghế ─────────────────────────── */}
          <Route path="shows/:showId/seats" element={<SeatSelection />} />
          {/*
            path="shows/:showId/seats": URL có tham số động showId
            :showId → URL parameter, ID của buổi diễn (show)
            Ví dụ: /shows/42/seats → showId = "42"
            SeatSelection: component chọn ghế
            → Hiển thị sơ đồ ghế (seat map)
            → User chọn ghế, xem giá, đặt vé
            → KHÔNG có guard: user có thể xem sơ đồ ghế trước khi đăng nhập
               (sẽ yêu cầu đăng nhập khi bấm "Đặt vé")
          */}

          {/* ── Route 404 (catch-all cho customer) ──────── */}
          <Route path="*" element={<ErrorPage />} />
          {/*
            path="*": wildcard - KHỚP MỌI URL chưa được định nghĩa
            → Đây là route "catch-all" (bắt tất cả)
            → QUAN TRỌNG: phải đặt SAU CÙNG trong danh sách route con
              Vì Routes chọn route KHỚP ĐẦU TIÊN
              Nếu đặt "*" lên đầu → mọi URL đều khớp → không vào được route khác
            ErrorPage: component hiển thị lỗi 404
            → "Trang không tồn tại" kèm nút quay về trang chủ
          */}

        </Route>
        {/* KẾT THÚC ROUTE CHA CUSTOMER */}


        {/* ── Route error độc lập ──────────────────────────── */}
        <Route path="/error" element={<ErrorPage />} />
        {/*
          Route ngoài layout, không bọc trong CustomerLayout
          → URL /error sẽ KHÔNG có header/footer của CustomerLayout
          → Trang lỗi thuần, dùng khi có lỗi nghiêm trọng
          → Có thể redirect từ bất kỳ đâu về đây khi gặp lỗi
        */}


        {/* ═══════════════════════════════════════════════════
            ROUTE CHA: TRANG QUẢN TRỊ (ADMIN)
            path="/admin" → URL bắt đầu bằng "/admin"
            element: bọc AdminLayout trong RequireAdmin
            → RequireAdmin: guard kiểm tra quyền admin
            → AdminLayout: layout riêng cho admin (sidebar menu)
            ═══════════════════════════════════════════════════ */}
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout title="Quản trị Hệ thống" />
            </RequireAdmin>
          }
        >
          {/*
            RequireAdmin bọc AdminLayout:
            → Chưa đăng nhập → redirect /login
            → Không phải admin → redirect /
            → Là admin → render AdminLayout với title "Quản trị Hệ thống"
            title: prop truyền vào AdminLayout
            → Hiển thị trên header của trang admin
          */}

          {/* ── Route index admin (Dashboard) ────────────── */}
          <Route index element={<AdminDashboard />} />
          {/*
            index: route mặc định khi URL là /admin
            AdminDashboard: trang tổng quan admin
            → Hiển thị thống kê: số vé bán, doanh thu, user mới...
          */}

          {/* ── Route quản lý sự kiện ──────────────────── */}
          <Route path="events" element={<AdminEvents />} />
          {/*
            path="events": URL /admin/events
            AdminEvents: trang quản lý danh sách sự kiện
            → CRUD sự kiện (Create, Read, Update, Delete)
            → Thêm/sửa/xóa sự kiện, quản lý trạng thái (draft/live/closed)
          */}

          {/* ── Route quản lý sơ đồ ghế ────────────────── */}
          <Route path="events/:eventKey/shows/:showId/seating" element={<AdminSeatPlanner />} />
          {/*
            path="events/:eventKey/shows/:showId/seating":
            Có 2 URL params:
              :eventKey → slug/ID của sự kiện
              :showId → ID của buổi diễn (show)
            Ví dụ: /admin/events/concert-2024/shows/15/seating
              → eventKey = "concert-2024"
              → showId = "15"
            AdminSeatPlanner: component thiết kế sơ đồ ghế
            → Kéo thả để tạo layout ghế
            → Gán loại ghế, giá vé cho từng khu vực
          */}

          {/* ── Route quản lý địa điểm ─────────────────── */}
          <Route path="venues" element={<AdminVenues />} />
          {/*
            path="venues": URL /admin/venues
            AdminVenues: trang quản lý địa điểm tổ chức
            → Thêm/sửa/xóa venues (nhà thi đấu, sân vận động...)
            → Mỗi venue có sức chứa, địa chỉ, layout mặc định
          */}

          {/* ── Route quản lý vé ────────────────────────── */}
          <Route path="tickets" element={<AdminTickets />} />
          {/*
            path="tickets": URL /admin/tickets
            AdminTickets: trang quản lý vé đã bán
            → Xem tất cả vé, lọc theo sự kiện/show
            → Check-in vé (xác nhận vé hợp lệ khi vào cửa)
          */}

          {/* ── Route thống kê ──────────────────────────── */}
          <Route path="analytics" element={<AdminAnalytics />} />
          {/*
            path="analytics": URL /admin/analytics
            AdminAnalytics: trang phân tích dữ liệu
            → Biểu đồ doanh thu, tỉ lệ lấp đầy, top sự kiện...
          */}

          {/* ── Route quản lý người dùng ───────────────── */}
          <Route path="users" element={<AdminUsers />} />
          {/*
            path="users": URL /admin/users
            AdminUsers: trang quản lý danh sách user
            → Xem tất cả user, khóa/mở khóa tài khoản
            → Phân quyền admin cho user
          */}

          {/* ── Route trợ giúp admin ────────────────────── */}
          <Route path="help" element={<AdminHelp />} />
          {/*
            path="help": URL /admin/help
            AdminHelp: trang hướng dẫn sử dụng cho admin
            → Cách tạo sự kiện, quản lý vé, check-in...
          */}

          {/* ── Route cài đặt admin ────────────────────── */}
          <Route path="settings" element={<AdminSettings />} />
          {/*
            path="settings": URL /admin/settings
            AdminSettings: trang cài đặt hệ thống
            → Cấu hình chung, tích hợp thanh toán, email template...
          */}

        </Route>
        {/* KẾT THÚC ROUTE CHA ADMIN */}

      </Routes>
    </BrowserRouter>
  )
}


// ╔══════════════════════════════════════════════════════════════╗
// ║              COMPONENT GỐC: App                           ║
// ╠══════════════════════════════════════════════════════════════╣
// ║ COMPONENT TỰ VIẾT - KIẾN THỨC QUAN TRỌNG (App Root)      ║
// ║ Đây là component GỐC, được render vào <div id="root">     ║
// ║ trong file index.html                                     ║
// ║ THỨ TỰ PROVIDER QUAN TRỌNG: phải bọc từ NGOÀI vào TRONG  ║
// ║ ThemeProvider → LoadingProvider → AuthProvider → AppRoutes ║
// ║ Lý do: Provider bên ngoài có thể được dùng bởi provider   ║
// ║ bên trong. Ví dụ: AuthProvider có thể cần LoadingProvider ║
// ║ để hiển thị loading khi đang kiểm tra token               ║
// ╚══════════════════════════════════════════════════════════════╝
function App() {
  return (
    // ── CẤP 1: ThemeProvider ────────────────────────────────
    <ThemeProvider>
      {/*
        ThemeProvider: cung cấp theme (sáng/tối) cho toàn bộ app
        → Bọc NGOÀI CÙNG vì TẤT CẢ component đều cần theme
        → Kể cả LoadingProvider cũng cần theme để style spinner
      */}

      {/* ── CẤP 2: LoadingProvider ────────────────────────── */}
      <LoadingProvider>
        {/*
          LoadingProvider: quản lý trạng thái loading toàn cục
          → Bọc TRƯỚC AuthProvider vì AuthProvider gọi API
            kiểm tra token khi khởi động → cần loading indicator
          → Cho phép bất kỳ component nào cũng có thể
            set loading = true/false
        */}

        {/* ── CẤP 3: AuthProvider ─────────────────────────── */}
        <AuthProvider>
          {/*
            AuthProvider: cung cấp context xác thực
            → Khi mount: kiểm tra token trong localStorage
            → Gọi API /auth/me để lấy thông tin user
            → Nếu token hết hạn → tự động clear + set user = null
            → Cung cấp user, login, logout... cho AppRoutes
          */}

          {/* ── CẤP 4: AppRoutes (hệ thống routing) ──────── */}
          <AppRoutes />
          {/*
            AppRoutes: component chứa toàn bộ routing
            → Được bọc trong AuthProvider nên có thể gọi useAuth()
            → Tất cả guard (RequireAdmin, RequireCustomerAuth...)
              đều hoạt động được nhờ context từ AuthProvider
          */}

        </AuthProvider>
      </LoadingProvider>
    </ThemeProvider>
  )
}

export default App
// ═══════════════════════════════════════════════════════════════
// export default App: cú pháp ES6 module
// → Xuất component App làm default export
// → File main.tsx (hoặc index.tsx) sẽ import và render:
//   import App from './App'
//   ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
// → Đây là ENTRY POINT của toàn bộ ứng dụng React
// ═══════════════════════════════════════════════════════════════


// ╔══════════════════════════════════════════════════════════════╗
// ║              TÓM TẮT KIẾN THỨC CỐT LÕI                     ║
// ╠══════════════════════════════════════════════════════════════╣
// ║ 1. React Router v6:                                        ║
// ║    - BrowserRouter: dùng HTML5 History API (URL thật)      ║
// ║    - Routes: chứa tất cả Route, chỉ render 1 route khớp   ║
// ║    - Route: định nghĩa path + element                      ║
// ║    - Navigate: component redirect                          ║
// ║    - useParams(): hook lấy URL params (:id)                ║
// ║    - Outlet: render route con trong layout                 ║
// ║                                                            ║
// ║ 2. Auth Guard Pattern (QUAN TRỌNG - dùng mọi dự án):      ║
// ║    - Tạo component riêng để kiểm tra quyền                ║
// ║    - Bọc route cần bảo vệ trong guard                     ║
// ║    - Chưa đăng nhập → redirect /login                     ║
// ║    - Không đủ quyền → redirect trang phù hợp              ║
// ║    - Đủ quyền → render children                           ║
// ║                                                            ║
// ║ 3. React Context Pattern (QUAN TRỌNG - dùng mọi dự án):   ║
// ║    - Tạo context bằng createContext()                      ║
// ║    - Provider bọc component cần dùng dữ liệu              ║
// ║    - useContext() hoặc custom hook để lấy dữ liệu         ║
// ║    - Thứ tự Provider: ngoài → trong (Theme → Loading      ║
// ║      → Auth → App)                                        ║
// ║                                                            ║
// ║ 4. Route nesting (layout route):                           ║
// ║    - Route cha có element là layout                       ║
// ║    - Route con tự động render vào Outlet                  ║
// ║    - Tiết kiệm code, không lặp header/footer              ║
// ╚══════════════════════════════════════════════════════════════╝