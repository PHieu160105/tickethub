import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Copy, MapPin, Plus, RefreshCw, Ruler, Save, Ticket, Wand2 } from 'lucide-react'
import { useParams } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { adminApi, eventApi, extractApiErrorMessage, seatmapApi } from '@/lib/api'
import type { EventDetail, SeatMapResponse, SeatMapSeat, SeatZone, SeatMatrixResponse } from '@/types'

const DEFAULT_SINGLE_FORM = {
    seat_label: '',
    zone_id: '',
    x: '50',
    y: '50',
    rotation: '0',
    price: '',
}

const DEFAULT_BULK_FORM = {
    zone_id: '',
    pattern: 'straight' as 'straight' | 'arc',
    rows: '4',
    cols: '6',
    gap_x: '4',
    gap_y: '4',
    start_x: '20',
    start_y: '20',
    label_prefix: 'A',
    arc_center_x: '50',
    arc_center_y: '50',
    arc_radius: '25',
    arc_start_angle: '-45',
    arc_end_angle: '45',
}

function seatColor(seat: SeatMapSeat) {
    if (seat.status === 'sold') return 'bg-slate-700 border-slate-500 text-slate-300'
    if (seat.status === 'locked' && !seat.is_locked_by_me) return 'bg-amber-900/70 border-amber-500 text-amber-200'
    if (seat.is_locked_by_me) return 'bg-emerald-700 border-emerald-400 text-white'
    return 'bg-slate-800 border-white/20 text-white'
}

function formatSeatCount(value: number) {
    return value.toLocaleString('vi-VN')
}

export default function AdminSeatPlanner() {
    const { eventKey } = useParams<{ eventKey: string }>()
    const canvasRef = useRef<HTMLDivElement>(null)

    const [eventDetail, setEventDetail] = useState<EventDetail | null>(null)
    const [matrix, setMatrix] = useState<SeatMatrixResponse | null>(null)
    const [seatMap, setSeatMap] = useState<SeatMapResponse | null>(null)
    const [zones, setZones] = useState<SeatZone[]>([])
    const [loading, setLoading] = useState(true)
    const [busySingle, setBusySingle] = useState(false)
    const [busyBulk, setBusyBulk] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)
    const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null)
    const [singleForm, setSingleForm] = useState(DEFAULT_SINGLE_FORM)
    const [bulkForm, setBulkForm] = useState(DEFAULT_BULK_FORM)

    const currentZone = useMemo(
        () => zones.find((zone) => zone.id === selectedZoneId) ?? zones[0] ?? null,
        [zones, selectedZoneId],
    )

    async function loadData() {
        if (!eventKey) return
        setLoading(true)
        setError(null)
        setMessage(null)
        try {
            const [detail, matrixResponse, seatMapResponse] = await Promise.all([
                eventApi.detail(eventKey),
                eventApi.seats(eventKey),
                seatmapApi.get(eventKey),
            ])
            setEventDetail(detail)
            setMatrix(matrixResponse)
            setSeatMap(seatMapResponse)
            setZones(matrixResponse.zones)
            const nextZoneId = selectedZoneId ?? matrixResponse.zones[0]?.id ?? null
            setSelectedZoneId(nextZoneId)
            setSingleForm((previous) => ({ ...previous, zone_id: String(nextZoneId ?? ''), seat_label: previous.seat_label || `${matrixResponse.zones[0]?.code ?? 'A'}1` }))
            setBulkForm((previous) => ({ ...previous, zone_id: String(nextZoneId ?? '') }))
        } catch (errorValue) {
            setError(extractApiErrorMessage(errorValue, 'Không thể tải dữ liệu sơ đồ ghế.'))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eventKey])

    useEffect(() => {
        if (!zones.length) return
        const nextZoneId = selectedZoneId ?? zones[0].id
        setSelectedZoneId(nextZoneId)
        setSingleForm((previous) => ({ ...previous, zone_id: String(nextZoneId) }))
        setBulkForm((previous) => ({ ...previous, zone_id: String(nextZoneId) }))
    }, [zones, selectedZoneId])

    function handleCanvasClick(event: MouseEvent<HTMLDivElement>) {
        const rect = event.currentTarget.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) return
        const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100))
        const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))
        setSingleForm((previous) => ({
            ...previous,
            x: x.toFixed(2),
            y: y.toFixed(2),
        }))
    }

    async function handleSingleSubmit() {
        if (!eventKey || !singleForm.seat_label.trim() || !singleForm.zone_id) return
        setBusySingle(true)
        setError(null)
        setMessage(null)
        try {
            await adminApi.createEventSeatSingle(eventKey, {
                seat_label: singleForm.seat_label.trim(),
                x: Number(singleForm.x),
                y: Number(singleForm.y),
                rotation: Number(singleForm.rotation),
                zone_id: Number(singleForm.zone_id),
                price: singleForm.price ? Number(singleForm.price) : null,
            })
            setMessage('Đã tạo ghế lẻ thành công.')
            setSingleForm((previous) => ({
                ...previous,
                seat_label: '',
                price: '',
            }))
            await loadData()
        } catch (errorValue) {
            setError(extractApiErrorMessage(errorValue, 'Không thể tạo ghế lẻ.'))
        } finally {
            setBusySingle(false)
        }
    }

    async function handleBulkSubmit() {
        if (!eventKey || !bulkForm.zone_id) return
        setBusyBulk(true)
        setError(null)
        setMessage(null)
        try {
            await adminApi.createEventSeatBulk(eventKey, {
                zone_id: Number(bulkForm.zone_id),
                pattern: bulkForm.pattern,
                rows: Number(bulkForm.rows),
                cols: Number(bulkForm.cols),
                gap_x: Number(bulkForm.gap_x),
                gap_y: Number(bulkForm.gap_y),
                start_x: Number(bulkForm.start_x),
                start_y: Number(bulkForm.start_y),
                label_prefix: bulkForm.label_prefix.trim() || 'A',
                arc_config:
                    bulkForm.pattern === 'arc'
                        ? {
                            center_x: Number(bulkForm.arc_center_x),
                            center_y: Number(bulkForm.arc_center_y),
                            radius: Number(bulkForm.arc_radius),
                            start_angle: Number(bulkForm.arc_start_angle),
                            end_angle: Number(bulkForm.arc_end_angle),
                        }
                        : null,
            })
            setMessage('Đã sinh ghế hàng loạt thành công.')
            await loadData()
        } catch (errorValue) {
            setError(extractApiErrorMessage(errorValue, 'Không thể sinh ghế hàng loạt.'))
        } finally {
            setBusyBulk(false)
        }
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <Card className="bg-space-900/90 border-white/10">
                    <CardContent className="py-12 text-center text-slate-400">Đang tải sơ đồ ghế...</CardContent>
                </Card>
            </div>
        )
    }

    if (error || !eventDetail || !matrix || !seatMap) {
        return (
            <div className="space-y-6">
                <Card className="bg-space-900/90 border-white/10">
                    <CardContent className="py-12 text-center text-red-200">
                        <p>{error ?? 'Không thể tải sơ đồ ghế.'}</p>
                        <div className="mt-4">
                            <Button variant="outline" onClick={() => void loadData()}>
                                <RefreshCw className="h-4 w-4" /> Tải lại
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Seat Placement Studio</p>
                    <h1 className="text-3xl font-black text-white">{eventDetail.title}</h1>
                    <p className="mt-1 text-slate-400">
                        {eventDetail.venue} · {seatMap.venue_name}
                    </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void loadData()}>
                    <RefreshCw className="h-4 w-4" /> Làm mới
                </Button>
            </div>

            {(error || message) && (
                <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>
                    {error ?? message}
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.9fr] gap-6">
                <Card className="bg-space-900/90 border-white/10">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-white">
                            <MapPin className="h-5 w-5 text-brand-red" /> Coordinate Canvas
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div
                            ref={canvasRef}
                            onClick={handleCanvasClick}
                            className="relative h-[540px] overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_center,_rgba(252,83,109,0.12)_0%,_rgba(15,23,42,0.92)_55%,_rgba(2,6,23,1)_100%)] cursor-crosshair"
                        >
                            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '10% 10%' }} />
                            <div className="absolute left-1/2 top-8 -translate-x-1/2 rounded-full border border-brand-yellow/50 bg-brand-yellow/10 px-4 py-1 text-xs uppercase tracking-[0.2em] text-brand-yellow">
                                Stage / Front
                            </div>
                            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-slate-400">
                                <span>Click to place a single seat. Coordinates are stored as 0-100%.</span>
                                <span>{seatMap.seat_count} seats</span>
                            </div>

                            {seatMap.seats
                                .filter((seat) => seat.x !== null && seat.y !== null)
                                .map((seat) => (
                                    <button
                                        key={seat.id}
                                        type="button"
                                        className={`absolute flex h-7 min-w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border px-2 text-[10px] font-semibold shadow-lg ${seatColor(seat)}`}
                                        style={{ left: `${seat.x}%`, top: `${seat.y}%`, transform: `translate(-50%, -50%) rotate(${seat.rotation}deg)` }}
                                        title={`${seat.label} · ${seat.section_name ?? 'No section'} · ${Number(seat.price).toFixed(2)}`}
                                    >
                                        {seat.label}
                                    </button>
                                ))}

                            {singleForm.x && singleForm.y && (
                                <div
                                    className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand-red bg-brand-red/30 shadow-[0_0_0_6px_rgba(252,83,109,0.18)]"
                                    style={{ left: `${singleForm.x}%`, top: `${singleForm.y}%` }}
                                    title="Current single-seat target"
                                />
                            )}
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card className="bg-space-900/90 border-white/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-white">
                                <Ticket className="h-5 w-5 text-brand-yellow" /> Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm text-slate-300">
                            <div className="flex items-center justify-between">
                                <span>Event</span>
                                <span className="text-white">{eventDetail.slug}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Zones</span>
                                <span className="text-white">{formatSeatCount(matrix.zones.length)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Current seats</span>
                                <span className="text-white">{formatSeatCount(seatMap.seat_count)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Selected zone</span>
                                <span className="text-white">{currentZone ? `${currentZone.code} · ${currentZone.name}` : 'None'}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-space-900/90 border-white/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-white">
                                <Plus className="h-5 w-5 text-emerald-400" /> Single Seat
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <Input placeholder="Seat label" value={singleForm.seat_label} onChange={(event) => setSingleForm({ ...singleForm, seat_label: event.target.value })} />
                                <select
                                    className="h-11 rounded-lg border border-white/10 bg-space-700/50 px-3 text-white outline-none"
                                    value={singleForm.zone_id}
                                    onChange={(event) => setSingleForm({ ...singleForm, zone_id: event.target.value })}
                                >
                                    <option value="">Select zone</option>
                                    {zones.map((zone) => (
                                        <option key={zone.id} value={zone.id}>
                                            {zone.code} · {zone.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <Input type="number" step="0.01" placeholder="X %" value={singleForm.x} onChange={(event) => setSingleForm({ ...singleForm, x: event.target.value })} />
                                <Input type="number" step="0.01" placeholder="Y %" value={singleForm.y} onChange={(event) => setSingleForm({ ...singleForm, y: event.target.value })} />
                                <Input type="number" step="0.01" placeholder="Rotation" value={singleForm.rotation} onChange={(event) => setSingleForm({ ...singleForm, rotation: event.target.value })} />
                            </div>
                            <Input type="number" step="0.01" placeholder="Price override (optional)" value={singleForm.price} onChange={(event) => setSingleForm({ ...singleForm, price: event.target.value })} />
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <Ruler className="h-4 w-4" /> Click the canvas to fill x/y automatically.
                            </div>
                            <Button className="w-full" onClick={() => void handleSingleSubmit()} isLoading={busySingle} disabled={!singleForm.zone_id || !singleForm.seat_label.trim()}>
                                <Save className="h-4 w-4" /> Create seat
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="bg-space-900/90 border-white/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-white">
                                <Wand2 className="h-5 w-5 text-cyan-400" /> Bulk Generator
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <select
                                    className="h-11 rounded-lg border border-white/10 bg-space-700/50 px-3 text-white outline-none"
                                    value={bulkForm.zone_id}
                                    onChange={(event) => setBulkForm({ ...bulkForm, zone_id: event.target.value })}
                                >
                                    <option value="">Select zone</option>
                                    {zones.map((zone) => (
                                        <option key={zone.id} value={zone.id}>
                                            {zone.code} · {zone.name}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    className="h-11 rounded-lg border border-white/10 bg-space-700/50 px-3 text-white outline-none"
                                    value={bulkForm.pattern}
                                    onChange={(event) => setBulkForm({ ...bulkForm, pattern: event.target.value as 'straight' | 'arc' })}
                                >
                                    <option value="straight">straight</option>
                                    <option value="arc">arc</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Input type="number" min={1} placeholder="Rows" value={bulkForm.rows} onChange={(event) => setBulkForm({ ...bulkForm, rows: event.target.value })} />
                                <Input type="number" min={1} placeholder="Cols" value={bulkForm.cols} onChange={(event) => setBulkForm({ ...bulkForm, cols: event.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Input type="number" step="0.01" placeholder="Gap X" value={bulkForm.gap_x} onChange={(event) => setBulkForm({ ...bulkForm, gap_x: event.target.value })} />
                                <Input type="number" step="0.01" placeholder="Gap Y" value={bulkForm.gap_y} onChange={(event) => setBulkForm({ ...bulkForm, gap_y: event.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Input type="number" step="0.01" placeholder="Start X" value={bulkForm.start_x} onChange={(event) => setBulkForm({ ...bulkForm, start_x: event.target.value })} />
                                <Input type="number" step="0.01" placeholder="Start Y" value={bulkForm.start_y} onChange={(event) => setBulkForm({ ...bulkForm, start_y: event.target.value })} />
                            </div>
                            <Input placeholder="Label prefix" value={bulkForm.label_prefix} onChange={(event) => setBulkForm({ ...bulkForm, label_prefix: event.target.value })} />

                            {bulkForm.pattern === 'arc' && (
                                <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Arc config</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input type="number" step="0.01" placeholder="Center X" value={bulkForm.arc_center_x} onChange={(event) => setBulkForm({ ...bulkForm, arc_center_x: event.target.value })} />
                                        <Input type="number" step="0.01" placeholder="Center Y" value={bulkForm.arc_center_y} onChange={(event) => setBulkForm({ ...bulkForm, arc_center_y: event.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <Input type="number" step="0.01" placeholder="Radius" value={bulkForm.arc_radius} onChange={(event) => setBulkForm({ ...bulkForm, arc_radius: event.target.value })} />
                                        <Input type="number" step="0.01" placeholder="Start angle" value={bulkForm.arc_start_angle} onChange={(event) => setBulkForm({ ...bulkForm, arc_start_angle: event.target.value })} />
                                        <Input type="number" step="0.01" placeholder="End angle" value={bulkForm.arc_end_angle} onChange={(event) => setBulkForm({ ...bulkForm, arc_end_angle: event.target.value })} />
                                    </div>
                                </div>
                            )}

                            <Button className="w-full" onClick={() => void handleBulkSubmit()} isLoading={busyBulk} disabled={!bulkForm.zone_id}>
                                <Copy className="h-4 w-4" /> Generate seats
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Card className="bg-space-900/90 border-white/10">
                <CardHeader>
                    <CardTitle className="text-white">Seat inventory by zone</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {matrix.zones.map((zone) => {
                            const zoneSeats = matrix.seats.filter((seat) => seat.zone_id === zone.id)
                            return (
                                <div key={zone.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-white">{zone.name}</p>
                                            <p className="text-xs text-slate-400">{zone.code} · {Number(zone.price).toLocaleString('vi-VN')}</p>
                                        </div>
                                        <span className="text-xs text-slate-400">{zoneSeats.length} seats</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {zoneSeats.slice(0, 20).map((seat) => (
                                            <span key={seat.id} className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${seatColor(seat)}`}>
                                                {seat.seat_label}
                                            </span>
                                        ))}
                                        {zoneSeats.length > 20 && <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-slate-400">+{zoneSeats.length - 20} more</span>}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
