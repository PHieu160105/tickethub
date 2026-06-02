import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Menu, Ticket, X } from 'lucide-react'

import { CustomerSidebar } from '@/components/layout/CustomerSidebar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { TicketCard } from '@/components/ui/TicketCard'
import { useAuth } from '@/context/AuthContext'
import { useMyTickets } from '@/features/booking/hooks/useBooking'
import type { RefundStatus, TicketItem } from '@/types'

type TicketTab = 'upcoming' | 'past' | 'cancelled'

const FALLBACK_TICKET_IMAGE =
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80'

const tabLabels: Record<TicketTab, string> = {
  upcoming: 'Sắp tới',
  past: 'Đã diễn ra',
  cancelled: 'Đã hủy',
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('vi-VN', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  })
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Chưa cập nhật'
  return new Date(value).toLocaleString('vi-VN')
}

function getCardStatus(ticket: TicketItem): 'confirmed' | 'pending' | 'cancelled' {
  if (ticket.ticket_status === 'cancelled') return 'cancelled'
  return ticket.seat_status === 'LOCKED' ? 'pending' : 'confirmed'
}

function getRefundStatusLabel(refundStatus: RefundStatus) {
  switch (refundStatus) {
    case 'REFUND_PENDING':
      return 'Chờ hoàn tiền'
    case 'REFUNDED':
      return 'Đã hoàn tiền'
    case 'REFUND_FAILED':
      return 'Hoàn tiền lỗi'
    default:
      return null
  }
}

function getRefundStatusMessage(refundStatus: RefundStatus) {
  switch (refundStatus) {
    case 'REFUND_PENDING':
      return 'Chúng tôi đang xử lý hoàn tiền trong thời gian sớm nhất.'
    case 'REFUNDED':
      return 'Yêu cầu hoàn tiền đã được xử lý.'
    case 'REFUND_FAILED':
      return 'Việc hoàn tiền đang gặp sự cố, chúng tôi sẽ tiếp tục xử lý.'
    default:
      return 'Chúng tôi sẽ sớm cập nhật tiến độ hoàn tiền cho bạn.'
  }
}

const CustomerTicket: React.FC = () => {
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<TicketTab>('upcoming')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedCancelledTicket, setSelectedCancelledTicket] = useState<TicketItem | null>(null)
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
      if (ticket.ticket_status === 'cancelled') {
        return activeTab === 'cancelled'
      }

      const eventTime = new Date(ticket.show_start_at).getTime()
      const isPast = eventTime < referenceTime

      if (activeTab === 'upcoming') return !isPast && ticket.seat_status === 'SOLD'
      if (activeTab === 'past') return isPast && ticket.seat_status === 'SOLD'
      return false
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
    if (ticket.ticket_status === 'cancelled') {
      setSelectedCancelledTicket(ticket)
      return
    }
    navigate(`/event/${ticket.event_id}`)
  }

  const onDownload = (ticket: TicketItem) => {
    if (!ticket.qr_payload || ticket.ticket_status === 'cancelled') return
    navigator.clipboard.writeText(ticket.qr_payload).catch(() => undefined)
    window.alert(`Đã sao chép nội dung QR của vé ${ticket.ticket_code}`)
  }

  return (
    <div className="app-theme-page pt-[35px] h-auto flex">
      <div className="hidden lg:block">
        <CustomerSidebar
          activeTab="tickets"
          userName={user?.full_name ?? 'Khách hàng'}
          membershipLevel="Thành viên TicketHub"
          onNavigate={onSidebarNavigate}
        />
      </div>
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <CustomerSidebar
            activeTab="tickets"
            userName={user?.full_name ?? 'Khách hàng'}
            membershipLevel="Thành viên TicketHub"
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
            {(['upcoming', 'past', 'cancelled'] as const).map((tab) => (
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
              <div key={`${ticket.ticket_id ?? ticket.ticket_code}-${ticket.order_id ?? 'no-order'}`} className="space-y-3">
                <TicketCard
                  eventTitle={`${ticket.event_title} • ${ticket.show_title}`}
                  ticketNumber={ticket.ticket_code}
                  date={formatDate(ticket.show_start_at)}
                  location={`${ticket.venue} | ${ticket.seat_label}`}
                  imageUrl={ticket.event_cover_image_url || FALLBACK_TICKET_IMAGE}
                  status={getCardStatus(ticket)}
                  secondaryStatusLabel={ticket.ticket_status === 'cancelled' ? getRefundStatusLabel(ticket.refund_status) : null}
                  cancellationReason={ticket.ticket_status === 'cancelled' ? ticket.cancellation_reason : null}
                  cancelledAt={ticket.ticket_status === 'cancelled' ? formatDateTime(ticket.cancelled_at) : null}
                  onViewDetails={() => onViewDetails(ticket)}
                  onDownload={ticket.ticket_status === 'cancelled' ? undefined : () => onDownload(ticket)}
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

      <Modal
        isOpen={selectedCancelledTicket !== null}
        onClose={() => setSelectedCancelledTicket(null)}
        title="Chi tiết show đã hủy"
        className="max-w-2xl"
      >
        {selectedCancelledTicket ? (
          <div className="space-y-6 text-slate-200">
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-red-300" />
                <div>
                  <p className="font-bold text-red-200">Show đã bị hủy</p>
                  <p className="mt-1 text-sm text-slate-300">
                    {selectedCancelledTicket.cancellation_reason || 'Chúng tôi rất tiếc vì sự bất tiện này.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-500">Sự kiện</p>
                <p className="mt-2 text-lg font-bold text-white">{selectedCancelledTicket.event_title}</p>
                <p className="text-sm text-slate-300">{selectedCancelledTicket.show_title}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-500">Trạng thái hoàn tiền</p>
                <p className="mt-2 text-lg font-bold text-white">{getRefundStatusLabel(selectedCancelledTicket.refund_status) || 'Chưa khởi tạo hoàn tiền'}</p>
                <p className="text-sm text-slate-300">{getRefundStatusMessage(selectedCancelledTicket.refund_status)}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-500">Mã vé</p>
                <p className="mt-2 font-semibold text-white">{selectedCancelledTicket.ticket_code}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-500">Mã đơn</p>
                <p className="mt-2 font-semibold text-white">#{selectedCancelledTicket.order_id ?? 'Không xác định'}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-500">Ghế / hạng vé</p>
                <p className="mt-2 font-semibold text-white">
                  {selectedCancelledTicket.seat_label} • {selectedCancelledTicket.ticket_tier_name}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-500">Địa điểm</p>
                <p className="mt-2 font-semibold text-white">{selectedCancelledTicket.venue}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-500">Thời gian show</p>
                <p className="mt-2 font-semibold text-white">{formatDateTime(selectedCancelledTicket.show_start_at)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-500">Thời điểm hủy</p>
                <p className="mt-2 font-semibold text-white">{formatDateTime(selectedCancelledTicket.cancelled_at)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-500">Bắt đầu hoàn tiền</p>
                <p className="mt-2 font-semibold text-white">{formatDateTime(selectedCancelledTicket.refund_started_at)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-500">Hoàn tất hoàn tiền</p>
                <p className="mt-2 font-semibold text-white">{formatDateTime(selectedCancelledTicket.refunded_at)}</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setSelectedCancelledTicket(null)}>
                Đóng
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

export default CustomerTicket
