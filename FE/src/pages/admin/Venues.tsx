import { useEffect, useMemo, useRef, useState, type MouseEvent, type WheelEvent } from 'react'
import { Building2, Check, Copy, Edit, FileUp, Hand, Layers3, MapPin, MousePointer2, Plus, Redo2, RefreshCw, Save, Shapes, Trash2, Undo2 } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { InteractiveSeatCanvas } from '@/components/admin/InteractiveSeatCanvas'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { GlobalLoader } from '@/components/ui/GlobalLoader'
import { adminApi, extractApiErrorMessage } from '@/lib/api'
import type { VenueDetail, VenueLayoutItem, VenuePolygonItem, VenueSeatItem, VenueSectionItem, VenueSummary } from '@/types'

const DEFAULT_LAYOUT_FORM = {
    name: '',
    description: '',
    svg_data: '',
    sort_order: '0',
}

const DEFAULT_SECTION_FORM = {
    name: '',
    code: '',
    color: '#024ddf',
    price_base: '0',
    sort_order: '0',
}

const DEFAULT_VENUE_FORM = {
    name: '',
    address: '',
    city: '',
    venue_type: 'theater',
    capacity: '',
    width: '1000',
    height: '600',
}

const DEFAULT_SINGLE_SEAT_FORM = {
    label: '',
    section_id: '',
    x: '50',
    y: '50',
    rotation: '0',
    is_admin_locked: false,
}

const DEFAULT_BULK_SEAT_FORM = {
    section_id: '',
    pattern: 'straight' as 'straight' | 'arc' | 'zigzag',
    rows: '4',
    cols: '8',
    gap_x: '4',
    gap_y: '4',
    start_x: '20',
    start_y: '20',
    label_prefix: 'A',
    arc_center_x: '50',
    arc_center_y: '50',
    arc_radius: '24',
    arc_start_angle: '-45',
    arc_end_angle: '45',
}

const DEFAULT_POLYGON_FORM = {
    label: '',
    section_id: '',
}

const DEFAULT_VIEWPORT = {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
}

const SNAP_STEP = 1
const STUDIO_STEPS = ['venue', 'background', 'layout', 'section', 'builder'] as const
type StudioStep = (typeof STUDIO_STEPS)[number]

const STEP_META: Record<StudioStep, { title: string; description: string }> = {
    venue: { title: 'Địa điểm', description: 'Tạo mới hoặc chọn địa điểm đã có.' },
    background: { title: 'Nền sơ đồ', description: 'Tải nền lên và hiển thị ngay trên canvas.' },
    layout: { title: 'Bố cục', description: 'Tạo bố cục mẫu cho địa điểm.' },
    section: { title: 'Khu vực ghế', description: 'Khai báo các khu vực trước khi dựng ghế.' },
    builder: { title: 'Trình dựng sơ đồ', description: 'Đặt ghế, tạo cụm ghế và vẽ vùng trên canvas.' },
}

function isSvgMarkup(value: string | null) {
    return Boolean(value && value.slice(0, 500).toLowerCase().includes('<svg'))
}

function renderBackgroundPreview(source: string | null) {
    if (!source) {
        return <div className="text-sm text-slate-400">Chưa có dữ liệu background.</div>
    }

    if (isSvgMarkup(source)) {
        return (
            <div
                className="max-h-[420px] overflow-auto rounded-xl border border-white/10 bg-white p-3"
                dangerouslySetInnerHTML={{ __html: source }}
            />
        )
    }

    return (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <img src={source} alt="Venue background preview" className="max-h-[420px] w-full rounded-lg object-contain" />
        </div>
    )
}

export default function AdminVenues() {
    const builderCanvasRef = useRef<HTMLDivElement>(null)
    const suppressNextCanvasClickRef = useRef(false)
    const nudgeSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const autoUploadQueuedRef = useRef(false)
    const savedVenueSeatsRef = useRef<VenueSeatItem[]>([])
    const savedVenuePolygonsRef = useRef<VenuePolygonItem[]>([])
    const tempSeatIdRef = useRef(-1)
    const tempPolygonIdRef = useRef(-1)
    const [venues, setVenues] = useState<VenueSummary[]>([])
    const [selectedVenueId, setSelectedVenueId] = useState<number | null>(null)
    const [selectedVenue, setSelectedVenue] = useState<VenueDetail | null>(null)
    const [layouts, setLayouts] = useState<VenueLayoutItem[]>([])
    const [selectedLayoutId, setSelectedLayoutId] = useState<number | null>(null)
    const [sections, setSections] = useState<VenueSectionItem[]>([])
    const [venueSeats, setVenueSeats] = useState<VenueSeatItem[]>([])
    const [venuePolygons, setVenuePolygons] = useState<VenuePolygonItem[]>([])
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const [builderBusy, setBuilderBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)
    const [backgroundFile, setBackgroundFile] = useState<File | null>(null)
    const [studioTab, setStudioTab] = useState<'builder' | 'parse'>('builder')
    const [backgroundViewMode, setBackgroundViewMode] = useState<'original' | 'processed'>('original')
    const [studioStep, setStudioStep] = useState<StudioStep>('venue')
    const [activeBuilderPanel, setActiveBuilderPanel] = useState<'seat' | 'bulk' | 'polygon'>('seat')
    const [canvasCursor, setCanvasCursor] = useState<{ x: number; y: number } | null>(null)

    const [venueForm, setVenueForm] = useState(DEFAULT_VENUE_FORM)
    const [editingVenueId, setEditingVenueId] = useState<number | null>(null)
    const [layoutForm, setLayoutForm] = useState(DEFAULT_LAYOUT_FORM)
    const [editingLayoutId, setEditingLayoutId] = useState<number | null>(null)
    const [sectionForm, setSectionForm] = useState(DEFAULT_SECTION_FORM)
    const [editingSectionId, setEditingSectionId] = useState<number | null>(null)
    const [singleSeatForm, setSingleSeatForm] = useState(DEFAULT_SINGLE_SEAT_FORM)
    const [bulkSeatForm, setBulkSeatForm] = useState(DEFAULT_BULK_SEAT_FORM)
    const [polygonForm, setPolygonForm] = useState(DEFAULT_POLYGON_FORM)
    const [editingSeatId, setEditingSeatId] = useState<number | null>(null)
    const [editingPolygonId, setEditingPolygonId] = useState<number | null>(null)
    const [placementMode, setPlacementMode] = useState<'seat' | 'polygon' | 'pan' | 'select'>('seat')
    const [draftPolygonPoints, setDraftPolygonPoints] = useState<Array<{ x: number; y: number }>>([])
    const [draggingSeatId, setDraggingSeatId] = useState<number | null>(null)
    const [dragSeatPosition, setDragSeatPosition] = useState<{ x: number; y: number } | null>(null)
    const [dragStartSeatPosition, setDragStartSeatPosition] = useState<{ x: number; y: number } | null>(null)
    const [dragSelectedSeatStartPositions, setDragSelectedSeatStartPositions] = useState<Record<number, { x: number; y: number }> | null>(null)
    const [draggingPolygonPointIndex, setDraggingPolygonPointIndex] = useState<number | null>(null)
    const [draggingPolygonBody, setDraggingPolygonBody] = useState(false)
    const [dragPolygonStartCursor, setDragPolygonStartCursor] = useState<{ x: number; y: number } | null>(null)
    const [dragPolygonStartPoints, setDragPolygonStartPoints] = useState<Array<{ x: number; y: number }> | null>(null)
    const [selectedSeatIds, setSelectedSeatIds] = useState<number[]>([])
    const [snapToGrid, setSnapToGrid] = useState(false)
    const [viewport, setViewport] = useState(DEFAULT_VIEWPORT)
    const [isPanning, setIsPanning] = useState(false)
    const [panStartCursor, setPanStartCursor] = useState<{ x: number; y: number } | null>(null)
    const [panStartOffset, setPanStartOffset] = useState<{ x: number; y: number } | null>(null)
    const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null)
    const [selectionCurrent, setSelectionCurrent] = useState<{ x: number; y: number } | null>(null)
    const [historyPast, setHistoryPast] = useState<Array<{ seats: VenueSeatItem[]; polygons: VenuePolygonItem[]; deletedSeatIds: number[]; deletedPolygonIds: number[]; selectedSeatIds: number[] }>>([])
    const [historyFuture, setHistoryFuture] = useState<Array<{ seats: VenueSeatItem[]; polygons: VenuePolygonItem[]; deletedSeatIds: number[]; deletedPolygonIds: number[]; selectedSeatIds: number[] }>>([])
    const [builderDirty, setBuilderDirty] = useState(false)
    const [pendingDeletedSeatIds, setPendingDeletedSeatIds] = useState<number[]>([])
    const [pendingDeletedPolygonIds, setPendingDeletedPolygonIds] = useState<number[]>([])

    const selectedLayout = useMemo(
        () => layouts.find((layout) => layout.id === selectedLayoutId) ?? null,
        [layouts, selectedLayoutId],
    )

    const selectedVenueBackground = useMemo(() => {
        if (!selectedVenue) return null
        if (backgroundViewMode === 'processed' && selectedVenue.background_processed) {
            return selectedVenue.background_processed
        }
        return selectedVenue.background_source ?? selectedVenue.svg_source ?? null
    }, [backgroundViewMode, selectedVenue])

    const isSvgBackground = selectedVenue?.background_type === 'svg' || isSvgMarkup(selectedVenue?.background_source ?? null)
    const hasBackground = Boolean(selectedVenue?.background_source)
    const hasLayout = Boolean(selectedLayoutId)
    const hasSections = sections.length > 0
    const activeStepIndex = STUDIO_STEPS.indexOf(studioStep)
    const sectionMap = useMemo(() => new Map(sections.map((section) => [section.id, section])), [sections])

    function canAccessStep(step: StudioStep) {
        switch (step) {
            case 'venue':
                return true
            case 'background':
                return Boolean(selectedVenueId)
            case 'layout':
                return Boolean(selectedVenueId && hasBackground)
            case 'section':
                return Boolean(selectedVenueId && hasBackground && hasLayout)
            case 'builder':
                return Boolean(selectedVenueId && hasBackground && hasLayout && hasSections)
            default:
                return false
        }
    }

    const seatPositionMap = useMemo(() => {
        const next = new Map<number, { x: number; y: number }>()
        venueSeats.forEach((seat) => {
            next.set(seat.id, { x: seat.x ?? 0, y: seat.y ?? 0 })
        })
        if (draggingSeatId !== null && dragSeatPosition) {
            next.set(draggingSeatId, dragSeatPosition)
        }
        return next
    }, [venueSeats, draggingSeatId, dragSeatPosition])
    const selectedSeat = useMemo(
        () => venueSeats.find((seat) => seat.id === selectedSeatIds[0]) ?? null,
        [venueSeats, selectedSeatIds],
    )

    function cloneSeatsForHistory(seats: VenueSeatItem[]) {
        return seats.map((seat) => ({ ...seat }))
    }

    function clonePolygonsForHistory(polygons: VenuePolygonItem[]) {
        return polygons.map((polygon) => ({
            ...polygon,
            points: polygon.points.map((point) => ({ ...point })),
        }))
    }

    function pushHistorySnapshot(nextSeats = venueSeats, nextPolygons = venuePolygons) {
        setHistoryPast((previous) => [...previous, { seats: cloneSeatsForHistory(nextSeats), polygons: clonePolygonsForHistory(nextPolygons), deletedSeatIds: [...pendingDeletedSeatIds], deletedPolygonIds: [...pendingDeletedPolygonIds], selectedSeatIds: [...selectedSeatIds] }].slice(-50))
        setHistoryFuture([])
    }

    function syncSavedVenueSeats(seats: VenueSeatItem[]) {
        savedVenueSeatsRef.current = cloneSeatsForHistory(seats)
    }

    function syncSavedVenuePolygons(polygons: VenuePolygonItem[]) {
        savedVenuePolygonsRef.current = clonePolygonsForHistory(polygons)
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

    function markBuilderDirty() {
        setBuilderDirty(true)
    }

    function discardBuilderChanges() {
        setVenueSeats(cloneSeatsForHistory(savedVenueSeatsRef.current))
        setVenuePolygons(clonePolygonsForHistory(savedVenuePolygonsRef.current))
        setPendingDeletedSeatIds([])
        setPendingDeletedPolygonIds([])
        setSelectedSeatIds([])
        setDraggingSeatId(null)
        setDragSeatPosition(null)
        setDragStartSeatPosition(null)
        setDragSelectedSeatStartPositions(null)
        setHistoryPast([])
        setHistoryFuture([])
        setBuilderDirty(false)
        setSelectionStart(null)
        setSelectionCurrent(null)
    }

    function confirmLeaveBuilderIfDirty() {
        if (!builderDirty) return true
        return window.confirm('Anh đang có thay đổi trên sơ đồ chưa lưu. Thoát ra sẽ mất các thay đổi này. Vẫn tiếp tục?')
    }

    function applySnap(value: number) {
        if (!snapToGrid) return Number(value.toFixed(2))
        return Number((Math.round(value / SNAP_STEP) * SNAP_STEP).toFixed(2))
    }

    async function persistSeatPositions(seatsToPersist: VenueSeatItem[]) {
        await Promise.all(
            seatsToPersist.map((seat) =>
                adminApi.updateVenueSeat(seat.id, {
                    x: seat.x ?? 0,
                    y: seat.y ?? 0,
                    rotation: seat.rotation,
                    section_id: seat.section_id,
                    label: seat.label,
                    is_admin_locked: seat.is_admin_locked,
                }),
            ),
        )
    }

    async function loadVenues(nextSelectedId?: number | null) {
        setLoading(true)
        setError(null)
        try {
            const list = await adminApi.listVenues()
            setVenues(list)
            const candidate = nextSelectedId ?? selectedVenueId ?? list[0]?.id ?? null
            setSelectedVenueId(candidate)
            if (candidate) {
                await loadVenueBundle(candidate)
            } else {
                setSelectedVenue(null)
                setLayouts([])
                setSections([])
                setSelectedLayoutId(null)
            }
        } catch (errorValue) {
            setError(extractApiErrorMessage(errorValue, 'Không thể tải danh sách venue.'))
        } finally {
            setLoading(false)
        }
    }

    async function loadVenueBundle(venueId: number) {
        const [detail, layoutList] = await Promise.all([adminApi.getVenue(venueId), adminApi.listLayouts(venueId)])
        setSelectedVenue(detail)
        setLayouts(layoutList)
        const nextLayoutId = layoutList[0]?.id ?? null
        setSelectedLayoutId(nextLayoutId)
        setSelectedVenueId(venueId)
        if (nextLayoutId) {
            await loadBuilderData(venueId, nextLayoutId)
        } else {
            setSections([])
            setVenueSeats([])
            setVenuePolygons([])
        }
        if (!detail.background_source) {
            setStudioStep('background')
        } else if (!nextLayoutId) {
            setStudioStep('layout')
        } else {
            setStudioStep('section')
        }
    }

    async function loadBuilderData(venueId: number, layoutId: number) {
        const [layoutSections, seats, polygons] = await Promise.all([
            adminApi.listLayoutSections(layoutId),
            adminApi.listVenueSeats(venueId, layoutId),
            adminApi.listVenuePolygons(venueId, layoutId),
        ])
        const fallbackSectionId = String(layoutSections[0]?.id ?? '')
        setSections(layoutSections)
        setVenueSeats(seats)
        setVenuePolygons(polygons)
        syncSavedVenueSeats(seats)
        syncSavedVenuePolygons(polygons)
        setSingleSeatForm((previous) => ({
            ...previous,
            section_id: layoutSections.some((section) => String(section.id) === previous.section_id) ? previous.section_id : fallbackSectionId,
            label: previous.label || `${layoutSections[0]?.code ?? 'A'}1`,
        }))
        setBulkSeatForm((previous) => ({
            ...previous,
            section_id: layoutSections.some((section) => String(section.id) === previous.section_id) ? previous.section_id : fallbackSectionId,
        }))
        setPolygonForm((previous) => ({
            ...previous,
            section_id: layoutSections.some((section) => String(section.id) === previous.section_id) ? previous.section_id : fallbackSectionId,
        }))
        setEditingSeatId(null)
        setEditingPolygonId(null)
        setDraftPolygonPoints([])
        setDraggingSeatId(null)
        setDragSeatPosition(null)
        setDragStartSeatPosition(null)
        setDragSelectedSeatStartPositions(null)
        setDraggingPolygonPointIndex(null)
        setDraggingPolygonBody(false)
        setDragPolygonStartCursor(null)
        setDragPolygonStartPoints(null)
        setSelectedSeatIds([])
        setHistoryPast([])
        setHistoryFuture([])
        setPendingDeletedSeatIds([])
        setPendingDeletedPolygonIds([])
        setBuilderDirty(false)
        setSelectionStart(null)
        setSelectionCurrent(null)
        if (nudgeSaveTimerRef.current) {
            clearTimeout(nudgeSaveTimerRef.current)
            nudgeSaveTimerRef.current = null
        }
    }

    useEffect(() => {
        void loadVenues()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (!selectedLayoutId) {
            setSections([])
            setVenueSeats([])
            setVenuePolygons([])
            return
        }

        let active = true
        void (async () => {
            try {
                if (!selectedVenueId) return
                const [list, seats, polygons] = await Promise.all([
                    adminApi.listLayoutSections(selectedLayoutId),
                    adminApi.listVenueSeats(selectedVenueId, selectedLayoutId),
                    adminApi.listVenuePolygons(selectedVenueId, selectedLayoutId),
                ])
                if (active) {
                    setSections(list)
                    setVenueSeats(seats)
                    setVenuePolygons(polygons)
                    syncSavedVenueSeats(seats)
                    syncSavedVenuePolygons(polygons)
                    setPendingDeletedSeatIds([])
                    setPendingDeletedPolygonIds([])
                    setBuilderDirty(false)
                }
            } catch (errorValue) {
                if (active) {
                    setError(extractApiErrorMessage(errorValue, 'Không thể tải sections của layout.'))
                }
            }
        })()

        return () => {
            active = false
        }
    }, [selectedLayoutId, selectedVenueId])

    useEffect(() => {
        if (backgroundViewMode === 'processed' && !selectedVenue?.background_processed) {
            setBackgroundViewMode('original')
        }
        if (studioTab === 'parse' && !selectedVenue?.can_parse_background) {
            setStudioTab('builder')
        }
    }, [backgroundViewMode, selectedVenue?.background_processed, selectedVenue?.can_parse_background, studioTab])

    useEffect(() => {
        if (studioStep === 'builder' && !canAccessStep('builder')) {
            if (canAccessStep('section')) {
                setStudioStep('section')
            } else if (canAccessStep('layout')) {
                setStudioStep('layout')
            } else if (canAccessStep('background')) {
                setStudioStep('background')
            } else {
                setStudioStep('venue')
            }
        }
    }, [studioStep, selectedVenueId, hasBackground, hasLayout, hasSections])

    useEffect(() => {
        if (!autoUploadQueuedRef.current || !backgroundFile || !selectedVenueId) return
        autoUploadQueuedRef.current = false
        void handleUploadBackground(backgroundFile)
    }, [backgroundFile, selectedVenueId])

    useEffect(() => {
        if (!builderDirty) return

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault()
            event.returnValue = ''
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
        }
    }, [builderDirty])

    useEffect(() => {
        if (draggingSeatId === null) return

        const handleWindowMouseMove = (event: globalThis.MouseEvent) => {
            const coordinates = getCanvasCoordinates(event.clientX, event.clientY)
            if (!coordinates) return
            setDragSeatPosition(coordinates)
            if (dragSelectedSeatStartPositions && dragStartSeatPosition && draggingSeatId !== null) {
                const deltaX = coordinates.x - dragStartSeatPosition.x
                const deltaY = coordinates.y - dragStartSeatPosition.y
            setVenueSeats((previous) =>
                previous.map((seat) => {
                    const start = dragSelectedSeatStartPositions[seat.id]
                    if (!start) return seat
                    return {
                            ...seat,
                            x: applySnap(Math.max(0, Math.min(100, start.x + deltaX))),
                            y: applySnap(Math.max(0, Math.min(100, start.y + deltaY))),
                        }
                    }),
                )
                markBuilderDirty()
            }
            setSingleSeatForm((previous) => ({
                ...previous,
                x: coordinates.x.toFixed(2),
                y: coordinates.y.toFixed(2),
            }))
        }

        const handleWindowMouseUp = () => {
            void finalizeSeatDrag()
        }

        window.addEventListener('mousemove', handleWindowMouseMove)
        window.addEventListener('mouseup', handleWindowMouseUp)

        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove)
            window.removeEventListener('mouseup', handleWindowMouseUp)
        }
    }, [draggingSeatId, selectedLayoutId, selectedVenueId, dragSeatPosition, dragStartSeatPosition, dragSelectedSeatStartPositions, snapToGrid])

    useEffect(() => {
        if (draggingPolygonPointIndex === null) return

        const handleWindowMouseMove = (event: globalThis.MouseEvent) => {
            const coordinates = getCanvasCoordinates(event.clientX, event.clientY)
            if (!coordinates) return
            setDraftPolygonPoints((previous) =>
                previous.map((point, index) => (index === draggingPolygonPointIndex ? coordinates : point)),
            )
        }

        const handleWindowMouseUp = () => {
            setDraggingPolygonPointIndex(null)
        }

        window.addEventListener('mousemove', handleWindowMouseMove)
        window.addEventListener('mouseup', handleWindowMouseUp)

        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove)
            window.removeEventListener('mouseup', handleWindowMouseUp)
        }
    }, [draggingPolygonPointIndex])

    useEffect(() => {
        if (!draggingPolygonBody || !dragPolygonStartCursor || !dragPolygonStartPoints) return

        const handleWindowMouseMove = (event: globalThis.MouseEvent) => {
            const coordinates = getCanvasCoordinates(event.clientX, event.clientY)
            if (!coordinates) return
            const deltaX = coordinates.x - dragPolygonStartCursor.x
            const deltaY = coordinates.y - dragPolygonStartCursor.y
            setDraftPolygonPoints(
                dragPolygonStartPoints.map((point) => ({
                    x: Number(Math.max(0, Math.min(100, point.x + deltaX)).toFixed(2)),
                    y: Number(Math.max(0, Math.min(100, point.y + deltaY)).toFixed(2)),
                })),
            )
        }

        const handleWindowMouseUp = () => {
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
    }, [draggingPolygonBody, dragPolygonStartCursor, dragPolygonStartPoints])

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

    useEffect(() => {
        if (placementMode !== 'select' || !selectionStart) return

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
                venueSeats
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
    }, [placementMode, selectionStart, selectionCurrent, venueSeats])

    useEffect(() => {
        const activeSeatIds = selectedSeatIds.length > 0 ? selectedSeatIds : editingSeatId !== null ? [editingSeatId] : []
        if (activeSeatIds.length === 0) return

        const handleKeyDown = (event: KeyboardEvent) => {
            const isEditableTarget = event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)
            if (isEditableTarget) return

            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
                event.preventDefault()
                if (event.shiftKey) {
                    handleRedo()
                } else {
                    handleUndo()
                }
                return
            }

            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
                event.preventDefault()
                handleRedo()
                return
            }

            const delta = event.shiftKey ? 5 : 1
            let moveX = 0
            let moveY = 0
            if (event.key === 'ArrowLeft') moveX = -delta
            if (event.key === 'ArrowRight') moveX = delta
            if (event.key === 'ArrowUp') moveY = -delta
            if (event.key === 'ArrowDown') moveY = delta
            if (moveX === 0 && moveY === 0) return

            event.preventDefault()
            pushHistorySnapshot()
            let nextSeatsSnapshot: VenueSeatItem[] = []
            setVenueSeats((previous) => {
                nextSeatsSnapshot = previous.map((seat) => {
                    if (!activeSeatIds.includes(seat.id)) return seat
                    return {
                        ...seat,
                        x: applySnap(Math.max(0, Math.min(100, (seat.x ?? 0) + moveX))),
                        y: applySnap(Math.max(0, Math.min(100, (seat.y ?? 0) + moveY))),
                    }
                })
                return nextSeatsSnapshot
            })
            setBuilderDirty(true)
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [selectedSeatIds, editingSeatId, venueSeats, venuePolygons, historyPast, historyFuture, snapToGrid])

    useEffect(() => {
        if (!selectedSeat || selectedSeatIds.length !== 1) {
            setEditingSeatId(null)
            return
        }
        setEditingSeatId(selectedSeat.id)
        setSingleSeatForm({
            label: selectedSeat.label,
            section_id: selectedSeat.section_id ? String(selectedSeat.section_id) : '',
            x: String(selectedSeat.x ?? 0),
            y: String(selectedSeat.y ?? 0),
            rotation: String(selectedSeat.rotation),
            is_admin_locked: selectedSeat.is_admin_locked,
        })
    }, [selectedSeat, selectedSeatIds])

    function startEditVenue(venue: VenueSummary) {
        setEditingVenueId(venue.id)
        setVenueForm({
            name: venue.name,
            address: selectedVenue?.id === venue.id ? selectedVenue.address ?? '' : '',
            city: venue.city ?? '',
            venue_type: venue.venue_type,
            capacity: venue.capacity ? String(venue.capacity) : '',
            width: selectedVenue?.id === venue.id ? String(selectedVenue.width) : '1000',
            height: selectedVenue?.id === venue.id ? String(selectedVenue.height) : '600',
        })
        setStudioStep('venue')
    }

    function resetVenueForm() {
        setEditingVenueId(null)
        setVenueForm(DEFAULT_VENUE_FORM)
    }

    async function handleSaveVenue() {
        setBusy(true)
        setError(null)
        setMessage(null)
        try {
            if (editingVenueId) {
                const updated = await adminApi.updateVenue(editingVenueId, {
                    name: venueForm.name,
                    address: venueForm.address || null,
                    city: venueForm.city || null,
                    venue_type: venueForm.venue_type,
                    capacity: venueForm.capacity ? Number(venueForm.capacity) : null,
                    width: Number(venueForm.width),
                    height: Number(venueForm.height),
                })
                setMessage('Đã cập nhật venue.')
                resetVenueForm()
                setStudioStep('background')
                await loadVenues(updated.id)
                return
            }

            const created = await adminApi.createVenue({
                name: venueForm.name,
                address: venueForm.address || null,
                city: venueForm.city || null,
                venue_type: venueForm.venue_type,
                capacity: venueForm.capacity ? Number(venueForm.capacity) : null,
                width: Number(venueForm.width),
                height: Number(venueForm.height),
            })
            resetVenueForm()
            setMessage('Đã tạo venue mới.')
            setStudioStep('background')
            await loadVenues(created.id)
        } catch (errorValue) {
            setError(extractApiErrorMessage(errorValue, 'Không thể tạo venue.'))
        } finally {
            setBusy(false)
        }
    }

    async function handleUploadBackground(fileOverride?: File) {
        const file = fileOverride ?? backgroundFile
        if (!selectedVenueId || !file) return
        setBusy(true)
        setError(null)
        setMessage(null)
        try {
            const result = await adminApi.uploadVenueBackground(selectedVenueId, file)
            setBackgroundViewMode('original')
            setStudioTab('builder')
            setStudioStep('layout')
            setMessage(
                result.background_type === 'svg'
                    ? 'Đã tải nền SVG lên. Trình dựng đã sẵn sàng, bước phân tích là tùy chọn.'
                    : 'Đã tải nền ảnh lên. Trình dựng đã sẵn sàng.',
            )
            await loadVenueBundle(selectedVenueId)
        } catch (errorValue) {
            setError(extractApiErrorMessage(errorValue, 'Không thể tải background.'))
        } finally {
            setBusy(false)
        }
    }

    async function handleProcessSvg() {
        if (!selectedVenueId) return
        setBusy(true)
        setError(null)
        setMessage(null)
        try {
            const result = await adminApi.processVenueSvg(selectedVenueId)
            setBackgroundViewMode('processed')
            setMessage(`Đã parse SVG: ${result.seat_count} seat markers, ${result.sections_detected} sections.`)
            await loadVenueBundle(selectedVenueId)
        } catch (errorValue) {
            setError(extractApiErrorMessage(errorValue, 'Không thể parse SVG.'))
        } finally {
            setBusy(false)
        }
    }

    function handleBackgroundFileChange(file: File | null) {
        setBackgroundFile(file)
        if (!file) {
            autoUploadQueuedRef.current = false
            return
        }
        autoUploadQueuedRef.current = true
        if (!selectedVenueId) {
            setMessage('File đã được giữ tạm. Hãy chọn venue, background sẽ tự upload.')
            return
        }
        void handleUploadBackground(file)
    }

    function startEditLayout(layout: VenueLayoutItem) {
        setEditingLayoutId(layout.id)
        setLayoutForm({
            name: layout.name,
            description: layout.description ?? '',
            svg_data: layout.svg_data ?? '',
            sort_order: String(layout.sort_order),
        })
    }

    function resetLayoutForm() {
        setEditingLayoutId(null)
        setLayoutForm(DEFAULT_LAYOUT_FORM)
    }

    async function handleSaveLayout() {
        if (!selectedVenueId || !layoutForm.name.trim()) return
        setBusy(true)
        setError(null)
        setMessage(null)
        try {
            if (editingLayoutId) {
                await adminApi.updateLayout(editingLayoutId, {
                    name: layoutForm.name,
                    description: layoutForm.description || null,
                    svg_data: layoutForm.svg_data || null,
                    sort_order: Number(layoutForm.sort_order),
                })
                setMessage('Đã cập nhật layout.')
                setStudioStep('section')
            } else {
                const created = await adminApi.createLayout(selectedVenueId, {
                    name: layoutForm.name,
                    description: layoutForm.description || null,
                    svg_data: layoutForm.svg_data || null,
                    sort_order: Number(layoutForm.sort_order),
                })
                setMessage('Đã tạo layout mới.')
                setSelectedLayoutId(created.id)
                setStudioStep('section')
            }
            resetLayoutForm()
            await loadVenueBundle(selectedVenueId)
        } catch (errorValue) {
            setError(extractApiErrorMessage(errorValue, 'Không thể lưu layout.'))
        } finally {
            setBusy(false)
        }
    }

    async function handleDeleteLayout(layoutId: number) {
        if (!window.confirm('Xóa layout này?')) return
        setBusy(true)
        setError(null)
        setMessage(null)
        try {
            await adminApi.deleteLayout(layoutId)
            setMessage('Đã xóa layout.')
            if (selectedVenueId) {
                await loadVenueBundle(selectedVenueId)
            }
        } catch (errorValue) {
            setError(extractApiErrorMessage(errorValue, 'Không thể xóa layout.'))
        } finally {
            setBusy(false)
        }
    }

    function startEditSection(section: VenueSectionItem) {
        setEditingSectionId(section.id)
        setSectionForm({
            name: section.name,
            code: section.code,
            color: section.color,
            price_base: String(section.price_base),
            sort_order: String(section.sort_order),
        })
    }

    function resetSectionForm() {
        setEditingSectionId(null)
        setSectionForm(DEFAULT_SECTION_FORM)
    }

    async function handleSaveSection() {
        if (!selectedLayoutId || !sectionForm.name.trim() || !sectionForm.code.trim()) return
        setBusy(true)
        setError(null)
        setMessage(null)
        try {
            if (editingSectionId) {
                await adminApi.updateSection(editingSectionId, {
                    name: sectionForm.name,
                    code: sectionForm.code,
                    color: sectionForm.color,
                    price_base: Number(sectionForm.price_base),
                    sort_order: Number(sectionForm.sort_order),
                })
                setMessage('Đã cập nhật section.')
            } else {
                await adminApi.createLayoutSection(selectedLayoutId, {
                    name: sectionForm.name,
                    code: sectionForm.code,
                    color: sectionForm.color,
                    price_base: Number(sectionForm.price_base),
                    sort_order: Number(sectionForm.sort_order),
                })
                setMessage('Đã tạo section mới.')
            }
            resetSectionForm()
            const latestSections = await adminApi.listLayoutSections(selectedLayoutId)
            setSections(latestSections)
            setStudioStep('builder')
        } catch (errorValue) {
            setError(extractApiErrorMessage(errorValue, 'Không thể lưu section.'))
        } finally {
            setBusy(false)
        }
    }

    async function handleDeleteSection(sectionId: number) {
        if (!window.confirm('Xóa section này?')) return
        setBusy(true)
        setError(null)
        setMessage(null)
        try {
            await adminApi.deleteSection(sectionId)
            setMessage('Đã xóa section.')
            if (selectedLayoutId) {
                setSections(await adminApi.listLayoutSections(selectedLayoutId))
            }
        } catch (errorValue) {
            setError(extractApiErrorMessage(errorValue, 'Không thể xóa section.'))
        } finally {
            setBusy(false)
        }
    }

    function resetSeatForm() {
        setEditingSeatId(null)
        setSingleSeatForm((previous) => ({
            ...DEFAULT_SINGLE_SEAT_FORM,
            section_id: previous.section_id,
        }))
    }

    function handleUndo() {
        if (builderBusy) return
        setHistoryPast((previous) => {
            const snapshot = previous[previous.length - 1]
            if (!snapshot) return previous
            setHistoryFuture((future) => [{ seats: cloneSeatsForHistory(venueSeats), polygons: clonePolygonsForHistory(venuePolygons), deletedSeatIds: [...pendingDeletedSeatIds], deletedPolygonIds: [...pendingDeletedPolygonIds], selectedSeatIds: [...selectedSeatIds] }, ...future].slice(0, 50))
            setVenueSeats(cloneSeatsForHistory(snapshot.seats))
            setVenuePolygons(clonePolygonsForHistory(snapshot.polygons))
            setPendingDeletedSeatIds(snapshot.deletedSeatIds)
            setPendingDeletedPolygonIds(snapshot.deletedPolygonIds)
            setSelectedSeatIds(snapshot.selectedSeatIds)
            setBuilderDirty(true)
            if (editingPolygonId !== null) {
                const polygon = snapshot.polygons.find((item) => item.id === editingPolygonId)
                setDraftPolygonPoints(polygon ? polygon.points.map((point) => ({ ...point })) : [])
            }
            return previous.slice(0, -1)
        })
    }

    function handleRedo() {
        if (builderBusy) return
        setHistoryFuture((previous) => {
            const snapshot = previous[0]
            if (!snapshot) return previous
            setHistoryPast((past) => [...past, { seats: cloneSeatsForHistory(venueSeats), polygons: clonePolygonsForHistory(venuePolygons), deletedSeatIds: [...pendingDeletedSeatIds], deletedPolygonIds: [...pendingDeletedPolygonIds], selectedSeatIds: [...selectedSeatIds] }].slice(-50))
            setVenueSeats(cloneSeatsForHistory(snapshot.seats))
            setVenuePolygons(clonePolygonsForHistory(snapshot.polygons))
            setPendingDeletedSeatIds(snapshot.deletedSeatIds)
            setPendingDeletedPolygonIds(snapshot.deletedPolygonIds)
            setSelectedSeatIds(snapshot.selectedSeatIds)
            setBuilderDirty(true)
            if (editingPolygonId !== null) {
                const polygon = snapshot.polygons.find((item) => item.id === editingPolygonId)
                setDraftPolygonPoints(polygon ? polygon.points.map((point) => ({ ...point })) : [])
            }
            return previous.slice(1)
        })
    }

    function zoomCanvas(factor: number) {
        const element = builderCanvasRef.current
        if (!element) return
        const rect = element.getBoundingClientRect()
        const centerX = rect.width / 2
        const centerY = rect.height / 2
        setViewport((previous) => {
            const nextScale = Math.max(0.5, Math.min(3, Number((previous.scale * factor).toFixed(2))))
            const scaleRatio = nextScale / previous.scale
            return {
                scale: nextScale,
                offsetX: previous.offsetX - (centerX - previous.offsetX) * (scaleRatio - 1),
                offsetY: previous.offsetY - (centerY - previous.offsetY) * (scaleRatio - 1),
            }
        })
    }

    function handleBuilderCanvasClick(event: MouseEvent<HTMLDivElement>) {
        if (suppressNextCanvasClickRef.current) {
            suppressNextCanvasClickRef.current = false
            return
        }
        if (draggingSeatId !== null || draggingPolygonBody) return
        const coordinates = getCanvasCoordinates(event.clientX, event.clientY)
        if (!coordinates) return
        if (placementMode === 'pan') {
            return
        }
        if (placementMode === 'select') {
            return
        }
        if (placementMode !== 'seat') {
            setSelectedSeatIds([])
            setEditingSeatId(null)
        }

        if (placementMode === 'seat') {
            setSingleSeatForm((previous) => ({
                ...previous,
                x: coordinates.x.toFixed(2),
                y: coordinates.y.toFixed(2),
            }))
            if (!event.shiftKey) {
                setSelectedSeatIds([])
            }
            return
        }

        if (editingPolygonId !== null) {
            return
        }

        setDraftPolygonPoints((previous) => [...previous, coordinates])
    }

    function handleCanvasMouseDown(event: MouseEvent<HTMLDivElement>) {
        if (placementMode === 'select') {
            const coordinates = getCanvasCoordinates(event.clientX, event.clientY)
            if (!coordinates) return
            event.preventDefault()
            setSelectionStart(coordinates)
            setSelectionCurrent(coordinates)
            return
        }
        const shouldPan = placementMode === 'pan' || event.button === 1 || event.shiftKey
        if (!shouldPan) return
        event.preventDefault()
        event.stopPropagation()
        suppressNextCanvasClickRef.current = true
        setIsPanning(true)
        setPanStartCursor({ x: event.clientX, y: event.clientY })
        setPanStartOffset({ x: viewport.offsetX, y: viewport.offsetY })
    }

    function handleCanvasWheel(event: WheelEvent<HTMLDivElement>) {
        event.preventDefault()
        const element = builderCanvasRef.current
        if (!element) return
        const rect = element.getBoundingClientRect()
        const pointerX = event.clientX - rect.left
        const pointerY = event.clientY - rect.top
        setViewport((previous) => {
            const factor = event.deltaY < 0 ? 1.1 : 0.9
            const nextScale = Math.max(0.5, Math.min(3, Number((previous.scale * factor).toFixed(2))))
            const logicalX = (pointerX - previous.offsetX) / previous.scale
            const logicalY = (pointerY - previous.offsetY) / previous.scale
            return {
                scale: nextScale,
                offsetX: pointerX - logicalX * nextScale,
                offsetY: pointerY - logicalY * nextScale,
            }
        })
    }

    function handleCanvasMouseMove(event: MouseEvent<HTMLDivElement>) {
        const coordinates = getCanvasCoordinates(event.clientX, event.clientY)
        setCanvasCursor(coordinates)
    }

    function startEditSeat(seat: VenueSeatItem) {
        setEditingSeatId(seat.id)
        setEditingPolygonId(null)
        setPlacementMode('seat')
        setSingleSeatForm({
            label: seat.label,
            section_id: seat.section_id ? String(seat.section_id) : '',
            x: String(seat.x ?? 0),
            y: String(seat.y ?? 0),
            rotation: String(seat.rotation),
            is_admin_locked: seat.is_admin_locked,
        })
    }

    function startEditPolygon(polygon: VenuePolygonItem) {
        setEditingSeatId(null)
        setSelectedSeatIds([])
        setEditingPolygonId(polygon.id)
        setPlacementMode('polygon')
        setPolygonForm({
            label: polygon.label ?? '',
            section_id: polygon.section_id ? String(polygon.section_id) : '',
        })
        setDraftPolygonPoints(polygon.points.map((point) => ({ x: point.x, y: point.y })))
    }

    function cancelPolygonEditing() {
        setEditingPolygonId(null)
        setDraftPolygonPoints([])
        setDraggingPolygonPointIndex(null)
        setDraggingPolygonBody(false)
        setDragPolygonStartCursor(null)
        setDragPolygonStartPoints(null)
        setPolygonForm((previous) => ({
            ...DEFAULT_POLYGON_FORM,
            section_id: previous.section_id,
        }))
    }

    function handlePolygonMouseDown(event: MouseEvent<SVGPolygonElement>, polygon: VenuePolygonItem) {
        event.preventDefault()
        event.stopPropagation()
        suppressNextCanvasClickRef.current = true

        if (editingPolygonId !== polygon.id) {
            startEditPolygon(polygon)
            return
        }

        const coordinates = getCanvasCoordinates(event.clientX, event.clientY)
        if (!coordinates) return
        pushHistorySnapshot()
        setDraggingPolygonPointIndex(null)
        setDraggingPolygonBody(true)
        setDragPolygonStartCursor(coordinates)
        setDragPolygonStartPoints(draftPolygonPoints.map((point) => ({ x: point.x, y: point.y })))
    }

    function getCanvasCoordinates(clientX: number, clientY: number) {
        const element = builderCanvasRef.current
        if (!element) return null
        const rect = element.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) return null
        const logicalX = ((clientX - rect.left - viewport.offsetX) / viewport.scale / rect.width) * 100
        const logicalY = ((clientY - rect.top - viewport.offsetY) / viewport.scale / rect.height) * 100
        return {
            x: applySnap(Math.max(0, Math.min(100, logicalX))),
            y: applySnap(Math.max(0, Math.min(100, logicalY))),
        }
    }

    function handleSeatPointerDown(event: MouseEvent<HTMLButtonElement>, seat: VenueSeatItem) {
        event.preventDefault()
        event.stopPropagation()
        suppressNextCanvasClickRef.current = true
        if (placementMode === 'select') {
            const nextSelection = event.shiftKey
                ? (selectedSeatIds.includes(seat.id) ? selectedSeatIds.filter((id) => id !== seat.id) : [...selectedSeatIds, seat.id])
                : (selectedSeatIds.length > 1 && selectedSeatIds.includes(seat.id) ? selectedSeatIds : [seat.id])
            setSelectedSeatIds(nextSelection)
            pushHistorySnapshot()
            const currentPosition = {
                x: seatPositionMap.get(seat.id)?.x ?? seat.x ?? 0,
                y: seatPositionMap.get(seat.id)?.y ?? seat.y ?? 0,
            }
            const startPositions = Object.fromEntries(
                venueSeats
                    .filter((item) => nextSelection.includes(item.id))
                    .map((item) => [item.id, { x: item.x ?? 0, y: item.y ?? 0 }]),
            )
            setDraggingSeatId(seat.id)
            setDragStartSeatPosition(currentPosition)
            setDragSeatPosition(currentPosition)
            setDragSelectedSeatStartPositions(startPositions)
            return
        }
        if (placementMode !== 'seat') {
            startEditSeat(seat)
            return
        }
        if (event.shiftKey) {
            setSelectedSeatIds((previous) => (previous.includes(seat.id) ? previous.filter((id) => id !== seat.id) : [...previous, seat.id]))
            return
        }
        startEditSeat(seat)
        setSelectedSeatIds((previous) => (previous.length > 1 && previous.includes(seat.id) ? previous : [seat.id]))
        pushHistorySnapshot()
        const currentPosition = {
            x: seatPositionMap.get(seat.id)?.x ?? seat.x ?? 0,
            y: seatPositionMap.get(seat.id)?.y ?? seat.y ?? 0,
        }
        const activeIds = selectedSeatIds.length > 1 && selectedSeatIds.includes(seat.id) ? selectedSeatIds : [seat.id]
        const startPositions = Object.fromEntries(
            venueSeats
                .filter((item) => activeIds.includes(item.id))
                .map((item) => [item.id, { x: item.x ?? 0, y: item.y ?? 0 }]),
        )
        setDraggingSeatId(seat.id)
        setDragStartSeatPosition(currentPosition)
        setDragSeatPosition(currentPosition)
        setDragSelectedSeatStartPositions(startPositions)
    }

    async function finalizeSeatDrag() {
        if (!selectedVenueId || !selectedLayoutId || draggingSeatId === null || !dragSeatPosition) {
            setDraggingSeatId(null)
            setDragSeatPosition(null)
            setDragStartSeatPosition(null)
            return
        }

        const originalPosition = dragStartSeatPosition
        const activeSeatId = draggingSeatId
        const nextPosition = dragSeatPosition
        const activeSeatIds = dragSelectedSeatStartPositions ? Object.keys(dragSelectedSeatStartPositions).map(Number) : [activeSeatId]
        const seatsToPersist = venueSeats.filter((seat) => activeSeatIds.includes(seat.id))

        setDraggingSeatId(null)
        setDragSeatPosition(null)
        setDragStartSeatPosition(null)
        setDragSelectedSeatStartPositions(null)
        setDragSeatPosition(null)
        if (!originalPosition || originalPosition.x !== nextPosition.x || originalPosition.y !== nextPosition.y || seatsToPersist.length > 1) {
            setBuilderDirty(true)
        }
    }

    function handleSaveSeat() {
        if (!selectedLayoutId || !singleSeatForm.label.trim()) return
        const nextSectionId = singleSeatForm.section_id ? Number(singleSeatForm.section_id) : null
        const nextSectionName = nextSectionId ? sectionMap.get(nextSectionId)?.name ?? null : null
        const nextSeat: VenueSeatItem = {
            id: editingSeatId ?? nextTempSeatId(),
            venue_layout_id: selectedLayoutId,
            section_id: nextSectionId,
            section_name: nextSectionName,
            label: singleSeatForm.label.trim(),
            x: Number(singleSeatForm.x),
            y: Number(singleSeatForm.y),
            rotation: Number(singleSeatForm.rotation),
            is_admin_locked: singleSeatForm.is_admin_locked,
        }
        pushHistorySnapshot()
        setVenueSeats((previous) => (
            editingSeatId
                ? previous.map((seat) => (seat.id === editingSeatId ? nextSeat : seat))
                : [...previous, nextSeat]
        ))
        setBuilderDirty(true)
        resetSeatForm()
        setActiveBuilderPanel('seat')
    }

    async function handleDeleteSeat(seatId: number) {
        if (!window.confirm('Xóa ghế này khỏi bố cục?')) return
        pushHistorySnapshot()
        setVenueSeats((previous) => previous.filter((seat) => seat.id !== seatId))
        if (seatId > 0) {
            setPendingDeletedSeatIds((previous) => (previous.includes(seatId) ? previous : [...previous, seatId]))
        }
        setSelectedSeatIds((previous) => previous.filter((id) => id !== seatId))
        if (editingSeatId === seatId) {
            resetSeatForm()
        }
        setBuilderDirty(true)
    }

    function handleBulkSeatCreate() {
        if (!selectedLayoutId) return
        const sectionId = bulkSeatForm.section_id ? Number(bulkSeatForm.section_id) : null
        const sectionName = sectionId ? sectionMap.get(sectionId)?.name ?? null : null
        const rows = Number(bulkSeatForm.rows)
        const cols = Number(bulkSeatForm.cols)
        const gapX = Number(bulkSeatForm.gap_x)
        const gapY = Number(bulkSeatForm.gap_y)
        const startX = Number(bulkSeatForm.start_x)
        const startY = Number(bulkSeatForm.start_y)
        const prefix = bulkSeatForm.label_prefix.trim() || 'A'
        const existingLabels = new Set(venueSeats.map((seat) => seat.label.trim().toLowerCase()))
        const generatedSeats: VenueSeatItem[] = []

        const tryPushSeat = (rowIndex: number, seatIndex: number, x: number, y: number, rotation = 0) => {
            const label = `${prefix}${rowIndex + 1}-${seatIndex + 1}`
            if (existingLabels.has(label.toLowerCase())) return
            existingLabels.add(label.toLowerCase())
            generatedSeats.push({
                id: nextTempSeatId(),
                venue_layout_id: selectedLayoutId,
                section_id: sectionId,
                section_name: sectionName,
                label,
                x: Number(Math.max(0, Math.min(100, x)).toFixed(2)),
                y: Number(Math.max(0, Math.min(100, y)).toFixed(2)),
                rotation: Number(rotation.toFixed(2)),
                is_admin_locked: false,
            })
        }

        if (bulkSeatForm.pattern === 'straight' || bulkSeatForm.pattern === 'zigzag') {
            for (let row = 0; row < rows; row += 1) {
                const offset = bulkSeatForm.pattern === 'zigzag' && row % 2 ? gapX / 2 : 0
                for (let col = 0; col < cols; col += 1) {
                    tryPushSeat(row, col, startX + offset + col * gapX, startY + row * gapY)
                }
            }
        } else {
            const centerX = Number(bulkSeatForm.arc_center_x)
            const centerY = Number(bulkSeatForm.arc_center_y)
            const radius = Number(bulkSeatForm.arc_radius)
            const startAngle = Number(bulkSeatForm.arc_start_angle)
            const endAngle = Number(bulkSeatForm.arc_end_angle)
            for (let row = 0; row < rows; row += 1) {
                const rowRadius = radius + row * gapY
                const seatsInRow = cols + row * 2
                const denominator = seatsInRow > 1 ? seatsInRow - 1 : 1
                for (let col = 0; col < seatsInRow; col += 1) {
                    const angle = startAngle + (endAngle - startAngle) * (col / denominator)
                    const radians = (angle * Math.PI) / 180
                    tryPushSeat(row, col, centerX + rowRadius * Math.sin(radians), centerY + rowRadius * Math.cos(radians), angle)
                }
            }
        }

        if (generatedSeats.length === 0) {
            return
        }

        pushHistorySnapshot()
        setVenueSeats((previous) => [...previous, ...generatedSeats])
        setBuilderDirty(true)
        setActiveBuilderPanel('bulk')
    }

    function handleSavePolygon() {
        if (!selectedVenueId || !selectedLayoutId || draftPolygonPoints.length < 3) return
        const nextSectionId = polygonForm.section_id ? Number(polygonForm.section_id) : null
        const nextSectionName = nextSectionId ? sectionMap.get(nextSectionId)?.name ?? null : null
        const nextPolygon: VenuePolygonItem = {
            id: editingPolygonId ?? nextTempPolygonId(),
            venue_id: selectedVenueId,
            venue_layout_id: selectedLayoutId,
            section_id: nextSectionId,
            section_name: nextSectionName,
            label: polygonForm.label.trim() || null,
            points: draftPolygonPoints.map((point) => ({ ...point })),
            created_at: '',
            updated_at: '',
        }
        pushHistorySnapshot()
        setVenuePolygons((previous) => (
            editingPolygonId
                ? previous.map((polygon) => (polygon.id === editingPolygonId ? nextPolygon : polygon))
                : [...previous, nextPolygon]
        ))
        setBuilderDirty(true)
        cancelPolygonEditing()
        setActiveBuilderPanel('polygon')
    }

    function handleDeletePolygon(polygonId: number) {
        if (!selectedVenueId || !selectedLayoutId || !window.confirm('Xóa polygon này?')) return
        pushHistorySnapshot()
        setVenuePolygons((previous) => previous.filter((polygon) => polygon.id !== polygonId))
        if (polygonId > 0) {
            setPendingDeletedPolygonIds((previous) => (previous.includes(polygonId) ? previous : [...previous, polygonId]))
        }
        setBuilderDirty(true)
        if (editingPolygonId === polygonId) {
            cancelPolygonEditing()
        }
    }

    const selectedVenueLabel = selectedVenue ? `${selectedVenue.name} · ${selectedVenue.city ?? 'N/A'}` : 'Chưa chọn venue'
    const stepSummary = STEP_META[studioStep]

    async function handleSaveBuilderChanges() {
        if (!selectedVenueId || !selectedLayoutId) return
        setBuilderBusy(true)
        setError(null)
        setMessage(null)
        try {
            const savedMap = new Map(savedVenueSeatsRef.current.map((seat) => [seat.id, seat]))
            const savedPolygonMap = new Map(savedVenuePolygonsRef.current.map((polygon) => [polygon.id, polygon]))
            const newSeats = venueSeats.filter((seat) => seat.id < 0)
            const changedSeats = venueSeats.filter((seat) => {
                if (seat.id < 0) return false
                const savedSeat = savedMap.get(seat.id)
                if (!savedSeat) return false
                return savedSeat.x !== seat.x || savedSeat.y !== seat.y || savedSeat.rotation !== seat.rotation || savedSeat.section_id !== seat.section_id || savedSeat.label !== seat.label
                    || savedSeat.is_admin_locked !== seat.is_admin_locked
            })
            const newPolygons = venuePolygons.filter((polygon) => polygon.id < 0)
            const changedPolygons = venuePolygons.filter((polygon) => {
                if (polygon.id < 0) return false
                const savedPolygon = savedPolygonMap.get(polygon.id)
                if (!savedPolygon) return false
                return (
                    savedPolygon.section_id !== polygon.section_id ||
                    savedPolygon.label !== polygon.label ||
                    JSON.stringify(savedPolygon.points) !== JSON.stringify(polygon.points)
                )
            })

            const createdSeatPairs = await Promise.all(
                newSeats.map(async (seat) => {
                    const created = await adminApi.createVenueSeatSingle(selectedVenueId, {
                        layout_id: selectedLayoutId,
                        label: seat.label,
                        section_id: seat.section_id,
                        x: seat.x ?? 0,
                        y: seat.y ?? 0,
                        rotation: seat.rotation,
                        is_admin_locked: seat.is_admin_locked,
                    })
                    return [seat.id, created] as const
                }),
            )
            const createdSeatMap = new Map(createdSeatPairs)
            if (changedSeats.length > 0) {
                await persistSeatPositions(changedSeats)
            }
            if (pendingDeletedSeatIds.length > 0) {
                await Promise.all(pendingDeletedSeatIds.map((seatId) => adminApi.deleteVenueSeat(seatId)))
            }
            const createdPolygonPairs = await Promise.all(
                newPolygons.map(async (polygon) => {
                    const created = await adminApi.createVenuePolygon(selectedVenueId, {
                        layout_id: selectedLayoutId,
                        section_id: polygon.section_id,
                        label: polygon.label,
                        points: polygon.points,
                    })
                    return [polygon.id, created] as const
                }),
            )
            const createdPolygonMap = new Map(createdPolygonPairs)
            if (changedPolygons.length > 0) {
                await Promise.all(
                    changedPolygons.map((polygon) =>
                        adminApi.updateVenuePolygon(polygon.id, {
                            section_id: polygon.section_id,
                            label: polygon.label,
                            points: polygon.points,
                        }),
                    ),
                )
            }
            if (pendingDeletedPolygonIds.length > 0) {
                await Promise.all(pendingDeletedPolygonIds.map((polygonId) => adminApi.deleteVenuePolygon(polygonId)))
            }

            const finalSeats = venueSeats
                .filter((seat) => !pendingDeletedSeatIds.includes(seat.id))
                .map((seat) => createdSeatMap.get(seat.id) ?? seat)
            const finalPolygons = venuePolygons
                .filter((polygon) => !pendingDeletedPolygonIds.includes(polygon.id))
                .map((polygon) => createdPolygonMap.get(polygon.id) ?? polygon)

            setVenueSeats(finalSeats)
            setVenuePolygons(finalPolygons)
            syncSavedVenueSeats(finalSeats)
            syncSavedVenuePolygons(finalPolygons)
            setPendingDeletedSeatIds([])
            setPendingDeletedPolygonIds([])
            setBuilderDirty(false)
            setHistoryPast([])
            setHistoryFuture([])
            setMessage('Đã lưu thay đổi trên sơ đồ.')
        } catch (errorValue) {
            setError(extractApiErrorMessage(errorValue, 'Không thể lưu thay đổi trên sơ đồ.'))
        } finally {
            setBuilderBusy(false)
        }
    }

    function handleRemovePolygonPoint(index: number) {
        pushHistorySnapshot()
        setDraftPolygonPoints((previous) => previous.filter((_, pointIndex) => pointIndex !== index))
    }

    function handleApplySelectedSeatChanges() {
        if (selectedSeatIds.length === 0) return
        pushHistorySnapshot()
        const nextSectionId = singleSeatForm.section_id ? Number(singleSeatForm.section_id) : null
        const nextSectionName = nextSectionId ? sectionMap.get(nextSectionId)?.name ?? null : null
        const nextRotation = Number(singleSeatForm.rotation)
        setVenueSeats((previous) =>
            previous.map((seat) =>
                selectedSeatIds.includes(seat.id)
                    ? {
                        ...seat,
                        section_id: nextSectionId,
                        section_name: nextSectionName,
                        rotation: Number.isNaN(nextRotation) ? seat.rotation : nextRotation,
                        is_admin_locked: singleSeatForm.is_admin_locked,
                    }
                    : seat,
            ),
        )
        setBuilderDirty(true)
    }

    function handleDeleteSelectedSeats() {
        if (selectedSeatIds.length === 0 || !window.confirm(`Xóa ${selectedSeatIds.length} ghế đã chọn khỏi bố cục?`)) return
        pushHistorySnapshot()
        setVenueSeats((previous) => previous.filter((seat) => !selectedSeatIds.includes(seat.id)))
        setPendingDeletedSeatIds((previous) => [...new Set([...previous, ...selectedSeatIds.filter((id) => id > 0)])])
        setSelectedSeatIds([])
        setBuilderDirty(true)
    }

    function goToStep(step: StudioStep) {
        if (studioStep === 'builder' && step !== 'builder' && !confirmLeaveBuilderIfDirty()) {
            return
        }
        if (!canAccessStep(step)) {
            setError(`Chưa thể vào bước ${STEP_META[step].title}. Hãy hoàn tất các bước trước.`)
            return
        }
        setError(null)
        setStudioStep(step)
    }

    function goToPreviousStep() {
        const previousStep = STUDIO_STEPS[Math.max(0, activeStepIndex - 1)]
        setStudioStep(previousStep)
    }

    function goToNextStep() {
        const nextStep = STUDIO_STEPS[Math.min(STUDIO_STEPS.length - 1, activeStepIndex + 1)]
        goToStep(nextStep)
    }

    if (loading) {
        return <GlobalLoader />
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-black admin-text-body">Venue Studio</h1>
                    <p className="text-slate-400 mt-1 max-w-2xl">
                        Thiết lập địa điểm theo từng bước: tạo địa điểm, tải nền sơ đồ, tạo bố cục, khai báo khu vực và dựng ghế.
                    </p>
                </div>
                <Button
                    className='border border-bg-black'
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        if (!confirmLeaveBuilderIfDirty()) return
                        void loadVenues()
                    }}
                    isLoading={loading}
                >
                    <RefreshCw className="h-4 w-4" />
                    Làm mới
                </Button>
            </div>

            {(error || message) && (
                <div className="fixed right-6 top-24 z-50 w-full max-w-sm">
                    <div className={`rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${error ? 'border-red-500/30 bg-red-500/15 text-red-100' : 'border-emerald-500/30 bg-emerald-500/15 text-emerald-100'}`}>
                        {error ?? message}
                    </div>
                </div>
            )}

            <Card className="bg-space-900/90 border-white/10">
                <CardContent className="py-5 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Các bước thực hiện</p>
                            <h2 className="text-xl font-black text-white">{stepSummary.title}</h2>
                            <p className="mt-1 text-sm text-slate-400">{stepSummary.description}</p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={goToPreviousStep} disabled={activeStepIndex === 0}>
                                Quay lại
                            </Button>
                            <Button variant="primary" onClick={goToNextStep} disabled={activeStepIndex === STUDIO_STEPS.length - 1}>
                                Tiếp theo
                            </Button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        {STUDIO_STEPS.map((step, index) => {
                            const isActive = studioStep === step
                            const unlocked = canAccessStep(step)
                            return (
                                <button
                                    key={step}
                                    type="button"
                                    onClick={() => goToStep(step)}
                                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                                        isActive
                                            ? 'border-brand-red/40 bg-brand-red/10'
                                            : unlocked
                                                ? 'border-white/10 bg-white/5 hover:bg-white/10'
                                                : 'border-white/5 bg-white/[0.03] opacity-60'
                                    }`}
                                >
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Bước {index + 1}</p>
                                    <p className="mt-1 font-semibold text-white">{STEP_META[step].title}</p>
                                </button>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            <div className={`grid gap-6 ${studioStep === 'builder' ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-3'}`}>
                <Card className={`xl:col-span-1 bg-space-900/90 border-white/10 ${studioStep === 'builder' ? 'hidden' : ''}`}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-white">
                            <Building2 className="h-5 w-5 text-brand-red" /> Danh sách địa điểm
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-3">
                            <div>
                                <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Tên địa điểm</label>
                                <Input value={venueForm.name} onChange={(event) => setVenueForm({ ...venueForm, name: event.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Thành phố</label>
                                    <Input value={venueForm.city} onChange={(event) => setVenueForm({ ...venueForm, city: event.target.value })} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Loại hình</label>
                                    <Input value={venueForm.venue_type} onChange={(event) => setVenueForm({ ...venueForm, venue_type: event.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Sức chứa</label>
                                    <Input value={venueForm.capacity} onChange={(event) => setVenueForm({ ...venueForm, capacity: event.target.value })} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Rộng</label>
                                    <Input value={venueForm.width} onChange={(event) => setVenueForm({ ...venueForm, width: event.target.value })} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Cao</label>
                                    <Input value={venueForm.height} onChange={(event) => setVenueForm({ ...venueForm, height: event.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Địa chỉ</label>
                                <Input value={venueForm.address} onChange={(event) => setVenueForm({ ...venueForm, address: event.target.value })} />
                            </div>
                            <div className="flex gap-2">
                                {editingVenueId && (
                                    <Button variant="ghost" className="flex-1" onClick={resetVenueForm}>
                                        Hủy sửa
                                    </Button>
                                )}
                                <Button className="flex-1" onClick={() => void handleSaveVenue()} isLoading={busy}>
                                    {editingVenueId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                    {editingVenueId ? 'Lưu venue' : 'Tạo venue'}
                                </Button>
                            </div>
                        </div>

                        <div className="border-t border-white/10 pt-4 space-y-2">
                            {loading ? (
                                <p className="text-sm text-slate-400">Đang tải danh sách địa điểm...</p>
                            ) : venues.length === 0 ? (
                                <p className="text-sm text-slate-400">Chưa có địa điểm nào.</p>
                            ) : (
                                venues.map((venue) => (
                                    <button
                                        key={venue.id}
                                        type="button"
                                        onClick={() => {
                                            if (!confirmLeaveBuilderIfDirty()) return
                                            void loadVenueBundle(venue.id)
                                        }}
                                        className={`w-full rounded-xl border px-4 py-3 text-left transition ${selectedVenueId === venue.id ? 'border-brand-red/40 bg-brand-red/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="font-semibold text-white">{venue.name}</p>
                                                <p className="text-xs text-slate-400">{venue.city ?? 'N/A'} · {venue.venue_type}</p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-xs text-slate-400">{venue.capacity ?? 0} chỗ</span>
                                                <button
                                                    type="button"
                                                    className="rounded p-1.5 hover:bg-white/10"
                                                    onClick={(event) => {
                                                        event.stopPropagation()
                                                        if (!confirmLeaveBuilderIfDirty()) return
                                                        void loadVenueBundle(venue.id).then(() => startEditVenue(venue))
                                                    }}
                                                >
                                                    <Edit className="h-4 w-4 text-sky-300" />
                                                </button>
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                <div className={`${studioStep === 'builder' ? 'space-y-6' : 'xl:col-span-2 space-y-6'}`}>
                    <Card className={`bg-space-900/90 border-white/10 ${studioStep === 'venue' ? '' : 'hidden'}`}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-white">
                            <Building2 className="h-5 w-5 text-brand-red" /> Thiết lập địa điểm
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-slate-300">
                        <p>Tạo địa điểm mới hoặc chọn một địa điểm có sẵn ở cột trái.</p>
                        <p>Khi địa điểm đã sẵn sàng, dùng nút `Tiếp theo` hoặc bấm thẳng vào bước `Nền sơ đồ` để tải nền lên.</p>
                        <p className="text-slate-400">Anh có thể quay lại bước này để sửa địa điểm bất kỳ lúc nào mà không làm mất nền, bố cục hay dữ liệu dựng ghế.</p>
                    </CardContent>
                </Card>

                    <Card className={`bg-space-900/90 border-white/10 ${studioStep === 'background' ? '' : 'hidden'}`}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-white">
                                <FileUp className="h-5 w-5 text-brand-red" /> Nền sơ đồ
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-slate-400">{selectedVenueLabel}</p>
                            <div className="flex flex-col md:flex-row gap-3">
                                <input
                                    type="file"
                                    accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
                                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 file:mr-4 file:rounded-md file:border-0 file:bg-brand-red file:px-4 file:py-2 file:text-white"
                                    onChange={(event) => handleBackgroundFileChange(event.target.files?.[0] ?? null)}
                                />
                                <Button variant="outline" onClick={() => void handleUploadBackground()} disabled={!selectedVenueId || !backgroundFile} isLoading={busy}>
                                    Tải lại
                                </Button>
                            </div>
                            <p className="text-xs text-slate-400">
                                Chọn file là hệ thống sẽ tự tải lên ngay. Anh có thể quay lại bước này bất kỳ lúc nào để thay nền.
                            </p>

                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 uppercase tracking-[0.2em] text-emerald-200">
                                    {selectedVenue?.background_source ? 'Đã có nền' : 'Chưa có nền'}
                                </span>
                                {selectedVenue?.can_parse_background && (
                                    <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 uppercase tracking-[0.2em] text-sky-200">
                                        Có thể phân tích SVG
                                    </span>
                                )}
                                {selectedVenue?.background_processed && (
                                    <span className="rounded-full border border-brand-yellow/20 bg-brand-yellow/10 px-3 py-1 uppercase tracking-[0.2em] text-brand-yellow">
                                        Có dữ liệu ghế đã phân tích
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
                                <Button variant={studioTab === 'builder' ? 'primary' : 'outline'} onClick={() => setStudioTab('builder')}>
                                    Nền / Xem dựng sơ đồ
                                </Button>
                                <Button
                                    variant={studioTab === 'parse' ? 'primary' : 'outline'}
                                    onClick={() => setStudioTab('parse')}
                                    disabled={!selectedVenue?.can_parse_background}
                                >
                                    Phân tích SVG
                                </Button>
                            </div>

                            {studioTab === 'builder' ? (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div>
                                        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Nền hiện tại</p>
                                        {renderBackgroundPreview(selectedVenue?.background_source ?? selectedVenue?.svg_source ?? null)}
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Chế độ nền</p>
                                            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300 space-y-2">
                                                <p>Trình dựng hoạt động ngay sau khi tải nền lên. Phân tích chỉ là bước tùy chọn cho SVG.</p>
                                                <p>Định dạng hỗ trợ: SVG, PNG, JPG/JPEG, WEBP.</p>
                                            </div>
                                        </div>
                                        {isSvgBackground && selectedVenue?.background_processed && (
                                            <div>
                                                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Nguồn hiển thị trên canvas</p>
                                                <div className="flex gap-2">
                                                    <Button variant={backgroundViewMode === 'original' ? 'primary' : 'outline'} onClick={() => setBackgroundViewMode('original')}>
                                                        Bản gốc
                                                    </Button>
                                                    <Button variant={backgroundViewMode === 'processed' ? 'primary' : 'outline'} onClick={() => setBackgroundViewMode('processed')}>
                                                        Bản đã phân tích
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                                        <div className="space-y-1 text-sm text-slate-300">
                                            <p>Phân tích SVG là công cụ tùy chọn để tự tìm seat markers từ nền SVG hiện tại.</p>
                                            <p className="text-slate-400">Nếu phân tích thất bại, trình dựng thủ công vẫn hoạt động bình thường.</p>
                                        </div>
                                        <Button variant="primary" onClick={() => void handleProcessSvg()} disabled={!selectedVenueId || !selectedVenue?.can_parse_background} isLoading={busy}>
                                            <Check className="h-4 w-4" /> Chạy phân tích
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        <div>
                                            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">SVG gốc</p>
                                            {renderBackgroundPreview(selectedVenue?.background_source ?? selectedVenue?.svg_source ?? null)}
                                        </div>
                                        <div>
                                            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">SVG đã phân tích</p>
                                            {renderBackgroundPreview(selectedVenue?.background_processed ?? selectedVenue?.svg_processed ?? null)}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className={`grid grid-cols-1 xl:grid-cols-2 gap-6 ${studioStep === 'layout' || studioStep === 'section' ? '' : 'hidden'}`}>
                        <Card className={`bg-space-900/90 border-white/10 ${studioStep === 'layout' || studioStep === 'section' ? '' : 'hidden'}`}>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-white">
                                    <Layers3 className="h-5 w-5 text-brand-yellow" /> Bố cục
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    <Input placeholder="Tên bố cục" value={layoutForm.name} onChange={(event) => setLayoutForm({ ...layoutForm, name: event.target.value })} />
                                    <Input placeholder="Mô tả" value={layoutForm.description} onChange={(event) => setLayoutForm({ ...layoutForm, description: event.target.value })} />
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input placeholder="Thứ tự hiển thị" value={layoutForm.sort_order} onChange={(event) => setLayoutForm({ ...layoutForm, sort_order: event.target.value })} />
                                        <Input placeholder="SVG bổ sung (không bắt buộc)" value={layoutForm.svg_data} onChange={(event) => setLayoutForm({ ...layoutForm, svg_data: event.target.value })} />
                                    </div>
                                    <div className="flex gap-2">
                                        {editingLayoutId && (
                                            <Button variant="ghost" onClick={resetLayoutForm}>
                                                Hủy sửa
                                            </Button>
                                        )}
                                        <Button onClick={() => void handleSaveLayout()} isLoading={busy}>
                                            <Save className="h-4 w-4" /> {editingLayoutId ? 'Cập nhật bố cục' : 'Thêm bố cục'}
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-2 border-t border-white/10 pt-4">
                                    {layouts.length === 0 ? (
                                        <p className="text-sm text-slate-400">Chưa có bố cục nào.</p>
                                    ) : (
                                        layouts.map((layout) => (
                                            <button
                                                key={layout.id}
                                                type="button"
                                                onClick={() => {
                                                    if (!confirmLeaveBuilderIfDirty()) return
                                                    setSelectedLayoutId(layout.id)
                                                }}
                                                className={`w-full rounded-xl border px-4 py-3 text-left transition ${selectedLayoutId === layout.id ? 'border-brand-yellow/40 bg-brand-yellow/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="font-semibold text-white">{layout.name}</p>
                                                        <p className="text-xs text-slate-400">Thứ tự: {layout.sort_order}</p>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button type="button" className="rounded p-1.5 hover:bg-white/10" onClick={(event) => { event.stopPropagation(); startEditLayout(layout) }}>
                                                            <Edit className="h-4 w-4 text-sky-300" />
                                                        </button>
                                                        <button type="button" className="rounded p-1.5 hover:bg-white/10" onClick={(event) => { event.stopPropagation(); void handleDeleteLayout(layout.id) }}>
                                                            <Trash2 className="h-4 w-4 text-red-400" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className={`bg-space-900/90 border-white/10 ${studioStep === 'section' ? '' : 'hidden'}`}>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-white">
                                    <Shapes className="h-5 w-5 text-brand-red" /> Khu vực ghế
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-sm text-slate-400">
                                    Bố cục đang chọn: <span className="text-white">{selectedLayout?.name ?? 'Chưa chọn'}</span>
                                </p>
                                <div className="space-y-3">
                                    <Input placeholder="Tên khu vực" value={sectionForm.name} onChange={(event) => setSectionForm({ ...sectionForm, name: event.target.value })} />
                                    <Input placeholder="Mã khu vực" value={sectionForm.code} onChange={(event) => setSectionForm({ ...sectionForm, code: event.target.value })} />
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input placeholder="Giá cơ sở" value={sectionForm.price_base} onChange={(event) => setSectionForm({ ...sectionForm, price_base: event.target.value })} />
                                        <Input placeholder="Thứ tự hiển thị" value={sectionForm.sort_order} onChange={(event) => setSectionForm({ ...sectionForm, sort_order: event.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-[96px_1fr] gap-3 items-center">
                                        <input
                                            type="color"
                                            value={sectionForm.color}
                                            onChange={(event) => setSectionForm({ ...sectionForm, color: event.target.value })}
                                            className="h-12 w-full rounded-lg border border-white/10 bg-transparent p-1"
                                        />
                                        <Input value={sectionForm.color} onChange={(event) => setSectionForm({ ...sectionForm, color: event.target.value })} />
                                    </div>
                                    <div className="flex gap-2">
                                        {editingSectionId && (
                                            <Button variant="ghost" onClick={resetSectionForm}>
                                                Hủy sửa
                                            </Button>
                                        )}
                                        <Button onClick={() => void handleSaveSection()} isLoading={busy} disabled={!selectedLayoutId}>
                                            <Save className="h-4 w-4" /> {editingSectionId ? 'Cập nhật khu vực' : 'Thêm khu vực'}
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-2 border-t border-white/10 pt-4">
                                    {sections.length === 0 ? (
                                        <p className="text-sm text-slate-400">Chưa có khu vực nào.</p>
                                    ) : (
                                        sections.map((section) => (
                                            <div key={section.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: section.color }} />
                                                    <div className="min-w-0">
                                                        <p className="truncate font-semibold text-white">{section.name}</p>
                                                        <p className="text-xs text-slate-400">{section.code} · {Number(section.price_base).toLocaleString('vi-VN')}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1 shrink-0">
                                                    <button type="button" className="rounded p-1.5 hover:bg-white/10" onClick={() => startEditSection(section)}>
                                                        <Edit className="h-4 w-4 text-sky-300" />
                                                    </button>
                                                    <button type="button" className="rounded p-1.5 hover:bg-white/10" onClick={() => void handleDeleteSection(section.id)}>
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

                    <div className={`grid grid-cols-1 xl:grid-cols-[1.35fr_0.95fr] gap-6 ${studioStep === 'builder' ? '' : 'hidden'}`}>
                        <Card className="bg-space-900/90 border-white/10">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-white">
                                    <MapPin className="h-5 w-5 text-brand-yellow" /> Trình dựng bố cục
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <InteractiveSeatCanvas
                                    canvasRef={builderCanvasRef}
                                    cursor={canvasCursor}
                                    viewport={viewport}
                                    onMouseDown={handleCanvasMouseDown}
                                    onMouseMove={handleCanvasMouseMove}
                                    onWheel={handleCanvasWheel}
                                    onClick={handleBuilderCanvasClick}
                                    onZoomIn={() => zoomCanvas(1.1)}
                                    onZoomOut={() => zoomCanvas(0.9)}
                                    cursorClassName={placementMode === 'polygon' ? 'cursor-cell' : placementMode === 'pan' ? 'cursor-grab' : 'cursor-crosshair'}
                                    gridSize={snapToGrid ? '5% 5%' : '10% 10%'}
                                    toolbar={
                                        <div className="flex flex-wrap items-center gap-2 text-white">
                                            <Button size="icon" variant={activeBuilderPanel === 'seat' ? 'primary' : 'outline'} onClick={() => { resetSeatForm(); setSelectedSeatIds([]); setActiveBuilderPanel('seat'); setPlacementMode('seat') }} title="Thêm một ghế">
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant={activeBuilderPanel === 'bulk' ? 'primary' : 'outline'} onClick={() => { setSelectedSeatIds([]); setActiveBuilderPanel('bulk') }} title="Tạo nhiều ghế">
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant={activeBuilderPanel === 'polygon' ? 'primary' : 'outline'} onClick={() => { setSelectedSeatIds([]); setActiveBuilderPanel('polygon'); setPlacementMode('polygon') }} title="Vẽ vùng đa giác">
                                                <Shapes className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant={placementMode === 'select' ? 'primary' : 'outline'} onClick={() => setPlacementMode('select')} title="Chọn vùng ghế">
                                                <MousePointer2 className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant={placementMode === 'pan' ? 'primary' : 'outline'} onClick={() => setPlacementMode('pan')} title="Di chuyển sơ đồ">
                                                <Hand className="h-4 w-4" />
                                            </Button>
                                            <Button variant={snapToGrid ? 'primary' : 'outline'} onClick={() => setSnapToGrid((previous) => !previous)}>
                                                Bám lưới {snapToGrid ? 'Bật' : 'Tắt'}
                                            </Button>
                                            <Button size="icon" variant="outline" onClick={handleUndo} disabled={historyPast.length === 0} title="Hoàn tác">
                                                <Undo2 className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="outline" onClick={handleRedo} disabled={historyFuture.length === 0} title="Làm lại">
                                                <Redo2 className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" onClick={() => setViewport(DEFAULT_VIEWPORT)}>
                                                Đặt lại góc nhìn
                                            </Button>
                                            {placementMode === 'polygon' && (
                                                <Button variant="ghost" onClick={() => (editingPolygonId ? cancelPolygonEditing() : setDraftPolygonPoints([]))}>
                                                    {editingPolygonId ? 'Thoát chỉnh polygon' : 'Xóa điểm nháp'}
                                                </Button>
                                            )}
                                            <Button variant={builderDirty ? 'primary' : 'outline'} onClick={() => void handleSaveBuilderChanges()} disabled={!builderDirty || builderBusy}>
                                                <Save className="h-4 w-4" /> Lưu thay đổi
                                            </Button>
                                            <Button variant="outline" onClick={discardBuilderChanges} disabled={!builderDirty || builderBusy}>
                                                Khôi phục bản đã lưu
                                            </Button>
                                        </div>
                                    }
                                    footerLeft={null}
                                    footerRight={`${venueSeats.length} ghế · ${venuePolygons.length} vùng · zoom ${viewport.scale.toFixed(2)}x`}
                                >
                                        {selectedVenueBackground && (
                                            isSvgMarkup(selectedVenueBackground) ? (
                                                <div
                                                    className="absolute inset-0 opacity-70 [&>svg]:h-full [&>svg]:w-full"
                                                    dangerouslySetInnerHTML={{ __html: selectedVenueBackground }}
                                                />
                                            ) : (
                                                <img
                                                    src={selectedVenueBackground}
                                                    alt="Venue background"
                                                    className="absolute inset-0 h-full w-full object-contain opacity-80 pointer-events-none"
                                                />
                                            )
                                        )}

                                        {venuePolygons.map((polygon) => (
                                            <svg key={polygon.id} className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                                <polygon
                                                    points={(editingPolygonId === polygon.id ? draftPolygonPoints : polygon.points).map((point) => `${point.x},${point.y}`).join(' ')}
                                                    onMouseDown={(event) => handlePolygonMouseDown(event, polygon)}
                                                    onClick={(event) => event.stopPropagation()}
                                                    fill={editingPolygonId === polygon.id ? 'rgba(56, 189, 248, 0.18)' : 'rgba(252, 211, 77, 0.16)'}
                                                    stroke={editingPolygonId === polygon.id ? 'rgba(56, 189, 248, 0.95)' : 'rgba(252, 211, 77, 0.9)'}
                                                    strokeWidth={editingPolygonId === polygon.id ? '0.5' : '0.35'}
                                                    className={editingPolygonId === polygon.id ? 'cursor-move' : 'cursor-pointer'}
                                                />
                                            </svg>
                                        ))}

                                        {draftPolygonPoints.length >= 1 && (
                                            <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                                                <polyline
                                                    points={draftPolygonPoints.map((point) => `${point.x},${point.y}`).join(' ')}
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
                                                title={editingPolygonId !== null ? 'Kéo để chỉnh đỉnh. Bấm đúp để xóa điểm.' : 'Điểm đa giác nháp'}
                                            />
                                        ))}

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

                                        {venueSeats.map((seat) => (
                                            <button
                                                key={seat.id}
                                                type="button"
                                                onMouseDown={(event) => handleSeatPointerDown(event, seat)}
                                                className={`absolute flex h-7 min-w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border px-2 text-[10px] font-semibold text-white shadow-lg transition-transform ${selectedSeatIds.includes(seat.id) || editingSeatId === seat.id ? 'ring-2 ring-brand-yellow/50' : ''} ${draggingSeatId === seat.id ? 'scale-110 cursor-grabbing' : 'cursor-grab'}`}
                                                style={{
                                                    left: `${seatPositionMap.get(seat.id)?.x ?? seat.x ?? 0}%`,
                                                    top: `${seatPositionMap.get(seat.id)?.y ?? seat.y ?? 0}%`,
                                                    transform: `translate(-50%, -50%) rotate(${seat.rotation}deg)`,
                                                    backgroundColor: seat.is_admin_locked ? '#be123ccc' : `${sectionMap.get(seat.section_id ?? -1)?.color ?? '#1e293b'}cc`,
                                                    borderColor: seat.is_admin_locked ? '#fb7185' : (sectionMap.get(seat.section_id ?? -1)?.color ?? 'rgba(255,255,255,0.2)'),
                                                }}
                                                title={`${seat.label} · ${seat.section_name ?? 'Chưa gán khu vực'}${seat.is_admin_locked ? ' · Admin khóa' : ''}`}
                                            >
                                                {seat.label}
                                            </button>
                                        ))}

                                        <div
                                            className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand-red bg-brand-red/30 shadow-[0_0_0_6px_rgba(252,83,109,0.18)]"
                                            style={{ left: `${singleSeatForm.x}%`, top: `${singleSeatForm.y}%` }}
                                            title="Seat target"
                                        />
                                </InteractiveSeatCanvas>
                            </CardContent>
                        </Card>

                        <div className="space-y-6">
                            {selectedSeatIds.length > 1 && (
                                <Card className="bg-space-900/90 border-white/10">
                                    <CardHeader>
                                        <CardTitle className="text-white">Ghế đang chọn</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <p className="text-sm text-slate-300">Đã chọn {selectedSeatIds.length} ghế.</p>
                                        <div>
                                            <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Đổi khu vực cho nhóm ghế</label>
                                            <select
                                                className="h-11 w-full rounded-lg border border-white/10 bg-space-700/50 px-3 text-white outline-none"
                                                value={singleSeatForm.section_id}
                                                onChange={(event) => setSingleSeatForm({ ...singleSeatForm, section_id: event.target.value })}
                                            >
                                                <option value="">Chọn khu vực</option>
                                                {sections.map((section) => (
                                                    <option key={section.id} value={section.id}>
                                                        {section.code} · {section.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Góc xoay</label>
                                            <Input type="number" step="0.01" placeholder="Góc xoay" value={singleSeatForm.rotation} onChange={(event) => setSingleSeatForm({ ...singleSeatForm, rotation: event.target.value })} />
                                        </div>
                                        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                                            <input
                                                type="checkbox"
                                                checked={singleSeatForm.is_admin_locked}
                                                onChange={(event) => setSingleSeatForm({ ...singleSeatForm, is_admin_locked: event.target.checked })}
                                            />
                                            Khóa sẵn nhóm ghế này
                                        </label>
                                        <div className="flex gap-2">
                                            <Button className="flex-1" onClick={handleApplySelectedSeatChanges}>
                                                Áp dụng thuộc tính
                                            </Button>
                                            <Button variant="outline" className="flex-1" onClick={handleDeleteSelectedSeats}>
                                                Xóa ghế đã chọn
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            <Card className={`bg-space-900/90 border-white/10 ${(activeBuilderPanel === 'seat' || selectedSeatIds.length === 1) && selectedSeatIds.length <= 1 ? '' : 'hidden'}`}>
                                <CardHeader>
                                    <CardTitle className="text-white">{editingSeatId ? 'Chỉnh sửa ghế' : 'Ghế lẻ'}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div>
                                        <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Nhãn ghế</label>
                                        <Input placeholder="Ví dụ A1" value={singleSeatForm.label} onChange={(event) => setSingleSeatForm({ ...singleSeatForm, label: event.target.value })} />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Khu vực ghế</label>
                                        <select
                                            className="h-11 w-full rounded-lg border border-white/10 bg-slate-900 px-3 text-white outline-none"
                                            value={singleSeatForm.section_id}
                                            onChange={(event) => setSingleSeatForm({ ...singleSeatForm, section_id: event.target.value })}
                                        >
                                            <option>Chưa gán khu vực</option>
                                            {sections.map((section) => (
                                                <option key={section.id} value={section.id}>
                                                    {section.code} · {section.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Tọa độ X</label>
                                            <Input type="number" step="0.01" placeholder="X %" value={singleSeatForm.x} onChange={(event) => setSingleSeatForm({ ...singleSeatForm, x: event.target.value })} />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Tọa độ Y</label>
                                            <Input type="number" step="0.01" placeholder="Y %" value={singleSeatForm.y} onChange={(event) => setSingleSeatForm({ ...singleSeatForm, y: event.target.value })} />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Góc xoay</label>
                                            <Input type="number" step="0.01" placeholder="Góc xoay" value={singleSeatForm.rotation} onChange={(event) => setSingleSeatForm({ ...singleSeatForm, rotation: event.target.value })} />
                                        </div>
                                    </div>
                                    <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                                        <input
                                            type="checkbox"
                                            checked={singleSeatForm.is_admin_locked}
                                            onChange={(event) => setSingleSeatForm({ ...singleSeatForm, is_admin_locked: event.target.checked })}
                                        />
                                        Khóa sẵn ghế này để khách không thể mua
                                    </label>
                                    <div className="flex gap-2">
                                        {editingSeatId && (
                                            <Button variant="ghost" onClick={resetSeatForm}>
                                                Hủy sửa
                                            </Button>
                                        )}
                                        {editingSeatId && (
                                            <Button variant="outline" onClick={() => void handleDeleteSeat(editingSeatId)}>
                                                <Trash2 className="h-4 w-4" /> Xóa ghế
                                            </Button>
                                        )}
                                        <Button className="flex-1" onClick={() => void handleSaveSeat()} isLoading={builderBusy} disabled={!selectedLayoutId || !singleSeatForm.label.trim()}>
                                            <Save className="h-4 w-4" /> {editingSeatId ? 'Cập nhật ghế' : 'Tạo ghế'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className={`bg-space-900/90 border-white/10 ${activeBuilderPanel === 'bulk' && selectedSeatIds.length === 0 ? '' : 'hidden'}`}>
                                <CardHeader>
                                    <CardTitle className="text-white">Tạo ghế hàng loạt</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <select
                                            className="h-11 rounded-lg border border-white/10 bg-slate-900 px-3 text-white outline-none"
                                            value={bulkSeatForm.section_id}
                                            onChange={(event) => setBulkSeatForm({ ...bulkSeatForm, section_id: event.target.value })}
                                        >
                                            <option value="">Chưa gán khu vực</option>
                                            {sections.map((section) => (
                                                <option key={section.id} value={section.id}>
                                                    {section.code} · {section.name}
                                                </option>
                                            ))}
                                        </select>
                                        <select
                                            className="h-11 rounded-lg border border-white/10 bg-slate-900 px-3 text-white outline-none"
                                            value={bulkSeatForm.pattern}
                                            onChange={(event) => setBulkSeatForm({ ...bulkSeatForm, pattern: event.target.value as 'straight' | 'arc' | 'zigzag' })}
                                        >
                                            <option value="straight">straight</option>
                                            <option value="arc">arc</option>
                                            <option value="zigzag">zigzag</option>
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input type="number" min={1} placeholder="Số hàng" value={bulkSeatForm.rows} onChange={(event) => setBulkSeatForm({ ...bulkSeatForm, rows: event.target.value })} />
                                        <Input type="number" min={1} placeholder="Số cột" value={bulkSeatForm.cols} onChange={(event) => setBulkSeatForm({ ...bulkSeatForm, cols: event.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input type="number" step="0.01" placeholder="Khoảng cách X" value={bulkSeatForm.gap_x} onChange={(event) => setBulkSeatForm({ ...bulkSeatForm, gap_x: event.target.value })} />
                                        <Input type="number" step="0.01" placeholder="Khoảng cách Y" value={bulkSeatForm.gap_y} onChange={(event) => setBulkSeatForm({ ...bulkSeatForm, gap_y: event.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input type="number" step="0.01" placeholder="Điểm bắt đầu X" value={bulkSeatForm.start_x} onChange={(event) => setBulkSeatForm({ ...bulkSeatForm, start_x: event.target.value })} />
                                        <Input type="number" step="0.01" placeholder="Điểm bắt đầu Y" value={bulkSeatForm.start_y} onChange={(event) => setBulkSeatForm({ ...bulkSeatForm, start_y: event.target.value })} />
                                    </div>
                                    <Input placeholder="Tiền tố nhãn ghế" value={bulkSeatForm.label_prefix} onChange={(event) => setBulkSeatForm({ ...bulkSeatForm, label_prefix: event.target.value })} />
                                    {bulkSeatForm.pattern === 'arc' && (
                                        <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                <Input type="number" step="0.01" placeholder="Tâm X" value={bulkSeatForm.arc_center_x} onChange={(event) => setBulkSeatForm({ ...bulkSeatForm, arc_center_x: event.target.value })} />
                                                <Input type="number" step="0.01" placeholder="Tâm Y" value={bulkSeatForm.arc_center_y} onChange={(event) => setBulkSeatForm({ ...bulkSeatForm, arc_center_y: event.target.value })} />
                                            </div>
                                            <div className="grid grid-cols-3 gap-3">
                                                <Input type="number" step="0.01" placeholder="Bán kính" value={bulkSeatForm.arc_radius} onChange={(event) => setBulkSeatForm({ ...bulkSeatForm, arc_radius: event.target.value })} />
                                                <Input type="number" step="0.01" placeholder="Góc bắt đầu" value={bulkSeatForm.arc_start_angle} onChange={(event) => setBulkSeatForm({ ...bulkSeatForm, arc_start_angle: event.target.value })} />
                                                <Input type="number" step="0.01" placeholder="Góc kết thúc" value={bulkSeatForm.arc_end_angle} onChange={(event) => setBulkSeatForm({ ...bulkSeatForm, arc_end_angle: event.target.value })} />
                                            </div>
                                        </div>
                                    )}
                                    <Button className="w-full" onClick={() => void handleBulkSeatCreate()} isLoading={builderBusy} disabled={!selectedLayoutId}>
                                        <Copy className="h-4 w-4" /> Tạo dãy ghế
                                    </Button>
                                </CardContent>
                            </Card>

                            <Card className={`bg-space-900/90 border-white/10 ${activeBuilderPanel === 'polygon' && selectedSeatIds.length === 0 ? '' : 'hidden'}`}>
                                <CardHeader>
                                    <CardTitle className="text-white">Vùng đa giác</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <Input placeholder="Tên vùng đa giác" value={polygonForm.label} onChange={(event) => setPolygonForm({ ...polygonForm, label: event.target.value })} />
                                    <select
                                        className="h-11 rounded-lg border border-white/10 bg-slate-900 px-3 text-white outline-none"
                                        value={polygonForm.section_id}
                                        onChange={(event) => setPolygonForm({ ...polygonForm, section_id: event.target.value })}
                                    >
                                            <option value="">Chưa gán khu vực</option>
                                        {sections.map((section) => (
                                            <option key={section.id} value={section.id}>
                                                {section.code} · {section.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-slate-400">
                                        {editingPolygonId ? `Đang chỉnh polygon #${editingPolygonId}.` : `${draftPolygonPoints.length} điểm nháp. Cần ít nhất 3 điểm để lưu.`}
                                    </p>
                                    <div className="flex gap-2">
                                        {draftPolygonPoints.length > 0 && (
                                            <Button variant="outline" onClick={() => handleRemovePolygonPoint(draftPolygonPoints.length - 1)}>
                                                Xóa điểm cuối
                                            </Button>
                                        )}
                                        {editingPolygonId && (
                                            <Button variant="ghost" onClick={cancelPolygonEditing}>
                                                Hủy chỉnh
                                            </Button>
                                        )}
                                        <Button className="flex-1" onClick={() => void handleSavePolygon()} isLoading={builderBusy} disabled={!selectedLayoutId || draftPolygonPoints.length < 3}>
                                            <Save className="h-4 w-4" /> {editingPolygonId ? 'Cập nhật polygon' : 'Lưu polygon'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    <div className={`grid grid-cols-1 xl:grid-cols-2 gap-6 ${studioStep === 'builder' ? '' : 'hidden'}`}>
                        <Card className="bg-space-900/90 border-white/10">
                            <CardHeader>
                                <CardTitle className="text-white">Danh sách ghế mẫu</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {venueSeats.length === 0 ? (
                                    <p className="text-sm text-slate-400">Chưa có ghế template.</p>
                                ) : (
                                    venueSeats.map((seat) => (
                                        <div key={seat.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                                            <div className="min-w-0">
                                                <p className="font-semibold text-white">{seat.label}</p>
                                                <p className="text-xs text-slate-400">
                                                    {seat.section_name ?? 'Chưa gán khu vực'} · x {seat.x ?? 0}% · y {seat.y ?? 0}% · xoay {seat.rotation}
                                                </p>
                                            </div>
                                            <div className="flex gap-1 shrink-0">
                                                <button type="button" className="rounded p-1.5 hover:bg-white/10" onClick={() => startEditSeat(seat)}>
                                                    <Edit className="h-4 w-4 text-sky-300" />
                                                </button>
                                                <button type="button" className="rounded p-1.5 hover:bg-white/10" onClick={() => void handleDeleteSeat(seat.id)}>
                                                    <Trash2 className="h-4 w-4 text-red-400" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        <Card className="bg-space-900/90 border-white/10">
                            <CardHeader>
                                <CardTitle className="text-white">Danh sách vùng đa giác</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {venuePolygons.length === 0 ? (
                                    <p className="text-sm text-slate-400">Chưa có polygon nào.</p>
                                ) : (
                                    venuePolygons.map((polygon) => (
                                        <div key={polygon.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                                            <div className="min-w-0">
                                                <p className="font-semibold text-white">{polygon.label || `Polygon #${polygon.id}`}</p>
                                                <p className="text-xs text-slate-400">
                                                    {polygon.section_name ?? 'Chưa gán khu vực'} · {polygon.points.length} điểm
                                                </p>
                                            </div>
                                            <div className="flex gap-1 shrink-0">
                                                <button type="button" className="rounded p-1.5 hover:bg-white/10" onClick={() => startEditPolygon(polygon)}>
                                                    <Edit className="h-4 w-4 text-sky-300" />
                                                </button>
                                                <button type="button" className="rounded p-1.5 hover:bg-white/10" onClick={() => void handleDeletePolygon(polygon.id)}>
                                                    <Trash2 className="h-4 w-4 text-red-400" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}
