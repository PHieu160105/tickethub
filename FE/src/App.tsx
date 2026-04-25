import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import { CustomerLayout } from './components/layout/CustomerLayout'
import { AdminLayout } from './components/layout/AdminLayout'
import { AuthProvider } from './context/AuthContext'
import Home from './pages/customer/Home'
import EventDetail from './pages/customer/EventDetail'
import Login from './pages/customer/Login'
import Checkout from './pages/customer/Checkout'
import Confirmation from './pages/customer/Confirmation'
import CustomerProfile from './pages/customer/CustomerProfile'
import CustomerTicket from './pages/customer/CustomerTicket'
import Search from './pages/customer/Search'
import Queue from './pages/customer/Queue'
import SeatSelection from './pages/customer/SeatSelection'
import ErrorPage from './pages/customer/Error'
import VirtualQueue from './pages/customer/VirtualQueue'
import Register from './pages/customer/Register'
import AdminDashboard from './pages/admin/dashboard'
import AdminEvents from './pages/admin/Events'
import AdminTickets from './pages/admin/Tickets'
import AdminAnalytics from './pages/admin/Analytics'
import AdminUsers from './pages/admin/Users'
import AdminSettings from './pages/admin/Settings'


function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<CustomerLayout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register/>} />
            <Route path="event/:id" element={<EventDetail />} />
            <Route path="queue" element={<VirtualQueue />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="confirmation" element={<Confirmation />} />
            <Route path="profile" element={<CustomerProfile />} />
            <Route path="tickets" element={<CustomerTicket />} />
            <Route path="search" element={<Search />} />
            <Route path="queue" element={<Queue />} />
            <Route path="seat-selection" element={<SeatSelection />} />
            <Route path="*" element={<ErrorPage />} />
          </Route>

          <Route path="/admin" element={<AdminLayout title="Quản trị hệ thống" />}>
            <Route index element={<AdminDashboard />} />
            <Route path="events" element={<AdminEvents />} />
            <Route path="tickets" element={<AdminTickets />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
