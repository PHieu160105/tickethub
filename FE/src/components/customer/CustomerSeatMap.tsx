import { useState, type MouseEventHandler, type ReactNode, type RefObject, type WheelEventHandler } from 'react'
import { Maximize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { formatCurrencyVnd } from '@/lib/utils'
import type { SeatMapPolygon, SeatMapResponse, SeatMapSeat } from '@/types'

function isSeatBlocked(seat: SeatMapSeat) {
  return seat.status !== 'AVAILABLE'
}

function seatClassName(seat: SeatMapSeat, isSelected: boolean) {
  if (seat.status === 'SOLD') return 'bg-slate-700 border-slate-500'
  if (seat.status === 'LOCKED' && !seat.is_locked_by_me) return 'bg-amber-900/70 border-amber-500'
  if (seat.is_locked_by_me) return 'bg-emerald-700 border-emerald-400'
  if (isSelected) return 'bg-slate-800 border-white/20'
  return 'bg-slate-800 border-white/20'
}

function seatInlineStyle(seat: SeatMapSeat, zoneColor?: string, isSelected = false) {
  const baseStyle = {
    boxShadow: isSelected ? '0 0 0 3px rgba(59,130,246,0.35)' : undefined,
  }

  if (seat.status === 'SOLD') {
    return {
      ...baseStyle,
      backgroundColor: '#334155',
      borderColor: '#64748b',
    }
  }

  if (seat.status === 'LOCKED' && !seat.is_locked_by_me) {
    return {
      ...baseStyle,
      backgroundColor: '#78350f',
      borderColor: '#f59e0b',
    }
  }

  if (seat.is_locked_by_me) {
    return {
      ...baseStyle,
      backgroundColor: '#047857',
      borderColor: '#34d399',
    }
  }

  return {
    ...baseStyle,
    backgroundColor: zoneColor ? `${zoneColor}cc` : undefined,
    borderColor: zoneColor ?? undefined,
  }
}

function polygonPoints(points: SeatMapPolygon['points']) {
  return points.map((point) => `${point.x},${point.y}`).join(' ')
}

function computeCentroid(points: SeatMapPolygon['points']) {
  if (points.length === 0) return { x: 50, y: 50 }
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  }
}

interface CustomerSeatMapProps {
  seatMap: SeatMapResponse
  selectedSeatIds: number[]
  seatColorMap?: Map<number, string>
  viewport: { scale: number; offsetX: number; offsetY: number }
  canvasRef: RefObject<HTMLDivElement | null>
  isPanning: boolean
  footer?: ReactNode
  seatSize?: number
  onSeatClick: (seat: SeatMapSeat) => void
  onMouseDown: MouseEventHandler<HTMLDivElement>
  onMouseMove: MouseEventHandler<HTMLDivElement>
  onWheel: WheelEventHandler<HTMLDivElement>
  onZoomIn: () => void
  onZoomOut: () => void
  onResetView: () => void
}

export function CustomerSeatMap({
  seatMap,
  selectedSeatIds,
  seatColorMap,
  viewport,
  canvasRef,
  isPanning,
  footer,
  seatSize = 1.8,
  onSeatClick,
  onMouseDown,
  onMouseMove,
  onWheel,
  onZoomIn,
  onZoomOut,
  onResetView,
}: CustomerSeatMapProps) {
  const visibleSeats = seatMap.seats.filter((seat) => seat.x !== null && seat.y !== null)
  const hiddenSeatCount = seatMap.seat_count - visibleSeats.length
  const aspectRatio = `${seatMap.background?.width ?? 1000} / ${seatMap.background?.height ?? 600}`
  const backgroundSource = seatMap.background?.source
  const isInlineSvg = Boolean(backgroundSource && backgroundSource.includes('<svg'))
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Sơ đồ ghế tương tác</p>
          <h2 className="text-2xl font-black customer-text-body">{seatMap.event_title}</h2>
          <p className="text-sm text-slate-400">{seatMap.venue_name}</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white/95 p-2 shadow-lg">
          <Button size="icon" variant="outline" className="border-slate-300 bg-white text-slate-900 hover:bg-slate-100" onClick={onZoomOut} title="Thu nhỏ">
            <ZoomOut className="h-4 w-4 text-black" />
          </Button>
          <Button size="icon" variant="outline" className="border-slate-300 bg-white text-slate-900 hover:bg-slate-100" onClick={onZoomIn} title="Phóng to">
            <ZoomIn className="h-4 w-4 text-black" />
          </Button>
          <Button size="icon" variant="outline" className="border-slate-300 bg-white text-slate-900 hover:bg-slate-100" onClick={onResetView} title="Đưa sơ đồ về mặc định">
            <RotateCcw className="h-4 w-4 text-black" />
          </Button>
        </div>
      </div>

      <div
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onWheel={onWheel}
        className={`relative overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-inner ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        <div className="absolute left-4 top-4 z-20 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white/95 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-slate-700 shadow-lg backdrop-blur">
          <Maximize2 className="h-3.5 w-3.5 text-slate-900" />
          Kéo để di chuyển sơ đồ
        </div>

        <div className="relative w-full" style={{ aspectRatio }}>
          <div
            className="absolute inset-0 origin-top-left"
            style={{
              transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${viewport.scale})`,
              transformOrigin: 'top left',
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(148,163,184,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.18) 1px, transparent 1px)',
                backgroundSize: '10% 10%',
              }}
            />
            <div className="pointer-events-none absolute inset-0 border-2 border-dashed border-slate-400/70" />

            {backgroundSource &&
              (isInlineSvg ? (
                <div className="absolute inset-0 opacity-70 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: backgroundSource }} />
              ) : (
                <img src={backgroundSource} alt={`${seatMap.venue_name} layout`} className="absolute inset-0 h-full w-full object-contain opacity-80 pointer-events-none" />
              ))}

            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full pointer-events-none">
              {seatMap.polygons.map((polygon) => {
                const zone = seatMap.zones.find((item) => item.id === polygon.zone_id)
                const stroke = zone?.color ?? '#94a3b8'
                return (
                  <polygon
                    key={polygon.id}
                    points={polygonPoints(polygon.points)}
                    fill={`${stroke}22`}
                    stroke={stroke}
                    strokeWidth="0.35"
                    strokeLinejoin="round"
                  />
                )
              })}
            </svg>

            {seatMap.polygons.map((polygon) => {
              const zone = seatMap.zones.find((item) => item.id === polygon.zone_id)
              const centroid = computeCentroid(polygon.points)
              if (!polygon.zone_name && !polygon.label) return null
              return (
                <div
                  key={`clabel-${polygon.id}`}
                  className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded px-2 py-0.5 text-[9px] font-bold whitespace-nowrap"
                  style={{
                    left: `${centroid.x}%`,
                    top: `${centroid.y}%`,
                    backgroundColor: zone?.color ? `${zone.color}cc` : 'rgba(0,0,0,0.6)',
                    color: '#fff',
                  }}
                >
                  {polygon.zone_name ?? polygon.label}
                </div>
              )
            })}

            {visibleSeats.map((seat) => {
              const isSelected = selectedSeatIds.includes(seat.id)
              const zoneColor = seatColorMap?.get(seat.id) ?? seatMap.zones.find((item) => item.id === seat.zone_id)?.color
              const priceLabel = formatCurrencyVnd(seat.price)
              const tooltipContent = `${seat.label} · ${seat.zone_name ?? 'Hạng vé phổ thông'} · ${priceLabel}`
              return (
                <button
                  key={seat.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    if (isSeatBlocked(seat)) return
                    onSeatClick(seat)
                  }}
                  onMouseDown={(event) => event.stopPropagation()}
                  onMouseEnter={(event) => setTooltip({ x: event.clientX, y: event.clientY, content: tooltipContent })}
                  onMouseMove={(event) => setTooltip((current) => (current ? { ...current, x: event.clientX, y: event.clientY } : current))}
                  onMouseLeave={() => setTooltip(null)}
                  disabled={isSeatBlocked(seat)}
                  className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border transition ${seatClassName(seat, isSelected)}`}
                  style={{
                    left: `${seat.x}%`,
                    top: `${seat.y}%`,
                    transform: `translate(-50%, -50%) rotate(${seat.rotation}deg)`,
                    width: `${seatSize}%`,
                    aspectRatio: '1',
                    ...seatInlineStyle(seat, zoneColor, isSelected),
                  }}
                />
              )
            })}
          </div>
        </div>

        {tooltip && (
          <div
            className="pointer-events-none fixed z-[9999] max-w-[220px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-2xl"
            style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
          >
            {tooltip.content}
          </div>
        )}

        <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white/90 px-4 py-3 text-xs text-slate-700 shadow-lg">
          <span>
            {visibleSeats.length} ghế có tọa độ
            {hiddenSeatCount > 0 ? ` · ${hiddenSeatCount} ghế chưa có tọa độ` : ''}
          </span>
          <span>Độ phóng {viewport.scale.toFixed(2)}x</span>
          {footer ? <span>{footer}</span> : null}
        </div>
      </div>
    </div>
  )
}
