import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '@/context/AuthContext'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useCheckout, useReleaseSeats } from '@/features/booking/hooks/useBooking'
import { useShowSeats } from '@/features/events/hooks/useEvents'
import { bookingApi } from '@/lib/api'
import { queueStorage } from '@/lib/storage'
import type { Seat } from '@/types'
import { AlertCircle, CreditCard, MapPin, QrCode, Rocket, Timer } from 'lucide-react'

interface CheckoutLocationState {
  lockedSeatIds?: number[]
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

  const [termsAccepted, setTermsAccepted] = useState(false)
  const [formData, setFormData] = useState({
    fullName: user?.full_name ?? '',
    email: user?.email ?? '',
    phone: '',
  })
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [selectedDiscountCode, setSelectedDiscountCode] = useState<string>('')
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)

  const { seats: matrix } = useShowSeats(showId)
  const checkoutCompletedRef = useRef(false)
  const locksReleasedRef = useRef(false)
  const latestShowIdRef = useRef<number | null>(null)
  const latestLockedSeatIdsRef = useRef<number[]>([])

  const lockedSeats = useMemo(() => {
    const allSeats = matrix?.seats ?? []

    if (state.lockedSeatIds && state.lockedSeatIds.length > 0) {
      return allSeats.filter((seat) => state.lockedSeatIds?.includes(seat.id))
    }

    return allSeats.filter((seat) => seat.is_locked_by_me)
  }, [matrix?.seats, state.lockedSeatIds])

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

  useEffect(() => () => {
    if (checkoutCompletedRef.current || locksReleasedRef.current) return
    const currentShowId = latestShowIdRef.current
    const currentSeatIds = latestLockedSeatIdsRef.current
    if (!currentShowId || currentSeatIds.length === 0) return
    locksReleasedRef.current = true
    void bookingApi.release(currentShowId, currentSeatIds).catch(() => undefined)
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
      setErrorMessage(error instanceof Error ? error.message : 'Failed to release held seats')
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
      setErrorMessage('Missing show information. Please reselect your seats.')
      return
    }

    if (!termsAccepted) {
      setErrorMessage('Please accept terms before checkout.')
      return
    }

    try {
      setErrorMessage('')
      const queueToken = showId ? queueStorage.getToken(showId) ?? undefined : undefined
      const result = await checkout(showId, queueToken, selectedDiscountCode || undefined)
      checkoutCompletedRef.current = true
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
      setErrorMessage(error instanceof Error ? error.message : 'Checkout failed')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white font-body">
      <Navbar />

      <main className="max-w-screen-2xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <form className="lg:col-span-7 space-y-8" onSubmit={handleSubmit}>
            <section>
              <h2 className="text-3xl font-headline font-bold tracking-tight mb-8">Personal Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-headline uppercase tracking-[0.2em] text-slate-400 font-bold">Full Name</label>
                  <Input
                    className="w-full bg-slate-800 border-none rounded-xl py-4 px-5 text-white"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-headline uppercase tracking-[0.2em] text-slate-400 font-bold">Email Address</label>
                  <Input
                    type="email"
                    className="w-full bg-slate-800 border-none rounded-xl py-4 px-5 text-white"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-[10px] font-headline uppercase tracking-[0.2em] text-slate-400 font-bold">Phone Number</label>
                  <Input
                    type="tel"
                    className="w-full bg-slate-800 border-none rounded-xl py-4 px-5 text-white"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="+84 900 000 000"
                  />
                </div>
              </div>
            </section>

            <section className="backdrop-blur-xl bg-slate-900/70 p-6 rounded-2xl border border-white/10">
              <div className="flex items-center gap-2 mb-4 text-slate-300">
                <CreditCard className="w-5 h-5 text-primary" />
                <p className="font-semibold">Demo Payment</p>
              </div>
              <p className="text-sm text-slate-400">This demo uses server-side checkout. No card info is processed.</p>
            </section>

            <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
              <input
                className="mt-1 rounded bg-slate-800 border-white/10 text-primary focus:ring-primary"
                id="terms"
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
              <label className="text-sm text-slate-400 leading-relaxed" htmlFor="terms">
                I agree to the terms and confirm this purchase.
              </label>
            </div>

            {errorMessage && (
              <div className="flex items-center gap-2 text-sm text-amber-300">
                <AlertCircle className="w-4 h-4" />
                {errorMessage}
              </div>
            )}

            <Button
              type="submit"
              className="w-full py-6 rounded-2xl bg-gradient-to-r from-primary to-primary-container text-on-primary-container font-headline font-black uppercase tracking-widest text-lg flex items-center justify-center gap-3"
              disabled={!termsAccepted || lockedSeats.length === 0 || remainingSeconds === 0}
              isLoading={isSubmitting}
            >
              Complete Purchase
              <Rocket className="h-6 w-6" />
            </Button>
          </form>

          <aside className="lg:col-span-5 sticky top-28">
            <div className="backdrop-blur-xl bg-slate-900/80 p-8 rounded-3xl overflow-hidden relative border border-white/10">
              <h3 className="text-xl font-headline font-bold uppercase tracking-widest mb-6 border-b border-white/5 pb-4">Order Summary</h3>

              <div className="space-y-3 mb-8 max-h-64 overflow-auto">
                {lockedSeats.length === 0 ? (
                  <p className="text-slate-400 text-sm">No locked seats found. Please go back and lock seats first.</p>
                ) : (
                  lockedSeats.map((seat: Seat) => (
                    <div key={seat.id} className="flex justify-between items-center text-sm bg-slate-800/60 rounded-lg px-3 py-2">
                      <span>{seat.seat_label}</span>
                      <span>${Number(seat.price).toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3 mb-8">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Subtotal ({lockedSeats.length} seats)</span>
                  <span className="text-white">${subtotal.toFixed(2)}</span>
                </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Hold Timer</span>
                <span className={remainingSeconds === 0 ? 'text-red-300' : 'text-secondary'}>{countdownLabel}</span>
              </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-[10px] font-headline font-black uppercase tracking-[0.3em] text-slate-500">Total Amount</span>
                    <p className="text-4xl font-headline font-black text-white mt-1">${total.toFixed(2)}</p>
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
              <div className="mt-4">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Voucher</label>
                <Input
                  className="mt-2 w-full rounded-lg border bg-slate-800 border-white/20 px-3 py-2 text-white"
                  value={selectedDiscountCode}
                  onChange={(e) => setSelectedDiscountCode(e.target.value)}
                  placeholder="Enter voucher code"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center gap-4 bg-secondary/5 border border-secondary/20 p-4 rounded-2xl">
              <Timer className="text-secondary h-5 w-5" />
              <p className="text-xs text-secondary font-medium">Seats remain locked only for a limited time.</p>
            </div>
            <div className="block mt-4">
              <Button variant="outline" className="w-full" onClick={() => void handleBackToSeatSelection()} isLoading={isReleasing}>
                Back To Seat Selection
              </Button>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}
