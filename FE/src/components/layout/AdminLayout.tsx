import { useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Bell, Menu, Search, Ticket, X, MessageSquareText } from 'lucide-react'

import { AdminSidebar } from './AdminSidebar'
import { Container } from './Container'
import { Button } from '@/components/ui/Button'
import { SearchAutocompleteInput } from '@/components/ui/SearchAutocompleteInput'
import { adminApi, helpApi } from '@/lib/api'
import type { AdminTicketSaleItem, HelpThread } from '@/types'

interface AdminLayoutProps {
  title?: string
  actions?: React.ReactNode
}

type AdminNotification =
  | {
      id: string
      type: 'sale'
      createdAt: string
      sale: AdminTicketSaleItem
    }
  | {
      id: string
      type: 'help'
      createdAt: string
      thread: HelpThread
    }

const SEEN_STORAGE_KEY = 'ticketrush_admin_notifications_seen'

function formatTime(value: string) {
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AdminLayout({ title, actions }: AdminLayoutProps) {
  const [searchValue, setSearchValue] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const navigate = useNavigate()
  const notificationRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!notificationRef.current) return
      if (!notificationRef.current.contains(event.target as Node)) {
        setNotificationOpen(false)
      }
    }

    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadNotifications = async () => {
      try {
        const [sales, threads] = await Promise.all([
          adminApi.ticketSales({ limit: 5 }),
          helpApi.adminThreads(),
        ])

        if (!isMounted) return

        const unreadThreads = threads
          .filter((thread) => thread.unread_admin > 0)
          .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
          .slice(0, 5)

        const nextNotifications: AdminNotification[] = [
          ...sales.items.map((sale) => ({
            id: `sale:${sale.id}:${sale.purchased_at}`,
            type: 'sale' as const,
            createdAt: sale.purchased_at,
            sale,
          })),
          ...unreadThreads.map((thread) => ({
            id: `help:${thread.id}:${thread.last_message_at}:${thread.unread_admin}`,
            type: 'help' as const,
            createdAt: thread.last_message_at,
            thread,
          })),
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

        setNotifications(nextNotifications)
      } catch {
        if (isMounted) {
          setNotifications([])
        }
      }
    }

    void loadNotifications()
    const interval = window.setInterval(() => {
      void loadNotifications()
    }, 30000)

    return () => {
      isMounted = false
      window.clearInterval(interval)
    }
  }, [])

  const unreadCount = useMemo(() => {
    const seen = new Set<string>(JSON.parse(localStorage.getItem(SEEN_STORAGE_KEY) || '[]'))
    return notifications.filter((notification) => !seen.has(notification.id)).length
  }, [notifications])

  function markVisibleAsSeen() {
    localStorage.setItem(
      SEEN_STORAGE_KEY,
      JSON.stringify(Array.from(new Set(notifications.map((notification) => notification.id)))),
    )
  }

  function handleToggleNotifications() {
    const next = !notificationOpen
    setNotificationOpen(next)
    if (next) {
      markVisibleAsSeen()
    }
  }

  function handleNotificationClick(notification: AdminNotification) {
    setNotificationOpen(false)
    if (notification.type === 'sale') {
      navigate('/admin/tickets')
      return
    }
    navigate('/admin/help')
  }

  return (
    <div className="flex h-screen admin-bg-page admin-text-body">
      <div className="hidden md:block">
        <AdminSidebar />
      </div>
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <div className="relative h-full w-72">
            <AdminSidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <main className="flex-1 flex min-h-0 flex-col overflow-visible">
        <header className="relative z-[70] flex items-center justify-between gap-3 border-b admin-border p-4 backdrop-blur-sm md:px-6">
          <div className="flex items-center gap-3">
            <button className="rounded p-2 hover:bg-white/10 md:hidden" onClick={() => setDrawerOpen((v) => !v)} aria-label="Toggle admin menu">
              {drawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            {title && <h1 className="text-lg font-semibold">{title}</h1>}
          </div>

          <div className="relative hidden w-96 lg:block">
            <Search className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <SearchAutocompleteInput value={searchValue} onChange={setSearchValue} placeholder="Tìm kiếm..." scope="global" className="pl-10" />
          </div>

          <div className="flex items-center gap-3">
            {actions}
            <div className="relative z-[80]" ref={notificationRef}>
              <Button variant="ghost" size="icon" className="relative" onClick={handleToggleNotifications}>
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>

              {notificationOpen && (
                <div className="absolute right-0 top-full z-[90] mt-2 max-h-[420px] w-[360px] overflow-auto rounded-2xl border admin-border admin-bg-listbox p-3 shadow-2xl">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold admin-text-header">Thông báo admin</p>
                    <span className="text-xs text-gray-400">{notifications.length} mục</span>
                  </div>

                  {notifications.length === 0 ? (
                    <p className="rounded-xl border admin-border p-3 text-sm text-gray-400">Chưa có cập nhật mới.</p>
                  ) : (
                    <div className="space-y-2">
                      {notifications.map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() => handleNotificationClick(notification)}
                          className="w-full rounded-xl border admin-border p-3 text-left transition hover:admin-bg-soft"
                        >
                          {notification.type === 'sale' ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm font-medium admin-text-header">
                                <Ticket className="h-4 w-4 text-emerald-400" />
                                <span>Vé mới được mua</span>
                              </div>
                              <p className="text-sm text-gray-200">
                                {notification.sale.customer_name} mua {notification.sale.show_title}
                              </p>
                              <p className="text-xs text-gray-400">
                                {notification.sale.event_title} • {notification.sale.zone_name} / {notification.sale.seat_label}
                              </p>
                              <p className="text-[11px] text-gray-500">{formatTime(notification.createdAt)}</p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm font-medium admin-text-header">
                                <MessageSquareText className="h-4 w-4 text-cyan-400" />
                                <span>Hỗ trợ cần phản hồi</span>
                              </div>
                              <p className="text-sm text-gray-200">
                                {notification.thread.customer_name} • {notification.thread.unread_admin} chưa đọc
                              </p>
                              <p className="line-clamp-2 text-xs text-gray-400">{notification.thread.last_message_preview}</p>
                              <p className="text-[11px] text-gray-500">{formatTime(notification.createdAt)}</p>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="relative z-10 flex-1 overflow-y-auto p-4 admin-bg-page md:p-6">
          <Container size="xl" className="relative z-10 animate-in fade-in duration-300">
            <Outlet />
          </Container>
        </div>
      </main>
    </div>
  )
}
