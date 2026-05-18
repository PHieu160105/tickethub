import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'

import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useCheckout, useReleaseSeats } from '@/features/booking/hooks/useBooking'
import { useShowSeats } from '@/features/events/hooks/useEvents'
import { bookingApi, extractApiErrorMessage } from '@/lib/api'
import { queueStorage } from '@/lib/storage'
import { formatCurrencyVnd } from '@/lib/utils'
import type { Seat } from '@/types'
import { AlertCircle, CreditCard, MapPin, QrCode, Rocket, Timer } from 'lucide-react'

interface CheckoutLocationState {
  lockedSeatIds?: number[]
  lockedSeats?: Seat[]
}

function isRecoverableQueueTokenError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false
  }

  const statusCode = error.response?.status
  return statusCode === 403 || statusCode === 404 || statusCode === 410 || statusCode === 429
}

export default function Checkout() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const { checkout, isLoading: isSubmitting } = useCheckout()
  const { releaseSeats, isLoading: isReleasing } = useReleaseSeats()

  const showId = Number(searchParams.get('showId'))
  const eventKey = searchParams.get('eventKey') ?? undefined
  const state = (location.state ?? {}) as CheckoutLocationState

  const [formData, setFormData] = useState({
    fullName: user?.full_name ?? '',
    email: user?.email ?? '',
    phone: '',
  })
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [selectedDiscountCode] = useState<string>('')
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)

  const stateLockedSeats = useMemo(() => state.lockedSeats ?? [], [state.lockedSeats])
  const shouldFetchMatrix = !stateLockedSeats.length
  const { seats: matrix } = useShowSeats(shouldFetchMatrix ? showId : undefined)
  const checkoutCompletedRef = useRef(false)
  const locksReleasedRef = useRef(false)
  const latestShowIdRef = useRef<number | null>(null)
  const latestLockedSeatIdsRef = useRef<number[]>([])

  const lockedSeats = useMemo(() => {
    if (stateLockedSeats.length > 0) {
      return stateLockedSeats
    }

    const allSeats = matrix?.seats ?? []

    if (state.lockedSeatIds && state.lockedSeatIds.length > 0) {
      return allSeats.filter((seat) => state.lockedSeatIds?.includes(seat.id))
    }

    return allSeats.filter((seat) => seat.is_locked_by_me)
  }, [matrix?.seats, state.lockedSeatIds, stateLockedSeats])

  const subtotal = lockedSeats.reduce((sum, seat) => sum + Number(seat.price), 0)
  const total = subtotal
  const lockedSeatIds = useMemo(() => lockedSeats.map((seat) => seat.id), [lockedSeats])
  const lockExpiryTimestamp = useMemo(() => {
    const timestamps = lockedSeats
      .map((seat) => (seat.lock_expires_at ? new Date(seat.lock_expires_at).getTime() : null))
      .filter((value): value is number => Boolean(value) && !Number.isNaN(value))

    if (timestamps.length === 0) return null
    return Math.min(...timestamps)
  }, [lockedSeats])
  const countdownLabel = remainingSeconds === null
    ? '--:--'
    : `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`
  const isProfileComplete = useMemo(() => {
    return (
      formData.fullName.trim().length > 0 &&
      formData.email.trim().length > 0 &&
      formData.phone.trim().length > 0
    )
  }, [formData.email, formData.fullName, formData.phone])
  const isCheckoutDisabled = lockedSeats.length === 0 || remainingSeconds === 0 || !isProfileComplete

  useEffect(() => {
    latestShowIdRef.current = Number.isNaN(showId) ? null : showId
    latestLockedSeatIdsRef.current = lockedSeatIds
  }, [showId, lockedSeatIds])

  useEffect(() => {
    if (!lockExpiryTimestamp) {
      setRemainingSeconds(null)
      return
    }

    const updateRemaining = () => {
      const seconds = Math.max(0, Math.floor((lockExpiryTimestamp - Date.now()) / 1000))
      setRemainingSeconds(seconds)
    }

    updateRemaining()
    const timer = window.setInterval(updateRemaining, 1000)
    return () => window.clearInterval(timer)
  }, [lockExpiryTimestamp])

  useEffect(() => {
    const handleBrowserUnload = () => {
      if (checkoutCompletedRef.current || locksReleasedRef.current) return

      const currentShowId = latestShowIdRef.current
      const currentSeatIds = latestLockedSeatIdsRef.current
      if (!currentShowId || currentSeatIds.length === 0) return

      locksReleasedRef.current = true
      void bookingApi.release(currentShowId, currentSeatIds).catch(() => undefined)
    }

    window.addEventListener('pagehide', handleBrowserUnload)
    window.addEventListener('beforeunload', handleBrowserUnload)

    return () => {
      window.removeEventListener('pagehide', handleBrowserUnload)
      window.removeEventListener('beforeunload', handleBrowserUnload)
    }
  }, [])

  const handleInputChange = (field: 'fullName' | 'email' | 'phone', value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleBackToSeatSelection = async () => {
    if (!eventKey) {
      navigate('/search')
      return
    }

    if (!showId || Number.isNaN(showId) || lockedSeatIds.length === 0 || locksReleasedRef.current) {
      navigate(`/shows/${showId}/seats`)
      return
    }

    try {
      await releaseSeats(showId, lockedSeatIds)
      locksReleasedRef.current = true
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể trả lại các ghế đang giữ')
    } finally {
      navigate(`/shows/${showId}/seats`)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    if (!showId || Number.isNaN(showId)) {
      setErrorMessage('Thiếu thông tin show. Vui lòng chọn ghế lại từ đầu.')
      return
    }

    if (!formData.fullName.trim() || !formData.email.trim() || !formData.phone.trim()) {
      setErrorMessage('Vui lòng nhập đầy đủ họ tên, email và số điện thoại trước khi thanh toán.')
      return
    }

    try {
      setErrorMessage('')
      const queueToken = showId ? queueStorage.getToken(showId) ?? undefined : undefined
      const result = await checkout(showId, queueToken, selectedDiscountCode || undefined)
      checkoutCompletedRef.current = true
      locksReleasedRef.current = true
      queueStorage.clearToken(showId)
      navigate('/confirmation', {
        state: {
          order: result,
          eventKey,
          showId,
          showTitle: matrix?.show_title,
          eventTitle: matrix?.event_title,
          showStartAt: null,
          profile: formData,
          lockedSeats,
        },
      })
    } catch (error) {
      if (showId && !Number.isNaN(showId) && isRecoverableQueueTokenError(error)) {
        queueStorage.clearToken(showId)
        setErrorMessage('Phien queue khong con hop le. Vui long quay lai hang doi de nhan luot moi.')
        navigate(`/queue?showId=${showId}${eventKey ? `&eventKey=${encodeURIComponent(eventKey)}` : ''}`)
        return
      }

      setErrorMessage(extractApiErrorMessage(error, 'Thanh toán thất bại'))
    }
  }

  return (
    <div className="min-h-screen customer-text-body font-body">
      <main className="max-w-screen-2xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <form className="lg:col-span-7 space-y-8" onSubmit={handleSubmit}>
            <section>
              <h2 className="text-3xl font-headline font-bold tracking-tight mb-8">Thông tin người mua</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-headline uppercase tracking-[0.2em] text-slate-500 font-bold">Họ tên</label>
                  <Input
                    className="w-full bg-[var(--customer-bg-surface)] border-none rounded-xl py-4 px-5 customer-text-body"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-headline uppercase tracking-[0.2em] text-slate-500 font-bold">Địa chỉ email</label>
                  <Input
                    type="email"
                    className="w-full bg-[var(--customer-bg-surface)] border-none rounded-xl py-4 px-5 customer-text-body"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-[10px] font-headline uppercase tracking-[0.2em] text-slate-500 font-bold">Số điện thoại</label>
                  <Input
                    type="tel"
                    className="w-full bg-[var(--customer-bg-surface)] border-none rounded-xl py-4 px-5 customer-text-body"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="+84 900 000 000"
                  />
                </div>
              </div>
            </section>

            <section className="backdrop-blur-xl customer-bg-surface p-6 rounded-2xl border border-[var(--customer-bg-opp)]">
              <div className="flex items-center gap-2 mb-4 customer-text-body">
                <CreditCard className="w-5 h-5 text-primary" />
                <p className="font-semibold">Thanh toán mô phỏng</p>
              </div>
              <p className="text-sm text-slate-500">Luồng demo này chỉ xác nhận thanh toán ở phía server, không xử lý thẻ thật.</p>
            </section>

            {errorMessage && (
              <div className="flex items-center gap-2 text-sm text-amber-300">
                <AlertCircle className="w-4 h-4" />
                {errorMessage}
              </div>
            )}

            <Button
              type="submit"
              className="w-full py-6 rounded-2xl bg-gradient-to-r from-primary to-primary-container text-on-primary-container font-headline font-black uppercase tracking-widest text-lg flex items-center justify-center gap-3"
              disabled={isCheckoutDisabled}
              isLoading={isSubmitting}
            >
              Xác nhận thanh toán
              <Rocket className="h-6 w-6" />
            </Button>
          </form>

          <aside className="lg:col-span-5 sticky top-28">
            <div className="backdrop-blur-xl customer-bg-surface p-8 rounded-3xl overflow-hidden relative border border-[var(--customer-bg-opp)]">
              <h3 className="text-xl font-headline font-bold uppercase tracking-widest mb-6 border-b border-white/5 pb-4">Tóm tắt đơn hàng</h3>

              <div className="space-y-3 mb-8 max-h-64 overflow-auto">
                {lockedSeats.length === 0 ? (
                  <p className="text-slate-400 text-sm">Không tìm thấy ghế đang giữ. Vui lòng quay lại bước chọn ghế.</p>
                ) : (
                  lockedSeats.map((seat: Seat) => (
                    <div key={seat.id} className="flex justify-between items-center text-sm customer-bg-page rounded-lg px-3 py-2">
                      <span>{seat.seat_label}</span>
                      <span>{formatCurrencyVnd(seat.price)}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3 mb-8">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Tạm tính ({lockedSeats.length} ghế)</span>
                  <span className="text-white">{formatCurrencyVnd(subtotal)}</span>
                </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Thời gian giữ ghế</span>
                <span className={remainingSeconds === 0 ? 'text-red-300' : 'text-secondary'}>{countdownLabel}</span>
              </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-[10px] font-headline font-black uppercase tracking-[0.3em] text-slate-500">Tổng thanh toán</span>
                    <p className="text-4xl font-headline font-black customer-text-header mt-1">{formatCurrencyVnd(total)}</p>
                  </div>
                  <div className="bg-white p-2 rounded-lg">
                    <div className="w-16 h-16 bg-slate-100 flex items-center justify-center">
                      <QrCode className="text-slate-900 text-3xl" />
                    </div>
                  </div>
                </div>
              </div>

              {eventKey && (
                <div className="mt-6 flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wider">
                  <MapPin className="w-4 h-4" />
                  {eventKey}
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center gap-4 bg-secondary/5 border border-secondary/20 p-4 rounded-2xl">
              <Timer className="text-secondary h-5 w-5" />
              <p className="text-xs text-secondary font-medium">Ghế chỉ được giữ trong một khoảng thời gian giới hạn.</p>
            </div>
            <div className="block mt-4">
              <Button variant="outline" className="w-full" onClick={() => void handleBackToSeatSelection()} isLoading={isReleasing}>
                Quay lại chọn ghế
              </Button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
