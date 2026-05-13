import { useEffect, useMemo, useRef, useState, type MouseEvent, type WheelEvent } from 'react'
import { Copy, FileUp, Hand, MapPin, MousePointer2, Plus, Redo2, RefreshCw, Save, Shapes, Ticket, Trash2, Undo2, Wand2 } from 'lucide-react'
import { useParams } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { InteractiveSeatCanvas } from '@/components/admin/InteractiveSeatCanvas'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { GlobalLoader } from '@/components/ui/GlobalLoader'
import { adminApi, eventApi, extractApiErrorMessage, seatmapApi } from '@/lib/api'
import type { Seat, SeatMapPolygon, SeatMapResponse, SeatMapSeat, SeatZone, SeatMatrixResponse, ShowDetail } from '@/types'

const DEFAULT_SINGLE_FORM = {
    seat_label: '',
    zone_id: '',
    x: '50',
    y: '50',
    rotation: '0',
    price: '',
    is_admin_locked: false,
}

const DEFAULT_BULK_FORM = {
    zone_id: '',
    pattern: 'straight' as 'straight' | 'arc' | 'zigzag',
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

const DEFAULT_POLYGON_FORM = {
    label: '',
    zone_id: '',
}

const DEFAULT_ZONE_FORM = {
    code: '',
    name: '',
    row_count: '1',
    seats_per_row: '1',
    price: '0',
    color: '#ef4444',
}

function computeCentroid(points: { x: number; y: number }[]) {
    if (points.length === 0) return { x: 50, y: 50 }
    return {
        x: points.reduce((s, p) => s + p.x, 0) / points.length,
        y: points.reduce((s, p) => s + p.y, 0) / points.length,
    }
}

function zoneFormFromZone(zone: SeatZone) {
    return {
        code: zone.code,
        name: zone.name,
        row_count: String(zone.row_count),
        seats_per_row: String(zone.seats_per_row),
        price: String(zone.price),
        color: zone.color,
    }
}

function seatColor(seat: Pick<SeatMapSeat, 'status' | 'is_locked_by_me' | 'is_admin_locked'> | Pick<Seat, 'status' | 'is_locked_by_me' | 'is_admin_locked'>) {
    if (seat.status === 'sold') return 'bg-slate-700 border-slate-500 text-slate-300'
    if (seat.is_admin_locked) return 'bg-rose-700 border-rose-400 text-white'
    if (seat.status === 'locked' && !seat.is_locked_by_me) return 'bg-amber-900/70 border-amber-500 text-amber-200'
    if (seat.is_locked_by_me) return 'bg-emerald-700 border-emerald-400 text-white'
    return 'bg-slate-800 border-white/20 text-white'
}

function formatSeatCount(value: number) {
    return value.toLocaleString('vi-VN')
}

function polygonPoints(points: SeatMapPolygon['points']) {
    return points.map((point) => `${point.x},${point.y}`).join(' ')
}

export default function AdminSeatPlanner() {
    const { eventKey, showId: showIdParam } = useParams<{ eventKey: string; showId: string }>()
    const showId = Number(showIdParam ?? '')
    const canvasRef = useRef<HTMLDivElement>(null)
    const savedSeatsRef = useRef<SeatMapSeat[]>([])
    const savedMatrixSeatsRef = useRef<Seat[]>([])
    const savedPolygonsRef = useRef<SeatMapPolygon[]>([])
    const tempSeatIdRef = useRef(-1)
    const tempPolygonIdRef = useRef(-1)
    const suppressNextCanvasClickRef = useRef(false)

    const [showDetail, setShowDetail] = useState<ShowDetail | null>(null)
    const [matrix, setMatrix] = useState<SeatMatrixResponse | null>(null)
    const [seatMap, setSeatMap] = useState<SeatMapResponse | null>(null)
    const [zones, setZones] = useState<SeatZone[]>([])
    const [loading, setLoading] = useState(true)
    const [busySingle, setBusySingle] = useState(false)
    const [busyBulk] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)
    const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null)
    const [singleForm, setSingleForm] = useState(DEFAULT_SINGLE_FORM)
    const [bulkForm, setBulkForm] = useState(DEFAULT_BULK_FORM)
    const [plannerTool, setPlannerTool] = useState<'single' | 'bulk' | 'polygon' | 'pan' | 'select'>('single')
    const [canvasCursor, setCanvasCursor] = useState<{ x: number; y: number } | null>(null)
    const [selectedSeatIds, setSelectedSeatIds] = useState<number[]>([])
    const [editingSeatId, setEditingSeatId] = useState<number | null>(null)
    const [draggingSeatId, setDraggingSeatId] = useState<number | null>(null)
    const [dragStartSeatPosition, setDragStartSeatPosition] = useState<{ x: number; y: number } | null>(null)
    const [dragSeatPosition, setDragSeatPosition] = useState<{ x: number; y: number } | null>(null)
    const [dragSelectedSeatStartPositions, setDragSelectedSeatStartPositions] = useState<Record<number, { x: number; y: number }> | null>(null)
    const [plannerDirty, setPlannerDirty] = useState(false)
    const [pendingDeletedSeatIds, setPendingDeletedSeatIds] = useState<number[]>([])
    const [pendingDeletedPolygonIds, setPendingDeletedPolygonIds] = useState<number[]>([])
    const [viewport, setViewport] = useState({ scale: 1, offsetX: 0, offsetY: 0 })
    const [isPanning, setIsPanning] = useState(false)
    const [panStartCursor, setPanStartCursor] = useState<{ x: number; y: number } | null>(null)
    const [panStartOffset, setPanStartOffset] = useState<{ x: number; y: number } | null>(null)
    const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null)
    const [selectionCurrent, setSelectionCurrent] = useState<{ x: number; y: number } | null>(null)
    const [zoneForm, setZoneForm] = useState(DEFAULT_ZONE_FORM)
    const [editingZoneId, setEditingZoneId] = useState<number | null>(null)
    const [polygonForm, setPolygonForm] = useState(DEFAULT_POLYGON_FORM)
    const [editingPolygonId, setEditingPolygonId] = useState<number | null>(null)
    const [draftPolygonPoints, setDraftPolygonPoints] = useState<Array<{ x: number; y: number }>>([])
    const [draggingPolygonPointIndex, setDraggingPolygonPointIndex] = useState<number | null>(null)
    const [draggingPolygonBody, setDraggingPolygonBody] = useState(false)
    const [dragPolygonStartCursor, setDragPolygonStartCursor] = useState<{ x: number; y: number } | null>(null)
    const [dragPolygonStartPoints, setDragPolygonStartPoints] = useState<Array<{ x: number; y: number }> | null>(null)
    const [historyPast, setHistoryPast] = useState<Array<{ seatMapSeats: SeatMapSeat[]; matrixSeats: Seat[]; polygons: SeatMapPolygon[]; deletedSeatIds: number[]; deletedPolygonIds: number[]; selectedSeatIds: number[] }>>([])
    const [historyFuture, setHistoryFuture] = useState<Array<{ seatMapSeats: SeatMapSeat[]; matrixSeats: Seat[]; polygons: SeatMapPolygon[]; deletedSeatIds: number[]; deletedPolygonIds: number[]; selectedSeatIds: number[] }>>([])
    const [plannerBackground, setPlannerBackground] = useState<string | null>(null)
    const [seatSize, setSeatSize] = useState(1.5)
    const [snapToGrid, setSnapToGrid] = useState(false)
    const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null)

    const currentZone = useMemo(
        () => zones.find((zone) => zone.id === selectedZoneId) ?? zones[0] ?? null,
        [zones, selectedZoneId],
    )
    const seatZoneMap = useMemo(() => new Map(seatMap?.seats.map((seat) => [seat.id, seat.zone_id]) ?? []), [seatMap?.seats])
    const zoneMap = useMemo(() => new Map(zones.map((zone) => [zone.id, zone])), [zones])
    const zoneSectionMap = useMemo(() => {
        const next = new Map<number, number>()
        seatMap?.seats.forEach((seat) => {
            if (seat.zone_id !== null && seat.section_id !== null && !next.has(seat.zone_id)) {
                next.set(seat.zone_id, seat.section_id)
            }
        })
        return next
    }, [seatMap?.seats])
    const selectedSeat = useMemo(() => seatMap?.seats.find((seat) => seat.id === selectedSeatIds[0]) ?? null, [seatMap?.seats, selectedSeatIds])
    const canEditPolygons = zones.length > 0
    const canCreateInitialZone = showDetail?.venue_layout_id == null
    const seatPositionMap = useMemo(() => {
        const next = new Map<number, { x: number; y: number }>()
        seatMap?.seats.forEach((seat) => {
            next.set(seat.id, {
                x: seat.id === draggingSeatId && dragSeatPosition ? dragSeatPosition.x : seat.x ?? 0,
                y: seat.id === draggingSeatId && dragSeatPosition ? dragSeatPosition.y : seat.y ?? 0,
            })
        })
        return next
    }, [seatMap?.seats, draggingSeatId, dragSeatPosition])

    function cloneSeatMapSeats(seats: SeatMapSeat[]) {
        return seats.map((seat) => ({ ...seat }))
    }

    function cloneMatrixSeats(seats: Seat[]) {
        return seats.map((seat) => ({ ...seat }))
    }

    function clonePolygons(polygons: SeatMapPolygon[]) {
        return polygons.map((polygon) => ({
            ...polygon,
            points: polygon.points.map((point) => ({ ...point })),
        }))
    }

    function pushHistorySnapshot() {
        setHistoryPast((previous) => [...previous, { seatMapSeats: cloneSeatMapSeats(seatMap?.seats ?? []), matrixSeats: cloneMatrixSeats(matrix?.seats ?? []), polygons: clonePolygons(seatMap?.polygons ?? []), deletedSeatIds: [...pendingDeletedSeatIds], deletedPolygonIds: [...pendingDeletedPolygonIds], selectedSeatIds: [...selectedSeatIds] }].slice(-50))
        setHistoryFuture([])
    }

    function syncSavedSeats(seats: SeatMapSeat[]) {
        savedSeatsRef.current = cloneSeatMapSeats(seats)
    }

    function syncSavedMatrixSeats(seats: Seat[]) {
        savedMatrixSeatsRef.current = cloneMatrixSeats(seats)
    }

    function syncSavedPolygons(polygons: SeatMapPolygon[]) {
        savedPolygonsRef.current = clonePolygons(polygons)
    }

    function nextTempSeatId() {
        const nextId = tempSeatIdRef.current
        tempSeatIdRef.current -= 1
        return nextId
    }

    function nextTempPolygonId() {
        const nextId = tempPolygonIdRef.current
        tempPolygonIdRef.current -= 1
        return nextId
    }

    function discardPlannerChanges() {
        setSeatMap((previous) => (previous ? { ...previous, seats: cloneSeatMapSeats(savedSeatsRef.current), polygons: clonePolygons(savedPolygonsRef.current), seat_count: savedSeatsRef.current.length } : previous))
        setMatrix((previous) => (previous ? { ...previous, seats: cloneMatrixSeats(savedMatrixSeatsRef.current) } : previous))
        setPendingDeletedSeatIds([])
        setPendingDeletedPolygonIds([])
        setSelectedSeatIds([])
        setPlannerDirty(false)
        setHistoryPast([])
        setHistoryFuture([])
        setDragSelectedSeatStartPositions(null)
    }

    function confirmLeavePlannerIfDirty() {
        if (!plannerDirty) return true
        return window.confirm('Anh đang có thay đổi sơ đồ ghế chưa lưu. Thoát ra sẽ mất các thay đổi này. Vẫn tiếp tục?')
    }

    function pushNotice(kind: 'error' | 'success', text: string) {
        if (kind === 'error') {
            setError(text)
            setTimeout(() => setError((current) => (current === text ? null : current)), 3500)
            return
        }
        setMessage(text)
        setTimeout(() => setMessage((current) => (current === text ? null : current)), 2500)
    }

    function seatStyle(seat: SeatMapSeat) {
        const zoneId = seat.zone_id ?? seatZoneMap.get(seat.id)
        const zoneColor = zoneId ? zoneMap.get(zoneId)?.color : undefined
        return {
            backgroundColor: seat.is_admin_locked ? undefined : (zoneColor ? `${zoneColor}cc` : undefined),
            borderColor: seat.is_admin_locked ? undefined : zoneColor ?? undefined,
        }
    }

    function startEditPolygon(polygon: SeatMapPolygon) {
        setEditingPolygonId(polygon.id)
        setPlannerTool('polygon')
        setPolygonForm({
            label: polygon.label ?? '',
            zone_id: polygon.zone_id ? String(polygon.zone_id) : '',
        })
        setDraftPolygonPoints(polygon.points.map((point) => ({ x: point.x, y: point.y })))
    }

    function startEditZone(zone: SeatZone) {
        setEditingZoneId(zone.id)
        setSelectedZoneId(zone.id)
        setZoneForm(zoneFormFromZone(zone))
    }

    function resetZoneForm(nextZoneId?: number | null) {
        setEditingZoneId(null)
        setZoneForm(DEFAULT_ZONE_FORM)
        if (nextZoneId !== undefined) {
            setSelectedZoneId(nextZoneId)
            setSingleForm((previous) => ({ ...previous, zone_id: nextZoneId ? String(nextZoneId) : '' }))
            setBulkForm((previous) => ({ ...previous, zone_id: nextZoneId ? String(nextZoneId) : '' }))
        }
    }

    function cancelPolygonEditing() {
        setEditingPolygonId(null)
        setDraftPolygonPoints([])
        setDraggingPolygonPointIndex(null)
        setDraggingPolygonBody(false)
        setDragPolygonStartCursor(null)
        setDragPolygonStartPoints(null)
        setPolygonForm(DEFAULT_POLYGON_FORM)
    }

    async function handleSaveZone() {
        if (!eventKey || !showId) return
        if (!zoneForm.code.trim() || !zoneForm.name.trim()) {
            pushNotice('error', 'Zone cần có code và tên.')
            return
        }
        if (plannerDirty && !window.confirm('Lưu zone sẽ tải lại planner. Các thay đổi ghế chưa lưu sẽ bị mất. Tiếp tục?')) {
            return
        }

        setBusySingle(true)
        setError(null)
        setMessage(null)
        try {
            const payload = {
                code: zoneForm.code.trim(),
                name: zoneForm.name.trim(),
                row_count: Math.max(1, Number(zoneForm.row_count) || 1),
                seats_per_row: Math.max(1, Number(zoneForm.seats_per_row) || 1),
                price: Math.max(0, Number(zoneForm.price) || 0),
                color: zoneForm.color.trim() || '#ef4444',
            }
            if (editingZoneId) {
                await adminApi.updateZone(eventKey, showId, editingZoneId, { ...payload, regenerate_seats: false })
                pushNotice('success', 'Đã cập nhật zone.')
                await loadData()
                setSelectedZoneId(editingZoneId)
            } else {
                const created = await adminApi.createZone(eventKey, showId, { ...payload, generate_seats: false })
                pushNotice('success', 'Đã tạo zone mới.')
                await loadData()
                setSelectedZoneId(created.id)
                setSingleForm((previous) => ({ ...previous, zone_id: String(created.id) }))
                setBulkForm((previous) => ({ ...previous, zone_id: String(created.id) }))
            }
            resetZoneForm()
        } catch (errorValue) {
            pushNotice('error', extractApiErrorMessage(errorValue, 'Không thể lưu zone.'))
        } finally {
            setBusySingle(false)
        }
    }

    async function handleCreateInitialZone() {
        if (!eventKey || !showId) return
        if (!zoneForm.code.trim() || !zoneForm.name.trim()) {
            pushNotice('error', 'Zone cần có code và tên.')
            return
        }
        if (!canCreateInitialZone) {
            pushNotice('error', 'Zone khởi tạo chỉ áp dụng cho show dạng chỗ tự do.')
            return
        }
        if (plannerDirty && !window.confirm('Tạo zone khởi tạo sẽ tải lại planner. Các thay đổi ghế hoặc polygon chưa lưu sẽ bị mất. Tiếp tục?')) {
            return
        }

        setBusySingle(true)
        setError(null)
        setMessage(null)
        try {
            const payload = {
                code: zoneForm.code.trim(),
                name: zoneForm.name.trim(),
                row_count: Math.max(1, Number(zoneForm.row_count) || 1),
                seats_per_row: Math.max(1, Number(zoneForm.seats_per_row) || 1),
                price: Math.max(0, Number(zoneForm.price) || 0),
                color: zoneForm.color.trim() || '#ef4444',
            }
            const created = await adminApi.createInitialZone(eventKey, showId, payload)
            pushNotice('success', 'Đã tạo zone khởi tạo cùng ghế mặc định và polygon bao quanh.')
            await loadData()
            setSelectedZoneId(created.id)
            setSingleForm((previous) => ({ ...previous, zone_id: String(created.id) }))
            setBulkForm((previous) => ({ ...previous, zone_id: String(created.id) }))
            resetZoneForm()
        } catch (errorValue) {
            pushNotice('error', extractApiErrorMessage(errorValue, 'Không thể tạo zone khởi tạo.'))
        } finally {
            setBusySingle(false)
        }
    }

    async function handleDeleteZone(zoneId: number) {
        if (!eventKey || !showId) return
        if (!window.confirm('Xóa zone này?')) return
        if (plannerDirty && !window.confirm('Xóa zone sẽ tải lại planner. Các thay đổi ghế chưa lưu sẽ bị mất. Tiếp tục?')) {
            return
        }

        setBusySingle(true)
        setError(null)
        setMessage(null)
        try {
            await adminApi.deleteZone(eventKey, showId, zoneId)
            pushNotice('success', 'Đã xóa zone.')
            await loadData()
            resetZoneForm()
            if (selectedZoneId === zoneId) {
                setSelectedZoneId(null)
            }
        } catch (errorValue) {
            pushNotice('error', extractApiErrorMessage(errorValue, 'Không thể xóa zone.'))
        } finally {
            setBusySingle(false)
        }
    }

    async function loadData() {
        if (!eventKey || !showId || Number.isNaN(showId)) return
        setLoading(true)
        setError(null)
        setMessage(null)
        try {
            const [detail, matrixResponse, seatMapResponse] = await Promise.all([
                adminApi.getShow(eventKey, showId),
                eventApi.seats(showId),
                seatmapApi.get(showId),
            ])
            if (detail.venue_id) {
                try {
                    const venueDetail = await adminApi.getVenue(detail.venue_id)
                    setPlannerBackground(venueDetail.background_source ?? venueDetail.svg_source ?? null)
                } catch {
                    setPlannerBackground(null)
                }
            } else {
                setPlannerBackground(null)
            }
            setShowDetail(detail)
            setMatrix(matrixResponse)
            setSeatMap(seatMapResponse)
            setZones(matrixResponse.zones)
            syncSavedSeats(matrixResponse && seatMapResponse ? seatMapResponse.seats : [])
            syncSavedMatrixSeats(matrixResponse.seats)
            syncSavedPolygons(seatMapResponse.polygons)
            setPendingDeletedSeatIds([])
            setPendingDeletedPolygonIds([])
            setPlannerDirty(false)
            setSelectedSeatIds([])
            setHistoryPast([])
            setHistoryFuture([])
            setDragSelectedSeatStartPositions(null)
            const nextZoneId = selectedZoneId ?? matrixResponse.zones[0]?.id ?? null
            setSelectedZoneId(nextZoneId)
            resetZoneForm(nextZoneId)
            setSingleForm((previous) => ({ ...previous, zone_id: String(nextZoneId ?? ''), seat_label: previous.seat_label || `${matrixResponse.zones[0]?.code ?? 'A'}1` }))
            setBulkForm((previous) => ({ ...previous, zone_id: String(nextZoneId ?? '') }))
        } catch (errorValue) {
            setError(extractApiErrorMessage(errorValue, 'Không thể tải dữ liệu sơ đồ ghế.'))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!plannerDirty) return

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault()
            event.returnValue = ''
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
        }
    }, [plannerDirty])

    useEffect(() => {
        void loadData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eventKey, showId])

    useEffect(() => {
        if (!zones.length) return
        const nextZoneId = selectedZoneId ?? zones[0].id
        setSelectedZoneId(nextZoneId)
        setSingleForm((previous) => ({ ...previous, zone_id: String(nextZoneId) }))
        setBulkForm((previous) => ({ ...previous, zone_id: String(nextZoneId) }))
    }, [zones, selectedZoneId])

    useEffect(() => {
        if (!selectedSeat || selectedSeatIds.length !== 1) {
            setEditingSeatId(null)
            return
        }
        setEditingSeatId(selectedSeat.id)
        const matrixSeat = matrix?.seats.find((seat) => seat.id === selectedSeat.id)
        setSingleForm({
            seat_label: selectedSeat.label,
            zone_id: String(matrixSeat?.zone_id ?? ''),
            x: String(selectedSeat.x ?? 0),
            y: String(selectedSeat.y ?? 0),
            rotation: String(selectedSeat.rotation),
            price: matrixSeat ? String(matrixSeat.price) : String(selectedSeat.price),
            is_admin_locked: selectedSeat.is_admin_locked,
        })
    }, [selectedSeat, selectedSeatIds.length, matrix?.seats])

    function applySnap(value: number) {
        if (!snapToGrid) return value
        return Math.round(value / 5) * 5
    }

    function handleCanvasClick(event: MouseEvent<HTMLDivElement>) {
        if (draggingSeatId !== null || draggingPolygonBody || draggingPolygonPointIndex !== null) return
        if (suppressNextCanvasClickRef.current) { suppressNextCanvasClickRef.current = false; return }
        const rect = event.currentTarget.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) return
        const x = applySnap(Math.max(0, Math.min(100, (((event.clientX - rect.left - viewport.offsetX) / viewport.scale) / rect.width) * 100)))
        const y = applySnap(Math.max(0, Math.min(100, (((event.clientY - rect.top - viewport.offsetY) / viewport.scale) / rect.height) * 100)))
        if (plannerTool === 'polygon') {
            setDraftPolygonPoints((previous) => [...previous, { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) }])
            return
        }
        if (plannerTool !== 'single') return
        setSingleForm((previous) => ({
            ...previous,
            x: x.toFixed(2),
            y: y.toFixed(2),
        }))
    }

    function handleCanvasMouseMove(event: MouseEvent<HTMLDivElement>) {
        const rect = event.currentTarget.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) return
        const x = Math.max(0, Math.min(100, (((event.clientX - rect.left - viewport.offsetX) / viewport.scale) / rect.width) * 100))
        const y = Math.max(0, Math.min(100, (((event.clientY - rect.top - viewport.offsetY) / viewport.scale) / rect.height) * 100))
        setCanvasCursor({ x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) })
    }

    function getCanvasCoordinates(clientX: number, clientY: number) {
        const element = canvasRef.current
        if (!element) return null
        const rect = element.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) return null
        const x = Math.max(0, Math.min(100, (((clientX - rect.left - viewport.offsetX) / viewport.scale) / rect.width) * 100))
        const y = Math.max(0, Math.min(100, (((clientY - rect.top - viewport.offsetY) / viewport.scale) / rect.height) * 100))
        return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) }
    }

    function handlePolygonMouseDown(event: MouseEvent<SVGPolygonElement>, polygon: SeatMapPolygon) {
        event.preventDefault()
        event.stopPropagation()

        if (editingPolygonId !== polygon.id) {
            startEditPolygon(polygon)
            return
        }

        const coordinates = getCanvasCoordinates(event.clientX, event.clientY)
        if (!coordinates) return
        setDraggingPolygonPointIndex(null)
        setDraggingPolygonBody(true)
        setDragPolygonStartCursor(coordinates)
        setDragPolygonStartPoints(draftPolygonPoints.map((point) => ({ x: point.x, y: point.y })))
    }

    function handleCanvasMouseDown(event: MouseEvent<HTMLDivElement>) {
        if (plannerTool === 'select') {
            const coordinates = getCanvasCoordinates(event.clientX, event.clientY)
            if (!coordinates) return
            event.preventDefault()
            setSelectionStart(coordinates)
            setSelectionCurrent(coordinates)
            return
        }
        const shouldPan = plannerTool === 'pan' || event.button === 1 || event.shiftKey
        if (!shouldPan) return
        event.preventDefault()
        event.stopPropagation()
        setIsPanning(true)
        setPanStartCursor({ x: event.clientX, y: event.clientY })
        setPanStartOffset({ x: viewport.offsetX, y: viewport.offsetY })
    }

    function handleCanvasWheel(event: WheelEvent<HTMLDivElement>) {
        event.preventDefault()
        const element = canvasRef.current
        if (!element) return
        const rect = element.getBoundingClientRect()
        const pointerX = event.clientX - rect.left
        const pointerY = event.clientY - rect.top
        setViewport((previous) => {
            const factor = event.deltaY < 0 ? 1.1 : 0.9
            const nextScale = Math.max(0.6, Math.min(3, Number((previous.scale * factor).toFixed(2))))
            const logicalX = (pointerX - previous.offsetX) / previous.scale
            const logicalY = (pointerY - previous.offsetY) / previous.scale
            return {
                scale: nextScale,
                offsetX: pointerX - logicalX * nextScale,
                offsetY: pointerY - logicalY * nextScale,
            }
        })
    }

    function zoomCanvas(factor: number) {
        setViewport((previous) => ({
            ...previous,
            scale: Math.max(0.6, Math.min(3, Number((previous.scale * factor).toFixed(2)))),
        }))
    }

    function appendSingleSeatLocally(created: { id: number; seat_label: string; x: number | null; y: number | null }) {
        const zone = zones.find((item) => item.id === Number(singleForm.zone_id))
        if (!zone) return
        const nextSectionId = zoneSectionMap.get(zone.id) ?? null
        const nextSectionName = nextSectionId ? seatMap?.sections.find((section) => section.id === nextSectionId)?.name ?? null : null
        setSeatMap((previous) =>
            previous
                ? {
                    ...previous,
                    seat_count: previous.seat_count + 1,
                    seats: [
                        ...previous.seats,
                        {
                            id: created.id,
                            label: created.seat_label,
                            x: created.x,
                            y: created.y,
                            rotation: Number(singleForm.rotation),
                            zone_id: zone.id,
                            zone_name: zone.name,
                            section_id: nextSectionId,
                            section_name: nextSectionName,
                            price: singleForm.price ? Number(singleForm.price) : zone.price,
                            status: singleForm.is_admin_locked ? 'locked' : 'available',
                            lock_expires_at: null,
                            is_locked_by_me: false,
                            is_admin_locked: singleForm.is_admin_locked,
                        },
                    ],
                }
                : previous,
        )
        setMatrix((previous) =>
            previous
                ? {
                    ...previous,
                    seats: [
                        ...previous.seats,
                        {
                            id: created.id,
                            zone_id: zone.id,
                            row_index: 0,
                            row_label: '',
                            seat_number: 0,
                            seat_label: created.seat_label,
                            price: singleForm.price ? Number(singleForm.price) : zone.price,
                            status: singleForm.is_admin_locked ? 'locked' : 'available',
                            lock_expires_at: null,
                            is_locked_by_me: false,
                            is_admin_locked: singleForm.is_admin_locked,
                        },
                    ],
                }
                : previous,
        )
    }

    function appendBulkSeatsLocally(createdSeats: Array<{ id: number; seat_label: string; x: number | null; y: number | null }>) {
        const zone = zones.find((item) => item.id === Number(bulkForm.zone_id))
        if (!zone || createdSeats.length === 0) return
        const nextSectionId = zoneSectionMap.get(zone.id) ?? null
        const nextSectionName = nextSectionId ? seatMap?.sections.find((section) => section.id === nextSectionId)?.name ?? null : null
        setSeatMap((previous) =>
            previous
                ? {
                    ...previous,
                    seat_count: previous.seat_count + createdSeats.length,
                    seats: [
                        ...previous.seats,
                        ...createdSeats.map((seat) => ({
                            id: seat.id,
                            label: seat.seat_label,
                            x: seat.x,
                            y: seat.y,
                            rotation: 0,
                            zone_id: zone.id,
                            zone_name: zone.name,
                            section_id: nextSectionId,
                            section_name: nextSectionName,
                            price: zone.price,
                            status: 'available' as const,
                            lock_expires_at: null,
                            is_locked_by_me: false,
                            is_admin_locked: false,
                        })),
                    ],
                }
                : previous,
        )
        setMatrix((previous) =>
            previous
                ? {
                    ...previous,
                    seats: [
                        ...previous.seats,
                        ...createdSeats.map((seat) => ({
                            id: seat.id,
                            zone_id: zone.id,
                            row_index: 0,
                            row_label: '',
                            seat_number: 0,
                            seat_label: seat.seat_label,
                            price: zone.price,
                            status: 'available' as const,
                            lock_expires_at: null,
                            is_locked_by_me: false,
                            is_admin_locked: false,
                        })),
                    ],
                }
                : previous,
        )
    }

    async function handleSingleSubmit() {
        if (!eventKey || !showId || !singleForm.seat_label.trim() || !singleForm.zone_id) return
        if (editingSeatId) {
            const zone = zones.find((item) => item.id === Number(singleForm.zone_id))
            if (!zone) return
            const nextStatus = selectedSeat?.status === 'sold' ? 'sold' : (singleForm.is_admin_locked ? 'locked' : 'available')
            const nextSectionId = zoneSectionMap.get(zone.id) ?? null
            const nextSectionName = nextSectionId ? seatMap?.sections.find((section) => section.id === nextSectionId)?.name ?? null : null
            pushHistorySnapshot()
            setSeatMap((previous) =>
                previous
                    ? {
                        ...previous,
                        seats: previous.seats.map((seat) =>
                            seat.id === editingSeatId
                                ? {
                                    ...seat,
                                    label: singleForm.seat_label.trim(),
                                    x: Number(singleForm.x),
                                    y: Number(singleForm.y),
                                    rotation: Number(singleForm.rotation),
                                    zone_id: zone.id,
                                    zone_name: zone.name,
                                    section_id: nextSectionId,
                                    section_name: nextSectionName,
                                    price: singleForm.price ? Number(singleForm.price) : zone.price,
                                    is_admin_locked: singleForm.is_admin_locked,
                                    status: nextStatus,
                                    lock_expires_at: singleForm.is_admin_locked ? null : seat.lock_expires_at,
                                }
                                : seat,
                        ),
                    }
                    : previous,
            )
            setMatrix((previous) =>
                previous
                    ? {
                        ...previous,
                        seats: previous.seats.map((seat) =>
                            seat.id === editingSeatId
                                ? {
                                    ...seat,
                                    seat_label: singleForm.seat_label.trim(),
                                    zone_id: zone.id,
                                    price: singleForm.price ? Number(singleForm.price) : zone.price,
                                    is_admin_locked: singleForm.is_admin_locked,
                                    status: nextStatus,
                                    lock_expires_at: singleForm.is_admin_locked ? null : seat.lock_expires_at,
                                }
                                : seat,
                        ),
                    }
                    : previous,
            )
            setPlannerDirty(true)
            return
        }
        pushHistorySnapshot()
        appendSingleSeatLocally({
            id: nextTempSeatId(),
            seat_label: singleForm.seat_label.trim(),
            x: Number(singleForm.x),
            y: Number(singleForm.y),
        })
        setPlannerDirty(true)
        setSingleForm((previous) => ({
            ...previous,
            seat_label: '',
            price: '',
            is_admin_locked: false,
        }))
    }

    function handleBulkSubmit() {
        if (!bulkForm.zone_id) return
        const rows = Number(bulkForm.rows)
        const cols = Number(bulkForm.cols)
        const gapX = Number(bulkForm.gap_x)
        const gapY = Number(bulkForm.gap_y)
        const startX = Number(bulkForm.start_x)
        const startY = Number(bulkForm.start_y)
        const prefix = bulkForm.label_prefix.trim() || 'A'
        const existingLabels = new Set((seatMap?.seats ?? []).map((seat) => seat.label.trim().toLowerCase()))
        const generatedSeats: Array<{ id: number; seat_label: string; x: number; y: number }> = []

        const tryPushSeat = (rowIndex: number, seatIndex: number, x: number, y: number) => {
            const label = `${prefix}${rowIndex + 1}-${seatIndex + 1}`
            if (existingLabels.has(label.toLowerCase())) return
            existingLabels.add(label.toLowerCase())
            generatedSeats.push({
                id: nextTempSeatId(),
                seat_label: label,
                x: Number(Math.max(0, Math.min(100, x)).toFixed(2)),
                y: Number(Math.max(0, Math.min(100, y)).toFixed(2)),
            })
        }

        if (bulkForm.pattern === 'straight') {
            for (let row = 0; row < rows; row += 1) {
                for (let col = 0; col < cols; col += 1) {
                    tryPushSeat(row, col, startX + col * gapX, startY + row * gapY)
                }
            }
        } else if (bulkForm.pattern === 'zigzag') {
            for (let row = 0; row < rows; row += 1) {
                const offset = row % 2 === 1 ? gapX / 2 : 0
                for (let col = 0; col < cols; col += 1) {
                    tryPushSeat(row, col, startX + offset + col * gapX, startY + row * gapY)
                }
            }
        } else {
            const centerX = Number(bulkForm.arc_center_x)
            const centerY = Number(bulkForm.arc_center_y)
            const radius = Number(bulkForm.arc_radius)
            const startAngle = Number(bulkForm.arc_start_angle)
            const endAngle = Number(bulkForm.arc_end_angle)
            for (let row = 0; row < rows; row += 1) {
                const rowRadius = radius + row * gapY
                const seatsInRow = cols + row * 2
                const denominator = seatsInRow > 1 ? seatsInRow - 1 : 1
                for (let col = 0; col < seatsInRow; col += 1) {
                    const angle = startAngle + (endAngle - startAngle) * (col / denominator)
                    const radians = (angle * Math.PI) / 180
                    tryPushSeat(row, col, centerX + rowRadius * Math.sin(radians), centerY + rowRadius * Math.cos(radians))
                }
            }
        }

        if (generatedSeats.length === 0) {
            return
        }

        pushHistorySnapshot()
        appendBulkSeatsLocally(generatedSeats)
        setPlannerDirty(true)
    }

    useEffect(() => {
        if (draggingSeatId === null) return

        const handleWindowMouseMove = (event: globalThis.MouseEvent) => {
            const coordinates = getCanvasCoordinates(event.clientX, event.clientY)
            if (!coordinates) return
            setDragSeatPosition(coordinates)
            setSeatMap((previous) =>
                previous
                    ? {
                        ...previous,
                        seats: previous.seats.map((seat) => {
                            if (!dragSelectedSeatStartPositions || !dragStartSeatPosition) {
                                return seat.id === draggingSeatId ? { ...seat, x: coordinates.x, y: coordinates.y } : seat
                            }
                            const start = dragSelectedSeatStartPositions[seat.id]
                            if (!start) return seat
                            return {
                                ...seat,
                                x: Math.max(0, Math.min(100, Number((start.x + (coordinates.x - dragStartSeatPosition.x)).toFixed(2)))),
                                y: Math.max(0, Math.min(100, Number((start.y + (coordinates.y - dragStartSeatPosition.y)).toFixed(2)))),
                            }
                        }),
                    }
                    : previous,
            )
        }

        const handleWindowMouseUp = () => {
            const moved = dragStartSeatPosition && dragSeatPosition && (dragStartSeatPosition.x !== dragSeatPosition.x || dragStartSeatPosition.y !== dragSeatPosition.y)
            setDraggingSeatId(null)
            setDragStartSeatPosition(null)
            setDragSeatPosition(null)
            setDragSelectedSeatStartPositions(null)
            if (moved) {
                setPlannerDirty(true)
            }
        }

        window.addEventListener('mousemove', handleWindowMouseMove)
        window.addEventListener('mouseup', handleWindowMouseUp)
        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove)
            window.removeEventListener('mouseup', handleWindowMouseUp)
        }
    }, [draggingSeatId, viewport, dragStartSeatPosition, dragSeatPosition])

    useEffect(() => {
        if (draggingPolygonPointIndex === null && !draggingPolygonBody) return

        const handleWindowMouseMove = (event: globalThis.MouseEvent) => {
            const coordinates = getCanvasCoordinates(event.clientX, event.clientY)
            if (!coordinates) return
            if (draggingPolygonBody && dragPolygonStartCursor && dragPolygonStartPoints) {
                const deltaX = coordinates.x - dragPolygonStartCursor.x
                const deltaY = coordinates.y - dragPolygonStartCursor.y
                setDraftPolygonPoints(
                    dragPolygonStartPoints.map((point) => ({
                        x: Math.max(0, Math.min(100, Number((point.x + deltaX).toFixed(2)))),
                        y: Math.max(0, Math.min(100, Number((point.y + deltaY).toFixed(2)))),
                    })),
                )
                return
            }
            if (draggingPolygonPointIndex !== null) {
                setDraftPolygonPoints((previous) =>
                    previous.map((point, index) => (index === draggingPolygonPointIndex ? coordinates : point)),
                )
            }
        }

        const handleWindowMouseUp = () => {
            setDraggingPolygonPointIndex(null)
            setDraggingPolygonBody(false)
            setDragPolygonStartCursor(null)
            setDragPolygonStartPoints(null)
        }

        window.addEventListener('mousemove', handleWindowMouseMove)
        window.addEventListener('mouseup', handleWindowMouseUp)
        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove)
            window.removeEventListener('mouseup', handleWindowMouseUp)
        }
    }, [draggingPolygonPointIndex, draggingPolygonBody, dragPolygonStartCursor, dragPolygonStartPoints, viewport])

    useEffect(() => {
        if (plannerTool !== 'select' || !selectionStart) return

        const handleWindowMouseMove = (event: globalThis.MouseEvent) => {
            const coordinates = getCanvasCoordinates(event.clientX, event.clientY)
            if (!coordinates) return
            setSelectionCurrent(coordinates)
        }

        const handleWindowMouseUp = () => {
            const end = selectionCurrent ?? selectionStart
            const minX = Math.min(selectionStart.x, end.x)
            const maxX = Math.max(selectionStart.x, end.x)
            const minY = Math.min(selectionStart.y, end.y)
            const maxY = Math.max(selectionStart.y, end.y)
            setSelectedSeatIds(
                (seatMap?.seats ?? [])
                    .filter((seat) => {
                        const x = seat.x ?? 0
                        const y = seat.y ?? 0
                        return x >= minX && x <= maxX && y >= minY && y <= maxY
                    })
                    .map((seat) => seat.id),
            )
            setSelectionStart(null)
            setSelectionCurrent(null)
        }

        window.addEventListener('mousemove', handleWindowMouseMove)
        window.addEventListener('mouseup', handleWindowMouseUp)
        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove)
            window.removeEventListener('mouseup', handleWindowMouseUp)
        }
    }, [plannerTool, selectionStart, selectionCurrent, seatMap?.seats])

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

    function handleSeatPointerDown(event: MouseEvent<HTMLButtonElement>, seat: SeatMapSeat) {
        event.preventDefault()
        event.stopPropagation()
        if (plannerTool === 'select') {
            const nextSelection = event.shiftKey
                ? (selectedSeatIds.includes(seat.id) ? selectedSeatIds.filter((id) => id !== seat.id) : [...selectedSeatIds, seat.id])
                : (selectedSeatIds.length > 1 && selectedSeatIds.includes(seat.id) ? selectedSeatIds : [seat.id])
            setSelectedSeatIds(nextSelection)
            pushHistorySnapshot()
            setDraggingSeatId(seat.id)
            setDragStartSeatPosition({ x: seat.x ?? 0, y: seat.y ?? 0 })
            setDragSeatPosition({ x: seat.x ?? 0, y: seat.y ?? 0 })
            setDragSelectedSeatStartPositions(
                Object.fromEntries(
                    (seatMap?.seats ?? [])
                        .filter((item) => nextSelection.includes(item.id))
                        .map((item) => [item.id, { x: item.x ?? 0, y: item.y ?? 0 }]),
                ),
            )
            return
        }
        setSelectedSeatIds([seat.id])
    }

    function handleDeleteSelectedSeat() {
        if (selectedSeatIds.length === 0 || !window.confirm(`Xóa ${selectedSeatIds.length} ghế đã chọn?`)) return
        pushHistorySnapshot()
        setSeatMap((previous) => (previous ? { ...previous, seats: previous.seats.filter((seat) => !selectedSeatIds.includes(seat.id)), seat_count: previous.seat_count - selectedSeatIds.length } : previous))
        setMatrix((previous) => (previous ? { ...previous, seats: previous.seats.filter((seat) => !selectedSeatIds.includes(seat.id)) } : previous))
        setPendingDeletedSeatIds((previous) => [...new Set([...previous, ...selectedSeatIds.filter((id) => id > 0)])])
        setSelectedSeatIds([])
        setPlannerDirty(true)
    }

    function handleDeleteEditingSeat() {
        if (!editingSeatId || !window.confirm('Xóa ghế này?')) return
        setSelectedSeatIds([editingSeatId])
        pushHistorySnapshot()
        setSeatMap((previous) => (previous ? { ...previous, seats: previous.seats.filter((seat) => seat.id !== editingSeatId), seat_count: previous.seat_count - 1 } : previous))
        setMatrix((previous) => (previous ? { ...previous, seats: previous.seats.filter((seat) => seat.id !== editingSeatId) } : previous))
        if (editingSeatId > 0) {
            setPendingDeletedSeatIds((previous) => [...new Set([...previous, editingSeatId])])
        }
        setEditingSeatId(null)
        setSelectedSeatIds([])
        setPlannerDirty(true)
    }

    function handleApplySelectedSeatChanges() {
        if (selectedSeatIds.length === 0) return
        const nextRotation = Number(singleForm.rotation)
        const nextZoneId = singleForm.zone_id ? Number(singleForm.zone_id) : null
        const zone = nextZoneId ? zoneMap.get(nextZoneId) : null
        const nextSectionId = nextZoneId ? zoneSectionMap.get(nextZoneId) ?? null : null
        const nextSectionName = nextSectionId ? seatMap?.sections.find((section) => section.id === nextSectionId)?.name ?? null : null
        pushHistorySnapshot()
        setSeatMap((previous) =>
            previous
                ? {
                    ...previous,
                    seats: previous.seats.map((seat) =>
                        selectedSeatIds.includes(seat.id)
                            ? {
                                ...seat,
                                zone_id: zone?.id ?? seat.zone_id,
                                zone_name: zone?.name ?? seat.zone_name,
                                section_id: nextSectionId ?? seat.section_id,
                                section_name: nextSectionName ?? seat.section_name,
                                rotation: Number.isNaN(nextRotation) ? seat.rotation : nextRotation,
                                price: zone ? zone.price : seat.price,
                                is_admin_locked: singleForm.is_admin_locked,
                                status: seat.status === 'sold' ? 'sold' : (singleForm.is_admin_locked ? 'locked' : 'available'),
                                lock_expires_at: singleForm.is_admin_locked ? null : seat.lock_expires_at,
                            }
                            : seat,
                    ),
                }
                : previous,
        )
        setMatrix((previous) =>
            previous
                ? {
                    ...previous,
                    seats: previous.seats.map((seat) =>
                        selectedSeatIds.includes(seat.id)
                            ? {
                                ...seat,
                                zone_id: zone?.id ?? seat.zone_id,
                                price: zone ? zone.price : seat.price,
                                is_admin_locked: singleForm.is_admin_locked,
                                status: seat.status === 'sold' ? 'sold' : (singleForm.is_admin_locked ? 'locked' : 'available'),
                                lock_expires_at: singleForm.is_admin_locked ? null : seat.lock_expires_at,
                            }
                            : seat,
                    ),
                }
                : previous,
        )
        if (nextZoneId) {
            setSelectedZoneId(nextZoneId)
        }
        setPlannerDirty(true)
    }

    function handleRemovePolygonPoint(index: number) {
        setDraftPolygonPoints((previous) => previous.filter((_, pointIndex) => pointIndex !== index))
    }

    function handleSavePolygon() {
        if (!canEditPolygons || !draftPolygonPoints.length || draftPolygonPoints.length < 3 || !seatMap) return
        const nextZoneId = polygonForm.zone_id ? Number(polygonForm.zone_id) : null
        const nextZoneName = zones.find((zone) => zone.id === nextZoneId)?.name ?? null
        const nextSectionId = nextZoneId ? zoneSectionMap.get(nextZoneId) ?? null : null
        const nextSectionName = nextSectionId ? seatMap.sections.find((section) => section.id === nextSectionId)?.name ?? null : null
        const nextPolygon: SeatMapPolygon = {
            id: editingPolygonId ?? nextTempPolygonId(),
            zone_id: nextZoneId,
            zone_name: nextZoneName,
            section_id: nextSectionId,
            section_name: nextSectionName,
            label: polygonForm.label.trim() || null,
            points: draftPolygonPoints.map((point) => ({ ...point })),
        }
        pushHistorySnapshot()
        setSeatMap((previous) =>
            previous
                ? {
                    ...previous,
                    polygons: editingPolygonId
                        ? previous.polygons.map((polygon) => (polygon.id === editingPolygonId ? nextPolygon : polygon))
                        : [...previous.polygons, nextPolygon],
                }
                : previous,
        )
        setPlannerDirty(true)
        cancelPolygonEditing()
    }

    function handleDeletePolygon(polygonId: number) {
        if (!window.confirm('Xóa vùng đa giác này?')) return
        pushHistorySnapshot()
        setSeatMap((previous) => (previous ? { ...previous, polygons: previous.polygons.filter((polygon) => polygon.id !== polygonId) } : previous))
        if (polygonId > 0) {
            setPendingDeletedPolygonIds((previous) => [...new Set([...previous, polygonId])])
        }
        if (editingPolygonId === polygonId) {
            cancelPolygonEditing()
        }
        setPlannerDirty(true)
    }

    function handleUndo() {
        const snapshot = historyPast[historyPast.length - 1]
        if (!snapshot || !seatMap || !matrix) return
        setHistoryFuture((previous) => [{ seatMapSeats: cloneSeatMapSeats(seatMap.seats), matrixSeats: cloneMatrixSeats(matrix.seats), polygons: clonePolygons(seatMap.polygons), deletedSeatIds: [...pendingDeletedSeatIds], deletedPolygonIds: [...pendingDeletedPolygonIds], selectedSeatIds: [...selectedSeatIds] }, ...previous].slice(0, 50))
        setHistoryPast((previous) => previous.slice(0, -1))
        setSeatMap({ ...seatMap, seats: cloneSeatMapSeats(snapshot.seatMapSeats), polygons: clonePolygons(snapshot.polygons), seat_count: snapshot.seatMapSeats.length })
        setMatrix({ ...matrix, seats: cloneMatrixSeats(snapshot.matrixSeats) })
        setPendingDeletedSeatIds(snapshot.deletedSeatIds)
        setPendingDeletedPolygonIds(snapshot.deletedPolygonIds)
        setSelectedSeatIds(snapshot.selectedSeatIds)
        setPlannerDirty(true)
    }

    function handleRedo() {
        const snapshot = historyFuture[0]
        if (!snapshot || !seatMap || !matrix) return
        setHistoryPast((previous) => [...previous, { seatMapSeats: cloneSeatMapSeats(seatMap.seats), matrixSeats: cloneMatrixSeats(matrix.seats), polygons: clonePolygons(seatMap.polygons), deletedSeatIds: [...pendingDeletedSeatIds], deletedPolygonIds: [...pendingDeletedPolygonIds], selectedSeatIds: [...selectedSeatIds] }].slice(-50))
        setHistoryFuture((previous) => previous.slice(1))
        setSeatMap({ ...seatMap, seats: cloneSeatMapSeats(snapshot.seatMapSeats), polygons: clonePolygons(snapshot.polygons), seat_count: snapshot.seatMapSeats.length })
        setMatrix({ ...matrix, seats: cloneMatrixSeats(snapshot.matrixSeats) })
        setPendingDeletedSeatIds(snapshot.deletedSeatIds)
        setPendingDeletedPolygonIds(snapshot.deletedPolygonIds)
        setSelectedSeatIds(snapshot.selectedSeatIds)
        setPlannerDirty(true)
    }

    async function handleSavePlannerChanges() {
        if (!eventKey || !showId || !seatMap) return
        setBusySingle(true)
        setError(null)
        setMessage(null)
        try {
            const savedSeatMap = new Map(savedSeatsRef.current.map((seat) => [seat.id, seat]))
            const savedMatrixMap = new Map(savedMatrixSeatsRef.current.map((seat) => [seat.id, seat]))
            const savedPolygonMap = new Map(savedPolygonsRef.current.map((polygon) => [polygon.id, polygon]))
            const currentMap = new Map(seatMap.seats.map((seat) => [seat.id, seat]))
            const newSeats = seatMap.seats.filter((seat) => seat.id < 0)
            const changedSeats = (matrix?.seats ?? []).filter((seat) => {
                if (seat.id < 0) return false
                const savedSeat = savedSeatMap.get(seat.id)
                const savedMatrixSeat = savedMatrixMap.get(seat.id)
                const currentSeat = currentMap.get(seat.id)
                if (!savedSeat || !savedMatrixSeat || !currentSeat) return false
                return (
                    savedSeat.label !== currentSeat.label ||
                    savedSeat.x !== currentSeat.x ||
                    savedSeat.y !== currentSeat.y ||
                    savedSeat.rotation !== currentSeat.rotation ||
                    savedSeat.is_admin_locked !== currentSeat.is_admin_locked ||
                    savedMatrixSeat.zone_id !== seat.zone_id ||
                    savedMatrixSeat.price !== seat.price
                )
            })
            const seatSyncResult = (newSeats.length > 0 || changedSeats.length > 0 || pendingDeletedSeatIds.length > 0)
                ? await adminApi.syncEventSeats(eventKey, showId, {
                    create: newSeats.map((seat) => {
                        const matrixSeat = matrix?.seats.find((item) => item.id === seat.id)
                        return {
                            client_id: seat.id,
                            seat_label: seat.label,
                            x: seat.x ?? 0,
                            y: seat.y ?? 0,
                            rotation: seat.rotation,
                            zone_id: matrixSeat?.zone_id ?? null,
                            section_id: seat.section_id,
                            price: matrixSeat?.price ?? seat.price,
                            is_admin_locked: seat.is_admin_locked,
                        }
                    }),
                    update: changedSeats.map((seat) => {
                        const currentSeat = currentMap.get(seat.id)
                        return {
                            id: seat.id,
                            seat_label: currentSeat?.label ?? seat.seat_label,
                            x: currentSeat?.x ?? 0,
                            y: currentSeat?.y ?? 0,
                            rotation: currentSeat?.rotation ?? 0,
                            zone_id: seat.zone_id,
                            section_id: currentSeat?.section_id ?? null,
                            price: seat.price,
                            is_admin_locked: currentSeat?.is_admin_locked ?? false,
                        }
                    }),
                    delete_ids: pendingDeletedSeatIds,
                })
                : null

            const createdSeatMap = new Map((seatSyncResult?.created ?? []).map((seat) => [seat.client_id, seat]))
            const newPolygons = seatMap.polygons.filter((polygon) => polygon.id < 0)
            const changedPolygons = seatMap.polygons.filter((polygon) => {
                if (polygon.id < 0) return false
                const savedPolygon = savedPolygonMap.get(polygon.id)
                if (!savedPolygon) return false
                return (
                    savedPolygon.zone_id !== polygon.zone_id ||
                    savedPolygon.section_id !== polygon.section_id ||
                    savedPolygon.label !== polygon.label ||
                    JSON.stringify(savedPolygon.points) !== JSON.stringify(polygon.points)
                )
            })
            const buildFinalSeatMapSeats = () =>
                seatMap.seats
                    .filter((seat) => !pendingDeletedSeatIds.includes(seat.id))
                    .map((seat) => {
                        const created = createdSeatMap.get(seat.id)
                        const nextZone = zoneMap.get(seat.zone_id ?? -1)
                        return created
                            ? {
                                id: created.id,
                                label: created.seat_label,
                                x: created.x,
                                y: created.y,
                                rotation: seat.rotation,
                                zone_id: seat.zone_id,
                                zone_name: nextZone?.name ?? seat.zone_name,
                                section_id: seat.section_id,
                                section_name: seat.section_name,
                                price: seat.price,
                                status: seat.status,
                                lock_expires_at: seat.lock_expires_at,
                                is_locked_by_me: seat.is_locked_by_me,
                                is_admin_locked: seat.is_admin_locked,
                            }
                            : seat
                    })
            const buildFinalMatrixSeats = () =>
                (matrix?.seats ?? [])
                    .filter((seat) => !pendingDeletedSeatIds.includes(seat.id))
                    .map((seat) => {
                        const created = createdSeatMap.get(seat.id)
                        return created
                            ? {
                                ...seat,
                                id: created.id,
                                seat_label: created.seat_label,
                            }
                            : seat
                    })

            const createdPolygonPairs = await Promise.all(
                newPolygons.map(async (polygon) => {
                    const created = await adminApi.createShowPolygon(eventKey, showId, {
                        zone_id: polygon.zone_id,
                        label: polygon.label,
                        points: polygon.points,
                    })
                    return [polygon.id, {
                        ...created,
                        section_id: polygon.section_id,
                        section_name: polygon.section_name,
                    } satisfies SeatMapPolygon] as const
                }),
            )
            const createdPolygonMap = new Map(createdPolygonPairs)
            await Promise.all(
                changedPolygons.map((polygon) =>
                    adminApi.updateShowPolygon(polygon.id, {
                        zone_id: polygon.zone_id,
                        label: polygon.label,
                        points: polygon.points,
                    }),
                ),
            )
            await Promise.all(pendingDeletedPolygonIds.map((polygonId) => adminApi.deleteShowPolygon(polygonId)))

            const finalSeatMapSeats = buildFinalSeatMapSeats()
            const finalMatrixSeats = buildFinalMatrixSeats()
            const finalPolygons = seatMap.polygons
                .filter((polygon) => !pendingDeletedPolygonIds.includes(polygon.id))
                .map((polygon) => createdPolygonMap.get(polygon.id) ?? polygon)

            setSeatMap((previous) => (previous ? { ...previous, seats: finalSeatMapSeats, polygons: finalPolygons, seat_count: finalSeatMapSeats.length } : previous))
            setMatrix((previous) => (previous ? { ...previous, seats: finalMatrixSeats } : previous))
            syncSavedSeats(finalSeatMapSeats)
            syncSavedMatrixSeats(finalMatrixSeats)
            syncSavedPolygons(finalPolygons)
            setPendingDeletedSeatIds([])
            setPendingDeletedPolygonIds([])
            setPlannerDirty(false)
            pushNotice('success', 'Đã lưu thay đổi sơ đồ ghế.')
        } catch (errorValue) {
            pushNotice('error', extractApiErrorMessage(errorValue, 'Không thể lưu thay đổi sơ đồ ghế.'))
        } finally {
            setBusySingle(false)
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

    if (!showDetail || !matrix || !seatMap) {
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

    if (loading) {
        return <GlobalLoader />
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Trình đặt ghế sự kiện</p>
                    <h1 className="text-3xl font-black text-white">{showDetail.title}</h1>
                    <p className="mt-1 text-slate-400">
                        {showDetail.event_title} · {showDetail.venue}
                    </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => {
                    if (!confirmLeavePlannerIfDirty()) return
                    void loadData()
                }}>
                    <RefreshCw className="h-4 w-4" /> Làm mới
                </Button>
            </div>

            {(error || message) && (
                <div className="fixed right-6 top-24 z-50 w-full max-w-sm">
                    <div className={`rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${error ? 'border-red-500/30 bg-red-500/15 text-red-100' : 'border-emerald-500/30 bg-emerald-500/15 text-emerald-100'}`}>
                        {error ?? message}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.9fr] gap-6">
                <Card className="bg-space-900/90 border-white/10">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-white">
                            <MapPin className="h-5 w-5 text-brand-red" /> Canvas tọa độ
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <InteractiveSeatCanvas
                            canvasRef={canvasRef}
                            cursor={canvasCursor}
                            viewport={viewport}
                            onClick={handleCanvasClick}
                            onMouseDown={handleCanvasMouseDown}
                            onMouseMove={handleCanvasMouseMove}
                            onWheel={handleCanvasWheel}
                            onZoomIn={() => zoomCanvas(1.1)}
                            onZoomOut={() => zoomCanvas(0.9)}
                            cursorClassName={plannerTool === 'pan' ? 'cursor-grab' : plannerTool === 'select' ? 'cursor-pointer' : 'cursor-crosshair'}
                            gridSize={snapToGrid ? '5% 5%' : '10% 10%'}
                            aspectRatio={seatMap.background?.width && seatMap.background.height ? seatMap.background.width / seatMap.background.height : undefined}
                            toolbar={
                                <div className="flex flex-wrap items-center gap-2 text-white">
                                    <Button size="icon" variant={plannerTool === 'single' ? 'primary' : 'outline'} onClick={() => { setSelectedSeatIds([]); setEditingSeatId(null); setPlannerTool('single') }} title="Thêm một ghế">
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant={plannerTool === 'bulk' ? 'primary' : 'outline'} onClick={() => { setSelectedSeatIds([]); setEditingSeatId(null); setPlannerTool('bulk') }} title="Tạo nhiều ghế">
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant={plannerTool === 'polygon' ? 'primary' : 'outline'} onClick={() => { setSelectedSeatIds([]); setEditingSeatId(null); setPlannerTool('polygon') }} title="Vẽ vùng đa giác" disabled={!canEditPolygons}>
                                        <Shapes className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant={plannerTool === 'select' ? 'primary' : 'outline'} onClick={() => setPlannerTool('select')} title="Chọn vùng ghế">
                                        <MousePointer2 className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant={plannerTool === 'pan' ? 'primary' : 'outline'} onClick={() => setPlannerTool('pan')} title="Kéo sơ đồ">
                                        <Hand className="h-4 w-4" />
                                    </Button>
                                    <Button variant={snapToGrid ? 'primary' : 'outline'} onClick={() => setSnapToGrid((v) => !v)}>
                                        Bám lưới {snapToGrid ? 'Bật' : 'Tắt'}
                                    </Button>
                                    <Button size="icon" variant="outline" onClick={handleUndo} disabled={historyPast.length === 0} title="Hoàn tác">
                                        <Undo2 className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="outline" onClick={handleRedo} disabled={historyFuture.length === 0} title="Làm lại">
                                        <Redo2 className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" onClick={() => setViewport({ scale: 1, offsetX: 0, offsetY: 0 })}>
                                        Đặt lại góc nhìn
                                    </Button>
                                    {plannerTool === 'polygon' && (
                                        <Button variant="ghost" onClick={() => (editingPolygonId ? cancelPolygonEditing() : setDraftPolygonPoints([]))}>
                                            {editingPolygonId ? 'Thoát chỉnh polygon' : 'Xóa điểm nháp'}
                                        </Button>
                                    )}
                                    <Button variant={plannerDirty ? 'primary' : 'outline'} onClick={() => void handleSavePlannerChanges()} disabled={!plannerDirty || busySingle}>
                                        <Save className="h-4 w-4" /> Lưu thay đổi
                                    </Button>
                                    <Button variant="outline" onClick={discardPlannerChanges} disabled={!plannerDirty || busySingle}>
                                        Khôi phục bản đã lưu
                                    </Button>
                                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15">
                                        <FileUp className="h-4 w-4" />
                                        Đổi background
                                        <input
                                            type="file"
                                            accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
                                            className="hidden"
                                            onChange={(event) => {
                                                const file = event.target.files?.[0]
                                                if (!file) return
                                                const reader = new FileReader()
                                                reader.onload = () => setPlannerBackground(typeof reader.result === 'string' ? reader.result : null)
                                                if (file.type.includes('svg') || file.name.toLowerCase().endsWith('.svg')) {
                                                    reader.readAsText(file)
                                                } else {
                                                    reader.readAsDataURL(file)
                                                }
                                            }}
                                        />
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-300">Ghế:</span>
                                        <input type="range" min="0.5" max="4" step="0.1" value={seatSize} onChange={(e) => setSeatSize(Number(e.target.value))} className="w-20 accent-brand-red" />
                                        <span className="text-xs text-slate-300 w-8">{seatSize}%</span>
                                    </div>
                                </div>
                            }
                            footerLeft={null}
                            footerRight={`${seatMap.seat_count} ghế · zoom ${viewport.scale.toFixed(2)}x`}
                        >
                                {plannerBackground && (
                                    plannerBackground.includes('<svg') ? (
                                        <div className="absolute inset-0 opacity-70 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: plannerBackground }} />
                                    ) : (
                                        <img src={plannerBackground} alt="Seat planner background" className="absolute inset-0 h-full w-full object-contain opacity-80 pointer-events-none" />
                                    )
                                )}
                            {seatMap.polygons.map((polygon) => {
                                const polyZone = zones.find((zone) => zone.id === polygon.zone_id)
                                const polySection = seatMap.sections.find((section) => section.id === polygon.section_id)
                                const polyColor = polyZone?.color ?? polySection?.color ?? '#fbbf24'
                                const polyPts = editingPolygonId === polygon.id ? draftPolygonPoints : polygon.points
                                const centroid = computeCentroid(polyPts)
                                return (
                                    <>
                                        <svg key={polygon.id} className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                            <polygon
                                                points={polygonPoints(polyPts)}
                                                onMouseDown={(event) => handlePolygonMouseDown(event, polygon)}
                                                onClick={(event) => event.stopPropagation()}
                                                fill={editingPolygonId === polygon.id ? 'rgba(56, 189, 248, 0.18)' : `${polyColor}33`}
                                                stroke={editingPolygonId === polygon.id ? 'rgba(56, 189, 248, 0.95)' : `${polyColor}dd`}
                                                strokeWidth={editingPolygonId === polygon.id ? '0.5' : '0.35'}
                                                className={editingPolygonId === polygon.id ? 'cursor-move' : 'cursor-pointer'}
                                            />
                                        </svg>
                                        {(polygon.zone_name ?? polygon.section_name ?? polygon.label) && (
                                            <div
                                                key={`clabel-${polygon.id}`}
                                                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded bg-black/60 px-2 py-0.5 text-[9px] font-semibold text-white whitespace-nowrap"
                                                style={{ left: `${centroid.x}%`, top: `${centroid.y}%` }}
                                            >
                                                {polygon.zone_name ?? polygon.section_name ?? polygon.label}
                                            </div>
                                        )}
                                    </>
                                )
                            })}

                            {draftPolygonPoints.length >= 1 && (
                                <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                                    <polyline
                                        points={polygonPoints(draftPolygonPoints)}
                                        fill={draftPolygonPoints.length >= 3 ? 'rgba(56, 189, 248, 0.16)' : 'none'}
                                        stroke="rgba(56, 189, 248, 0.95)"
                                        strokeWidth="0.35"
                                    />
                                </svg>
                            )}

                            {draftPolygonPoints.map((point, index) => (
                                <button
                                    key={`${point.x}-${point.y}-${index}`}
                                    type="button"
                                    onMouseDown={(event) => {
                                        event.preventDefault()
                                        event.stopPropagation()
                                        if (editingPolygonId !== null) {
                                            pushHistorySnapshot()
                                            suppressNextCanvasClickRef.current = true
                                            setDraggingPolygonPointIndex(index)
                                        }
                                    }}
                                    onDoubleClick={(event) => {
                                        event.preventDefault()
                                        event.stopPropagation()
                                        handleRemovePolygonPoint(index)
                                    }}
                                    className={`absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border ${editingPolygonId !== null ? 'cursor-grab border-cyan-100 bg-cyan-300 shadow-[0_0_0_4px_rgba(34,211,238,0.18)]' : 'border-cyan-200 bg-cyan-400'}`}
                                    style={{ left: `${point.x}%`, top: `${point.y}%` }}
                                    title="Điểm vùng đa giác"
                                />
                            ))}
                            {seatMap.seats
                                .filter((seat) => seat.x !== null && seat.y !== null)
                                .map((seat) => (
                                    <button
                                        key={seat.id}
                                        type="button"
                                        onMouseDown={(event) => handleSeatPointerDown(event, seat)}
                                        onMouseEnter={(event) => setTooltip({ x: event.clientX, y: event.clientY, content: `${seat.label} · ${seat.zone_name ?? seat.section_name ?? 'Chưa gán khu'} · ${seat.is_admin_locked ? 'Admin khóa' : Number(seat.price).toLocaleString('vi-VN')}` })}
                                        onMouseLeave={() => setTooltip(null)}
                                        className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-lg ${seatColor(seat)}`}
                                        style={{ left: `${seatPositionMap.get(seat.id)?.x ?? seat.x}%`, top: `${seatPositionMap.get(seat.id)?.y ?? seat.y}%`, transform: `translate(-50%, -50%) rotate(${seat.rotation}deg)`, width: `${seatSize}%`, aspectRatio: '1', ...seatStyle(seat), boxShadow: selectedSeatIds.includes(seat.id) ? '0 0 0 3px rgba(59,130,246,0.35)' : undefined }}
                                    />
                                ))}

                            {singleForm.x && singleForm.y && (
                                <div
                                    className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand-red bg-brand-red/30 shadow-[0_0_0_6px_rgba(252,83,109,0.18)]"
                                    style={{ left: `${singleForm.x}%`, top: `${singleForm.y}%` }}
                                    title="Current single-seat target"
                                />
                            )}
                            {selectionStart && selectionCurrent && (
                                <div
                                    className="absolute border-2 border-sky-400 bg-sky-400/10"
                                    style={{
                                        left: `${Math.min(selectionStart.x, selectionCurrent.x)}%`,
                                        top: `${Math.min(selectionStart.y, selectionCurrent.y)}%`,
                                        width: `${Math.abs(selectionCurrent.x - selectionStart.x)}%`,
                                        height: `${Math.abs(selectionCurrent.y - selectionStart.y)}%`,
                                    }}
                                />
                            )}
                        </InteractiveSeatCanvas>
                        {tooltip && (
                            <div
                                className="pointer-events-none fixed z-[9999] max-w-xs rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-xs text-white shadow-2xl"
                                style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
                            >
                                {tooltip.content}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card className="bg-space-900/90 border-white/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-white">
                                <Ticket className="h-5 w-5 text-brand-yellow" /> Tóm tắt
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm text-slate-300">
                            <div className="flex items-center justify-between">
                                <span>Sự kiện</span>
                                <span className="text-white">{showDetail.event_slug}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Số khu</span>
                                <span className="text-white">{formatSeatCount(matrix.zones.length)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Số ghế hiện có</span>
                                <span className="text-white">{formatSeatCount(seatMap.seat_count)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Khu đang chọn</span>
                                <span className="text-white">{currentZone ? `${currentZone.code} · ${currentZone.name}` : 'Chưa chọn'}</span>
                            </div>
                            {selectedSeatIds.length > 1 && (
                                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                                    <div className="space-y-3">
                                        <div>
                                            <p className="font-semibold text-white">Đã chọn {selectedSeatIds.length} ghế</p>
                                            {selectedSeat && <p className="text-xs text-slate-400">Ghế đầu tiên: {selectedSeat.label} · X {selectedSeat.x ?? 0}% · Y {selectedSeat.y ?? 0}%</p>}
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Khu bán vé</label>
                                            <select
                                                className="h-11 w-full rounded-lg border border-white/10 bg-space-700/50 px-3 text-white outline-none"
                                                value={singleForm.zone_id}
                                                onChange={(event) => setSingleForm({ ...singleForm, zone_id: event.target.value })}
                                            >
                                                <option value="">Giữ nguyên khu hiện tại</option>
                                                {zones.map((zone) => (
                                                    <option key={zone.id} value={zone.id}>
                                                        {zone.code} · {zone.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Góc xoay</label>
                                            <Input type="number" step="0.01" placeholder="Góc xoay" value={singleForm.rotation} onChange={(event) => setSingleForm({ ...singleForm, rotation: event.target.value })} />
                                        </div>
                                        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                                            <input
                                                type="checkbox"
                                                checked={singleForm.is_admin_locked}
                                                onChange={(event) => setSingleForm({ ...singleForm, is_admin_locked: event.target.checked })}
                                            />
                                            Khóa sẵn nhóm ghế này
                                        </label>
                                        <div className="flex gap-2">
                                            <Button className="flex-1" onClick={handleApplySelectedSeatChanges}>
                                                Áp dụng thuộc tính
                                            </Button>
                                            <Button variant="outline" className="flex-1" onClick={handleDeleteSelectedSeat}>
                                                <Trash2 className="h-4 w-4" /> Xóa ghế
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="text-xs text-slate-400">
                                Công cụ đang chọn sẽ được tô nền đỏ. Ghế khóa bởi admin hiển thị màu đỏ đậm và khách vẫn thấy nhưng không thể mua.
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-space-900/90 border-white/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-white">
                                <MapPin className="h-5 w-5 text-sky-400" /> Zone management
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Code</label>
                                    <Input value={zoneForm.code} onChange={(event) => setZoneForm({ ...zoneForm, code: event.target.value })} placeholder="VIP-A" />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Tên zone</label>
                                    <Input value={zoneForm.name} onChange={(event) => setZoneForm({ ...zoneForm, name: event.target.value })} placeholder="Khu A" />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Rows</label>
                                    <Input type="number" min={1} value={zoneForm.row_count} onChange={(event) => setZoneForm({ ...zoneForm, row_count: event.target.value })} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Seats / row</label>
                                    <Input type="number" min={1} value={zoneForm.seats_per_row} onChange={(event) => setZoneForm({ ...zoneForm, seats_per_row: event.target.value })} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Price</label>
                                    <Input type="number" min={0} step="0.01" value={zoneForm.price} onChange={(event) => setZoneForm({ ...zoneForm, price: event.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Color</label>
                                <div className="grid grid-cols-[68px_1fr] gap-3">
                                    <input
                                        type="color"
                                        value={zoneForm.color}
                                        onChange={(event) => setZoneForm({ ...zoneForm, color: event.target.value })}
                                        className="h-11 w-full rounded-lg border border-white/10 bg-space-700/50 p-1"
                                    />
                                    <Input value={zoneForm.color} onChange={(event) => setZoneForm({ ...zoneForm, color: event.target.value })} />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {editingZoneId && (
                                    <Button variant="outline" onClick={() => resetZoneForm(selectedZoneId)} disabled={busySingle}>
                                        Hủy sửa
                                    </Button>
                                )}
                                <Button className="flex-1" onClick={() => void handleSaveZone()} isLoading={busySingle}>
                                    <Save className="h-4 w-4" /> {editingZoneId ? 'Cập nhật zone' : 'Tạo zone'}
                                </Button>
                            </div>
                            {!editingZoneId && (
                                <Button variant="outline" className="w-full" onClick={() => void handleCreateInitialZone()} disabled={busySingle || !canCreateInitialZone}>
                                    <Wand2 className="h-4 w-4" /> Tạo zone khởi tạo
                                </Button>
                            )}
                            <div className="text-xs text-slate-400">
                                Show chỗ tự do có thể dùng zone khởi tạo để sinh nhanh ghế mặc định và polygon bao quanh. Để tạo stage, hãy tạo zone không sinh ghế rồi vẽ polygon riêng.
                            </div>
                            <div className="space-y-2 border-t border-white/10 pt-3">
                                {zones.length === 0 ? (
                                    <p className="text-sm text-slate-400">Show này chưa có zone. Hãy tạo zone trước khi thêm ghế hoặc polygon.</p>
                                ) : (
                                    zones.map((zone) => (
                                        <div key={zone.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="h-3 w-3 rounded-full border border-white/20" style={{ backgroundColor: zone.color }} />
                                                    <p className="truncate font-semibold text-white">{zone.name}</p>
                                                </div>
                                                <p className="text-xs text-slate-400">{zone.code} · {Number(zone.price).toLocaleString('vi-VN')} · {zone.row_count} x {zone.seats_per_row}</p>
                                            </div>
                                            <div className="flex gap-1">
                                                <button type="button" className="rounded p-1.5 hover:bg-white/10" onClick={() => startEditZone(zone)}>
                                                    <Shapes className="h-4 w-4 text-cyan-300" />
                                                </button>
                                                <button type="button" className="rounded p-1.5 hover:bg-white/10" onClick={() => void handleDeleteZone(zone.id)}>
                                                    <Trash2 className="h-4 w-4 text-red-400" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className={`bg-space-900/90 border-white/10 ${(plannerTool === 'single' || selectedSeatIds.length === 1) && selectedSeatIds.length <= 1 ? '' : 'hidden'}`}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-white">
                                <Plus className="h-5 w-5 text-emerald-400" /> {editingSeatId ? 'Chỉnh sửa ghế' : 'Ghế lẻ'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Nhãn ghế</label>
                                    <Input placeholder="Ví dụ A1" value={singleForm.seat_label} onChange={(event) => setSingleForm({ ...singleForm, seat_label: event.target.value })} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Khu bán vé</label>
                                    <select
                                        className="h-11 w-full rounded-lg border border-white/10 bg-space-700/50 px-3 text-white outline-none"
                                        value={singleForm.zone_id}
                                        onChange={(event) => setSingleForm({ ...singleForm, zone_id: event.target.value })}
                                    >
                                        <option value="">Chọn khu</option>
                                        {zones.map((zone) => (
                                            <option key={zone.id} value={zone.id}>
                                                {zone.code} · {zone.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Tọa độ X</label>
                                    <Input type="number" step="0.01" placeholder="X %" value={singleForm.x} onChange={(event) => setSingleForm({ ...singleForm, x: event.target.value })} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Tọa độ Y</label>
                                    <Input type="number" step="0.01" placeholder="Y %" value={singleForm.y} onChange={(event) => setSingleForm({ ...singleForm, y: event.target.value })} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Góc xoay</label>
                                    <Input type="number" step="0.01" placeholder="Góc xoay" value={singleForm.rotation} onChange={(event) => setSingleForm({ ...singleForm, rotation: event.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Giá riêng (không bắt buộc)</label>
                                <Input type="number" step="0.01" placeholder="Giá riêng" value={singleForm.price} onChange={(event) => setSingleForm({ ...singleForm, price: event.target.value })} />
                            </div>
                            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                                <input
                                    type="checkbox"
                                    checked={singleForm.is_admin_locked}
                                    onChange={(event) => setSingleForm({ ...singleForm, is_admin_locked: event.target.checked })}
                                />
                                Khóa sẵn ghế này để khách không thể mua
                            </label>
                            <div className="text-xs text-slate-400">Bấm lên sơ đồ để điền tự động tọa độ X/Y.</div>
                            <div className="flex gap-2">
                                {editingSeatId && (
                                    <Button variant="outline" onClick={handleDeleteEditingSeat}>
                                        <Trash2 className="h-4 w-4" /> Xóa ghế
                                    </Button>
                                )}
                                <Button className="flex-1" onClick={() => void handleSingleSubmit()} isLoading={busySingle} disabled={!singleForm.zone_id || !singleForm.seat_label.trim()}>
                                    <Save className="h-4 w-4" /> {editingSeatId ? 'Cập nhật ghế đã chọn' : 'Thêm ghế'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className={`bg-space-900/90 border-white/10 ${plannerTool === 'bulk' && selectedSeatIds.length === 0 ? '' : 'hidden'}`}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-white">
                                <Wand2 className="h-5 w-5 text-cyan-400" /> Tạo ghế hàng loạt
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Khu bán vé</label>
                                    <select
                                        className="h-11 w-full rounded-lg border border-white/10 bg-space-700/50 px-3 text-white outline-none"
                                        value={bulkForm.zone_id}
                                        onChange={(event) => setBulkForm({ ...bulkForm, zone_id: event.target.value })}
                                    >
                                        <option value="">Chọn khu</option>
                                        {zones.map((zone) => (
                                            <option key={zone.id} value={zone.id}>
                                                {zone.code} · {zone.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Mẫu tạo</label>
                                    <select
                                        className="h-11 w-full rounded-lg border border-white/10 bg-space-700/50 px-3 text-white outline-none"
                                        value={bulkForm.pattern}
                                        onChange={(event) => setBulkForm({ ...bulkForm, pattern: event.target.value as 'straight' | 'arc' | 'zigzag' })}
                                    >
                                        <option value="straight">Hàng thẳng</option>
                                        <option value="zigzag">Zigzag</option>
                                        <option value="arc">Cung tròn</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Số hàng</label>
                                    <Input type="number" min={1} placeholder="Số hàng" value={bulkForm.rows} onChange={(event) => setBulkForm({ ...bulkForm, rows: event.target.value })} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Số cột</label>
                                    <Input type="number" min={1} placeholder="Số cột" value={bulkForm.cols} onChange={(event) => setBulkForm({ ...bulkForm, cols: event.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Khoảng cách X</label>
                                    <Input type="number" step="0.01" placeholder="Khoảng cách X" value={bulkForm.gap_x} onChange={(event) => setBulkForm({ ...bulkForm, gap_x: event.target.value })} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Khoảng cách Y</label>
                                    <Input type="number" step="0.01" placeholder="Khoảng cách Y" value={bulkForm.gap_y} onChange={(event) => setBulkForm({ ...bulkForm, gap_y: event.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Điểm bắt đầu X</label>
                                    <Input type="number" step="0.01" placeholder="Điểm bắt đầu X" value={bulkForm.start_x} onChange={(event) => setBulkForm({ ...bulkForm, start_x: event.target.value })} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Điểm bắt đầu Y</label>
                                    <Input type="number" step="0.01" placeholder="Điểm bắt đầu Y" value={bulkForm.start_y} onChange={(event) => setBulkForm({ ...bulkForm, start_y: event.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Tiền tố nhãn ghế</label>
                                <Input placeholder="Tiền tố nhãn ghế" value={bulkForm.label_prefix} onChange={(event) => setBulkForm({ ...bulkForm, label_prefix: event.target.value })} />
                            </div>

                            {bulkForm.pattern === 'arc' && (
                                <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Cấu hình cung tròn</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input type="number" step="0.01" placeholder="Tâm X" value={bulkForm.arc_center_x} onChange={(event) => setBulkForm({ ...bulkForm, arc_center_x: event.target.value })} />
                                        <Input type="number" step="0.01" placeholder="Tâm Y" value={bulkForm.arc_center_y} onChange={(event) => setBulkForm({ ...bulkForm, arc_center_y: event.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <Input type="number" step="0.01" placeholder="Bán kính" value={bulkForm.arc_radius} onChange={(event) => setBulkForm({ ...bulkForm, arc_radius: event.target.value })} />
                                        <Input type="number" step="0.01" placeholder="Góc bắt đầu" value={bulkForm.arc_start_angle} onChange={(event) => setBulkForm({ ...bulkForm, arc_start_angle: event.target.value })} />
                                        <Input type="number" step="0.01" placeholder="Góc kết thúc" value={bulkForm.arc_end_angle} onChange={(event) => setBulkForm({ ...bulkForm, arc_end_angle: event.target.value })} />
                                    </div>
                                </div>
                            )}

                            <Button className="w-full" onClick={() => void handleBulkSubmit()} isLoading={busyBulk} disabled={!bulkForm.zone_id}>
                                <Copy className="h-4 w-4" /> Tạo dãy ghế
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className={`bg-space-900/90 border-white/10 ${plannerTool === 'polygon' && selectedSeatIds.length === 0 ? '' : 'hidden'}`}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-white">
                                <Shapes className="h-5 w-5 text-cyan-400" /> Vùng đa giác
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Input placeholder="Tên vùng" value={polygonForm.label} onChange={(event) => setPolygonForm({ ...polygonForm, label: event.target.value })} />
                            <div>
                                <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Gán zone</label>
                                <select
                                    className="h-11 w-full rounded-lg border border-white/10 bg-space-700/50 px-3 text-white outline-none"
                                    value={polygonForm.zone_id}
                                    onChange={(event) => setPolygonForm({ ...polygonForm, zone_id: event.target.value })}
                                >
                                    <option value="">Chưa gán zone</option>
                                    {zones.map((zone) => (
                                        <option key={zone.id} value={zone.id}>
                                            {zone.code} · {zone.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="text-xs text-slate-400">
                                {editingPolygonId ? `Đang chỉnh vùng #${editingPolygonId}` : `${draftPolygonPoints.length} điểm nháp. Cần ít nhất 3 điểm để lưu.`}
                            </div>
                            <div className="flex gap-2">
                                {draftPolygonPoints.length > 0 && (
                                    <Button variant="outline" onClick={() => handleRemovePolygonPoint(draftPolygonPoints.length - 1)}>
                                        Hoàn tác điểm
                                    </Button>
                                )}
                                {editingPolygonId && (
                                    <Button variant="outline" onClick={() => void handleDeletePolygon(editingPolygonId)}>
                                        <Trash2 className="h-4 w-4" /> Xóa vùng
                                    </Button>
                                )}
                                <Button className="flex-1" onClick={() => void handleSavePolygon()} isLoading={busySingle} disabled={!canEditPolygons || draftPolygonPoints.length < 3}>
                                    <Save className="h-4 w-4" /> {editingPolygonId ? 'Cập nhật vùng' : 'Lưu vùng'}
                                </Button>
                            </div>
                            <div className="space-y-2 border-t border-white/10 pt-3">
                                {seatMap.polygons.length === 0 ? (
                                    <p className="text-sm text-slate-400">Chưa có vùng nào.</p>
                                ) : (
                                    seatMap.polygons.map((polygon) => (
                                        <div key={polygon.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                                            <div>
                                                <p className="font-semibold text-white">{polygon.label || `Vùng #${polygon.id}`}</p>
                                                <p className="text-xs text-slate-400">{polygon.zone_name ?? polygon.section_name ?? 'Chưa gán zone'} · {polygon.points.length} điểm</p>
                                            </div>
                                            <div className="flex gap-1">
                                                <button type="button" className="rounded p-1.5 hover:bg-white/10" onClick={() => startEditPolygon(polygon)}>
                                                    <Shapes className="h-4 w-4 text-cyan-300" />
                                                </button>
                                                <button type="button" className="rounded p-1.5 hover:bg-white/10" onClick={() => void handleDeletePolygon(polygon.id)}>
                                                    <Trash2 className="h-4 w-4 text-red-400" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
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

