import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Ticket, X } from 'lucide-react'

import { CustomerSidebar } from '@/components/layout/CustomerSidebar'
import { Button } from '@/components/ui/Button'
import { TicketCard } from '@/components/ui/TicketCard'
import { useAuth } from '@/context/AuthContext'
import { useMyTickets } from '@/features/booking/hooks/useBooking'
import type { TicketItem } from '@/types'

type TicketTab = 'upcoming' | 'past'

const FALLBACK_TICKET_IMAGE =
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80'

const tabLabels: Record<TicketTab, string> = {
  upcoming: 'Sắp tới',
  past: 'Đã diễn ra',
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('vi-VN', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  })
}

function toCardStatus(ticket: TicketItem): 'confirmed' | 'pending' {
  return ticket.seat_status === 'locked' ? 'pending' : 'confirmed'
}

const CustomerTicket: React.FC = () => {
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<TicketTab>('upcoming')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [referenceTime] = useState(() => Date.now())

  const { tickets, isLoading, error, refetch } = useMyTickets()

  useEffect(() => {
    if (!isAuthenticated) return
    void refetch()
  }, [isAuthenticated, refetch])

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const eventTime = new Date(ticket.show_start_at).getTime()
      const isPast = eventTime < referenceTime

      if (activeTab === 'upcoming') return !isPast && ticket.seat_status === 'sold'
      return isPast && ticket.seat_status === 'sold'
    })
  }, [activeTab, referenceTime, tickets])

  const onSidebarNavigate = (tab: string) => {
    setDrawerOpen(false)
    if (tab === 'tickets') return navigate('/tickets')
    if (tab === 'profile') return navigate('/profile')
    if (tab === 'settings') return navigate('/settings')
    if (tab === 'logout') {
      logout()
      return navigate('/')
    }
  }

  const onViewDetails = (ticket: TicketItem) => {
    navigate(`/event/${ticket.event_id}`)
  }

  const onDownload = (ticket: TicketItem) => {
    if (!ticket.qr_payload) return
    navigator.clipboard.writeText(ticket.qr_payload).catch(() => undefined)
    window.alert(`Đã sao chép nội dung QR của vé ${ticket.ticket_code}`)
  }

  return (
    <div className="app-theme-page pt-[35px] h-auto flex">
      <div className="hidden lg:block">
        <CustomerSidebar
          activeTab="tickets"
          userName={user?.full_name ?? 'Khách hàng'}
          membershipLevel="Thành viên TicketRush"
          onNavigate={onSidebarNavigate}
        />
      </div>
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <CustomerSidebar
            activeTab="tickets"
            userName={user?.full_name ?? 'Khách hàng'}
            membershipLevel="Thành viên TicketRush"
            onNavigate={onSidebarNavigate}
            className="relative"
          />
        </div>
      )}

      <main className="flex-1 p-4 sm:p-6 lg:p-12 max-w-5xl mx-auto">
        <button className="lg:hidden mb-4 p-2 rounded bg-surface-container" onClick={() => setDrawerOpen((v) => !v)}>
          {drawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl sm:text-5xl font-black text-on-background font-headline tracking-tighter">Vé của bạn</h1>
            <p className="text-on-surface-variant mt-2 max-w-lg">Xem tất cả các vé sự kiện đã mua của bạn.</p>
          </div>
          <div className="flex flex-wrap p-1 main-bg-surface border border-[var(--customer-bg-opp)] rounded-2xl sm:rounded-full backdrop-blur-sm">
            {(['upcoming', 'past'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 sm:px-6 py-2 rounded-full font-bold text-sm transition-all capitalize ${
                  activeTab === tab
                    ? 'bg-[var(--customer-bg-opt)] text-white shadow-lg shadow-[var(--customer-bg-opt)]'
                    : 'text-slate-400 hover:text-[var(--customer-bg-opt)]'
                }`}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </div>
        </header>

        {!isAuthenticated ? (
          <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-20 text-center text-slate-300">
            <Ticket className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-2xl font-black text-white">Cần đăng nhập để xem vé</p>
            <p className="mt-2 max-w-md text-sm text-slate-400">
              Danh sách vé là dữ liệu cá nhân nên hệ thống chỉ tải sau khi xác thực tài khoản.
            </p>
            <Button className="mt-6" onClick={() => navigate('/login')}>
              Đăng nhập
            </Button>
          </div>
        ) : isLoading ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
            <p className="text-lg font-bold">Đang tải danh sách vé...</p>
          </div>
        ) : error ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-amber-300">
            <p className="text-lg font-bold mb-3">{error}</p>
            <button className="text-sm underline" onClick={() => void refetch()}>
              Thử lại
            </button>
          </div>
        ) : (
          <div className="space-y-3 gap-8">
            {filteredTickets.map((ticket) => (
              <div key={ticket.ticket_id} className="space-y-3">
                <TicketCard
                  eventTitle={`${ticket.event_title} • ${ticket.show_title}`}
                  ticketNumber={ticket.ticket_code}
                  date={formatDate(ticket.show_start_at)}
                  location={`${ticket.venue} | ${ticket.seat_label}`}
                  imageUrl={ticket.event_cover_image_url || FALLBACK_TICKET_IMAGE}
                  status={toCardStatus(ticket)}
                  onViewDetails={() => onViewDetails(ticket)}
                  onDownload={() => (ticket.qr_payload ? onDownload(ticket) : undefined)}
                />
              </div>
            ))}

            {filteredTickets.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
                <Ticket className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg font-bold">Không có vé trong mục {tabLabels[activeTab].toLowerCase()}.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default CustomerTicket
