import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/Button'
import { useLockSeats } from '@/features/booking/hooks/useBooking'
import { useEventSeats } from '@/features/events/hooks/useEvents'
import { useAuth } from '@/context/AuthContext'
import { queueStorage } from '@/lib/storage'
import type { Seat, SeatZone } from '@/types'
import { AlertCircle, CheckCircle2, Clock3, MapPin, Ticket } from 'lucide-react'

function seatClass(seat: Seat, isSelected: boolean) {
  if (seat.status === 'sold') return 'bg-slate-700 text-slate-500 cursor-not-allowed'
  if (seat.status === 'locked' && !seat.is_locked_by_me) return 'bg-amber-900/60 text-amber-300 cursor-not-allowed'
  if (isSelected) return 'bg-primary text-white border-primary'
  if (seat.is_locked_by_me) return 'bg-emerald-700 text-white border-emerald-500'
  return 'bg-slate-800 text-slate-200 hover:bg-slate-700 border-white/10'
}

function groupSeatsByZone(seats: Seat[]) {
  return seats.reduce<Record<number, Seat[]>>((accumulator, seat) => {
    if (!accumulator[seat.zone_id]) {
      accumulator[seat.zone_id] = []
    }
    accumulator[seat.zone_id].push(seat)
    return accumulator
  }, {})
}

export default function SeatSelection() {
  const COUNTDOWN_SECONDS = 10 * 60
  const { eventKey } = useParams<{ eventKey: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const { seats: matrix, isLoading, error, refetch } = useEventSeats(eventKey)
  const { isLoading: isLocking, lockSeats } = useLockSeats()

  const [selectedSeatIds, setSelectedSeatIds] = useState<number[]>([])
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [remainingSeconds, setRemainingSeconds] = useState(COUNTDOWN_SECONDS)

  const queueToken = eventKey ? queueStorage.getToken(eventKey) : null

  const seatsByZone = useMemo(() => groupSeatsByZone(matrix?.seats ?? []), [matrix?.seats])

  const selectedSeats = useMemo(
    () =>
      (matrix?.seats ?? []).filter((seat) => selectedSeatIds.includes(seat.id)).sort((a, b) => a.seat_label.localeCompare(b.seat_label)),
    [matrix?.seats, selectedSeatIds],
  )

  const subtotal = selectedSeats.reduce((sum, seat) => sum + Number(seat.price), 0)
  const isCountdownExpired = remainingSeconds <= 0

  useEffect(() => {
    setRemainingSeconds(COUNTDOWN_SECONDS)
  }, [eventKey])

  useEffect(() => {
    if (remainingSeconds <= 0) return
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => Math.max(prev - 1, 0))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [remainingSeconds])

  const countdownLabel = `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`

  const toggleSeat = (seat: Seat) => {
    if (seat.status === 'sold') return
    if (seat.status === 'locked' && !seat.is_locked_by_me) return

    setSelectedSeatIds((prev) => {
      if (prev.includes(seat.id)) {
        return prev.filter((id) => id !== seat.id)
      }
      return [...prev, seat.id]
    })
  }

  const handleLockSeats = async () => {
    if (!matrix || selectedSeatIds.length === 0 || isCountdownExpired) return
    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    try {
      const response = await lockSeats(matrix.event_id, selectedSeatIds, queueToken ?? undefined)
      setStatusMessage(response.message)
      const lockedSeatIds = response.locked_seat_ids ?? []
      setSelectedSeatIds([])
      await refetch()

      if (lockedSeatIds.length > 0) {
        navigate(`/checkout?eventId=${matrix.event_id}&eventKey=${matrix.event_slug}`, {
          state: { lockedSeatIds },
        })
      }
    } catch (lockError) {
      setStatusMessage(lockError instanceof Error ? lockError.message : 'Unable to lock seats')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-24 text-center text-slate-300">Loading seat map...</main>
      </div>
    )
  }

  if (error || !matrix) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-24 text-center">
          <p className="text-red-400 mb-6">{error ?? 'Cannot load seat map'}</p>
          <Link to="/search">
            <Button>Back to Search</Button>
          </Link>
        </main>
      </div>
    )
  }

  if (matrix.queue_enabled && !queueToken) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <Navbar />
        <main className="max-w-3xl mx-auto px-6 py-24 text-center space-y-4">
          <p className="text-amber-300">This event requires queue admission before seat selection.</p>
          <Link to={`/queue?eventKey=${matrix.event_slug}`}>
            <Button>Join Queue</Button>
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />

      <main className="max-w-screen-2xl mx-auto px-6 py-10 grid grid-cols-1 xl:grid-cols-3 gap-8">
        <section className="xl:col-span-2 rounded-xl border border-white/10 bg-slate-900/70 p-6">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-black">Seat Selection</h1>
              <p className="text-slate-400 text-sm mt-1">Choose available seats and lock before checkout.</p>
            </div>
            <Link to={`/event/${matrix.event_slug}`}>
              <Button variant="outline" size="sm">
                Back To Event
              </Button>
            </Link>
          </div>

          <div className="space-y-6">
            {matrix.zones.map((zone: SeatZone) => {
              const zoneSeats = seatsByZone[zone.id] ?? []
              return (
                <div key={zone.id} className="rounded-lg border border-white/10 bg-slate-950/40 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{zone.name}</h3>
                      <p className="text-xs text-slate-400">
                        {zone.code} | ${Number(zone.price).toFixed(2)}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">{zoneSeats.length} seats</span>
                  </div>

                  <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
                    {zoneSeats.map((seat) => {
                      const isSelected = selectedSeatIds.includes(seat.id)
                      return (
                        <button
                          key={seat.id}
                          type="button"
                          onClick={() => toggleSeat(seat)}
                          className={`text-xs px-2 py-1.5 rounded border transition-colors ${seatClass(seat, isSelected)}`}
                          disabled={seat.status === 'sold' || (seat.status === 'locked' && !seat.is_locked_by_me)}
                          title={`${seat.seat_label} - $${Number(seat.price).toFixed(2)}`}
                        >
                          {seat.seat_label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-6 space-y-4">
            <h2 className="text-lg font-bold">Order Summary</h2>

            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wider">
              <MapPin className="w-4 h-4" />
              {matrix.event_slug}
            </div>

            <div className="max-h-56 overflow-auto space-y-2">
              {selectedSeats.length === 0 ? (
                <p className="text-sm text-slate-400">No seats selected yet.</p>
              ) : (
                selectedSeats.map((seat) => (
                  <div key={seat.id} className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{seat.seat_label}</p>
                      <p className="text-xs text-slate-400">${Number(seat.price).toFixed(2)}</p>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => setSelectedSeatIds((prev) => prev.filter((id) => id !== seat.id))}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-white/10 pt-4 space-y-2">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className={`flex items-center gap-2 text-xs ${isCountdownExpired ? 'text-red-300' : 'text-slate-400'}`}>
                <Clock3 className="w-4 h-4" />
                Countdown: {countdownLabel}
              </div>
            </div>

            <Button className="w-full" onClick={handleLockSeats} disabled={selectedSeatIds.length === 0 || isCountdownExpired} isLoading={isLocking}>
              <Ticket className="w-4 h-4" />
              Lock Selected Seats
            </Button>

            {!isAuthenticated && (
              <p className="text-xs text-amber-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Login is required before locking seats.
              </p>
            )}

            {statusMessage && (
              <p className="text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {statusMessage}
              </p>
            )}

            {isCountdownExpired && (
              <p className="text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Hết thời gian giữ chỗ (10 phút). Vui lòng tải lại trang để chọn lại ghế.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4 text-xs text-slate-400 space-y-2">
            <p>Legend:</p>
            <p>Available: dark button</p>
            <p>Locked by other users: amber</p>
            <p>Sold: dimmed</p>
            <p>Locked by you: green</p>
            <p>Selected now: red</p>
          </div>
        </aside>
      </main>

      <Footer />
    </div>
  )
}
