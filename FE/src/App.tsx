import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import './App.css'

import { QueueSessionGuard } from './components/customer/QueueSessionGuard'
import { AdminLayout } from './components/layout/AdminLayout'
import { CustomerLayout } from './components/layout/CustomerLayout'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LoadingProvider } from './context/LoadingContext'
import { ThemeProvider } from './context/ThemeContext'

import AdminAnalytics from './pages/admin/Analytics'
import AdminDashboard from './pages/admin/Dashboard'
import AdminEvents from './pages/admin/Events'
import AdminSettings from './pages/admin/Settings'
import AdminStaff from './pages/admin/Staff'
import AdminSeatPlanner from './pages/admin/SeatPlanner'
import AdminTickets from './pages/admin/Tickets'
import AdminUsers from './pages/admin/Users'
import AdminVenues from './pages/admin/Venues'
import Checkout from './pages/customer/Checkout'
import Confirmation from './pages/customer/Confirmation'
import CustomerProfile from './pages/customer/CustomerProfile'
import CustomerSettings from './pages/customer/Setting'
import CustomerTicket from './pages/customer/CustomerTicket'
import ErrorPage from './pages/customer/Error'
import EventDetail from './pages/customer/EventDetail'
import HelpPage from './pages/customer/Help'
import Home from './pages/customer/Home'
import InfoPage from './pages/customer/Info'
import Login from './pages/customer/Login'
import Register from './pages/customer/Register'
import Search from './pages/customer/Search'
import SeatSelection from './pages/customer/SeatSelection'
import VirtualQueue from './pages/customer/VirtualQueue'

function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth()
  if (isLoading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireCustomerAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, isAdmin } = useAuth()
  if (isLoading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (isAdmin) return <Navigate to="/admin" replace />
  return <>{children}</>
}

function RequireRole({ role, children }: { role: 'EVENT_STAFF' | 'SYSTEM_ADMIN'; children: ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return null
  if (user?.user_type !== role) return <Navigate to="/admin" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CustomerLayout />}>
          <Route index element={<Home />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="search" element={<Search />} />
          <Route path="event/:eventKey" element={<EventDetail />} />
          <Route path="queue" element={<RequireCustomerAuth><VirtualQueue /></RequireCustomerAuth>} />
          <Route
            path="shows/:showId/seats"
            element={
              <RequireCustomerAuth>
                <>
                  <QueueSessionGuard />
                  <SeatSelection />
                </>
              </RequireCustomerAuth>
            }
          />
          <Route path="checkout" element={<RequireCustomerAuth><Checkout /></RequireCustomerAuth>} />
          <Route path="confirmation" element={<RequireCustomerAuth><Confirmation /></RequireCustomerAuth>} />
          <Route path="tickets" element={<RequireCustomerAuth><CustomerTicket /></RequireCustomerAuth>} />
          <Route path="profile" element={<RequireCustomerAuth><CustomerProfile /></RequireCustomerAuth>} />
          <Route path="settings" element={<RequireCustomerAuth><CustomerSettings /></RequireCustomerAuth>} />
          <Route path="help" element={<HelpPage />} />
          <Route path="info" element={<InfoPage />} />
          <Route path="payments" element={<Navigate to="/settings" replace />} />
          <Route path="*" element={<ErrorPage />} />
        </Route>

        <Route path="/admin" element={<RequireAdmin><AdminLayout title="Quản trị hệ thống" /></RequireAdmin>}>
          <Route index element={<AdminDashboard />} />
          <Route path="events" element={<RequireRole role="EVENT_STAFF"><AdminEvents /></RequireRole>} />
          <Route path="events/:eventKey/shows/:showId/seating" element={<RequireRole role="EVENT_STAFF"><AdminSeatPlanner /></RequireRole>} />
          <Route path="venues" element={<RequireRole role="EVENT_STAFF"><AdminVenues /></RequireRole>} />
          <Route path="tickets" element={<RequireRole role="EVENT_STAFF"><AdminTickets /></RequireRole>} />
          <Route path="analytics" element={<RequireRole role="SYSTEM_ADMIN"><AdminAnalytics /></RequireRole>} />
          <Route path="users" element={<RequireRole role="SYSTEM_ADMIN"><AdminUsers /></RequireRole>} />
          <Route path="staff" element={<RequireRole role="SYSTEM_ADMIN"><AdminStaff /></RequireRole>} />
          <Route path="settings" element={<RequireRole role="SYSTEM_ADMIN"><AdminSettings /></RequireRole>} />
        </Route>

        <Route path="/error" element={<ErrorPage />} />
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
