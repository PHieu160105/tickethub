import { useEffect, useMemo, useRef, useState, type MouseEvent, type WheelEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/Button'
import { GlobalLoader } from '@/components/ui/GlobalLoader'
import { CustomerSeatMap } from '@/components/customer/CustomerSeatMap'
import { SeatMapLegend } from '@/components/customer/SeatMapLegend'
import { SeatSelectionSummary } from '@/components/customer/SeatSelectionSummary'
import { useLockSeats } from '@/features/booking/hooks/useBooking'
import { useEventSeats } from '@/features/events/hooks/useEvents'
import { useAuth } from '@/context/AuthContext'
import { extractApiErrorMessage, seatmapApi } from '@/lib/api'
import { queueStorage } from '@/lib/storage'
import type { SeatMapResponse, SeatMapSeat } from '@/types'
import { AlertCircle, CheckCircle2, MapPin, Ticket } from 'lucide-react'

const POLLING_INTERVAL_MS = 10_000

function isSeatSelectable(seat: SeatMapSeat) {
  if (seat.is_locked_by_me) return false
  if (seat.status === 'sold') return false
  if (seat.status === 'locked' && !seat.is_locked_by_me) return false
  return true
}

export default function SeatSelection() {
  const { eventKey } = useParams<{ eventKey: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { isLoading: isLocking, lockSeats } = useLockSeats()
  const { seats: matrix } = useEventSeats(eventKey)

  const canvasRef = useRef<HTMLDivElement>(null)

  const [seatMap, setSeatMap] = useState<SeatMapResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [selectedSeatIds, setSelectedSeatIds] = useState<number[]>([])
  const [viewport, setViewport] = useState({ scale: 1, offsetX: 0, offsetY: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStartCursor, setPanStartCursor] = useState<{ x: number; y: number } | null>(null)
  const [panStartOffset, setPanStartOffset] = useState<{ x: number; y: number } | null>(null)

  const queueToken = eventKey ? queueStorage.getToken(eventKey) : null

  async function loadSeatMap(options?: { silent?: boolean }) {
    if (!eventKey) return
    if (!options?.silent) {
      setIsLoading(true)
    }
    try {
      const response = await seatmapApi.get(eventKey)
      setSeatMap(response)
      setError(null)
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Cannot load seat map'))
    } finally {
      if (!options?.silent) {
        setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    void loadSeatMap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventKey])

  useEffect(() => {
    if (!eventKey) return
    const interval = window.setInterval(() => {
      void loadSeatMap({ silent: true })
    }, POLLING_INTERVAL_MS)
    return () => window.clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventKey])

  useEffect(() => {
    if (!seatMap) return
    setSelectedSeatIds((previous) =>
      previous.filter((seatId) => {
        const seat = seatMap.seats.find((item) => item.id === seatId)
        return seat ? isSeatSelectable(seat) : false
      }),
    )
  }, [seatMap])

  useEffect(() => {
    if (!isPanning || !panStartCursor || !panStartOffset) return

    const handleWindowMouseMove = (event: globalThis.MouseEvent) => {
      setViewport((previous) => ({
        ...previous,
        offsetX: panStartOffset.x + (event.clientX - panStartCursor.x),
        offsetY: panStartOffset.y + (event.clientY - panStartCursor.y),
      }))
    }

    const handleWindowMouseUp = () => {
      setIsPanning(false)
      setPanStartCursor(null)
      setPanStartOffset(null)
    }

    window.addEventListener('mousemove', handleWindowMouseMove)
    window.addEventListener('mouseup', handleWindowMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove)
      window.removeEventListener('mouseup', handleWindowMouseUp)
    }
  }, [isPanning, panStartCursor, panStartOffset])

  const selectedSeats = useMemo(
    () =>
      (seatMap?.seats ?? [])
        .filter((seat) => selectedSeatIds.includes(seat.id))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [seatMap?.seats, selectedSeatIds],
  )

  const heldSeats = useMemo(
    () => (seatMap?.seats ?? []).filter((seat) => seat.is_locked_by_me).sort((a, b) => a.label.localeCompare(b.label)),
    [seatMap?.seats],
  )
  const zoneMap = useMemo(() => new Map((matrix?.zones ?? []).map((zone) => [zone.id, zone])), [matrix?.zones])
  const seatColorMap = useMemo(
    () =>
      new Map(
        (matrix?.seats ?? [])
          .map((seat) => [seat.id, zoneMap.get(seat.zone_id)?.color])
          .filter((entry): entry is [number, string] => Boolean(entry[1])),
      ),
    [matrix?.seats, zoneMap],
  )

  const subtotal = selectedSeats.reduce((sum, seat) => sum + Number(seat.price), 0)
  const mappedSeatCount = (seatMap?.seats ?? []).filter((seat) => seat.x !== null && seat.y !== null).length

  function handleSeatClick(seat: SeatMapSeat) {
    if (!isSeatSelectable(seat)) return
    setSelectedSeatIds((previous) => (
      previous.includes(seat.id)
        ? previous.filter((seatId) => seatId !== seat.id)
        : [...previous, seat.id]
    ))
  }

  function handleCanvasMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest('button')) return
    event.preventDefault()
    setIsPanning(true)
    setPanStartCursor({ x: event.clientX, y: event.clientY })
    setPanStartOffset({ x: viewport.offsetX, y: viewport.offsetY })
  }

  function handleCanvasMouseMove(_event: MouseEvent<HTMLDivElement>) {
    // Customer map only needs drag-to-pan for now.
  }

  function handleCanvasWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault()
    setViewport((previous) => {
      const nextScale = Math.max(0.75, Math.min(2.5, previous.scale + (event.deltaY < 0 ? 0.12 : -0.12)))
      return {
        ...previous,
        scale: Number(nextScale.toFixed(2)),
      }
    })
  }

  function resetViewport() {
    setViewport({ scale: 1, offsetX: 0, offsetY: 0 })
  }

  function navigateToCheckout() {
    if (!seatMap) return
    navigate(`/checkout?eventId=${seatMap.event_id}&eventKey=${seatMap.event_slug}`)
  }

  async function handleProceedToCheckout() {
    if (!seatMap) return
    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    if (selectedSeatIds.length === 0) {
      if (heldSeats.length > 0) {
        navigateToCheckout()
      }
      return
    }

    try {
      const response = await lockSeats(seatMap.event_id, selectedSeatIds, queueToken ?? undefined)
      const lockedSeatIds = response.locked_seat_ids ?? []
      const failedSeatIds = response.failed_seat_ids ?? []
      setSelectedSeatIds([])
      await loadSeatMap({ silent: true })

      if (lockedSeatIds.length > 0) {
        navigate(`/checkout?eventId=${seatMap.event_id}&eventKey=${seatMap.event_slug}`, {
          state: { lockedSeatIds },
        })
        return
      }

      setStatusMessage(
        failedSeatIds.length > 0
          ? 'Some selected seats are no longer available. Please review the map and try again.'
          : response.message,
      )
    } catch (errorValue) {
      setStatusMessage(extractApiErrorMessage(errorValue, 'Unable to lock seats'))
    }
  }

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

          {mappedSeatCount === 0 ? (
            <div className="rounded-3xl border border-dashed border-amber-500/30 bg-amber-500/10 p-8 text-center text-amber-100">
              This event does not have mapped seat coordinates yet. Customer seat map cannot be rendered.
            </div>
          ) : (
            <CustomerSeatMap
              seatMap={seatMap}
              selectedSeatIds={selectedSeatIds}
              seatColorMap={seatColorMap}
              viewport={viewport}
              canvasRef={canvasRef}
              isPanning={isPanning}
              onSeatClick={handleSeatClick}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onWheel={handleCanvasWheel}
              onZoomIn={() => setViewport((previous) => ({ ...previous, scale: Math.min(2.5, Number((previous.scale + 0.12).toFixed(2))) }))}
              onZoomOut={() => setViewport((previous) => ({ ...previous, scale: Math.max(0.75, Number((previous.scale - 0.12).toFixed(2))) }))}
              onResetView={resetViewport}
              footer={<span>{seatMap.seat_count} total seats</span>}
            />
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-500">
              <MapPin className="h-4 w-4" />
              {seatMap.venue_name}
            </div>
            <div className="mt-4">
              <SeatMapLegend zones={matrix?.zones ?? []} />
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
        </aside>
      </main>

      <Footer />
    </div>
  )
}
