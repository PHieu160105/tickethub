import { Navigate, Route, Routes } from 'react-router-dom'

import { Footer } from './components/Footer'
import { ProtectedRoute } from './components/ProtectedRoute'
import { TopNav } from './components/TopNav'
import { AdminDashboardPage } from './pages/AdminDashboardPage'
import { AdminEventsPage } from './pages/AdminEventsPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { MyAccountPage } from './pages/MyAccountPage'
import { MyTicketsPage } from './pages/MyTicketsPage'
import { QueuePage } from './pages/QueuePage'
import { RegisterPage } from './pages/RegisterPage'
import { SeatBookingPage } from './pages/SeatBookingPage'

export default function App() {
  return (
    <div className="app-shell">
      <TopNav />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          path="/events/:eventKey/queue"
          element={
            <ProtectedRoute>
              <QueuePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/events/:eventKey/seats"
          element={<SeatBookingPage />}
        />

        <Route
          path="/my-account"
          element={
            <ProtectedRoute>
              <MyAccountPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/my-tickets"
          element={
            <ProtectedRoute>
              <MyTicketsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute adminOnly>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/events"
          element={
            <ProtectedRoute adminOnly>
              <AdminEventsPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </div>
  )
}
