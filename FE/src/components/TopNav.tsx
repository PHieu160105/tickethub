import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'

export function TopNav() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('ticketrush-theme')
    return savedTheme === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('ticketrush-theme', theme)
  }, [theme])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="top-nav">
      <div className="top-nav__inner app-container">
        <Link to="/" className="brand">
          TicketRush
        </Link>

        <nav className="top-nav__menu">
          <NavLink to="/" end>
            Events
          </NavLink>
          {isAuthenticated && !isAdmin && <NavLink to="/my-tickets">My Tickets</NavLink>}
          {isAuthenticated && isAdmin && <NavLink to="/admin/dashboard">Dashboard</NavLink>}
          {isAuthenticated && isAdmin && <NavLink to="/admin/events">Event Management</NavLink>}
        </nav>

        <div className="top-nav__actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setTheme((previousTheme) => (previousTheme === 'light' ? 'dark' : 'light'))}
          >
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>

          {!isAuthenticated && (
            <>
              <Link to="/login" className="btn btn-ghost">
                Login
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Register
              </Link>
            </>
          )}

          {isAuthenticated && (
            <>
              <button type="button" className="top-nav__user" onClick={() => navigate('/my-account')}>
                {user?.full_name}
              </button>
              <button type="button" className="btn btn-ghost" onClick={handleLogout}>
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
