import dayjs from 'dayjs'
import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { SeatLegend } from '../components/SeatLegend'
import { useAuth } from '../hooks/useAuth'
import { useWebSocketHeartbeat } from '../hooks/useWebSocketHeartbeat'
import { bookingApi, eventApi, extractApiErrorMessage, queueApi } from '../lib/api'
import { queueStorage } from '../lib/storage'
import type { CheckoutResponse, EventDetail, Seat } from '../types'

interface SeatUpdatePayload {
  id: number
  status: 'available' | 'locked' | 'sold'
  lock_expires_at: string | null
  locked_by_user_id: number | null
}

const softSeatPalette = ['#ffd9de', '#fff0c8', '#dff7d8', '#e7dcff', '#d8f3ff', '#ffe1ef'] as const

function softenHexColor(hexColor: string, amount = 0.35): string {
  const clean = hexColor.replace('#', '')
  if (![3, 6].includes(clean.length)) return hexColor

  const expanded = clean.length === 3 ? clean.split('').map((char) => `${char}${char}`).join('') : clean
  const red = Number.parseInt(expanded.slice(0, 2), 16)
  const green = Number.parseInt(expanded.slice(2, 4), 16)
  const blue = Number.parseInt(expanded.slice(4, 6), 16)

  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount)
  return `#${mix(red).toString(16).padStart(2, '0')}${mix(green).toString(16).padStart(2, '0')}${mix(blue).toString(16).padStart(2, '0')}`
}

function getReadableTextColor(hexColor: string): string {
  const clean = hexColor.replace('#', '')
  if (![3, 6].includes(clean.length)) return '#002462'

  const expanded = clean.length === 3 ? clean.split('').map((char) => `${char}${char}`).join('') : clean
  const red = Number.parseInt(expanded.slice(0, 2), 16)
  const green = Number.parseInt(expanded.slice(2, 4), 16)
  const blue = Number.parseInt(expanded.slice(4, 6), 16)

  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
  return luminance > 0.62 ? '#0f172a' : '#ffffff'
}

export function SeatBookingPage() {
  const { eventKey = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, token, isAuthenticated, isAdmin } = useAuth()

  const [event, setEvent] = useState<EventDetail | null>(null)
  const [seats, setSeats] = useState<Seat[]>([])
  const [loading, setLoading] = useState(true)
  const [busySeatId, setBusySeatId] = useState<number | null>(null)
  const [guestPreviewSeatIds, setGuestPreviewSeatIds] = useState<number[]>([])
  const [inspectedSeatIds, setInspectedSeatIds] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [checkoutData, setCheckoutData] = useState<CheckoutResponse | null>(null)
  const [resettingSeats, setResettingSeats] = useState(false)
  const [nowTick, setNowTick] = useState(() => Date.now())

  const queueTokenFromQuery = useMemo(
    () => new URLSearchParams(location.search).get('queue_token') ?? undefined,
    [location.search],
  )

  const queueToken = useMemo(() => {
    const persisted = queueStorage.getToken(eventKey)
    return persisted ?? queueTokenFromQuery
  }, [eventKey, queueTokenFromQuery])

  useEffect(() => {
    if (!queueTokenFromQuery) return

    queueStorage.setToken(eventKey, queueTokenFromQuery)

    // Persist token then remove it from URL to prevent stale browser-back bypasses.
    navigate(`/events/${eventKey}/seats`, { replace: true })
  }, [eventKey, navigate, queueTokenFromQuery])

  const wsBase = import.meta.env.VITE_WS_BASE_URL ?? 'ws://localhost:8000/ws'

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [eventResponse, seatMatrixResponse] = await Promise.all([
        eventApi.detail(eventKey),
        eventApi.seats(eventKey),
      ])

      setEvent(eventResponse)
      setSeats(seatMatrixResponse.seats)
      setGuestPreviewSeatIds([])
      setInspectedSeatIds([])

      if (isAuthenticated && !isAdmin && eventResponse.queue_enabled && !queueToken) {
        navigate(`/events/${eventKey}/queue`, { replace: true })
        return
      }
    } catch (caughtError) {
      setError(extractApiErrorMessage(caughtError, 'Unable to load seat map. You may need queue access token.'))
    } finally {
      setLoading(false)
    }
  }, [eventKey, isAdmin, isAuthenticated, navigate, queueToken])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  useEffect(() => {
    if (!event?.queue_enabled || !queueToken) return

    const interval = window.setInterval(() => {
      void queueApi.heartbeat(eventKey, queueToken)
    }, 20000)

    return () => {
      window.clearInterval(interval)
    }
  }, [event?.queue_enabled, eventKey, queueToken])

  useEffect(() => {
    const interval = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  useWebSocketHeartbeat({
    url: token ? `${wsBase}/events/${eventKey}/seats?token=${token}` : null,
    onMessage: (eventMessage) => {
      try {
        const data = JSON.parse(eventMessage.data) as { type: string; payload: SeatUpdatePayload[] }
        if (data.type !== 'seat_changes') return

        setSeats((prevSeats) =>
          prevSeats.map((seat) => {
            const update = data.payload.find((item) => item.id === seat.id)
            if (!update) return seat

            return {
              ...seat,
              status: update.status,
              lock_expires_at: update.lock_expires_at,
              is_locked_by_me: update.locked_by_user_id === user?.id,
            }
          }),
        )
      } catch {
        // Ignore non-json ping or malformed payload.
      }
    },
  })

  const selectedSeats = useMemo(() => seats.filter((seat) => seat.is_locked_by_me && seat.status === 'locked'), [seats])
  const guestPreviewSeats = useMemo(
    () => seats.filter((seat) => guestPreviewSeatIds.includes(seat.id) && seat.status !== 'sold'),
    [guestPreviewSeatIds, seats],
  )
  const inspectedSeats = useMemo(
    () => seats.filter((seat) => inspectedSeatIds.includes(seat.id)),
    [inspectedSeatIds, seats],
  )
  const displaySeats = useMemo(() => {
    if (isAdmin) {
      return inspectedSeats
    }
    if (isAuthenticated) {
      return selectedSeats
    }
    return guestPreviewSeats
  }, [guestPreviewSeats, inspectedSeats, isAdmin, isAuthenticated, selectedSeats])
  const totalPrice = useMemo(
    () => displaySeats.reduce((sum, seat) => sum + Number(seat.price), 0),
    [displaySeats],
  )

  const holdDeadline = useMemo(() => {
    if (selectedSeats.length === 0) return null
    return selectedSeats
      .map((seat) => seat.lock_expires_at)
      .filter(Boolean)
      .sort()[0]
  }, [selectedSeats])

  const holdCountdown = useMemo(() => {
    if (!holdDeadline) return '--:--'
    const seconds = dayjs(holdDeadline).diff(dayjs(nowTick), 'second')
    if (seconds <= 0) return '00:00'

    const minutePart = String(Math.floor(seconds / 60)).padStart(2, '0')
    const secondPart = String(seconds % 60).padStart(2, '0')
    return `${minutePart}:${secondPart}`
  }, [holdDeadline, nowTick])

  const handleSeatClick = async (seat: Seat) => {
    if (!event || busySeatId) return

    if (isAdmin) {
      setInspectedSeatIds((previousIds) =>
        previousIds.includes(seat.id) ? previousIds.filter((id) => id !== seat.id) : [...previousIds, seat.id],
      )
      return
    }

    if (!isAuthenticated) {
      if (seat.status === 'sold') return
      setGuestPreviewSeatIds((previousIds) =>
        previousIds.includes(seat.id) ? previousIds.filter((id) => id !== seat.id) : [...previousIds, seat.id],
      )
      return
    }

    if (seat.status === 'sold') return

    setBusySeatId(seat.id)
    setError(null)

    try {
      if (seat.status === 'locked' && seat.is_locked_by_me) {
        await bookingApi.release(event.id, [seat.id])
        setSeats((prevSeats) =>
          prevSeats.map((item) =>
            item.id === seat.id
              ? { ...item, status: 'available', is_locked_by_me: false, lock_expires_at: null }
              : item,
          ),
        )
        return
      }

      if (seat.status === 'locked' && !seat.is_locked_by_me) {
        setError(`Seat ${seat.seat_label} is already locked by another user.`)
        return
      }

      const lockResult = await bookingApi.lock(event.id, [seat.id], queueToken)
      if (lockResult.failed_seat_ids.length > 0) {
        setError(`Seat ${seat.seat_label} was taken by another user.`)
      }

      if (lockResult.locked_seat_ids.length > 0) {
        setSeats((prevSeats) =>
          prevSeats.map((item) =>
            item.id === seat.id
              ? {
                  ...item,
                  status: 'locked',
                  is_locked_by_me: true,
                  lock_expires_at: dayjs().add(event.hold_minutes, 'minute').toISOString(),
                }
              : item,
          ),
        )
      }
    } catch (caughtError) {
      setError(extractApiErrorMessage(caughtError, 'Failed to lock seat. Please retry.'))
      void fetchAll()
    } finally {
      setBusySeatId(null)
    }
  }

  const handleCheckout = async () => {
    if (!event) return

    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    try {
      const checkout = await bookingApi.checkout(event.id, queueToken)
      setCheckoutData(checkout)
      queueStorage.clearToken(eventKey)
      void fetchAll()
    } catch (caughtError) {
      setError(extractApiErrorMessage(caughtError, 'Checkout failed. Lock may have expired.'))
      void fetchAll()
    }
  }

  const handleResetSelectedSeats = async () => {
    if (!event) return

    setError(null)

    if (isAdmin) {
      setInspectedSeatIds([])
      return
    }

    if (!isAuthenticated) {
      setGuestPreviewSeatIds([])
      return
    }

    if (selectedSeats.length === 0) return

    const selectedSeatIds = selectedSeats.map((seat) => seat.id)
    setResettingSeats(true)

    try {
      await bookingApi.release(event.id, selectedSeatIds)
      setSeats((prevSeats) =>
        prevSeats.map((seat) =>
          selectedSeatIds.includes(seat.id)
            ? { ...seat, status: 'available', is_locked_by_me: false, lock_expires_at: null }
            : seat,
        ),
      )
    } catch (caughtError) {
      setError(extractApiErrorMessage(caughtError, 'Failed to reset selected seats. Please retry.'))
      void fetchAll()
    } finally {
      setResettingSeats(false)
    }
  }

  const zoneMap = useMemo(() => {
    const map = new Map<number, { name: string; color: string }>()
    event?.zones.forEach((zone, index) => {
      const normalized = zone.color.trim().toLowerCase()
      const color = ['#024ddf', '#3569f9', '#799dd6', '#b6c4ff'].includes(normalized)
        ? softSeatPalette[index % softSeatPalette.length]
        : softenHexColor(zone.color)

      map.set(zone.id, { name: zone.name, color })
    })
    return map
  }, [event])

  const legendZones = useMemo(
    () => event?.zones.map((zone) => ({ ...zone, color: zoneMap.get(zone.id)?.color ?? zone.color })) ?? [],
    [event, zoneMap],
  )

  return (
    <main className="page page-seat-booking app-container">
      {loading && <p className="state-text">Loading seat map...</p>}

      {error && <p className="state-text state-text--error">{error}</p>}

      {!loading && event && (
        <>
          <section className="seat-header">
            <div>
              <span className="chip chip-primary">{event.category}</span>
              <h1>{event.title}</h1>
              <p>
                {dayjs(event.start_at).format('DD MMM YYYY HH:mm')} • {event.venue}
              </p>
            </div>

            <div className="seat-header__timer">
              <p>Hold Timer</p>
              <strong>{holdCountdown}</strong>
              <small>Seats auto-release in {event.hold_minutes} minutes</small>
            </div>
          </section>

          <section className="seat-layout-grid">
            <article className="seat-map-card">
              <div className="stage-pill">MAIN STAGE</div>
              <SeatLegend zones={legendZones} />

              <div className="seat-grid">
                {seats.map((seat) => {
                  const zoneMeta = zoneMap.get(seat.zone_id)
                  const availableStyle: CSSProperties | undefined =
                    seat.status === 'available' && zoneMeta
                      ? ({
                          '--seat-zone-color': zoneMeta.color,
                          '--seat-zone-text': getReadableTextColor(zoneMeta.color),
                        } as CSSProperties)
                      : undefined

                  const className = [
                    'seat-cell',
                    seat.status === 'available' ? 'seat-cell--available' : '',
                    seat.status === 'sold' ? 'seat-cell--sold' : '',
                    seat.status === 'locked' && seat.is_locked_by_me ? 'seat-cell--mine' : '',
                    seat.status === 'locked' && !seat.is_locked_by_me ? 'seat-cell--locked' : '',
                    !isAuthenticated && guestPreviewSeatIds.includes(seat.id) ? 'seat-cell--preview' : '',
                    isAdmin && inspectedSeatIds.includes(seat.id) ? 'seat-cell--inspected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')

                  return (
                    <button
                      key={seat.id}
                      type="button"
                      className={className}
                      style={availableStyle}
                      title={`${seat.seat_label} • ${zoneMeta?.name ?? 'Unknown Zone'} • $${seat.price}`}
                      onClick={() => void handleSeatClick(seat)}
                      disabled={!isAdmin && (seat.status === 'sold' || busySeatId === seat.id)}
                    >
                      {seat.row_label}
                      {seat.seat_number}
                    </button>
                  )
                })}
              </div>
            </article>

            <aside className="seat-summary-card">
              <h2>{isAdmin ? 'Seat Inspector' : 'Selected Seats'}</h2>
              <p>
                {isAdmin
                  ? 'Click any seat to inspect owner details.'
                  : isAuthenticated
                    ? `${selectedSeats.length} seats locked`
                    : `${guestPreviewSeats.length} seats selected (preview)`}
              </p>

              <ul>
                {displaySeats.map((seat) => (
                  <li key={seat.id}>
                    <span>{seat.seat_label}</span>
                    <span>${Number(seat.price).toFixed(2)}</span>
                  </li>
                ))}
                {displaySeats.length === 0 && <li>No seats selected yet.</li>}
              </ul>

              <div className="seat-summary__total">
                <span>Total</span>
                <strong>${totalPrice.toFixed(2)}</strong>
              </div>

              <button
                type="button"
                className="btn btn-ghost"
                disabled={displaySeats.length === 0 || resettingSeats}
                onClick={() => void handleResetSelectedSeats()}
              >
                {resettingSeats ? 'Resetting...' : 'Reset Selected Seats'}
              </button>

              {isAdmin && inspectedSeats.length > 0 && (
                <div className="seat-inspector-stack">
                  {inspectedSeats.map((inspectedSeat) => (
                    <div key={inspectedSeat.id} className="seat-inspector-card">
                      <h3>{inspectedSeat.seat_label}</h3>
                      <p>Status: {inspectedSeat.status}</p>
                      <p>Price: ${Number(inspectedSeat.price).toFixed(2)}</p>

                      {inspectedSeat.sold_to_user ? (
                        <div className="seat-inspector-card__owner">
                          <strong>Purchased By</strong>
                          <span>{inspectedSeat.sold_to_user.user.full_name}</span>
                          <span>{inspectedSeat.sold_to_user.user.email}</span>
                          <span>
                            {inspectedSeat.sold_to_user.user.gender} • {inspectedSeat.sold_to_user.user.age} years old
                          </span>
                          <span>Order #{inspectedSeat.sold_to_user.order_id}</span>
                          {inspectedSeat.sold_to_user.ticket_code && <span>Ticket: {inspectedSeat.sold_to_user.ticket_code}</span>}
                        </div>
                      ) : inspectedSeat.locked_by_user ? (
                        <div className="seat-inspector-card__owner">
                          <strong>Currently Locked By</strong>
                          <span>{inspectedSeat.locked_by_user.full_name}</span>
                          <span>{inspectedSeat.locked_by_user.email}</span>
                          <span>
                            {inspectedSeat.locked_by_user.gender} • {inspectedSeat.locked_by_user.age} years old
                          </span>
                        </div>
                      ) : (
                        <p className="state-text">No owner yet for this seat.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!isAdmin && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={displaySeats.length === 0 || resettingSeats}
                  onClick={handleCheckout}
                >
                  Confirm Checkout
                </button>
              )}
            </aside>
          </section>
        </>
      )}

      {checkoutData && (
        <section className="checkout-modal-backdrop" role="dialog" aria-modal="true">
          <div className="checkout-modal">
            <h3>Order Confirmed</h3>
            <p>
              Order #{checkoutData.order_id} • {checkoutData.items.length} tickets • ${Number(checkoutData.total_amount).toFixed(2)}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setCheckoutData(null)
                navigate('/my-tickets', { replace: true })
              }}
            >
              Go to My Tickets
            </button>
          </div>
        </section>
      )}
    </main>
  )
}
