import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { SearchAutocompleteInput } from '@/components/ui/SearchAutocompleteInput'
import { Menu, X, Bell, LogOut } from 'lucide-react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useState, useEffect, useMemo, useRef } from 'react'
import LogoSVG from '@/assets/logo.svg'
import { useAuth } from '@/context/AuthContext'
import { helpApi } from '@/lib/api'
import type { HelpThread } from '@/types'

const navLinks = [
  { label: 'Sự kiện', href: '/search' },
  { label: 'Cá nhân', href: '/tickets' },
]

function formatNotificationTime(value: string): string {
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function Logo() {
  return (
    <Link to="/" aria-label="Về trang chủ TicketRush" className="flex items-center gap-2">
      <img src={LogoSVG} alt="Logo TicketRush" className="h-12 w-auto" />
    </Link>
  )
}

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [supportThread, setSupportThread] = useState<HelpThread | null>(null)
  const [openThread, setOpenThread] = useState<HelpThread | null>(null)
  const [hasUnread, setHasUnread] = useState(false)
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const notifRef = useRef<HTMLDivElement | null>(null)
  const supportThreadFailureCountRef = useRef(0)
  const nextSupportThreadRetryAtRef = useRef(0)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!notifRef.current) return
      if (!notifRef.current.contains(event.target as Node)) {
        setNotificationOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setSupportThread(null)
      setOpenThread(null)
      setHasUnread(false)
      return
    }

    let isMounted = true

    const loadSupportThread = async () => {
      /**
       * Tải trạng thái thông báo hỗ trợ cho Navbar mà không tự tạo hội thoại rỗng.
       *
       * Đầu vào:
       * - Không nhận tham số trực tiếp. Hàm đọc trạng thái đăng nhập và JWT từ context/API chung.
       *
       * Đầu ra:
       * - Cập nhật `supportThread` và cờ `hasUnread` trong Navbar.
       *
       * Cách hoạt động:
       * - Chỉ gọi API khi tab đang online và đã qua thời điểm backoff sau lỗi mạng.
       * - Dùng API GET chỉ đọc để tránh spam POST tạo thread khi backend tạm restart.
       * - Nếu backend mất kết nối, tăng thời gian chờ trước lần thử tiếp theo để console không ngập lỗi.
       */

      if (!window.navigator.onLine || document.visibilityState === 'hidden') {
        return
      }

      const now = Date.now()
      if (now < nextSupportThreadRetryAtRef.current) {
        return
      }

      try {
        const thread = await helpApi.getMyThread()
        if (!isMounted) return
        supportThreadFailureCountRef.current = 0
        nextSupportThreadRetryAtRef.current = 0
        setSupportThread(thread)
        setHasUnread((thread?.unread_customer ?? 0) > 0)
      } catch {
        if (!isMounted) return
        supportThreadFailureCountRef.current += 1
        const retryDelayMs = Math.min(120000, 15000 * supportThreadFailureCountRef.current)
        nextSupportThreadRetryAtRef.current = Date.now() + retryDelayMs
        setSupportThread(null)
        setHasUnread(false)
      }
    }

    void loadSupportThread()
    const interval = window.setInterval(() => {
      void loadSupportThread()
    }, 30000)

    return () => {
      isMounted = false
      window.clearInterval(interval)
    }
  }, [isAuthenticated, user])

  const hasNotificationItem = useMemo(
    () => Boolean(openThread && openThread.last_message_preview.trim()),
    [openThread],
  )

  const toggleNotifications = async () => {
    const next = !notificationOpen
    setNotificationOpen(next)

    if (!next) return

    setOpenThread(supportThread)
    if (!supportThread || supportThread.unread_customer <= 0) return

    setHasUnread(false)
    setSupportThread((previous) => (previous ? { ...previous, unread_customer: 0 } : previous))
    try {
      await helpApi.markMyThreadSeen()
    } finally {
      try {
        const thread = await helpApi.createOrGetMyThread()
        setSupportThread(thread)
        setHasUnread(thread.unread_customer > 0)
      } catch {
        setSupportThread(null)
        setHasUnread(false)
      }
    }
  }

  const handleNotificationClick = () => {
    setNotificationOpen(false)
    navigate('/help')
  }

  const handleLogout = () => {
    logout()
    navigate('/', { replace: true })
    setMobileOpen(false)
  }

  const closeMobileMenu = () => setMobileOpen(false)

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        isScrolled
          ? 'customer-nav-bg backdrop-blur-xl border-b customer-border'
          : 'customer-nav-bg backdrop-blur-md border-b customer-border'
      )}
      style={
        isScrolled
          ? {
              boxShadow: `0 0 10px color-mix(in srgb, var(--customer-bg-opt) 30%, transparent)`,
            }
          : {}
      }
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
                      : 'customer-text-muted hover:customer-text-header customer-bg-soft/0 hover:customer-bg-soft'
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
            <div className="hidden sm:flex items-center gap-3" ref={notifRef}>
              <div className="relative">
                <Button variant="ghost" size="icon" onClick={() => void toggleNotifications()} className="relative">
                  <Bell className="h-5 w-5" />
                  {hasUnread && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500" />}
                </Button>

                {notificationOpen && (
                  <div className="absolute left-0 mt-2 w-[340px] max-h-[420px] overflow-auto rounded-xl border border border-[var(--customer-bg-opp)] customer-bg-surface shadow-xl p-3 z-50">
                    <p className="text-sm font-semibold customer-text-header mb-2">Thông báo</p>
                    {!hasNotificationItem ? (
                      <p className="text-sm customer-text-muted">Chưa có thông báo mới.</p>
                    ) : (
                      <button
                        type="button"
                        onClick={handleNotificationClick}
                        className="w-full rounded-lg border customer-border p-2.5 text-left transition hover:bg-white/5"
                      >
                        <p className="text-sm font-medium customer-text-header">Bạn có phản hồi mới từ hỗ trợ</p>
                        <p className="text-xs customer-text-muted mt-0.5">{openThread?.last_message_preview}</p>
                        <p className="text-[11px] customer-text-muted mt-1">
                          {openThread ? formatNotificationTime(openThread.last_message_at) : ''}
                        </p>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <img
                  src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
                  alt={user.name}
                  className="h-9 w-9 rounded-full customer-bg-soft border-2 border-primary/50"
                />
                <span className="text-sm font-medium customer-text-header max-w-[120px] truncate">{user.name}</span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="gap-2 customer-text-muted hover:customer-text-header"
              >
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
                onClick={closeMobileMenu}
                className={({ isActive }) =>
                  cn(
                    'block rounded-lg px-4 py-3 text-base font-medium transition-colors',
                    isActive ? 'customer-bg-soft customer-text-header' : 'customer-text-muted hover:customer-bg-soft'
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
                  closeMobileMenu()
                }}
                placeholder="Tìm kiếm..."
                scope="events"
                className="w-full"
              />
            </div>

            {!isAuthenticated && (
              <div className="pt-3 border-t customer-border flex flex-col gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    navigate('/login')
                    closeMobileMenu()
                  }}
                  className="justify-center"
                >
                  Đăng nhập
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    navigate('/register')
                    closeMobileMenu()
                  }}
                  className="justify-center"
                >
                  Đăng ký
                </Button>
              </div>
            )}

            {isAuthenticated && user && (
              <div className="pt-3 border-t customer-border">
                <Link to="/profile" onClick={closeMobileMenu} className="flex items-center gap-3 mb-3 hover:opacity-80 transition-opacity">
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
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="w-full justify-start gap-2 customer-text-muted hover:customer-text-header"
                >
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
