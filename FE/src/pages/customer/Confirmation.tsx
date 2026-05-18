import { Link, useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { formatCurrencyVnd } from '@/lib/utils'
import type { CheckoutResponse, Seat } from '@/types'
import { Calendar, CheckCircle, MapPin, QrCode, Ticket } from 'lucide-react'

interface ConfirmationLocationState {
  order?: CheckoutResponse
  eventKey?: string
  showId?: number
  eventTitle?: string
  showTitle?: string
  venue?: string
  showStartAt?: string | null
  profile?: {
    fullName: string
    email: string
    phone: string
  }
  lockedSeats?: Seat[]
}

export default function Confirmation() {
  const location = useLocation()
  const state = (location.state ?? {}) as ConfirmationLocationState

  const order = state.order
  const profile = state.profile
  const tickets = order?.items ?? []

  if (!order) {
    return (
      <div className="app-theme-page min-h-screen text-slate-500">
        <main className="max-w-4xl mx-auto px-6 py-20 text-center">
          <h1 className="text-3xl font-bold mb-4">Không tìm thấy dữ liệu xác nhận</h1>
          <p className="text-slate-500 mb-6">Vui lòng hoàn tất thanh toán trước.</p>
          <Link to="/search">
            <Button>Quay lại tìm kiếm</Button>
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="app-theme-page min-h-screen customer-text-header font-body">
      <main className="max-w-screen-2xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-300/20 mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-4xl font-headline font-black tracking-tight mb-4">Đặt vé thành công</h1>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto">Đơn hàng đã được tạo và vé điện tử đã sẵn sàng.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-7 space-y-8">
            <div className="backdrop-blur-xl customer-bg-surface p-8 rounded-3xl border border-[var(--customer-bg-opp)]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-headline font-bold">Đơn hàng #{order.order_id}</h2>
                <span className="text-sm text-slate-500">Trạng thái: {order.order_status}</span>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Khách hàng</span>
                  <span>{profile?.fullName || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Email</span>
                  <span>{profile?.email || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Thanh toán lúc</span>
                  <span>{new Date(order.paid_at).toLocaleString('vi-VN')}</span>
                </div>
              </div>
            </div>

            <div className="backdrop-blur-xl customer-bg-surface p-8 rounded-3xl border border-[var(--customer-bg-opp)]">
              <h3 className="text-xl font-headline font-bold mb-6">Vé đã phát hành</h3>
              <div className="space-y-4">
                {tickets.map((ticket) => (
                  <div key={ticket.ticket_code} className="p-4 bg-[var(--customer-bg-page)] rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Ticket className="w-4 h-4 text-secondary" />
                        <div>
                          <p className="font-semibold">
                            {ticket.seat_label} | {ticket.zone_name}
                          </p>
                          <p className="text-xs text-slate-400">Mã vé: {ticket.ticket_code}</p>
                        </div>
                      </div>
                      <p className="font-semibold">{formatCurrencyVnd(ticket.price)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="lg:col-span-5 top-28 space-y-6">
            <div className="backdrop-blur-xl customer-bg-surface p-8 rounded-3xl border border-[var(--customer-bg-opp)]">
              <h3 className="text-xl font-headline font-bold uppercase tracking-widest mb-8 border-b border-[var(--customer-text-body)]/20 pb-4">Tóm tắt thanh toán</h3>

              <div className="space-y-4 mb-10">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Vé ({tickets.length})</span>
                  <span className="customer-text-body">{formatCurrencyVnd(order.total_amount)}</span>
                </div>
                <div className="pt-4 border-t border-[var(--customer-text-body)]/20 mt-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="text-[10px] font-headline font-black uppercase tracking-[0.3em] text-slate-500">Tổng đã thanh toán</span>
                      <p className="text-4xl font-headline font-black customer-text-body mt-1">{formatCurrencyVnd(order.total_amount)}</p>
                    </div>
                    <div className="bg-white p-2 rounded-lg">
                      <div className="w-16 h-16 bg-slate-100 flex items-center justify-center">
                        <QrCode className="text-slate-900 text-3xl" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-400">
                <p className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Giữ mã QR và mã vé để soát vé tại cổng.
                </p>
                {state.showTitle && (
                  <p className="flex items-center gap-2">
                    <Ticket className="w-4 h-4" />
                    Buổi diễn: {state.showTitle}
                  </p>
                )}
                {state.venue && (
                  <p className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Địa điểm: {state.venue}
                  </p>
                )}
                {state.eventKey && (
                  <p className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Sự kiện: {state.eventTitle ?? state.eventKey}
                  </p>
                )}
              </div>
            </div>
            <Link to="/tickets">
              <Button className="w-full" variant="primary">
                Xem vé của tôi
              </Button>
            </Link>
          </aside>
        </div>
      </main>

    </div>
  )
}
