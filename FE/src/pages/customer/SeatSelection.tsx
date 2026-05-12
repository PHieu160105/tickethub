import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/Button'
import { GlobalLoader } from '@/components/ui/GlobalLoader'
import { CustomerSeatMap } from '@/components/customer/CustomerSeatMap'
import { SeatMapLegend } from '@/components/customer/SeatMapLegend'
import { useLockSeats, useReleaseSeats } from '@/features/booking/hooks/useBooking'
import { useShowSeats } from '@/features/events/hooks/useEvents'
import { useAuth } from '@/context/AuthContext'
import { useWebSocketHeartbeat } from '@/hooks/useWebSocketHeartbeat'
import { authStorage, queueStorage } from '@/lib/storage'
import { seatmapApi } from '@/lib/api'
import { WS_BASE_URL } from '@/constants'
import type { Seat, SeatMapResponse, SeatMapSeat, SeatZone } from '@/types'
import { AlertCircle, CheckCircle2, MapPin, Ticket } from 'lucide-react'

function seatClass(seat: Seat, isPending: boolean) {
  if (isPending) return 'bg-cyan-700 text-white border-cyan-400 cursor-wait'
  if (seat.status === 'sold') return 'bg-slate-700 text-slate-500 cursor-not-allowed'
  if (seat.status === 'locked' && !seat.is_locked_by_me) return 'bg-slate-700 text-slate-400 cursor-not-allowed'
  if (seat.is_locked_by_me) return 'bg-emerald-700 text-white border-emerald-500'
  return 'bg-slate-800 text-slate-200 hover:bg-slate-700 border-white/10'
}

function groupSeatsByZone(seats: Seat[]) {
  return seats.reduce<Record<number, Seat[]>>((acc, seat) => {
    if (!acc[seat.zone_id]) acc[seat.zone_id] = []
    acc[seat.zone_id].push(seat)
    return acc
  }, {})
}

const DEFAULT_VIEWPORT = { scale: 1, offsetX: 0, offsetY: 0 }

export default function SeatSelection() {
  const { showId: showIdParam } = useParams<{ showId: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const showId = Number(showIdParam ?? '')

  const { seats: matrix, isLoading, error, refetch } = useShowSeats(showId, { pollIntervalMs: 3000 })
  const { isLoading: isLocking, lockSeats } = useLockSeats()
  const { isLoading: isReleasing, releaseSeats } = useReleaseSeats()

  const [pendingSeatIds, setPendingSeatIds] = useState<number[]>([])
  const pendingSeatIdsRef = useRef<Set<number>>(new Set())
  const [statusMessage, setStatusMessage] = useState<string>('')

  // Canvas-specific state
  const [seatMap, setSeatMap] = useState<SeatMapResponse | null>(null)
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT)
  const [isPanning, setIsPanning] = useState(false)
  const [panStartCursor, setPanStartCursor] = useState<{ x: number; y: number } | null>(null)
  const [panStartOffset, setPanStartOffset] = useState<{ x: number; y: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const queueToken = showId ? queueStorage.getToken(showId) : null
  const authToken = authStorage.getToken()
  const wsUrl = showId && authToken ? `${WS_BASE_URL}/shows/${showId}/seats?token=${encodeURIComponent(authToken)}` : null

  useEffect(() => {
    if (!showId || Number.isNaN(showId)) return
    seatmapApi.get(showId).then(setSeatMap).catch(() => setSeatMap(null))
  }, [showId])

  // Canvas panning via global mouse events
  useEffect(() => {
    if (!isPanning || !panStartCursor || !panStartOffset) return
    const onMove = (e: MouseEvent) => {
      setViewport((prev) => ({
        ...prev,
        offsetX: panStartOffset.x + (e.clientX - panStartCursor.x),
        offsetY: panStartOffset.y + (e.clientY - panStartCursor.y),
      }))
    }
    const onUp = () => { setIsPanning(false); setPanStartCursor(null); setPanStartOffset(null) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [isPanning, panStartCursor, panStartOffset])

  const seatsByZone = useMemo(() => groupSeatsByZone(matrix?.seats ?? []), [matrix?.seats])

  const heldSeats = useMemo(
    () => (matrix?.seats ?? []).filter((s) => s.is_locked_by_me).sort((a, b) => a.seat_label.localeCompare(b.seat_label)),
    [matrix?.seats],
  )

  const subtotal = heldSeats.reduce((sum, s) => sum + Number(s.price), 0)

  const useCanvas = Boolean(seatMap?.background?.source && seatMap.seats.some((s) => s.x !== null))

  // Seat color map for canvas (sync status from matrix into canvas colours)
  const seatColorMap = useMemo(() => {
    if (!seatMap) return undefined
    const map = new Map<number, string>()
    seatMap.sections.forEach((sec) => {
      seatMap.seats.filter((s) => s.section_id === sec.id).forEach((s) => map.set(s.id, sec.color))
    })
    return map
  }, [seatMap])

  // IDs of held seats so canvas can highlight them
  const heldSeatIdsOnCanvas = useMemo(() => {
    if (!seatMap) return []
    return seatMap.seats.filter((s) => s.is_locked_by_me).map((s) => s.id)
  }, [seatMap])

  async function handleSeatClick(seat: Seat) {
    if (seat.status === 'sold') return
    if (seat.status === 'locked' && !seat.is_locked_by_me) return
    if (!matrix) return
    if (pendingSeatIdsRef.current.has(seat.id)) return
    if (!isAuthenticated) { navigate('/login'); return }

    pendingSeatIdsRef.current.add(seat.id)
    setPendingSeatIds((prev) => [...prev, seat.id])
    try {
      if (seat.is_locked_by_me) {
        const msg = await releaseSeats(matrix.show_id, [seat.id])
        setStatusMessage(msg)
      } else {
        const res = await lockSeats(matrix.show_id, [seat.id], queueToken ?? undefined)
        setStatusMessage(res.locked_seat_ids.includes(seat.id) ? `${seat.seat_label} đã giữ cho bạn.` : `${seat.seat_label} vừa bị người khác đặt.`)
      }
      await refetch(false)
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái ghế')
    } finally {
      pendingSeatIdsRef.current.delete(seat.id)
      setPendingSeatIds((prev) => prev.filter((id) => id !== seat.id))
    }
  }

  async function handleCanvasSeatClick(seat: SeatMapSeat) {
    if (seat.status === 'sold') return
    if (seat.status === 'locked' && !seat.is_locked_by_me) return
    if (!matrix) return
    if (pendingSeatIdsRef.current.has(seat.id)) return
    if (!isAuthenticated) { navigate('/login'); return }

    pendingSeatIdsRef.current.add(seat.id)
    setPendingSeatIds((prev) => [...prev, seat.id])
    try {
      if (seat.is_locked_by_me) {
        const msg = await releaseSeats(matrix.show_id, [seat.id])
        setStatusMessage(msg)
      } else {
        const res = await lockSeats(matrix.show_id, [seat.id], queueToken ?? undefined)
        setStatusMessage(res.locked_seat_ids.includes(seat.id) ? `${seat.label} đã giữ cho bạn.` : `${seat.label} vừa bị người khác đặt.`)
      }
      await refetch(false)
      // Re-sync canvas seatmap status
      if (showId) seatmapApi.get(showId).then(setSeatMap).catch(() => {})
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái ghế')
    } finally {
      pendingSeatIdsRef.current.delete(seat.id)
      setPendingSeatIds((prev) => prev.filter((id) => id !== seat.id))
    }
  }

  const handleCheckout = () => {
    if (!matrix || heldSeats.length === 0) return
    if (!isAuthenticated) { navigate('/login'); return }
    navigate(`/checkout?showId=${matrix.show_id}&eventKey=${matrix.event_slug}`, {
      state: { lockedSeatIds: heldSeats.map((s) => s.id) },
    })
  }

  const handleCanvasMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button === 1 || event.shiftKey) {
      event.preventDefault()
      setIsPanning(true)
      setPanStartCursor({ x: event.clientX, y: event.clientY })
      setPanStartOffset({ x: viewport.offsetX, y: viewport.offsetY })
    }
  }, [viewport])

  const handleCanvasMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning || !panStartCursor || !panStartOffset) return
    setViewport((prev) => ({
      ...prev,
      offsetX: panStartOffset.x + (event.clientX - panStartCursor.x),
      offsetY: panStartOffset.y + (event.clientY - panStartCursor.y),
    }))
  }, [isPanning, panStartCursor, panStartOffset])

  const handleCanvasWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const el = canvasRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = event.clientX - rect.left
    const py = event.clientY - rect.top
    setViewport((prev) => {
      const factor = event.deltaY < 0 ? 1.1 : 0.9
      const nextScale = Math.max(0.4, Math.min(4, prev.scale * factor))
      const lx = (px - prev.offsetX) / prev.scale
      const ly = (py - prev.offsetY) / prev.scale
      return { scale: nextScale, offsetX: px - lx * nextScale, offsetY: py - ly * nextScale }
    })
  }, [])

  const handleSeatUpdates = useCallback((event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data) as { type?: string }
      if (msg.type === 'seat_changes') {
        void refetch(false)
        if (showId) seatmapApi.get(showId).then(setSeatMap).catch(() => {})
      }
    } catch { /* ignore */ }
  }, [refetch, showId])

  useWebSocketHeartbeat({ url: wsUrl, onMessage: handleSeatUpdates })

  if (isLoading) return <GlobalLoader />

  if (error || !matrix) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-24 text-center">
          <p className="mb-6 text-red-400">{error ?? 'Không tải được sơ đồ ghế'}</p>
          <Link to="/search"><Button>Trở về tìm kiếm</Button></Link>
        </main>
      </div>
    )
  }

  if (matrix.queue_enabled && !queueToken) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <Navbar />
        <main className="mx-auto max-w-3xl space-y-4 px-6 py-24 text-center">
          <p className="text-amber-300">Sự kiện này yêu cầu vào hàng đợi trước khi chọn ghế.</p>
          <Link to={`/queue?showId=${matrix.show_id}&eventKey=${matrix.event_slug}`}><Button>Tham gia hàng đợi</Button></Link>
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
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Chọn chỗ ngồi</p>
              <h1 className="mt-2 text-3xl font-black">{seatMap?.show_title ?? 'Chọn ghế trên sơ đồ'}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                {useCanvas ? 'Click vào ghế trên sơ đồ để giữ chỗ.' : 'Chọn ghế từ danh sách bên dưới để tiếp tục thanh toán.'}
              </p>
            </div>
            <Link to={`/event/${matrix.event_slug}`}>
              <Button variant="outline" size="sm">Quay lại sự kiện</Button>
            </Link>
          </div>

          {useCanvas && seatMap ? (
            <CustomerSeatMap
              seatMap={seatMap}
              selectedSeatIds={heldSeatIdsOnCanvas}
              seatColorMap={seatColorMap}
              viewport={viewport}
              canvasRef={canvasRef}
              isPanning={isPanning}
              onSeatClick={(seat) => void handleCanvasSeatClick(seat)}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onWheel={handleCanvasWheel}
              onZoomIn={() => setViewport((prev) => ({ ...prev, scale: Math.min(4, Number((prev.scale * 1.15).toFixed(2))) }))}
              onZoomOut={() => setViewport((prev) => ({ ...prev, scale: Math.max(0.4, Number((prev.scale * 0.87).toFixed(2))) }))}
              onResetView={() => setViewport(DEFAULT_VIEWPORT)}
            />
          ) : (
            <div className="space-y-6">
              {matrix.zones.map((zone: SeatZone) => {
                const zoneSeats = seatsByZone[zone.id] ?? []
                return (
                  <div key={zone.id} className="rounded-lg border border-white/10 bg-slate-950/40 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold">{zone.name}</h3>
                        <p className="text-xs text-slate-400">{zone.code} | {Number(zone.price).toLocaleString('vi-VN')}đ</p>
                      </div>
                      <span className="text-xs text-slate-400">{zoneSeats.length} ghế</span>
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
                            title={`${seat.seat_label} - ${Number(seat.price).toLocaleString('vi-VN')}đ`}
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
          )}

          {useCanvas && <SeatMapLegend />}
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-500 mb-4">
              <MapPin className="h-4 w-4" />
              {seatMap?.venue_name ?? ''}
            </div>

            <div className="max-h-56 overflow-auto space-y-2">
              {heldSeats.length === 0 ? (
                <p className="text-sm text-slate-400">Chưa có ghế nào được giữ.</p>
              ) : (
                heldSeats.map((seat) => (
                  <div key={seat.id} className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{seat.seat_label}</p>
                      <p className="text-xs text-slate-400">{Number(seat.price).toLocaleString('vi-VN')}đ</p>
                    </div>
                    <button type="button" className="text-xs text-primary hover:underline" onClick={() => void handleSeatClick(seat)}>
                      Bỏ giữ
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Tổng cộng</span>
              <span className="font-bold">{subtotal.toLocaleString('vi-VN')}đ</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>{heldSeats.length} ghế đã giữ</span>
            </div>

            <Button className="w-full" onClick={handleCheckout} disabled={heldSeats.length === 0} isLoading={isLocking || isReleasing}>
              <Ticket className="w-4 h-4" />
              Tiếp tục thanh toán
            </Button>

            {!isAuthenticated && (
              <p className="flex items-center gap-2 text-xs text-amber-300">
                <AlertCircle className="h-4 w-4" />
                Cần đăng nhập trước khi giữ ghế.
              </p>
            )}

            {statusMessage && (
              <p className="flex items-center gap-2 text-xs text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                {statusMessage}
              </p>
            )}
          </div>

          {!useCanvas && (
            <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4 text-xs text-slate-400 space-y-1">
              <p className="font-medium">Chú thích:</p>
              <p>🟢 Bạn đang giữ | 🟡 Người khác giữ | ⬛ Đã bán</p>
            </div>
          )}
        </aside>
      </main>

    </div>
  )
}
