import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { CustomerLayout } from './components/layout/CustomerLayout'
import { AdminLayout } from './components/layout/AdminLayout'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
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

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin } = useAuth()

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireCustomerAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin } = useAuth()

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (isAdmin) return <Navigate to="/admin" replace />
  return <>{children}</>
}

function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin } = useAuth()
  if (!isAuthenticated) return <>{children}</>
  return <Navigate to={isAdmin ? '/admin' : '/'} replace />
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CustomerLayout />}>
          <Route index element={<Home />} />
          <Route
            path="login"
            element={
              <RedirectIfAuthenticated>
                <Login />
              </RedirectIfAuthenticated>
            }
          />
          <Route
            path="register"
            element={
              <RedirectIfAuthenticated>
                <Register />
              </RedirectIfAuthenticated>
            }
          />
          <Route path="event/:eventKey" element={<EventDetail />} />
          <Route path="queue" element={<VirtualQueue />} />
          <Route path="checkout" element={<RequireCustomerAuth><Checkout /></RequireCustomerAuth>} />
          <Route path="confirmation" element={<Confirmation />} />
          <Route path="profile" element={<RequireCustomerAuth><CustomerProfile /></RequireCustomerAuth>} />
          <Route path="tickets" element={<RequireCustomerAuth><CustomerTicket /></RequireCustomerAuth>} />
          <Route path="favourites" element={<RequireCustomerAuth><Favourites /></RequireCustomerAuth>} />
          <Route path="payments" element={<Navigate to="/settings" replace />} />
          <Route path="help" element={<RequireCustomerAuth><Help /></RequireCustomerAuth>} />
          <Route path="info" element={<InfoPage />} />
          <Route path="settings" element={<RequireCustomerAuth><CustomerSettings /></RequireCustomerAuth>} />
          <Route path="search" element={<Search />} />
          <Route path="shows/:showId/seats" element={<SeatSelection />} />
          <Route path="*" element={<ErrorPage />} />
        </Route>

        <Route path="/error" element={<ErrorPage />} />

        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout title="Quản trị Hệ thống" />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="events" element={<AdminEvents />} />
          <Route path="events/:eventKey/shows/:showId/seating" element={<AdminSeatPlanner />} />
          <Route path="venues" element={<AdminVenues />} />
          <Route path="tickets" element={<AdminTickets />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="help" element={<AdminHelp />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

function App() {
  return (
    <ThemeProvider>
      <LoadingProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </LoadingProvider>
    </ThemeProvider>
  )
}

export default App
