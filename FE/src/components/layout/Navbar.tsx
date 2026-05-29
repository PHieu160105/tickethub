import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { LogOut, Menu, X } from 'lucide-react'

import { SearchAutocompleteInput } from '@/components/ui/SearchAutocompleteInput'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

const navLinks = [
  { label: 'Sự kiện', href: '/search' },
  { label: 'Vé của tôi', href: '/tickets' },
  { label: 'Thông tin', href: '/info' },
]

export function Logo() {
  return (
    <Link to="/" aria-label="Về trang chủ" className="flex items-center gap-2 margin-r-6">
      <p className="text-lg font-bold">TICKETHUB</p>
    </Link>
  )
}

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/', { replace: true })
    setMobileOpen(false)
  }

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        isScrolled ? 'customer-nav-bg backdrop-blur-xl border-b customer-border' : 'customer-nav-bg backdrop-blur-md border-b customer-border',
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-1 py-3 sm:px-3">
        <Logo />

        <div className="hidden md:flex flex-1 items-center justify-between gap-6">
          <nav className="flex items-center gap-2">
            {navLinks.map((link) => (
              <NavLink
                key={link.href}
                to={link.href}
                className={({ isActive }) =>
                  cn(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'customer-text-header border-b-3 border-[var(--customer-bg-opt)] text-[var(--customer-bg-opt)]'
                      : 'customer-text-muted hover:customer-text-header customer-bg-soft/0 hover:customer-bg-soft',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="relative w-90 border-1 border-gray-500 rounded-xl">
            <SearchAutocompleteInput
              value={searchValue}
              onChange={setSearchValue}
              onSelect={(item) => navigate(`/event/${item.value}`)}
              placeholder="Tìm kiếm sự kiện..."
              scope="events"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <div className="hidden sm:flex items-center gap-3">
              <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <img
                  src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
                  alt={user.name}
                  className="h-9 w-9 rounded-full customer-bg-soft border-2 border-primary/50"
                />
                <span className="text-sm font-medium customer-text-header max-w-[120px] truncate">{user.name}</span>
              </Link>

              <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2 customer-text-muted hover:customer-text-header">
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </Button>
            </div>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => navigate('/login')}>
                Đăng nhập
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/register')}>
                Đăng ký
              </Button>
            </>
          )}

          <button
            className="md:hidden p-2 rounded-lg hover:customer-bg-soft transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Mở hoặc đóng menu"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden customer-nav-bg backdrop-blur-xl border-t customer-border animate-in slide-in-from-top-2">
          <div className="space-y-3 px-4 py-4">
            {navLinks.map((link) => (
              <NavLink
                key={link.href}
                to={link.href}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'block rounded-lg px-4 py-3 text-base font-medium transition-colors',
                    isActive ? 'customer-bg-soft customer-text-header' : 'customer-text-muted hover:customer-bg-soft',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}

            <div className="pt-3 border-t customer-border">
              <SearchAutocompleteInput
                value={searchValue}
                onChange={setSearchValue}
                onSelect={(item) => {
                  navigate(`/event/${item.value}`)
                  setMobileOpen(false)
                }}
                placeholder="Tìm kiếm..."
                scope="events"
                className="w-full"
              />
            </div>

            {!isAuthenticated && (
              <div className="pt-3 border-t customer-border flex flex-col gap-2">
                <Button variant="ghost" onClick={() => { navigate('/login'); setMobileOpen(false) }} className="justify-center">
                  Đăng nhập
                </Button>
                <Button variant="primary" onClick={() => { navigate('/register'); setMobileOpen(false) }} className="justify-center">
                  Đăng ký
                </Button>
              </div>
            )}

            {isAuthenticated && user && (
              <div className="pt-3 border-t customer-border">
                <Link to="/profile" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 mb-3 hover:opacity-80 transition-opacity">
                  <img
                    src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
                    alt={user.name}
                    className="h-12 w-12 rounded-full customer-bg-soft border-2 border-primary/50"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium customer-text-header truncate">{user.name}</p>
                    <p className="text-xs customer-text-muted truncate">{user.email}</p>
                  </div>
                </Link>
                <Button variant="ghost" onClick={handleLogout} className="w-full justify-start gap-2 customer-text-muted hover:customer-text-header">
                  <LogOut className="h-4 w-4" />
                  Đăng xuất
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
