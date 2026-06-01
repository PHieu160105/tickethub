import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Building2, Copy, FileUp, Hand, Layers3, MapPin, MousePointer2, Plus, RefreshCw, Save, Trash2 } from 'lucide-react'

import { InteractiveSeatCanvas } from '@/components/admin/InteractiveSeatCanvas'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { GlobalLoader } from '@/components/ui/GlobalLoader'
import { Input } from '@/components/ui/Input'
import { adminApi, extractApiErrorMessage } from '@/lib/api'
import type { VenueDetail, VenueLayoutItem, VenueSeatItem, VenueSummary } from '@/types'

const STEPS = ['venue', 'layout', 'builder'] as const
type StudioStep = (typeof STEPS)[number]

const STEP_META: Record<StudioStep, { title: string; description: string }> = {
  venue: { title: 'Địa điểm', description: 'Tạo địa điểm và tải ảnh nền sơ đồ.' },
  layout: { title: 'Bố cục sắp xếp', description: 'Tạo bố cục ghế tái sử dụng cho địa điểm.' },
  builder: { title: 'Trình dựng sơ đồ', description: 'Đặt ghế mẫu trực tiếp trên canvas.' },
}

const EMPTY_VENUE = { name: '', address: '', is_active: true }
const EMPTY_LAYOUT = { name: '', description: '' }
const EMPTY_SEAT = { label: '', x: '50', y: '50' }
const EMPTY_BULK = {
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
const DEFAULT_VIEWPORT = { scale: 1, offsetX: 0, offsetY: 0 }

function deriveSeatIdentity(label: string) {
  const match = label.trim().match(/^([A-Za-z]+)\s*[- ]?\s*(\d+)$/)
  return match ? { row_label: match[1], seat_number: Number(match[2]) } : { row_label: null, seat_number: null }
}

export default function AdminVenues() {
  const builderCanvasRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState<StudioStep>('venue')
  const [venues, setVenues] = useState<VenueSummary[]>([])
  const [selectedVenue, setSelectedVenue] = useState<VenueDetail | null>(null)
  const [layouts, setLayouts] = useState<VenueLayoutItem[]>([])
  const [selectedLayoutId, setSelectedLayoutId] = useState<number | null>(null)
  const [seats, setSeats] = useState<VenueSeatItem[]>([])
  const [venueForm, setVenueForm] = useState(EMPTY_VENUE)
  const [layoutForm, setLayoutForm] = useState(EMPTY_LAYOUT)
  const [seatForm, setSeatForm] = useState(EMPTY_SEAT)
  const [bulkForm, setBulkForm] = useState(EMPTY_BULK)
  const [editingVenueId, setEditingVenueId] = useState<number | null>(null)
  const [editingLayoutId, setEditingLayoutId] = useState<number | null>(null)
  const [editingSeatId, setEditingSeatId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [activeBuilderPanel, setActiveBuilderPanel] = useState<'seat' | 'bulk'>('seat')
  const [placementMode, setPlacementMode] = useState<'seat' | 'bulk' | 'select' | 'pan'>('seat')
  const [canvasCursor, setCanvasCursor] = useState<{ x: number; y: number } | null>(null)
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT)
  const [panStart, setPanStart] = useState<{ clientX: number; clientY: number; offsetX: number; offsetY: number } | null>(null)
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null)
  const [selectionCurrent, setSelectionCurrent] = useState<{ x: number; y: number } | null>(null)
  const [selectedSeatIds, setSelectedSeatIds] = useState<number[]>([])
  const [draggingSeatId, setDraggingSeatId] = useState<number | null>(null)
  const [dragStartPosition, setDragStartPosition] = useState<{ x: number; y: number } | null>(null)
  const [dragSelectedSeatStartPositions, setDragSelectedSeatStartPositions] = useState<Record<number, { x: number; y: number }> | null>(null)
  const [snapToGrid, setSnapToGrid] = useState(false)
  const [seatSize, setSeatSize] = useState(1.5)
  const seatsRef = useRef<VenueSeatItem[]>([])

  const selectedLayout = layouts.find((item) => item.id === selectedLayoutId) ?? null
  const canvasAspectRatio = selectedVenue && selectedVenue.width > 0 && selectedVenue.height > 0
    ? selectedVenue.width / selectedVenue.height
    : 5 / 3

  async function loadSeats(venueId: number, layoutId: number | null) {
    setSeats(layoutId ? await adminApi.listVenueSeats(venueId, layoutId) : [])
    setSelectedSeatIds([])
    setSelectionStart(null)
    setSelectionCurrent(null)
    setDraggingSeatId(null)
    setDragStartPosition(null)
    setDragSelectedSeatStartPositions(null)
  }

  async function selectVenue(venueId: number) {
    setError(null)
    const [venue, nextLayouts] = await Promise.all([adminApi.getVenue(venueId), adminApi.listLayouts(venueId)])
    setSelectedVenue(venue)
    setLayouts(nextLayouts)
    const nextLayoutId = nextLayouts[0]?.id ?? null
    setSelectedLayoutId(nextLayoutId)
    await loadSeats(venueId, nextLayoutId)
  }

  async function loadVenues(preferredVenueId?: number) {
    setLoading(true)
    setError(null)
    try {
      const nextVenues = await adminApi.listVenues()
      setVenues(nextVenues)
      const nextId = preferredVenueId ?? selectedVenue?.id ?? nextVenues[0]?.id
      if (nextId) await selectVenue(nextId)
      else {
        setSelectedVenue(null)
        setLayouts([])
        setSeats([])
      }
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể tải Venue Studio.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadVenues()
    // Venue list is loaded once on entry; subsequent refreshes are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    seatsRef.current = seats
  }, [seats])

  function startCreateVenue() {
    setEditingVenueId(null)
    setVenueForm(EMPTY_VENUE)
  }

  function startEditVenue() {
    if (!selectedVenue) return
    setEditingVenueId(selectedVenue.id)
    setVenueForm({ name: selectedVenue.name, address: selectedVenue.address ?? '', is_active: selectedVenue.is_active })
  }

  async function saveVenue() {
    if (!venueForm.name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const payload = { name: venueForm.name.trim(), address: venueForm.address.trim() || null, is_active: venueForm.is_active }
      const saved = editingVenueId
        ? await adminApi.updateVenue(editingVenueId, payload)
        : await adminApi.createVenue(payload)
      setMessage(editingVenueId ? 'Đã cập nhật địa điểm.' : 'Đã tạo địa điểm.')
      setEditingVenueId(saved.id)
      await loadVenues(saved.id)
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể lưu địa điểm.'))
    } finally {
      setBusy(false)
    }
  }

  async function deleteVenue() {
    if (!selectedVenue || !window.confirm(`Xóa địa điểm "${selectedVenue.name}"?`)) return
    setBusy(true)
    try {
      await adminApi.deleteVenue(selectedVenue.id)
      setMessage('Đã xóa địa điểm.')
      setEditingVenueId(null)
      setVenueForm(EMPTY_VENUE)
      await loadVenues()
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể xóa địa điểm.'))
    } finally {
      setBusy(false)
    }
  }

  async function uploadBackground(file: File) {
    if (!selectedVenue) return
    setBusy(true)
    try {
      await adminApi.uploadVenueBackground(selectedVenue.id, file)
      await selectVenue(selectedVenue.id)
      setMessage('Đã tải ảnh nền và cập nhật kích thước canvas.')
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể tải ảnh nền. Chỉ hỗ trợ SVG, PNG, JPEG hoặc WEBP.'))
    } finally {
      setBusy(false)
    }
  }

  function startEditLayout(layout: VenueLayoutItem) {
    setEditingLayoutId(layout.id)
    setLayoutForm({ name: layout.name, description: layout.description ?? '' })
  }

  async function saveLayout() {
    if (!selectedVenue || !layoutForm.name.trim()) return
    setBusy(true)
    try {
      const payload = { name: layoutForm.name.trim(), description: layoutForm.description.trim() || null }
      const saved = editingLayoutId
        ? await adminApi.updateLayout(editingLayoutId, payload)
        : await adminApi.createLayout(selectedVenue.id, payload)
      const nextLayouts = await adminApi.listLayouts(selectedVenue.id)
      setLayouts(nextLayouts)
      setSelectedLayoutId(saved.id)
      setEditingLayoutId(saved.id)
      setLayoutForm({ name: saved.name, description: saved.description ?? '' })
      await loadSeats(selectedVenue.id, saved.id)
      setMessage(editingLayoutId ? 'Đã cập nhật bố cục.' : 'Đã tạo bố cục.')
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể lưu bố cục.'))
    } finally {
      setBusy(false)
    }
  }

  async function deleteLayout(layoutId: number) {
    if (!selectedVenue || !window.confirm('Xóa bố cục này?')) return
    setBusy(true)
    try {
      await adminApi.deleteLayout(layoutId)
      const nextLayouts = await adminApi.listLayouts(selectedVenue.id)
      setLayouts(nextLayouts)
      const nextId = nextLayouts[0]?.id ?? null
      setSelectedLayoutId(nextId)
      await loadSeats(selectedVenue.id, nextId)
      setEditingLayoutId(null)
      setLayoutForm(EMPTY_LAYOUT)
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể xóa bố cục.'))
    } finally {
      setBusy(false)
    }
  }

  function getCanvasCoordinates(clientX: number, clientY: number) {
    const rect = builderCanvasRef.current?.getBoundingClientRect()
    if (!rect) return null
    const x = ((clientX - rect.left - viewport.offsetX) / viewport.scale / rect.width) * 100
    const y = ((clientY - rect.top - viewport.offsetY) / viewport.scale / rect.height) * 100
    return {
      x: Math.max(0, Math.min(100, snapToGrid ? Math.round(x) : Number(x.toFixed(2)))),
      y: Math.max(0, Math.min(100, snapToGrid ? Math.round(y) : Number(y.toFixed(2)))),
    }
  }

  function handleCanvasMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (placementMode === 'select') {
      const point = getCanvasCoordinates(event.clientX, event.clientY)
      if (!point) return
      event.preventDefault()
      setSelectionStart(point)
      setSelectionCurrent(point)
      return
    }
    if (placementMode !== 'pan') return
    event.preventDefault()
    setPanStart({ clientX: event.clientX, clientY: event.clientY, offsetX: viewport.offsetX, offsetY: viewport.offsetY })
  }

  function handleCanvasMouseMove(event: MouseEvent<HTMLDivElement>) {
    setCanvasCursor(getCanvasCoordinates(event.clientX, event.clientY))
  }

  function handleCanvasClick(event: MouseEvent<HTMLDivElement>) {
    if (!['seat', 'bulk'].includes(placementMode) || draggingSeatId !== null) return
    const point = getCanvasCoordinates(event.clientX, event.clientY)
    if (!point) return
    if (placementMode === 'bulk') {
      setBulkForm((current) => ({ ...current, start_x: point.x.toFixed(2), start_y: point.y.toFixed(2) }))
      return
    }
    setSeatForm((current) => ({ ...current, x: point.x.toFixed(2), y: point.y.toFixed(2) }))
  }

  function zoomCanvas(multiplier: number) {
    setViewport((current) => ({ ...current, scale: Math.max(0.5, Math.min(3, current.scale * multiplier)) }))
  }

  function handleCanvasWheel(event: WheelEvent) {
    event.preventDefault()
    const element = builderCanvasRef.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    const pointerX = event.clientX - rect.left
    const pointerY = event.clientY - rect.top
    setViewport((current) => {
      const scale = Math.max(0.5, Math.min(3, Number((current.scale * (event.deltaY < 0 ? 1.1 : 0.9)).toFixed(2))))
      return {
        scale,
        offsetX: pointerX - ((pointerX - current.offsetX) / current.scale) * scale,
        offsetY: pointerY - ((pointerY - current.offsetY) / current.scale) * scale,
      }
    })
  }

  function handleSeatMouseDown(event: MouseEvent<HTMLButtonElement>, seat: VenueSeatItem) {
    event.preventDefault()
    event.stopPropagation()
    if (placementMode !== 'select') {
      editSeat(seat)
      return
    }
    const nextSelection = event.shiftKey
      ? (selectedSeatIds.includes(seat.id) ? selectedSeatIds.filter((id) => id !== seat.id) : [...selectedSeatIds, seat.id])
      : (selectedSeatIds.includes(seat.id) ? selectedSeatIds : [seat.id])
    if (!nextSelection.includes(seat.id)) {
      setSelectedSeatIds(nextSelection)
      return
    }
    const point = { x: seat.x ?? 0, y: seat.y ?? 0 }
    setSelectedSeatIds(nextSelection)
    setDraggingSeatId(seat.id)
    setDragStartPosition(point)
    setDragSelectedSeatStartPositions(Object.fromEntries(
      seats.filter((item) => nextSelection.includes(item.id)).map((item) => [item.id, { x: item.x ?? 0, y: item.y ?? 0 }]),
    ))
  }

  useEffect(() => {
    if (!panStart) return
    const onMove = (event: globalThis.MouseEvent) => {
      setViewport((current) => ({
        ...current,
        offsetX: panStart.offsetX + event.clientX - panStart.clientX,
        offsetY: panStart.offsetY + event.clientY - panStart.clientY,
      }))
    }
    const onUp = () => setPanStart(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [panStart])

  useEffect(() => {
    if (placementMode !== 'select' || !selectionStart) return
    const onMove = (event: globalThis.MouseEvent) => {
      const point = getCanvasCoordinates(event.clientX, event.clientY)
      if (point) setSelectionCurrent(point)
    }
    const onUp = () => {
      const end = selectionCurrent ?? selectionStart
      const minX = Math.min(selectionStart.x, end.x)
      const maxX = Math.max(selectionStart.x, end.x)
      const minY = Math.min(selectionStart.y, end.y)
      const maxY = Math.max(selectionStart.y, end.y)
      setSelectedSeatIds(seats.filter((seat) => {
        const x = seat.x ?? 0
        const y = seat.y ?? 0
        return x >= minX && x <= maxX && y >= minY && y <= maxY
      }).map((seat) => seat.id))
      setSelectionStart(null)
      setSelectionCurrent(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [placementMode, seats, selectionCurrent, selectionStart, snapToGrid, viewport])

  useEffect(() => {
    if (draggingSeatId === null || !dragStartPosition || !dragSelectedSeatStartPositions) return
    const onMove = (event: globalThis.MouseEvent) => {
      const point = getCanvasCoordinates(event.clientX, event.clientY)
      if (!point) return
      setSeats((current) => current.map((seat) => {
        const start = dragSelectedSeatStartPositions[seat.id]
        if (!start) return seat
        return {
          ...seat,
          x: Math.max(0, Math.min(100, Number((start.x + point.x - dragStartPosition.x).toFixed(2)))),
          y: Math.max(0, Math.min(100, Number((start.y + point.y - dragStartPosition.y).toFixed(2)))),
        }
      }))
    }
    const onUp = async (event: globalThis.MouseEvent) => {
      const movedSeatIds = Object.keys(dragSelectedSeatStartPositions).map(Number)
      const point = getCanvasCoordinates(event.clientX, event.clientY)
      const finalSeats = seatsRef.current.map((seat) => {
        const start = dragSelectedSeatStartPositions[seat.id]
        if (!start || !point) return seat
        return {
          ...seat,
          x: Math.max(0, Math.min(100, Number((start.x + point.x - dragStartPosition.x).toFixed(2)))),
          y: Math.max(0, Math.min(100, Number((start.y + point.y - dragStartPosition.y).toFixed(2)))),
        }
      })
      setSeats(finalSeats)
      setDraggingSeatId(null)
      setDragStartPosition(null)
      setDragSelectedSeatStartPositions(null)
      if (!selectedVenue || !selectedLayoutId) return
      try {
        await adminApi.syncVenueSeats(selectedVenue.id, {
          layout_id: selectedLayoutId,
          create: [],
          update: finalSeats.filter((seat) => movedSeatIds.includes(seat.id)).map((seat) => ({
            id: seat.id,
            label: seat.label,
            row_label: seat.row_label,
            seat_number: seat.seat_number,
            x: seat.x ?? 0,
            y: seat.y ?? 0,
          })),
          delete_ids: [],
        })
        setMessage(`Đã cập nhật vị trí ${movedSeatIds.length} ghế mẫu.`)
      } catch (errorValue) {
        setError(extractApiErrorMessage(errorValue, 'Không thể cập nhật vị trí ghế mẫu.'))
        await loadSeats(selectedVenue.id, selectedLayoutId)
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragSelectedSeatStartPositions, dragStartPosition, draggingSeatId, selectedLayoutId, selectedVenue, snapToGrid, viewport])

  function editSeat(seat: VenueSeatItem) {
    setEditingSeatId(seat.id)
    setSelectedSeatIds([seat.id])
    setSeatForm({ label: seat.label, x: String(seat.x ?? 50), y: String(seat.y ?? 50) })
    setActiveBuilderPanel('seat')
    setPlacementMode('select')
  }

  function resetSeatForm() {
    setEditingSeatId(null)
    setSelectedSeatIds([])
    setSeatForm(EMPTY_SEAT)
    setPlacementMode('seat')
  }

  async function saveSeat() {
    if (!selectedVenue || !selectedLayoutId || !seatForm.label.trim()) return
    setBusy(true)
    try {
      const identity = deriveSeatIdentity(seatForm.label)
      const payload = { ...identity, label: seatForm.label.trim(), x: Number(seatForm.x), y: Number(seatForm.y) }
      if (editingSeatId) await adminApi.updateVenueSeat(editingSeatId, payload)
      else await adminApi.createVenueSeatSingle(selectedVenue.id, { ...payload, layout_id: selectedLayoutId })
      await loadSeats(selectedVenue.id, selectedLayoutId)
      resetSeatForm()
      setMessage('Đã lưu ghế mẫu.')
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể lưu ghế mẫu.'))
    } finally {
      setBusy(false)
    }
  }

  async function createBulkSeats() {
    if (!selectedVenue || !selectedLayoutId) return
    setBusy(true)
    try {
      await adminApi.createVenueSeatBulk(selectedVenue.id, {
        layout_id: selectedLayoutId,
        pattern: bulkForm.pattern,
        rows: Number(bulkForm.rows),
        cols: Number(bulkForm.cols),
        gap_x: Number(bulkForm.gap_x),
        gap_y: Number(bulkForm.gap_y),
        start_x: Number(bulkForm.start_x),
        start_y: Number(bulkForm.start_y),
        label_prefix: bulkForm.label_prefix,
        arc_config: bulkForm.pattern === 'arc'
          ? {
              center_x: Number(bulkForm.arc_center_x),
              center_y: Number(bulkForm.arc_center_y),
              radius: Number(bulkForm.arc_radius),
              start_angle: Number(bulkForm.arc_start_angle),
              end_angle: Number(bulkForm.arc_end_angle),
            }
          : null,
      })
      await loadSeats(selectedVenue.id, selectedLayoutId)
      setMessage('Đã tạo cụm ghế mẫu.')
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể tạo cụm ghế mẫu.'))
    } finally {
      setBusy(false)
    }
  }

  async function deleteSeat(seatId: number) {
    if (!selectedVenue || !selectedLayoutId || !window.confirm('Xóa ghế mẫu này?')) return
    try {
      await adminApi.deleteVenueSeat(seatId)
      await loadSeats(selectedVenue.id, selectedLayoutId)
      if (editingSeatId === seatId) resetSeatForm()
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể xóa ghế mẫu.'))
    }
  }

  const canGoNext = step === 'venue' ? Boolean(selectedVenue) : step === 'layout' ? Boolean(selectedLayoutId) : false
  const stepIndex = STEPS.indexOf(step)
  const selectionBox = selectionStart && selectionCurrent ? {
    left: `${Math.min(selectionStart.x, selectionCurrent.x)}%`,
    top: `${Math.min(selectionStart.y, selectionCurrent.y)}%`,
    width: `${Math.abs(selectionStart.x - selectionCurrent.x)}%`,
    height: `${Math.abs(selectionStart.y - selectionCurrent.y)}%`,
  } : null

  if (loading) return <GlobalLoader />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-bold admin-text-header">Venue Studio</h2>
          <p className="mt-1 text-sm admin-text-muted">Thiết lập địa điểm theo từng bước: thông tin, bố cục và ghế mẫu.</p>
        </div>
        <Button variant="outline" onClick={() => void loadVenues()}><RefreshCw className="h-4 w-4" /> Làm mới</Button>
      </div>

      {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
      {message ? <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</div> : null}

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] admin-text-muted">Các bước thực hiện</p>
              <h3 className="mt-1 text-xl font-bold admin-text-header">{STEP_META[step].title}</h3>
              <p className="text-sm admin-text-muted">{STEP_META[step].description}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={stepIndex === 0} onClick={() => setStep(STEPS[stepIndex - 1])}>Quay lại</Button>
              <Button disabled={!canGoNext} onClick={() => setStep(STEPS[stepIndex + 1])}>Tiếp theo</Button>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {STEPS.map((item, index) => (
              <button key={item} type="button" onClick={() => setStep(item)} className={`rounded-lg border px-4 py-3 text-left ${item === step ? 'admin-border bg-white/10' : 'border-white/5 bg-black/20'}`}>
                <p className="text-xs uppercase tracking-[0.16em] admin-text-muted">Bước {index + 1}</p>
                <p className="mt-1 font-semibold admin-text-body">{STEP_META[item].title}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {step === 'venue' ? (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Danh sách địa điểm</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={startCreateVenue}><Plus className="h-4 w-4" /> Địa điểm mới</Button>
              {venues.map((venue) => (
                <button key={venue.id} type="button" onClick={() => void selectVenue(venue.id)} className={`w-full rounded-lg border px-4 py-3 text-left ${selectedVenue?.id === venue.id ? 'border-rose-400 bg-rose-500/10' : 'border-white/10 bg-white/5'}`}>
                  <p className="font-semibold admin-text-body">{venue.name}</p>
                  <p className="text-xs admin-text-muted">#{venue.id} · {venue.is_active ? 'Đang hoạt động' : 'Đã tắt'}</p>
                </button>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Thông tin địa điểm</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder="Tên địa điểm" value={venueForm.name} onChange={(event) => setVenueForm({ ...venueForm, name: event.target.value })} />
              <Input placeholder="Địa chỉ" value={venueForm.address} onChange={(event) => setVenueForm({ ...venueForm, address: event.target.value })} />
              <label className="flex items-center gap-2 text-sm admin-text-body"><input type="checkbox" checked={venueForm.is_active} onChange={(event) => setVenueForm({ ...venueForm, is_active: event.target.checked })} /> Đang hoạt động</label>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void saveVenue()} isLoading={busy}><Save className="h-4 w-4" /> Lưu địa điểm</Button>
                {selectedVenue ? <Button variant="outline" onClick={startEditVenue}>Sửa địa điểm đang chọn</Button> : null}
                {selectedVenue ? <Button variant="danger" onClick={() => void deleteVenue()}><Trash2 className="h-4 w-4" /> Xóa</Button> : null}
              </div>
              {selectedVenue ? (
                <div className="space-y-3 border-t border-white/10 pt-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm admin-text-body">
                      <FileUp className="h-4 w-4" /> Tải ảnh nền
                      <input className="hidden" type="file" accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp" onChange={(event) => event.target.files?.[0] && void uploadBackground(event.target.files[0])} />
                    </label>
                    <span className="text-sm admin-text-muted">Kích thước: {selectedVenue.width} x {selectedVenue.height}</span>
                  </div>
                  {selectedVenue.background_source ? <img src={selectedVenue.background_source} alt="Ảnh nền địa điểm" className="max-h-80 w-full rounded-lg border border-white/10 bg-white object-contain" /> : <p className="text-sm admin-text-muted">Chưa có ảnh nền.</p>}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {step === 'layout' ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Layers3 className="h-5 w-5" /> Bố cục của {selectedVenue?.name}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {layouts.map((layout) => (
                <div key={layout.id} className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${layout.id === selectedLayoutId ? 'border-rose-400 bg-rose-500/10' : 'border-white/10 bg-white/5'}`}>
                  <button type="button" className="flex-1 text-left" onClick={() => { setSelectedLayoutId(layout.id); void loadSeats(selectedVenue!.id, layout.id) }}><p className="font-semibold admin-text-body">{layout.name}</p><p className="text-xs admin-text-muted">{layout.description || 'Không có mô tả'}</p></button>
                  <Button size="sm" variant="outline" onClick={() => startEditLayout(layout)}>Sửa</Button>
                  <Button size="icon" variant="danger" onClick={() => void deleteLayout(layout.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{editingLayoutId ? 'Sửa bố cục' : 'Thêm bố cục'}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Tên bố cục" value={layoutForm.name} onChange={(event) => setLayoutForm({ ...layoutForm, name: event.target.value })} />
              <Input placeholder="Mô tả" value={layoutForm.description} onChange={(event) => setLayoutForm({ ...layoutForm, description: event.target.value })} />
              <div className="flex gap-2"><Button onClick={() => void saveLayout()} isLoading={busy}><Save className="h-4 w-4" /> Lưu bố cục</Button><Button variant="outline" onClick={() => { setEditingLayoutId(null); setLayoutForm(EMPTY_LAYOUT) }}>Tạo mới</Button></div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {step === 'builder' ? (
        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <Card className="border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-brand-yellow" /> Trình dựng bố cục
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InteractiveSeatCanvas
                canvasRef={builderCanvasRef}
                cursor={canvasCursor}
                viewport={viewport}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onClick={handleCanvasClick}
                onWheel={handleCanvasWheel}
                onZoomIn={() => zoomCanvas(1.1)}
                onZoomOut={() => zoomCanvas(0.9)}
                cursorClassName={placementMode === 'pan' ? 'cursor-grab' : placementMode === 'select' ? 'cursor-default' : 'cursor-crosshair'}
                gridSize={snapToGrid ? '5% 5%' : '10% 10%'}
                aspectRatio={canvasAspectRatio}
                footerRight={`${seats.length} ghế · zoom ${viewport.scale.toFixed(2)}x`}
                toolbar={(
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="icon" variant={activeBuilderPanel === 'seat' && placementMode === 'seat' ? 'primary' : 'outline'} onClick={() => { resetSeatForm(); setActiveBuilderPanel('seat') }} title="Thêm một ghế">
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant={activeBuilderPanel === 'bulk' && placementMode === 'bulk' ? 'primary' : 'outline'} onClick={() => { setActiveBuilderPanel('bulk'); setPlacementMode('bulk') }} title="Tạo nhiều ghế">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant={placementMode === 'select' ? 'primary' : 'outline'} onClick={() => setPlacementMode('select')} title="Chọn ghế">
                      <MousePointer2 className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant={placementMode === 'pan' ? 'primary' : 'outline'} onClick={() => setPlacementMode('pan')} title="Di chuyển sơ đồ">
                      <Hand className="h-4 w-4" />
                    </Button>
                    <Button variant={snapToGrid ? 'primary' : 'outline'} onClick={() => setSnapToGrid((current) => !current)}>
                      Bám lưới {snapToGrid ? 'Bật' : 'Tắt'}
                    </Button>
                    <Button variant="ghost" onClick={() => setViewport(DEFAULT_VIEWPORT)}>Đặt lại góc nhìn</Button>
                    <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 text-sm admin-text-body hover:bg-white/15">
                      <FileUp className="h-4 w-4" /> Đổi nền
                      <input className="hidden" type="file" accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp" onChange={(event) => event.target.files?.[0] && void uploadBackground(event.target.files[0])} />
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs admin-text-muted">Ghế:</span>
                      <input type="range" min="0.5" max="4" step="0.1" value={seatSize} onChange={(event) => setSeatSize(Number(event.target.value))} className="w-20 accent-brand-red" title={`Kích thước ghế: ${seatSize}%`} />
                      <span className="w-8 text-xs admin-text-muted">{seatSize}%</span>
                    </div>
                  </div>
                )}
              >
                {selectedVenue?.background_source ? <img src={selectedVenue.background_source} alt="Nền địa điểm" className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-80" /> : null}
                {selectionBox ? <div className="pointer-events-none absolute border border-sky-500 bg-sky-400/20" style={selectionBox} /> : null}
                {seats.map((seat) => (
                  <button
                    key={seat.id}
                    type="button"
                    onMouseDown={(event) => handleSeatMouseDown(event, seat)}
                    onClick={(event) => event.stopPropagation()}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-blue-600 shadow-lg ${selectedSeatIds.includes(seat.id) || editingSeatId === seat.id ? 'ring-2 ring-brand-yellow/60' : ''} ${draggingSeatId === seat.id ? 'cursor-grabbing scale-110' : placementMode === 'select' ? 'cursor-grab' : ''}`}
                    style={{ left: `${seat.x ?? 0}%`, top: `${seat.y ?? 0}%`, width: `${seatSize}%`, aspectRatio: '1' }}
                    title={seat.label}
                  />
                ))}
                <div
                  className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand-red bg-brand-red/30 shadow-[0_0_0_6px_rgba(252,83,109,0.18)]"
                  style={{ left: `${placementMode === 'bulk' ? bulkForm.start_x : seatForm.x}%`, top: `${placementMode === 'bulk' ? bulkForm.start_y : seatForm.y}%` }}
                  title={placementMode === 'bulk' ? 'Điểm bắt đầu cụm ghế' : 'Vị trí ghế đang chọn'}
                />
              </InteractiveSeatCanvas>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {activeBuilderPanel === 'seat' ? (
              <Card className="border-white/10">
                <CardHeader><CardTitle>{editingSeatId ? 'Chỉnh sửa ghế' : 'Ghế lẻ'}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm admin-text-muted">Bố cục: {selectedLayout?.name ?? 'Chưa chọn'}</p>
                  <div>
                    <label className="mb-1 block text-md admin-text-muted">Nhãn ghế</label>
                    <Input placeholder="Ví dụ: A1" value={seatForm.label} onChange={(event) => setSeatForm({ ...seatForm, label: event.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-md admin-text-muted">Tọa độ X</label>
                      <Input type="number" step="0.01" value={seatForm.x} onChange={(event) => setSeatForm({ ...seatForm, x: event.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-md admin-text-muted">Tọa độ Y</label>
                      <Input type="number" step="0.01" value={seatForm.y} onChange={(event) => setSeatForm({ ...seatForm, y: event.target.value })} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editingSeatId ? <Button variant="ghost" onClick={resetSeatForm}>Hủy sửa</Button> : null}
                    {editingSeatId ? <Button variant="outline" onClick={() => void deleteSeat(editingSeatId)}><Trash2 className="h-4 w-4" /> Xóa ghế</Button> : null}
                    <Button className="flex-1" onClick={() => void saveSeat()} isLoading={busy} disabled={!selectedLayoutId || !seatForm.label.trim()}>
                      <Save className="h-4 w-4" /> {editingSeatId ? 'Cập nhật ghế' : 'Tạo ghế'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-white/10">
                <CardHeader><CardTitle>Tạo ghế hàng loạt</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className='text-md text-slate-500'>Kiểu</p>
                    <select className="h-11 w-full rounded-lg border border-white/10 bg-[var(--admin-bg-page)] px-3 admin-text-body outline-none" value={bulkForm.pattern} onChange={(event) => setBulkForm({ ...bulkForm, pattern: event.target.value as 'straight' | 'arc' | 'zigzag' })}>
                      <option value="straight">Thẳng</option>
                      <option value="zigzag">So le</option>
                      <option value="arc">Cung tròn</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className='text-md text-slate-500'>Số hàng</p>
                      <Input type="number" min={1} placeholder="VD: 10" value={bulkForm.rows} onChange={(event) => setBulkForm({ ...bulkForm, rows: event.target.value })} />
                    </div>
                    <div>
                      <p className='text-md text-slate-500'>Số cột</p>
                      <Input type="number" min={1} placeholder="VD: 10" value={bulkForm.cols} onChange={(event) => setBulkForm({ ...bulkForm, cols: event.target.value })} />
                    </div>
                    <div>
                      <p className='text-md text-slate-500'>Khoảng cách ngang</p>
                      <Input type="number" step="0.01" placeholder="VD: 5" value={bulkForm.gap_x} onChange={(event) => setBulkForm({ ...bulkForm, gap_x: event.target.value })} />
                    </div>
                    <div>
                      <p className='text-md text-slate-500'>Khoảng cách dọc</p>
                      <Input type="number" step="0.01" placeholder="VD: 5" value={bulkForm.gap_y} onChange={(event) => setBulkForm({ ...bulkForm, gap_y: event.target.value })} />
                    </div>
                    <div>
                      <p className='text-md text-slate-500'>Điểm bắt đầu x</p>
                      <Input type="number" step="0.01" placeholder="VD: 50" value={bulkForm.start_x} onChange={(event) => setBulkForm({ ...bulkForm, start_x: event.target.value })} />
                    </div>
                    <div>
                      <p className='text-md text-slate-500'>Điểm bắt đầu y</p>
                      <Input type="number" step="0.01" placeholder="VD: 50" value={bulkForm.start_y} onChange={(event) => setBulkForm({ ...bulkForm, start_y: event.target.value })} />
                    </div>                  
                  </div>
                  <div>
                      <p className='text-md text-slate-500'>Tiền tố nhãn ghế</p>
                    <Input placeholder="VD: VIP" value={bulkForm.label_prefix} onChange={(event) => setBulkForm({ ...bulkForm, label_prefix: event.target.value })} />
                  </div>
                  {bulkForm.pattern === 'arc' ? (
                    <div className="space-y-3 rounded-lg border border-white/10 p-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Input type="number" step="0.01" placeholder="Tâm X" value={bulkForm.arc_center_x} onChange={(event) => setBulkForm({ ...bulkForm, arc_center_x: event.target.value })} />
                        <Input type="number" step="0.01" placeholder="Tâm Y" value={bulkForm.arc_center_y} onChange={(event) => setBulkForm({ ...bulkForm, arc_center_y: event.target.value })} />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <Input type="number" step="0.01" placeholder="Bán kính" value={bulkForm.arc_radius} onChange={(event) => setBulkForm({ ...bulkForm, arc_radius: event.target.value })} />
                        <Input type="number" step="0.01" placeholder="Góc đầu" value={bulkForm.arc_start_angle} onChange={(event) => setBulkForm({ ...bulkForm, arc_start_angle: event.target.value })} />
                        <Input type="number" step="0.01" placeholder="Góc cuối" value={bulkForm.arc_end_angle} onChange={(event) => setBulkForm({ ...bulkForm, arc_end_angle: event.target.value })} />
                      </div>
                    </div>
                  ) : null}
                  <Button className="w-full" onClick={() => void createBulkSeats()} isLoading={busy} disabled={!selectedLayoutId}>
                    <Copy className="h-4 w-4" /> Tạo dãy ghế
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
