import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import { CustomerLayout } from './components/layout/CustomerLayout'
import { AdminLayout } from './components/layout/AdminLayout'
import Home from './pages/Home'
import EventDetail from './pages/EventDetail'
import Login from './pages/Login'
import Checkout from './pages/Checkout'
import Confirmation from './pages/Confirmation'
import CustomerProfile from './pages/CustomerProfile'
import CustomerTicket from './pages/CustomerTicket'
import Search from './pages/Search'
import Queue from './pages/Queue'
import SeatSelection from './pages/SeatSelection'
import ErrorPage from './pages/Error'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CustomerLayout />}>
          <Route index element={<Home />} />
          <Route path="login" element={<Login />} />
          <Route path="events/:id" element={<EventDetail />} />
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
          <Route
            index
            element={
              <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6 py-12">
                <div className="max-w-3xl rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl">
                  <h1 className="text-3xl font-bold mb-4">Admin Dashboard</h1>
                  <p className="text-slate-300">Use the admin panel to manage events, orders, and users.</p>
                </div>
              </div>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
