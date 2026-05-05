import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/Button'
import { useLockSeats, useReleaseSeats } from '@/features/booking/hooks/useBooking'
import { useEventSeats } from '@/features/events/hooks/useEvents'
import { useAuth } from '@/context/AuthContext'
import { useWebSocketHeartbeat } from '@/hooks/useWebSocketHeartbeat'
import { authStorage, queueStorage } from '@/lib/storage'
import { WS_BASE_URL } from '@/constants'
import type { Seat, SeatZone } from '@/types'
import { AlertCircle, CheckCircle2, Clock3, MapPin, Ticket } from 'lucide-react'

function seatClass(seat: Seat, isPending: boolean) {
  if (isPending) return 'bg-cyan-700 text-white border-cyan-400 cursor-wait'
  if (seat.status === 'sold') return 'bg-slate-700 text-slate-500 cursor-not-allowed'
  if (seat.status === 'locked' && !seat.is_locked_by_me) return 'bg-slate-700 text-slate-400 cursor-not-allowed'
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
  const { eventKey } = useParams<{ eventKey: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const { seats: matrix, isLoading, error, refetch } = useEventSeats(eventKey, { pollIntervalMs: 3000 })
  const { isLoading: isLocking, lockSeats } = useLockSeats()
  const { isLoading: isReleasing, releaseSeats } = useReleaseSeats()

  const [pendingSeatIds, setPendingSeatIds] = useState<number[]>([])
  const pendingSeatIdsRef = useRef<Set<number>>(new Set())
  const [statusMessage, setStatusMessage] = useState<string>('')

  const queueToken = eventKey ? queueStorage.getToken(eventKey) : null
  const authToken = authStorage.getToken()
  const wsUrl = eventKey && authToken ? `${WS_BASE_URL}/events/${eventKey}/seats?token=${encodeURIComponent(authToken)}` : null

  const seatsByZone = useMemo(() => groupSeatsByZone(matrix?.seats ?? []), [matrix?.seats])

  const heldSeats = useMemo(
    () =>
      (matrix?.seats ?? []).filter((seat) => seat.is_locked_by_me).sort((a, b) => a.seat_label.localeCompare(b.seat_label)),
    [matrix?.seats],
  )

  const subtotal = heldSeats.reduce((sum, seat) => sum + Number(seat.price), 0)

  const handleSeatClick = async (seat: Seat) => {
    if (seat.status === 'sold') return
    if (seat.status === 'locked' && !seat.is_locked_by_me) return
    if (!matrix) return
    if (pendingSeatIdsRef.current.has(seat.id)) return

    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    pendingSeatIdsRef.current.add(seat.id)
    setPendingSeatIds((previous) => [...previous, seat.id])
    try {
      if (seat.is_locked_by_me) {
        const message = await releaseSeats(matrix.event_id, [seat.id])
        setStatusMessage(message)
      } else {
        const response = await lockSeats(matrix.event_id, [seat.id], queueToken ?? undefined)
        if (response.locked_seat_ids.includes(seat.id)) {
          setStatusMessage(`${seat.seat_label} is held for your checkout.`)
        } else {
          setStatusMessage(`${seat.seat_label} was just taken by another customer.`)
        }
      }
      await refetch(false)
    } catch (lockError) {
      setStatusMessage(lockError instanceof Error ? lockError.message : 'Unable to update seat hold')
    } finally {
      pendingSeatIdsRef.current.delete(seat.id)
      setPendingSeatIds((previous) => previous.filter((id) => id !== seat.id))
    }
  }

  const handleCheckout = () => {
    if (!matrix || heldSeats.length === 0) return
    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    navigate(`/checkout?eventId=${matrix.event_id}&eventKey=${matrix.event_slug}`, {
      state: { lockedSeatIds: heldSeats.map((seat) => seat.id) },
    })
  }

  const handleSeatUpdates = useCallback(
    (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as { type?: string }
        if (message.type === 'seat_changes') {
          void refetch(false)
        }
      } catch {
        // Ignore non-JSON heartbeat responses.
      }
    },
    [refetch],
  )

  useWebSocketHeartbeat({ url: wsUrl, onMessage: handleSeatUpdates })

  if (isLoading) {
    return <GlobalLoader />
  }

  if (error || !seatMap) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-24 text-center">
          <p className="mb-6 text-red-400">{error ?? 'Cannot load seat map'}</p>
          <Link to="/search">
            <Button>Back to Search</Button>
          </Link>
        </main>
      </div>
    )
  }

  if (seatMap.queue_enabled && !queueToken) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <Navbar />
        <main className="mx-auto max-w-3xl space-y-4 px-6 py-24 text-center">
          <p className="text-amber-300">This event requires queue admission before seat selection.</p>
          <Link to={`/queue?eventKey=${seatMap.event_slug}`}>
            <Button>Join Queue</Button>
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />

      <main className="mx-auto grid max-w-screen-2xl grid-cols-1 gap-8 px-6 py-10 xl:grid-cols-[1.65fr_0.85fr]">
        <section className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Booking Flow</p>
              <h1 className="mt-2 text-3xl font-black">Choose your seats on the map</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Pick seats on the map, then continue to checkout to hold them for payment.
              </p>
            </div>
            <Link to={`/event/${seatMap.event_slug}`}>
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
                      const isPending = pendingSeatIds.includes(seat.id)
                      return (
                        <button
                          key={seat.id}
                          type="button"
                          onClick={() => void handleSeatClick(seat)}
                          className={`text-xs px-2 py-1.5 rounded border transition-colors ${seatClass(seat, isPending)}`}
                          disabled={isPending || seat.status === 'sold' || (seat.status === 'locked' && !seat.is_locked_by_me)}
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
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-500">
              <MapPin className="h-4 w-4" />
              {seatMap.venue_name}
            </div>

            <div className="max-h-56 overflow-auto space-y-2">
              {heldSeats.length === 0 ? (
                <p className="text-sm text-slate-400">No held seats yet.</p>
              ) : (
                heldSeats.map((seat) => (
                  <div key={seat.id} className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{seat.seat_label}</p>
                      <p className="text-xs text-slate-400">${Number(seat.price).toFixed(2)}</p>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => void handleSeatClick(seat)}
                    >
                      Release
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <SeatSelectionSummary
              selectedSeats={selectedSeats}
              lockedSeats={heldSeats}
              subtotal={subtotal}
            />

            <div className="mt-6 space-y-3">
              <Button className="w-full" onClick={() => void handleProceedToCheckout()} disabled={(selectedSeatIds.length === 0 && heldSeats.length === 0) || mappedSeatCount === 0} isLoading={isLocking}>
                <Ticket className="h-4 w-4" />
                Continue To Checkout
              </Button>
            </div>

            <Button className="w-full" onClick={handleCheckout} disabled={heldSeats.length === 0} isLoading={isLocking || isReleasing}>
              <Ticket className="w-4 h-4" />
              Continue To Checkout
            </Button>

            {!isAuthenticated && (
              <p className="mt-4 flex items-center gap-2 text-xs text-amber-300">
                <AlertCircle className="h-4 w-4" />
                Login is required before locking seats.
              </p>
            )}

            {statusMessage && (
              <p className="mt-4 flex items-center gap-2 text-xs text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                {statusMessage}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4 text-xs text-slate-400 space-y-2">
            <p>Legend:</p>
            <p>Available: dark button</p>
            <p>Held by other users: gray</p>
            <p>Sold: dimmed</p>
            <p>Held by you: green</p>
            <p>Updating: blue</p>
          </div>
        </aside>
      </main>

      <Footer />
    </div>
  )
}
