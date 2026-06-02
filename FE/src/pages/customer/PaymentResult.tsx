import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { bookingApi } from '@/features/booking/api/bookingApi'
import { pendingPaymentStorage, queueStorage } from '@/lib/storage'
import type { OrderStatusResponse } from '@/types'

const formatCurrencyVnd = (amount: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount)

export default function PaymentResult() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [order, setOrder] = useState<OrderStatusResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const pendingPayment = pendingPaymentStorage.get()
    const orderIdFromUrl = Number(searchParams.get('orderId'))
    const orderId =
      Number.isFinite(orderIdFromUrl) && orderIdFromUrl > 0
        ? orderIdFromUrl
        : pendingPayment?.orderId ?? null
    const gatewayError = searchParams.get('gatewayError')

    if (!orderId) {
      setIsLoading(false)
      setErrorMessage(
        gatewayError === 'invalid_signature'
          ? 'Không thể xác minh phản hồi từ cổng thanh toán.'
          : 'Không tìm thấy phiên thanh toán đang chờ xử lý.',
      )
      return
    }

    let isMounted = true
    let pollTimer: number | null = null

    const pollStatus = async () => {
      try {
        const result = await bookingApi.getOrderStatus(orderId)
        if (!isMounted) return

        setOrder(result)

        if (result.order_status === 'PAID') {
          if (pendingPayment) {
            queueStorage.clearToken(pendingPayment.showId)
          }
          pendingPaymentStorage.clear()
          navigate('/confirmation', {
            replace: true,
            state: {
              order: result,
              eventKey: pendingPayment?.eventKey,
              showId: pendingPayment?.showId,
              showTitle: pendingPayment?.showTitle,
              eventTitle: pendingPayment?.eventTitle,
              profile: pendingPayment?.profile,
              lockedSeats: pendingPayment?.lockedSeats ?? [],
            },
          })
          return
        }

        if (result.order_status === 'PENDING_PAYMENT') {
          pollTimer = window.setTimeout(() => {
            void pollStatus()
          }, 2000)
          return
        }

        pendingPaymentStorage.clear()
        if (pendingPayment) {
          queueStorage.clearToken(pendingPayment.showId)
        }
        setErrorMessage('Thanh toan chua hoan tat hoac da bi huy.')
      } catch (error) {
        if (!isMounted) return
        setErrorMessage(error instanceof Error ? error.message : 'Không thể kiểm tra trạng thái thanh toán.')
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void pollStatus()

    return () => {
      isMounted = false
      if (pollTimer !== null) {
        window.clearTimeout(pollTimer)
      }
    }
  }, [navigate, searchParams])

  return (
    <div className="min-h-screen customer-text-body font-body">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="backdrop-blur-xl customer-bg-surface p-8 rounded-3xl border border-[var(--customer-bg-opp)] space-y-6">
          <h1 className="text-3xl font-headline font-black tracking-tight">Ket qua thanh toan</h1>

          {isLoading && <p className="text-slate-400">Đang kiểm tra trạng thái thanh toán với hệ thống...</p>}

          {!isLoading && order?.order_status === 'PENDING_PAYMENT' && (
            <p className="text-slate-300">Đơn hàng vẫn đang chờ VNPAY xác nhận. Trang này sẽ tự làm mới trạng thái.</p>
          )}

          {!isLoading && errorMessage && <p className="text-amber-300">{errorMessage}</p>}

          {!isLoading && order && (
            <div className="space-y-2 text-sm">
              <p>Ma don: {order.order_id}</p>
              <p>Trang thai: {order.order_status}</p>
              <p>Tong tien: {formatCurrencyVnd(order.total_amount)}</p>
            </div>
          )}

          <div className="flex gap-4">
            <Button onClick={() => window.location.reload()} disabled={isLoading}>
              Kiem tra lai
            </Button>
            <Link to="/tickets">
              <Button variant="outline">Ve cua toi</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
