import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'

import { CustomerSeatMap } from '@/components/customer/CustomerSeatMap'
import { SeatMapLegend } from '@/components/customer/SeatMapLegend'
import { Button } from '@/components/ui/Button'
import { GlobalLoader } from '@/components/ui/GlobalLoader'
import { WS_BASE_URL } from '@/constants'
import { useAuth } from '@/context/AuthContext'
import { useLockSeats, useReleaseSeats } from '@/features/booking/hooks/useBooking'
import { useShowSeats } from '@/features/events/hooks/useEvents'
import { useWebSocketHeartbeat } from '@/hooks/useWebSocketHeartbeat'
import { eventApi, extractApiErrorMessage, getWaitingRoomQueueUrl, isWaitingRoomRequiredError, seatmapApi } from '@/lib/api'
import { authStorage, checkoutReturnSeatStorage, flashNoticeStorage, queueStorage } from '@/lib/storage'
import { formatCurrencyVnd } from '@/lib/utils'
import type { Seat, SeatMapResponse, SeatMapSeat, SeatZone } from '@/types'
import { AlertCircle, MapPin, Ticket } from 'lucide-react'

function seatClass(seat: Seat, isSelected: boolean) {
  if (seat.status === 'sold') return 'bg-slate-700 text-slate-300 border-slate-500 cursor-not-allowed'
  if (seat.status === 'locked' && !seat.is_locked_by_me) return 'bg-amber-900/70 text-amber-100 border-amber-500 cursor-not-allowed'
  if (seat.is_locked_by_me) return 'bg-emerald-700 customer-text-body border-emerald-500'
  if (isSelected) return 'bg-sky-700 customer-text-body border-sky-400'
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

interface SeatSelectionLocationState {
  preselectedSeatIds?: number[]
}

function isRecoverableQueueTokenError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false
  }

  const statusCode = error.response?.status
  return statusCode === 403 || statusCode === 404 || statusCode === 410 || statusCode === 429
}

export default function SeatSelection() {
  const { showId: showIdParam } = useParams<{ showId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const showId = Number(showIdParam ?? '')
  const locationState = (location.state ?? {}) as SeatSelectionLocationState
  const storedPreselectedSeatIds = useMemo(() => {
    if (!showId || Number.isNaN(showId)) return []
    return checkoutReturnSeatStorage.get(showId)
  }, [showId])
  const preselectedSeatIds = useMemo(
    () => {
      const routeSeatIds = locationState.preselectedSeatIds ?? []
      return routeSeatIds.length > 0 ? routeSeatIds : storedPreselectedSeatIds
    },
    [locationState.preselectedSeatIds, storedPreselectedSeatIds],
  )

  const queueToken = showId ? queueStorage.getToken(showId) : null
  const { seats: matrix, isLoading, error, rawError, refetch } = useShowSeats(showId, { queueToken })
  const { isLoading: isLocking, lockSeats } = useLockSeats()
  const { isLoading: isReleasing, releaseSeats } = useReleaseSeats()

  const [statusMessage, setStatusMessage] = useState('')
  const [selectedSeatIds, setSelectedSeatIds] = useState<number[]>([])
  const [seatMap, setSeatMap] = useState<SeatMapResponse | null>(null)
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT)
  const [isPanning, setIsPanning] = useState(false)
  const [panStartCursor, setPanStartCursor] = useState<{ x: number; y: number } | null>(null)
  const [panStartOffset, setPanStartOffset] = useState<{ x: number; y: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const hasAppliedPreselectedSeatsRef = useRef(false)
  const interruptionRedirectTimerRef = useRef<number | null>(null)

  const authToken = authStorage.getToken()
  const wsUrl = showId
    ? `${WS_BASE_URL}/shows/${showId}/seats${authToken ? `?token=${encodeURIComponent(authToken)}` : ''}`
    : null

  useEffect(() => {
    hasAppliedPreselectedSeatsRef.current = false
  }, [location.key, showId])

  useEffect(() => {
    return () => {
      if (interruptionRedirectTimerRef.current !== null) {
        window.clearTimeout(interruptionRedirectTimerRef.current)
      }
    }
  }, [])

  const handleShowInterrupted = useCallback((eventSlug?: string) => {
    if (!showId || Number.isNaN(showId)) return

    queueStorage.clearToken(showId)
    checkoutReturnSeatStorage.clear(showId)
    flashNoticeStorage.set({
      variant: 'warning',
      title: 'Show đang được cập nhật',
      description: 'Phiên đặt vé hiện tại đã kết thúc vì admin đang chỉnh sửa show. Vui lòng chọn show khác hoặc quay lại sau.',
    })
    setSelectedSeatIds([])
    setStatusMessage('Show đang được cập nhật. Hệ thống sẽ đưa bạn về trang sự kiện.')

    if (interruptionRedirectTimerRef.current !== null) {
      window.clearTimeout(interruptionRedirectTimerRef.current)
    }

    interruptionRedirectTimerRef.current = window.setTimeout(() => {
      navigate(eventSlug ? `/event/${eventSlug}` : '/search', { replace: true })
    }, 1500)
  }, [navigate, showId])

  useEffect(() => {
    let disposed = false

    const loadSeatMap = async () => {
      if (!showId || Number.isNaN(showId) || !matrix) return

      try {
        const nextSeatMap = await seatmapApi.get(showId, queueToken ?? undefined)
        if (!disposed) setSeatMap(nextSeatMap)
      } catch {
        if (!disposed) setSeatMap(null)
      }
    }

    void loadSeatMap()

    return () => {
      disposed = true
    }
  }, [matrix?.show_id, queueToken, showId])

  useEffect(() => {
    if (!showId || Number.isNaN(showId) || !rawError || !isWaitingRoomRequiredError(rawError)) return

    queueStorage.clearToken(showId)
    navigate(getWaitingRoomQueueUrl(rawError, `/queue?showId=${showId}${matrix?.event_slug ? `&eventKey=${encodeURIComponent(matrix.event_slug)}` : ''}`), { replace: true })
  }, [matrix?.event_slug, navigate, rawError, showId])

  useEffect(() => {
    if (!isPanning || !panStartCursor || !panStartOffset) return

    const onMove = (event: MouseEvent) => {
      setViewport((previous) => ({
        ...previous,
        offsetX: panStartOffset.x + (event.clientX - panStartCursor.x),
        offsetY: panStartOffset.y + (event.clientY - panStartCursor.y),
      }))
    }

    const onUp = () => {
      setIsPanning(false)
      setPanStartCursor(null)
      setPanStartOffset(null)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isPanning, panStartCursor, panStartOffset])

  useEffect(() => {
    if (error && matrix?.event_slug) {
      handleShowInterrupted(matrix.event_slug)
    }
  }, [error, handleShowInterrupted, matrix?.event_slug])

  useEffect(() => {
    if (!matrix) return

    const frameId = window.requestAnimationFrame(() => {
      const shouldRestoreFromCheckout = (
        !hasAppliedPreselectedSeatsRef.current &&
        selectedSeatIds.length === 0 &&
        preselectedSeatIds.length > 0
      )
      const sourceSeatIds = shouldRestoreFromCheckout ? preselectedSeatIds : selectedSeatIds
      const nextSeatIds = sourceSeatIds.filter((seatId) => {
        const seat = matrix.seats.find((item) => item.id === seatId)
        return Boolean(seat && (seat.status === 'available' || seat.is_locked_by_me))
      })

      if (shouldRestoreFromCheckout) {
        hasAppliedPreselectedSeatsRef.current = true
        checkoutReturnSeatStorage.clear(showId)
      }

      const changed = nextSeatIds.length !== selectedSeatIds.length || nextSeatIds.some((seatId, index) => seatId !== selectedSeatIds[index])
      if (changed) {
        setSelectedSeatIds(nextSeatIds)
      }
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [matrix, preselectedSeatIds, selectedSeatIds, showId])

  const displaySeatMap = useMemo(() => {
    if (!seatMap || !matrix) return seatMap

    const latestSeats = new Map(matrix.seats.map((seat) => [seat.id, seat]))
    return {
      ...seatMap,
      seats: seatMap.seats.map((seat) => {
        const latest = latestSeats.get(seat.id)
        if (!latest) return seat
        return {
          ...seat,
          price: latest.price,
          status: latest.status,
          lock_expires_at: latest.lock_expires_at,
          is_locked_by_me: latest.is_locked_by_me,
          is_admin_locked: latest.is_admin_locked,
        }
      }),
    }
  }, [matrix, seatMap])

  const seatsByZone = useMemo(() => groupSeatsByZone(matrix?.seats ?? []), [matrix?.seats])

  const selectedSeats = useMemo(
    () =>
      (matrix?.seats ?? [])
        .filter((seat) => selectedSeatIds.includes(seat.id))
        .sort((a, b) => a.seat_label.localeCompare(b.seat_label)),
    [matrix?.seats, selectedSeatIds],
  )

  const subtotal = selectedSeats.reduce((sum, seat) => sum + Number(seat.price), 0)
  const useCanvas = Boolean(displaySeatMap)

  const seatColorMap = useMemo(() => {
    if (!displaySeatMap) return undefined

    const map = new Map<number, string>()

    displaySeatMap.zones.forEach((zone) => {
      displaySeatMap.seats
        .filter((seat) => seat.zone_id === zone.id)
        .forEach((seat) => map.set(seat.id, zone.color))
    })

    displaySeatMap.sections.forEach((section) => {
      displaySeatMap.seats
        .filter((seat) => seat.section_id === section.id && !map.has(seat.id))
        .forEach((seat) => map.set(seat.id, section.color))
    })

    return map
  }, [displaySeatMap])

  const toggleSeatSelection = useCallback((seatId: number) => {
    setSelectedSeatIds((previous) =>
      previous.includes(seatId) ? previous.filter((id) => id !== seatId) : [...previous, seatId],
    )
  }, [])

  const handleSeatClick = useCallback((seat: Seat) => {
    if (seat.status !== 'available') return
    setStatusMessage('')
    toggleSeatSelection(seat.id)
  }, [toggleSeatSelection])

  const handleCanvasSeatClick = useCallback((seat: SeatMapSeat) => {
    if (seat.status !== 'available') return
    setStatusMessage('')
    toggleSeatSelection(seat.id)
  }, [toggleSeatSelection])

  const handleCheckout = useCallback(async () => {
    if (!matrix || selectedSeatIds.length === 0) return

    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    setStatusMessage('')

    try {
      const result = await lockSeats(matrix.show_id, selectedSeatIds, queueToken ?? undefined)

      if (result.locked_seat_ids.length !== selectedSeatIds.length || result.failed_seat_ids.length > 0) {
        if (result.locked_seat_ids.length > 0) {
          await releaseSeats(matrix.show_id, result.locked_seat_ids)
        }

        await refetch(false)
        setSelectedSeatIds((previous) => previous.filter((id) => !result.failed_seat_ids.includes(id)))
        setStatusMessage('Một hoặc nhiều ghế bạn chọn vừa được người khác giữ. Vui lòng kiểm tra lại.')
        return
      }

      const latestMatrix = await eventApi.seats(matrix.show_id, queueToken ?? undefined)
      const lockedSeats = latestMatrix.seats
        .filter((seat) => result.locked_seat_ids.includes(seat.id) && seat.is_locked_by_me)
        .sort((a, b) => a.seat_label.localeCompare(b.seat_label))

      if (lockedSeats.length !== result.locked_seat_ids.length) {
        if (lockedSeats.length > 0) {
          await releaseSeats(matrix.show_id, lockedSeats.map((seat) => seat.id))
        }

        await refetch(false)
        setStatusMessage('Không thể xác nhận giữ đủ ghế để thanh toán. Vui lòng thử lại.')
        return
      }

      navigate(`/checkout?showId=${matrix.show_id}&eventKey=${matrix.event_slug}`, {
        state: { lockedSeatIds: result.locked_seat_ids, lockedSeats },
      })
    } catch (checkoutError) {
      if (isWaitingRoomRequiredError(checkoutError) || isRecoverableQueueTokenError(checkoutError)) {
        queueStorage.clearToken(matrix.show_id)
        setSelectedSeatIds([])
        setStatusMessage('Phiên phòng chờ không còn hợp lệ. Hệ thống sẽ đưa bạn quay lại phòng chờ để cấp token mới.')
        await refetch(false)
        navigate(`/queue?showId=${matrix.show_id}&eventKey=${encodeURIComponent(matrix.event_slug)}`)
        return
      }

      setStatusMessage(extractApiErrorMessage(checkoutError, 'Không thể giữ ghế để thanh toán.'))
      await refetch(false)
    }
  }, [isAuthenticated, lockSeats, matrix, navigate, queueToken, refetch, releaseSeats, selectedSeatIds])

  const handleCanvasMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return

    const target = event.target
    if (target instanceof Element && target.closest('button, a, input, select, textarea, [data-no-pan="true"]')) {
      return
    }

    event.preventDefault()
    setIsPanning(true)
    setPanStartCursor({ x: event.clientX, y: event.clientY })
    setPanStartOffset({ x: viewport.offsetX, y: viewport.offsetY })
  }, [viewport.offsetX, viewport.offsetY])

  const handleCanvasMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning || !panStartCursor || !panStartOffset) return

    setViewport((previous) => ({
      ...previous,
      offsetX: panStartOffset.x + (event.clientX - panStartCursor.x),
      offsetY: panStartOffset.y + (event.clientY - panStartCursor.y),
    }))
  }, [isPanning, panStartCursor, panStartOffset])

  const handleCanvasWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const px = event.clientX - rect.left
    const py = event.clientY - rect.top

    setViewport((previous) => {
      const factor = event.deltaY < 0 ? 1.1 : 0.9
      const nextScale = Math.max(0.4, Math.min(4, previous.scale * factor))
      const localX = (px - previous.offsetX) / previous.scale
      const localY = (py - previous.offsetY) / previous.scale

      return {
        scale: nextScale,
        offsetX: px - localX * nextScale,
        offsetY: py - localY * nextScale,
      }
    })
  }, [])

  const handleSeatUpdates = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data) as { type?: string; payload?: { event_slug?: string } }
      if (message.type === 'seat_changes') {
        void refetch(false)
      }
      if (message.type === 'show_unpublished') {
        handleShowInterrupted(message.payload?.event_slug ?? matrix?.event_slug)
      }
    } catch {
      // Bỏ qua gói tin WebSocket không đúng định dạng để luồng cập nhật ghế tiếp tục ổn định.
    }
  }, [handleShowInterrupted, matrix?.event_slug, refetch])

  useWebSocketHeartbeat({ url: wsUrl, onMessage: handleSeatUpdates })

  if (isLoading) return <GlobalLoader />

  if (error || !matrix) {
    return (
      <div className="min-h-screen cutsomer-text-body">
        <main className="mx-auto max-w-7xl px-4 py-24 text-center">
          <p className="mb-6 text-red-400">{error ?? 'Không tải được sơ đồ ghế.'}</p>
          <Link to="/search">
            <Button>Trở về tìm kiếm</Button>
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen customer-text-body">
      <main className="mx-auto grid max-w-screen-2xl grid-cols-1 gap-8 px-6 py-10 xl:grid-cols-[1.65fr_0.85fr]">
        <section className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-[var(--customer-bg-opp)] customer-bg-surface p-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-gray-500">Chọn chỗ ngồi</p>
              <h1 className="mt-2 text-3xl font-black customer-text-header">{displaySeatMap?.show_title ?? 'Chọn ghế trên sơ đồ'}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                {useCanvas
                  ? 'Bấm vào ghế trống để xem giá và chọn thử. Ghế chỉ được giữ khi bạn đăng nhập, qua hàng đợi hợp lệ và bấm tiếp tục thanh toán.'
                  : 'Hiện chưa có sơ đồ chỗ ngồi cho show này.'}
              </p>
            </div>
            <Link to={`/event/${matrix.event_id}`}>
              <Button variant="outline" size="sm">Quay lại sự kiện</Button>
            </Link>
          </div>

          {useCanvas && displaySeatMap ? (
            <CustomerSeatMap
              seatMap={displaySeatMap}
              selectedSeatIds={selectedSeatIds}
              seatColorMap={seatColorMap}
              viewport={viewport}
              canvasRef={canvasRef}
              isPanning={isPanning}
              onSeatClick={handleCanvasSeatClick}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onWheel={handleCanvasWheel}
              onZoomIn={() =>
                setViewport((previous) => ({
                  ...previous,
                  scale: Math.min(4, Number((previous.scale * 1.15).toFixed(2))),
                }))
              }
              onZoomOut={() =>
                setViewport((previous) => ({
                  ...previous,
                  scale: Math.max(0.4, Number((previous.scale * 0.87).toFixed(2))),
                }))
              }
              onResetView={() => setViewport(DEFAULT_VIEWPORT)}
            />
          ) : (
            <div className="space-y-6">
              {matrix.zones.map((zone: SeatZone) => {
                const zoneSeats = seatsByZone[zone.id] ?? []

                return (
                  <div key={zone.id} className="rounded-lg border border-white/10 bg-slate-950/40 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{zone.name}</h3>
                        <p className="text-xs text-slate-400">
                          {zone.code} | {formatCurrencyVnd(zone.price)}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400">{zoneSeats.length} ghế</span>
                    </div>
                    <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10">
                      {zoneSeats.map((seat) => {
                        const isSelected = selectedSeatIds.includes(seat.id)

                        return (
                          <button
                            key={seat.id}
                            type="button"
                            onClick={() => handleSeatClick(seat)}
                            className={`rounded border px-2 py-1.5 text-xs transition-colors ${seatClass(seat, isSelected)}`}
                            disabled={seat.status !== 'available'}
                            title={`${seat.seat_label} - ${formatCurrencyVnd(seat.price)}`}
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

          {useCanvas && (
            <div className="xl:hidden">
              <SeatMapLegend zones={displaySeatMap?.zones ?? []} />
            </div>
          )}
        </section>

        <aside className="space-y-4">
          {useCanvas && (
            <div className="hidden xl:block">
              <SeatMapLegend zones={displaySeatMap?.zones ?? []} />
            </div>
          )}

          <div className="rounded-3xl border border-[var(--customer-bg-opp)] customer-bg-surface p-6">
            <div className="mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-gray-500">
              <MapPin className="h-4 w-4" />
              {displaySeatMap?.venue_name ?? ''}
            </div>

            <div className="max-h-56 space-y-2 overflow-auto">
              {selectedSeats.length === 0 ? (
                <p className="text-sm customer-text-body">Chưa chọn ghế nào.</p>
              ) : (
                selectedSeats.map((seat) => (
                  <div key={seat.id} className="flex items-center justify-between rounded-lg customer-bg-page px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{seat.seat_label}</p>
                      <p className="text-xs text-slate-400">{formatCurrencyVnd(seat.price)}</p>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-[var(--customer-bg-opt)] hover:underline"
                      onClick={() => handleSeatClick(seat)}
                    >
                      Bỏ chọn
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-[var(--customer-bg-opp)] customer-bg-surface p-6">
            <div className="flex justify-between text-sm">
              <span className=" text-md customer-text-header">Tổng cộng</span>
              <span className="font-bold">{formatCurrencyVnd(subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>{selectedSeats.length} ghế đã chọn</span>
            </div>

            <Button
              className="w-full bg-[var(--customer-bg-opt)] hover:bg-[var(--customer-bg-opt)]/50"
              onClick={() => void handleCheckout()}
              disabled={selectedSeats.length === 0}
              isLoading={isLocking || isReleasing}
            >
              <Ticket className="h-4 w-4" />
              Tiếp tục thanh toán
            </Button>

            {!isAuthenticated && (
              <p className="flex items-center gap-2 text-xs text-amber-300">
                <AlertCircle className="h-4 w-4" />
                Cần đăng nhập trước khi giữ ghế.
              </p>
            )}

            {statusMessage && (
              <p className="flex items-center gap-2 text-xs text-amber-300">
                <AlertCircle className="h-4 w-4" />
                {statusMessage}
              </p>
            )}
          </div>

          {!useCanvas && (
            <div className="space-y-1 rounded-xl border border-white/10 bg-slate-900/70 p-4 text-xs text-slate-400">
              <p className="font-medium">Chú thích:</p>
              <p>Còn trống: màu theo khu vực | Đang giữ: cam | Bạn đang giữ: xanh lá | Đã bán: xám</p>
            </div>
          )}
        </aside>
      </main>
    </div>
  )
}
