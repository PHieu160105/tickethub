import { useEffect, useState } from 'react'
import { Listbox } from '@headlessui/react'
import { Calendar, DollarSign, RefreshCcw, Ticket, TrendingUp } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { adminApi, extractApiErrorMessage } from '@/lib/api'
import type {
  AdminEventRevenueItem,
  AdminTicketSaleItem,
  AdminTicketTransactionHistory,
  AdminTransactionLogItem,
  DashboardSummary,
} from '@/types'

const PAGE_SIZE = 10

const DEFAULT_SUMMARY: DashboardSummary = {
  total_revenue: 0,
  tickets_sold: 0,
  active_events: 0,
  waiting_queue_users: 0,
}

interface SelectOption {
  value: string
  label: string
}

interface FilterListboxProps {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  buttonClassName?: string
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Chưa có'
  return new Date(value).toLocaleString('vi-VN')
}

function statusBadge(status: string) {
  if (status === 'PAID') return <Badge variant="success" size="sm">Da thanh toan</Badge>
  if (status === 'PENDING_PAYMENT') return <Badge variant="warning" size="sm">Đang chờ thanh toán</Badge>
  if (status === 'PAYMENT_FAILED') return <Badge variant="danger" size="sm">Thanh toán thất bại</Badge>
  if (status === 'CANCELLED') return <Badge variant="default" size="sm">Da huy</Badge>
  if (status === 'REFUND_PENDING') return <Badge variant="warning" size="sm">Đang chờ hoàn tiền</Badge>
  if (status === 'REFUNDED') return <Badge variant="success" size="sm">Đã hoàn tiền</Badge>
  if (status === 'REFUND_FAILED') return <Badge variant="danger" size="sm">Hoàn tiền lỗi</Badge>
  return <Badge variant="default" size="sm">Khac</Badge>
}

function parseRawPayload(rawPayload?: string | null): Record<string, unknown> | null {
  if (!rawPayload) return null
  try {
    const parsed = JSON.parse(rawPayload)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

function pickPrimaryTransactionLog(transaction: AdminTicketTransactionHistory): AdminTransactionLogItem | null {
  const logs = transaction.logs
  if (transaction.order_status === 'PAID') {
    return logs.find((log) => log.action === 'PAYMENT_SUCCESS') ?? logs[0] ?? null
  }
  if (transaction.order_status === 'REFUND_PENDING') {
    return logs.find((log) => log.action === 'REFUND_REQUESTED') ?? logs[0] ?? null
  }
  if (transaction.order_status === 'REFUNDED') {
    return logs.find((log) => log.action === 'REFUND_SIMULATED_SUCCESS') ?? logs[0] ?? null
  }
  if (transaction.order_status === 'REFUND_FAILED') {
    return logs.find((log) => log.action === 'REFUND_SIMULATED_FAILED') ?? logs[0] ?? null
  }
  if (transaction.order_status === 'PAYMENT_FAILED') {
    return logs.find((log) => log.status === 'PAYMENT_FAILED' || log.action.includes('FAILED')) ?? logs[0] ?? null
  }
  if (transaction.order_status === 'CANCELLED') {
    return logs.find((log) => log.status === 'CANCELLED' || log.action.includes('FAILED') || log.action.includes('CANCEL')) ?? logs[0] ?? null
  }
  if (transaction.order_status === 'PENDING_PAYMENT') {
    return logs.find((log) => Boolean(log.gateway_transaction_id) || Boolean(log.raw_payload)) ?? logs[0] ?? null
  }
  return logs[0] ?? null
}

function FilterListbox({ value, options, onChange, buttonClassName = 'w-full sm:w-48' }: FilterListboxProps) {
  const selectedLabel = options.find((option) => option.value === value)?.label ?? options[0]?.label ?? ''

  return (
    <Listbox value={value} onChange={onChange}>
      <div className="relative">
        <Listbox.Button className={`${buttonClassName} h-9 px-3 admin-bg-listbox admin-text-header border admin-border rounded-md shadow-sm text-left text-sm`}>
          {selectedLabel}
        </Listbox.Button>
        <Listbox.Options className={`absolute z-50 mt-1 ${buttonClassName} admin-bg-listbox admin-text-header border admin-border rounded-md shadow-lg`}>
          {options.map((option) => (
            <Listbox.Option key={option.value} value={option.value} className="px-3 py-2 cursor-pointer hover:admin-bg-soft text-sm">
              {option.label}
            </Listbox.Option>
          ))}
        </Listbox.Options>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
          <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
          </svg>
        </div>
      </div>
    </Listbox>
  )
}

export default function AdminTickets() {
  const [summary, setSummary] = useState<DashboardSummary>(DEFAULT_SUMMARY)
  const [revenueByShow, setRevenueByShow] = useState<AdminEventRevenueItem[]>([])
  const [ticketSales, setTicketSales] = useState<AdminTicketSaleItem[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [eventFilter, setEventFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalSales, setTotalSales] = useState(0)
  const [selectedTransaction, setSelectedTransaction] = useState<AdminTicketTransactionHistory | null>(null)
  const [transactionLoading, setTransactionLoading] = useState(false)
  const [transactionError, setTransactionError] = useState<string | null>(null)
  const [transactionModalOpen, setTransactionModalOpen] = useState(false)
  const [resendingEmail, setResendingEmail] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)

  const selectedEventId = eventFilter === 'all' ? undefined : Number(eventFilter)

  async function loadStaticData() {
    const [summaryRes, revenueRes] = await Promise.all([adminApi.summary(), adminApi.revenueByEvent()])
    setSummary(summaryRes)
    setRevenueByShow(revenueRes)
  }

  async function loadSalesData() {
    const salesRes = await adminApi.ticketSales({
      event_id: selectedEventId,
      status_filter: statusFilter === 'all' ? undefined : statusFilter,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    })
    setTicketSales(salesRes.items)
    setTotalSales(salesRes.total)
  }

  async function loadTicketsData(isRefresh = false) {
    setError(null)
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      await Promise.all([loadStaticData(), loadSalesData()])
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không tải được dữ liệu vé và doanh thu.'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function openTransactionHistory(ticketId: number) {
    setTransactionModalOpen(true)
    setTransactionLoading(true)
    setTransactionError(null)
    setResendMessage(null)
    setSelectedTransaction(null)
    try {
      const detail = await adminApi.ticketTransactionHistory(ticketId)
      setSelectedTransaction(detail)
    } catch (errorValue) {
      setTransactionError(extractApiErrorMessage(errorValue, 'Không tải được thông tin giao dịch.'))
    } finally {
      setTransactionLoading(false)
    }
  }

  async function handleResendTicketEmail() {
    if (!selectedTransaction) return
    setResendingEmail(true)
    setTransactionError(null)
    setResendMessage(null)
    try {
      const message = await adminApi.resendTicketEmail(selectedTransaction.order_id)
      setResendMessage(message.detail)
      const detail = await adminApi.ticketTransactionHistory(selectedTransaction.ticket_id)
      setSelectedTransaction(detail)
    } catch (errorValue) {
      setTransactionError(extractApiErrorMessage(errorValue, 'Không thể gửi lại mail vé.'))
    } finally {
      setResendingEmail(false)
    }
  }

  useEffect(() => {
    void loadTicketsData()
  }, [page, statusFilter, selectedEventId])

  const totalRevenue = summary.total_revenue
  const totalTicketsSold = summary.tickets_sold
  const totalPages = Math.max(1, Math.ceil(totalSales / PAGE_SIZE))
  const eventOptions: SelectOption[] = [
    { value: 'all', label: 'Tất cả sự kiện' },
    ...revenueByShow.map((eventItem) => ({
      value: String(eventItem.event_id),
      label: eventItem.event_title,
    })),
  ]
  const statusOptions: SelectOption[] = [
    { value: 'all', label: 'Tất cả trạng thái' },
    { value: 'PAID', label: 'Da thanh toan' },
    { value: 'REFUND_PENDING', label: 'Đang chờ hoàn tiền' },
    { value: 'REFUNDED', label: 'Đã hoàn tiền' },
    { value: 'REFUND_FAILED', label: 'Hoàn tiền lỗi' },
    { value: 'PENDING_PAYMENT', label: 'Đang chờ thanh toán' },
    { value: 'PAYMENT_FAILED', label: 'Thanh toán thất bại' },
    { value: 'CANCELLED', label: 'Da huy' },
  ]

  const primaryLog = selectedTransaction ? pickPrimaryTransactionLog(selectedTransaction) : null
  const primaryPayload = parseRawPayload(primaryLog?.raw_payload)
  const canResendTicketEmail = selectedTransaction ? ['PAID', 'REFUND_PENDING', 'REFUNDED', 'REFUND_FAILED'].includes(selectedTransaction.order_status) : false

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold admin-text-header">Vé và Doanh thu</h2>
          <p className="text-gray-400 mt-1">Thong tin ve va doanh thu</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void loadTicketsData(true)} isLoading={refreshing}>
            <RefreshCcw className="h-4 w-4" />
            Lam moi
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-500/30 bg-red-500/10">
          <CardContent className="pt-6 text-sm text-red-200">{error}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold admin-text-body mb-1">Doanh thu tong</p>
                <p className="text-2xl font-bold text-green-400">{formatCurrency(totalRevenue)}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-green-400">
              <TrendingUp className="h-4 w-4" />
              <span>Cap nhat tu /admin/dashboard/summary</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold admin-text-body mb-1">Ve da ban</p>
                <p className="text-2xl font-bold text-brand-red">{totalTicketsSold.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-brand-red/20 flex items-center justify-center">
                <Ticket className="h-6 w-6 text-brand-red" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-400">
              <Ticket className="h-4 w-4" />
              <span>Hien thi cac giao dich ve theo trang thai thanh toan.</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold admin-text-body mb-1">Ket qua filter</p>
                <p className="text-2xl font-bold text-brand-yellow">{totalSales}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-brand-yellow/20 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-brand-yellow" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-400">
              <span>Trang {page}/{totalPages}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Doanh thu theo show</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm admin-text-body">Đang tải doanh thu...</p>
          ) : revenueByShow.length === 0 ? (
            <p className="text-sm text-gray-400">Chưa có dữ liệu doanh thu theo show.</p>
          ) : (
            <div className="space-y-4">
              {revenueByShow.map((item) => {
                const progress = summary.tickets_sold > 0 ? (item.tickets_sold / summary.tickets_sold) * 100 : 0
                return (
                  <div key={item.show_id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <span className="admin-text-body font-medium">{item.show_title}</span>
                        <p className="text-xs text-gray-400">
                          {item.event_title} • {new Date(item.show_start_at).toLocaleString('vi-VN')}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-gray-400">{item.tickets_sold} ve</span>
                        <span className="text-green-400 font-medium">{formatCurrency(item.revenue)}</span>
                      </div>
                    </div>
                    <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ background: 'linear-gradient(to right, var(--admin-bg-opt), var(--admin-bg-opp))', width: `${Math.max(progress, 2)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span>Giao dịch vé gần đây</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full sm:w-auto">
              <FilterListbox
                value={eventFilter}
                options={eventOptions}
                onChange={(value) => {
                  setEventFilter(value)
                  setPage(1)
                }}
                buttonClassName="w-full sm:w-56"
              />
              <FilterListbox
                value={statusFilter}
                options={statusOptions}
                onChange={(value) => {
                  setStatusFilter(value)
                  setPage(1)
                }}
                buttonClassName="w-full sm:w-56"
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-300">Đang tải giao dịch...</p>
          ) : ticketSales.length === 0 ? (
            <p className="text-sm text-gray-400">Không có giao dịch.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left admin-text-body">
                    <th className="pb-3 font-medium">ID</th>
                    <th className="pb-3 font-medium">Sự kiện</th>
                    <th className="pb-3 font-medium">Show</th>
                    <th className="pb-3 font-medium">Khách hàng</th>
                    <th className="pb-3 font-medium">Ghế</th>
                    <th className="pb-3 font-medium">Giá</th>
                    <th className="pb-3 font-medium">Thời gian</th>
                    <th className="pb-3 font-medium">Trạng thái</th>
                    <th className="pb-3 font-medium text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {ticketSales.map((sale) => (
                    <tr key={sale.id} className="border-b border-white/5">
                      <td className="py-3 admin-text-body font-mono text-xs">#{sale.id.toString().padStart(4, '0')}</td>
                      <td className="py-3 admin-text-body max-w-[220px] truncate">{sale.event_title}</td>
                      <td className="py-3 admin-text-body">
                        <div>{sale.show_title}</div>
                        <div className="text-xs text-gray-400">{new Date(sale.show_start_at).toLocaleString('vi-VN')}</div>
                        <div className="text-xs text-gray-500">{sale.venue}</div>
                      </td>
                      <td className="py-3 admin-text-body">{sale.customer_name}</td>
                      <td className="py-3 admin-text-body">{sale.ticket_tier_name} - {sale.seat_label}</td>
                      <td className="py-3 text-green-400">{formatCurrency(sale.price)}</td>
                      <td className="py-3 admin-text-body">{new Date(sale.purchased_at).toLocaleString('vi-VN')}</td>
                      <td className="py-3">{statusBadge(sale.order_status)}</td>
                      <td className="py-3 text-right">
                        <Button variant="outline" size="sm" onClick={() => void openTransactionHistory(sale.id)}>
                          Xem giao dịch
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              Truoc
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
              Sau
            </Button>
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={transactionModalOpen}
        onClose={() => {
          setTransactionModalOpen(false)
          setSelectedTransaction(null)
          setTransactionError(null)
          setTransactionLoading(false)
          setResendMessage(null)
          setResendingEmail(false)
        }}
        title="Thông tin giao dịch"
        className="max-w-4xl"
      >
        {transactionLoading ? (
          <p className="text-sm admin-text-body">Đang tải thông tin giao dịch...</p>
        ) : transactionError ? (
          <p className="text-sm text-red-300">{transactionError}</p>
        ) : selectedTransaction ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-end gap-3">
              {resendMessage ? <p className="text-sm text-green-300">{resendMessage}</p> : null}
              <Button variant="outline" onClick={() => void handleResendTicketEmail()} isLoading={resendingEmail} disabled={!canResendTicketEmail}>
                Gửi lại mail vé
              </Button>
            </div>
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl border border-white/10 p-4 space-y-2">
                <h3 className="font-semibold admin-text-header">Đơn hàng</h3>
                <p>Ma order: {selectedTransaction.order_code ?? `#${selectedTransaction.order_id}`}</p>
                <div className="flex items-center gap-2">
                  <span>Trạng thái:</span>
                  {statusBadge(selectedTransaction.order_status)}
                </div>
                <p>Nhà cung cấp: {selectedTransaction.payment_provider ?? 'Chưa có'}</p>
                <p>Mã tham chiếu cổng: {selectedTransaction.gateway_order_ref ?? 'Chưa có'}</p>
                <p>Mã giao dịch cổng: {selectedTransaction.gateway_transaction_id ?? 'Chưa có'}</p>
                <p>Bắt đầu thanh toán: {formatDateTime(selectedTransaction.payment_started_at)}</p>
                <p>Hết hạn: {formatDateTime(selectedTransaction.payment_expires_at)}</p>
                <p>Thanh toán lúc: {formatDateTime(selectedTransaction.paid_at)}</p>
              </div>
              <div className="rounded-xl border border-white/10 p-4 space-y-2">
                <h3 className="font-semibold admin-text-header">Vé và người mua</h3>
                <p>Khách hàng: {selectedTransaction.buyer_name ?? 'Chưa có'}</p>
                <p>Email: {selectedTransaction.buyer_email ?? 'Chưa có'}</p>
                <p>Điện thoại: {selectedTransaction.buyer_phone ?? 'Chưa có'}</p>
                <p>Sự kiện: {selectedTransaction.event_title}</p>
                <p>Show: {selectedTransaction.show_title}</p>
                <p>Thời gian show: {formatDateTime(selectedTransaction.show_start_at)}</p>
                <p>Venue: {selectedTransaction.venue}</p>
                <p>Ve: {selectedTransaction.ticket_tier_name} - {selectedTransaction.seat_label}</p>
                <p>Giá: {formatCurrency(selectedTransaction.price)}</p>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="font-semibold admin-text-header">Chi tiết thanh toán</h3>
              {!primaryLog ? (
                <p className="text-sm text-gray-400">Chưa có thông tin thanh toán để hiển thị.</p>
              ) : (
                <div className="rounded-xl border border-white/10 p-4 space-y-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" size="sm">{primaryLog.action}</Badge>
                      {statusBadge(primaryLog.status)}
                    </div>
                    <p className="text-xs text-gray-400">{formatDateTime(primaryLog.created_at)}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <p>Phương thức thanh toán: {primaryLog.payment_method ?? 'Chưa có'}</p>
                    <p>Mã giao dịch cổng: {primaryLog.gateway_transaction_id ?? 'Chưa có'}</p>
                    <p>Mã phản hồi: {primaryLog.gateway_response_code ?? 'Chưa có'}</p>
                    <p>Số tiền: {primaryLog.amount != null ? formatCurrency(primaryLog.amount) : 'Chưa có'}</p>
                  </div>
                  {primaryLog.message && (
                    <p className="text-sm text-amber-300">{primaryLog.message}</p>
                  )}
                  {primaryPayload && (
                    <div className="rounded-lg bg-white/5 p-3 text-xs text-gray-300">
                      <p className="font-medium text-white mb-2">Tóm tắt payload VNPAY</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {Boolean(primaryPayload['vnp_TransactionNo']) && <p>{`vnp_TransactionNo: ${String(primaryPayload['vnp_TransactionNo'])}`}</p>}
                        {Boolean(primaryPayload['vnp_ResponseCode']) && <p>{`vnp_ResponseCode: ${String(primaryPayload['vnp_ResponseCode'])}`}</p>}
                        {Boolean(primaryPayload['vnp_TransactionStatus']) && <p>{`vnp_TransactionStatus: ${String(primaryPayload['vnp_TransactionStatus'])}`}</p>}
                        {Boolean(primaryPayload['vnp_PayDate']) && <p>{`vnp_PayDate: ${String(primaryPayload['vnp_PayDate'])}`}</p>}
                        {Boolean(primaryPayload['vnp_BankCode']) && <p>{`vnp_BankCode: ${String(primaryPayload['vnp_BankCode'])}`}</p>}
                        {Boolean(primaryPayload['vnp_CardType']) && <p>{`vnp_CardType: ${String(primaryPayload['vnp_CardType'])}`}</p>}
                        {Boolean(primaryPayload['vnp_BankTranNo']) && <p>{`vnp_BankTranNo: ${String(primaryPayload['vnp_BankTranNo'])}`}</p>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
