import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { CustomerLayout } from './components/layout/CustomerLayout'
import { AdminLayout } from './components/layout/AdminLayout'
import { AuthProvider, useAuth } from './context/AuthContext'
import { GameProvider } from './context/GameContext'
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
import Payments from './pages/customer/Payments'
import Help from './pages/customer/Help'
import CustomerSettings from './pages/customer/Setting'
import AdminDashboard from './pages/admin/Dashboard'
import AdminEvents from './pages/admin/Events'
import AdminVenues from './pages/admin/Venues'
import AdminSeatPlanner from './pages/admin/SeatPlanner'
import AdminTickets from './pages/admin/Tickets'
import AdminAnalytics from './pages/admin/Analytics'
import AdminUsers from './pages/admin/Users'
import AdminSettings from './pages/admin/Settings'
import AdminGames from './pages/admin/Games'
import AdminHelp from './pages/admin/Help'
import { LoadingProvider } from '@/context/LoadingContext'

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin } = useAuth()

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
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
          <Route path="checkout" element={<Checkout />} />
          <Route path="confirmation" element={<Confirmation />} />
          <Route path="profile" element={<CustomerProfile />} />
          <Route path="tickets" element={<CustomerTicket />} />
          <Route path="favourites" element={<Favourites />} />
          <Route path="payments" element={<Payments />} />
          <Route path="help" element={<Help />} />
          <Route path="settings" element={<CustomerSettings />} />
          <Route path="search" element={<Search />} />
          <Route path="event/:eventKey/seats" element={<SeatSelection />} />
          <Route path="*" element={<ErrorPage />} />
        </Route>

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
          <Route path="events/:eventKey/seating" element={<AdminSeatPlanner />} />
          <Route path="venues" element={<AdminVenues />} />
          <Route path="tickets" element={<AdminTickets />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="games" element={<AdminGames />} />
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
          <GameProvider>
            <AppRoutes />
          </GameProvider>
        </AuthProvider>
      </LoadingProvider>
    </ThemeProvider>
  )
}

export default App
