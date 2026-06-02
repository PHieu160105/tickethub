import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { GlobalLoader } from '@/components/ui/GlobalLoader'
import { adminApi, extractApiErrorMessage } from '@/lib/api'
import type { AdminRefundBatchResponse, AdminRefundListResponse, EventDetail, ShowSummary } from '@/types'

const formatCurrencyVnd = (amount: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount)

function formatDateTime(value?: string | null) {
  if (!value) return 'Chưa có'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có'
  return date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
}

function refundStatusBadge(status: 'PAID' | 'REFUND_PENDING' | 'REFUNDED' | 'REFUND_FAILED') {
  const variants = {
    PAID: { label: 'Chưa khởi tạo', variant: 'outline' as const },
    REFUND_PENDING: { label: 'Chờ hoàn tiền', variant: 'warning' as const },
    REFUNDED: { label: 'Đã hoàn tiền', variant: 'success' as const },
    REFUND_FAILED: { label: 'Refund lỗi', variant: 'danger' as const },
  }
  const item = variants[status]
  return <Badge variant={item.variant}>{item.label}</Badge>
}

export default function AdminShowRefunds() {
  const { eventKey, showId } = useParams<{ eventKey: string; showId: string }>()
  const parsedShowId = Number(showId)

  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [eventDetail, setEventDetail] = useState<EventDetail | null>(null)
  const [showRefunds, setShowRefunds] = useState<AdminRefundListResponse | null>(null)

  const activeShow: ShowSummary | null = useMemo(() => {
    if (!eventDetail) return null
    return eventDetail.shows.find((item) => item.id === parsedShowId) ?? null
  }, [eventDetail, parsedShowId])

  const orders = showRefunds?.orders ?? []
  const refundPendingCount = orders.filter((order) => order.refund_status === 'REFUND_PENDING').length
  const refundedCount = orders.filter((order) => order.refund_status === 'REFUNDED').length
  const failedCount = orders.filter((order) => order.refund_status === 'REFUND_FAILED').length
  const canRetryFailed = failedCount > 0

  function applyBatchResponse(response: AdminRefundBatchResponse) {
    setShowRefunds({
      show_id: response.show_id,
      cancellation_reason: showRefunds?.cancellation_reason ?? activeShow?.cancellation_reason ?? null,
      orders: response.orders,
    })
  }

  async function loadData() {
    if (!eventKey || !Number.isFinite(parsedShowId) || parsedShowId <= 0) {
      setError('Thiếu thông tin show để theo dõi refund.')
      setLoading(false)
      return
    }

    setError(null)
    try {
      const [detail, refunds] = await Promise.all([
        adminApi.getEvent(eventKey),
        adminApi.getShowRefunds(eventKey, parsedShowId),
      ])
      setEventDetail(detail)
      setShowRefunds(refunds)
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể tải dữ liệu hoàn tiền.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [eventKey, parsedShowId])

  useEffect(() => {
    if (refundPendingCount === 0 || processing || !eventKey || !Number.isFinite(parsedShowId) || parsedShowId <= 0) {
      return
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        setProcessing(true)
        setError(null)
        try {
          const response = await adminApi.refreshShowRefunds(eventKey, parsedShowId)
          applyBatchResponse(response)
        } catch (errorValue) {
          setError(extractApiErrorMessage(errorValue, 'Không thể tự động xử lý batch refund.'))
        } finally {
          setProcessing(false)
        }
      })()
    }, 4000)
    return () => window.clearTimeout(timer)
  }, [eventKey, parsedShowId, refundPendingCount, processing, activeShow, showRefunds])

  async function handleRetryFailedRefunds() {
    if (!eventKey || !Number.isFinite(parsedShowId) || parsedShowId <= 0) return

    setProcessing(true)
    setError(null)
    try {
      const response: AdminRefundBatchResponse = await adminApi.requestShowRefunds(eventKey, parsedShowId)
      applyBatchResponse(response)
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể retry refund lỗi.'))
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return <GlobalLoader />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold admin-text-header">Theo dõi hoàn tiền show</h1>
          <p className="mt-1 text-sm text-gray-400">
            {activeShow ? `${activeShow.title} - ${eventDetail?.title ?? ''}` : 'Theo dõi trạng thái refund cho từng giao dịch'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/admin/events">
            <Button variant="outline">Quay lại sự kiện</Button>
          </Link>
          <Button variant="danger" onClick={() => void handleRetryFailedRefunds()} isLoading={processing} disabled={!canRetryFailed}>
            Thử lại giao dịch lỗi
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-red-500/30 bg-red-500/10">
          <CardContent className="pt-6 text-sm text-red-200">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader><CardTitle>Tổng giao dịch</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold text-white">{orders.length}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Đang xử lý</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold text-amber-300">{refundPendingCount}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Đã hoàn tiền</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold text-green-300">{refundedCount}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Refund lỗi</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold text-red-300">{failedCount}</CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader><CardTitle>Tổng số vé</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold text-white">{activeShow?.historical_paid_ticket_count ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Tổng cần hoàn</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-white">{formatCurrencyVnd(activeShow?.refund_required_amount ?? 0)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Tiền đang pending</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-amber-300">{formatCurrencyVnd(activeShow?.refund_pending_amount ?? 0)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Tiền đã hoàn</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-green-300">{formatCurrencyVnd(activeShow?.refunded_amount ?? 0)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin hủy show</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-300">
          <p><strong className="text-white">Show:</strong> {activeShow?.title ?? `#${parsedShowId}`}</p>
          <p><strong className="text-white">Trạng thái:</strong> {activeShow ? activeShow.status : 'Chưa có'}</p>
          <p><strong className="text-white">Hủy lúc:</strong> {formatDateTime(activeShow?.cancelled_at)}</p>
          <p><strong className="text-white">Lý do hủy:</strong> {showRefunds?.cancellation_reason ?? activeShow?.cancellation_reason ?? 'Chưa cập nhật'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách giao dịch refund</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">Chưa có giao dịch refund nào cho show này.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-slate-400">
                    <th className="px-3 py-3">Đơn hàng</th>
                    <th className="px-3 py-3">Khách hàng</th>
                    <th className="px-3 py-3">Số tiền</th>
                    <th className="px-3 py-3">Đã thanh toán</th>
                    <th className="px-3 py-3">Bắt đầu refund</th>
                    <th className="px-3 py-3">Hoàn tất</th>
                    <th className="px-3 py-3">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.order_id} className="border-b border-white/5 text-slate-200">
                      <td className="px-3 py-4">
                        <div className="font-medium text-white">{order.order_code ?? `ĐƠN-${order.order_id}`}</div>
                        <div className="text-xs text-slate-500">#{order.order_id}</div>
                      </td>
                      <td className="px-3 py-4">
                        <div>{order.buyer_name ?? 'Chưa có tên'}</div>
                        <div className="text-xs text-slate-500">{order.buyer_email ?? 'Chưa có email'}</div>
                      </td>
                      <td className="px-3 py-4">{formatCurrencyVnd(order.total_amount)}</td>
                      <td className="px-3 py-4">{formatDateTime(order.paid_at)}</td>
                      <td className="px-3 py-4">{formatDateTime(order.refund_started_at)}</td>
                      <td className="px-3 py-4">{formatDateTime(order.refunded_at)}</td>
                      <td className="px-3 py-4">{refundStatusBadge(order.refund_status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
