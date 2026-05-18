import { useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Bell, Menu, MessageSquareText, X } from 'lucide-react'

import { AdminSidebar } from './AdminSidebar'
import { Container } from './Container'
import { Button } from '@/components/ui/Button'
import { helpApi } from '@/lib/api'
import type { HelpThread } from '@/types'

interface AdminLayoutProps {
  title?: string
  actions?: React.ReactNode
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AdminLayout({ title, actions }: AdminLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notifications, setNotifications] = useState<HelpThread[]>([])
  const [openNotifications, setOpenNotifications] = useState<HelpThread[]>([])
  const [hasUnread, setHasUnread] = useState(false)
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
        const threads = await helpApi.adminThreads()
        if (!isMounted) return

        const unreadThreads = threads
          .filter((thread) => thread.unread_admin > 0)
          .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
          .slice(0, 5)

        setNotifications(unreadThreads)
        setHasUnread(unreadThreads.length > 0)
      } catch {
        if (!isMounted) return
        setNotifications([])
        setHasUnread(false)
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

  const notificationCountLabel = useMemo(() => `${openNotifications.length} mục`, [openNotifications.length])

  async function refreshUnreadNotifications() {
    try {
      const threads = await helpApi.adminThreads()
      const unreadThreads = threads
        .filter((thread) => thread.unread_admin > 0)
        .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
        .slice(0, 5)

      setNotifications(unreadThreads)
      setHasUnread(unreadThreads.length > 0)
    } catch {
      setNotifications([])
      setHasUnread(false)
    }
  }

  async function handleToggleNotifications() {
    const next = !notificationOpen
    setNotificationOpen(next)

    if (!next) return

    setOpenNotifications(notifications)
    if (notifications.length === 0) return

    setHasUnread(false)
    setNotifications((previous) => previous.map((thread) => ({ ...thread, unread_admin: 0 })))
    try {
      await helpApi.adminMarkThreadsSeen()
    } finally {
      void refreshUnreadNotifications()
    }
  }

  function handleNotificationClick(thread: HelpThread) {
    setNotificationOpen(false)
    navigate(`/admin/help?threadId=${thread.id}`)
  }

  return (
    <div className="app-theme-page flex h-screen admin-text-body">
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
            <button className="rounded p-2 hover:bg-white/10 md:hidden" onClick={() => setDrawerOpen((value) => !value)} aria-label="Mở hoặc đóng menu quản trị">
              {drawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            {title && <h1 className="text-lg font-semibold">{title}</h1>}
          </div>

          <div className="flex items-center gap-3">
            {actions}
            <div className="relative z-[80]" ref={notificationRef}>
              <Button variant="ghost" size="icon" className="relative overflow-visible" onClick={() => void handleToggleNotifications()}>
                <Bell className="h-5 w-5" />
                {hasUnread && <span className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full bg-red-500 ring-2 ring-[var(--admin-bg-page)]" />}
              </Button>

              {notificationOpen && (
                <div className="absolute right-0 top-full z-[90] mt-2 max-h-[420px] w-[360px] overflow-auto rounded-2xl border admin-border admin-bg-listbox p-3 shadow-2xl">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold admin-text-header">Thông báo admin</p>
                    <span className="text-xs text-gray-400">{notificationCountLabel}</span>
                  </div>

                  {openNotifications.length === 0 ? (
                    <p className="rounded-xl border admin-border p-3 text-sm text-gray-400">Chưa có cập nhật mới.</p>
                  ) : (
                    <div className="space-y-2">
                      {openNotifications.map((thread) => (
                        <button
                          key={thread.id}
                          type="button"
                          onClick={() => handleNotificationClick(thread)}
                          className="w-full rounded-xl border admin-border p-3 text-left transition hover:admin-bg-soft"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm font-medium admin-text-header">
                              <MessageSquareText className="h-4 w-4 text-cyan-400" />
                              <span>Hỗ trợ cần phản hồi</span>
                            </div>
                            <p className="text-sm text-gray-200">{thread.customer_name}</p>
                            <p className="line-clamp-2 text-xs text-gray-400">{thread.last_message_preview}</p>
                            <p className="text-[11px] text-gray-500">{formatTime(thread.last_message_at)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="relative z-10 flex-1 overflow-y-auto p-4 md:p-6">
          <Container size="xl" className="relative z-10 animate-in fade-in duration-300">
            <Outlet />
          </Container>
        </div>
      </main>
    </div>
  )
}
