import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { SearchAutocompleteInput } from '@/components/ui/SearchAutocompleteInput'
import { Search, Menu, X, Bell, LogOut } from 'lucide-react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useState, useEffect, useMemo, useRef } from 'react'
import LogoSVG from '@/assets/logo.svg'
import { useAuth } from '@/context/AuthContext'
import { bookingApi, eventApi } from '@/lib/api'
import type { EventCard, TicketItem } from '@/types'

const navLinks = [
  { label: 'Sự kiện', href: '/search' },
  { label: 'Hồ sơ', href: '/profile' },
  { label: 'Vé của tôi', href: '/tickets' },
]

type NotificationType = 'ticket' | 'event'

interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body: string
  createdAt: string
}

function classifyTicketStatus(ticket: TicketItem): 'upcoming' | 'past' | 'cancelled' | null {
  if (ticket.ticket_status === 'cancelled') return 'cancelled'
  if (ticket.ticket_status !== 'active' || ticket.seat_status !== 'sold') return null
  return new Date(ticket.show_start_at).getTime() < Date.now() ? 'past' : 'upcoming'
}

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
    <Link to="/" aria-label="TicketRush Home" className="flex items-center gap-2">
      <img src={LogoSVG} alt="TicketRush Logo" className="h-12 w-auto" />
    </Link>
  )
}

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const notifRef = useRef<HTMLDivElement | null>(null)

  const storageScope = useMemo(() => String(user?.id ?? user?.email ?? 'guest'), [user?.id, user?.email])
  const storageSeenKey = `ticketrush:notifications:seen:${storageScope}`
  const storageSnapshotKey = `ticketrush:notifications:snapshot:${storageScope}`

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
      setNotifications([])
      return
    }

    let isMounted = true

    const loadNotifications = async () => {
      try {
        const [tickets, events] = await Promise.all([bookingApi.myTickets(), eventApi.list()])
        if (!isMounted) return

        const now = new Date()
        const sevenDaysAgo = new Date(now)
        sevenDaysAgo.setDate(now.getDate() - 7)

        const seenIds = new Set<string>(JSON.parse(localStorage.getItem(storageSeenKey) || '[]'))
        const previousSnapshot = JSON.parse(localStorage.getItem(storageSnapshotKey) || '{}') as Record<string, string>
        const nextSnapshot: Record<string, string> = {}
        const built: AppNotification[] = []

        tickets.forEach((ticket) => {
          const status = classifyTicketStatus(ticket)
          if (!status) return

          const ticketKey = String(ticket.ticket_id ?? ticket.ticket_code)
          nextSnapshot[`ticket:${ticketKey}`] = status

          if (previousSnapshot[`ticket:${ticketKey}`] === status) return

          const statusLabel = status === 'upcoming' ? 'Sắp tới' : status === 'past' ? 'Hết hạn' : 'Đã hủy'
          built.push({
            id: `ticket-status-${ticketKey}-${status}`,
            type: 'ticket',
            title: 'Cập nhật trạng thái vé',
            body: `${ticket.ticket_code} chuyển sang trạng thái ${statusLabel}`,
            createdAt: new Date().toISOString(),
          })
        })

        events
          .filter((event: EventCard) => {
            const createdAt = new Date(event.created_at)
            const startAt = new Date(event.start_at)
            return createdAt >= sevenDaysAgo && startAt >= now
          })
          .forEach((event) => {
            const eventSnapshotKey = `event:${event.id}`
            nextSnapshot[eventSnapshotKey] = event.created_at

            if (previousSnapshot[eventSnapshotKey] === event.created_at) return

            built.push({
              id: `event-new-${event.id}`,
              type: 'event',
              title: 'Sự kiện mới gần đây',
              body: `${event.title} vừa được thêm mới`,
              createdAt: event.created_at,
            })
          })

        const uniqueMap = new Map<string, AppNotification>()
        built
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .forEach((item) => {
            if (!uniqueMap.has(item.id)) uniqueMap.set(item.id, item)
          })

        const finalList = Array.from(uniqueMap.values())
        setNotifications(finalList)

        const mergedSeen = Array.from(new Set([...seenIds]))
        localStorage.setItem(storageSeenKey, JSON.stringify(mergedSeen))
        localStorage.setItem(storageSnapshotKey, JSON.stringify(nextSnapshot))
      } catch {
        if (isMounted) setNotifications([])
      }
    }

    void loadNotifications()
    const interval = window.setInterval(() => {
      void loadNotifications()
    }, 60000)

    return () => {
      isMounted = false
      window.clearInterval(interval)
    }
  }, [isAuthenticated, user, storageSeenKey, storageSnapshotKey])

  const hasUnread = useMemo(() => {
    const seenIds = new Set<string>(JSON.parse(localStorage.getItem(storageSeenKey) || '[]'))
    return notifications.some((item) => !seenIds.has(item.id))
  }, [notifications, storageSeenKey])

  const markAllAsSeen = () => {
    const ids = notifications.map((item) => item.id)
    localStorage.setItem(storageSeenKey, JSON.stringify(ids))
  }

  const toggleNotifications = () => {
    const next = !notificationOpen
    setNotificationOpen(next)
    if (next) markAllAsSeen()
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 customer-text-muted" />
            <SearchAutocompleteInput
              value={searchValue}
              onChange={setSearchValue}
              onSelect={(item) => navigate(`/event/${item.value}`)}
              placeholder="Tìm kiếm sự kiện..."
              scope="events"
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <>
              <div className="hidden sm:flex items-center gap-3" ref={notifRef}>
                <div className="relative">
                  <Button variant="ghost" size="icon" onClick={toggleNotifications} className="relative">
                    <Bell className="h-5 w-5" />
                    {hasUnread && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full" />}
                  </Button>

                  {notificationOpen && (
                    <div className="absolute right-0 mt-2 w-[340px] max-h-[420px] overflow-auto rounded-xl border customer-border customer-bg-soft shadow-xl p-3 z-50">
                      <p className="text-sm font-semibold customer-text-header mb-2">Thông báo</p>
                      {notifications.length === 0 ? (
                        <p className="text-sm customer-text-muted">Chưa có thông báo mới.</p>
                      ) : (
                        <div className="space-y-2">
                          {notifications.map((item) => (
                            <div key={item.id} className="rounded-lg border customer-border p-2.5">
                              <p className="text-sm font-medium customer-text-header">{item.title}</p>
                              <p className="text-xs customer-text-muted mt-0.5">{item.body}</p>
                              <p className="text-[11px] customer-text-muted mt-1">{formatNotificationTime(item.createdAt)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <img
                    src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
                    alt={user.name}
                    className="h-9 w-9 rounded-full customer-bg-soft border-2 border-primary/50"
                  />
                  <span className="text-sm font-medium customer-text-header max-w-[120px] truncate">{user.name}</span>
                </Link>

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
            </>
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
            aria-label="Toggle menu"
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
