import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { bookingApi } from '@/features/booking/api/bookingApi'
import { pendingPaymentStorage, queueStorage } from '@/lib/storage'
import type { OrderStatusResponse } from '@/types'

export default function PaymentResult() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [order, setOrder] = useState<OrderStatusResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const pendingPayment = pendingPaymentStorage.get()
    const orderIdFromUrl = Number(searchParams.get('orderId'))
    const orderId = Number.isFinite(orderIdFromUrl) && orderIdFromUrl > 0
      ? orderIdFromUrl
      : pendingPayment?.orderId ?? null
    const gatewayError = searchParams.get('gatewayError')

    if (!orderId) {
      setIsLoading(false)
      setErrorMessage(
        gatewayError === 'invalid_signature'
          ? 'KhÃ´ng thá»ƒ xÃ¡c minh pháº£n há»“i tá»« cá»•ng thanh toÃ¡n.'
          : 'KhÃ´ng tÃ¬m tháº¥y phiÃªn thanh toÃ¡n Ä‘ang chá» xá»­ lÃ½.',
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
        setErrorMessage('Thanh toÃ¡n chÆ°a hoÃ n táº¥t hoáº·c Ä‘Ã£ bá»‹ há»§y.')
      } catch (error) {
        if (!isMounted) return
        setErrorMessage(error instanceof Error ? error.message : 'KhÃ´ng thá»ƒ kiá»ƒm tra tráº¡ng thÃ¡i thanh toÃ¡n.')
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
          <h1 className="text-3xl font-headline font-black tracking-tight">Káº¿t quáº£ thanh toÃ¡n</h1>

          {isLoading && <p className="text-slate-400">Äang kiá»ƒm tra tráº¡ng thÃ¡i thanh toÃ¡n vá»›i há»‡ thá»‘ng...</p>}

          {!isLoading && order?.order_status === 'PENDING_PAYMENT' && (
            <p className="text-slate-300">ÄÆ¡n hÃ ng váº«n Ä‘ang chá» VNPAY xÃ¡c nháº­n. Trang nÃ y sáº½ tá»± lÃ m má»›i tráº¡ng thÃ¡i.</p>
          )}

          {!isLoading && errorMessage && (
            <p className="text-amber-300">{errorMessage}</p>
          )}

          {!isLoading && order && (
            <div className="space-y-2 text-sm">
              <p>MÃ£ Ä‘Æ¡n: {order.order_id}</p>
              <p>Tráº¡ng thÃ¡i: {order.order_status}</p>
              <p>Tá»•ng tiá»n: {order.total_amount.toLocaleString('vi-VN')} Ä‘</p>
            </div>
          )}

          <div className="flex gap-4">
            <Button onClick={() => window.location.reload()} disabled={isLoading}>
              Kiá»ƒm tra láº¡i
            </Button>
            <Link to="/tickets">
              <Button variant="outline">VÃ© cá»§a tÃ´i</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
