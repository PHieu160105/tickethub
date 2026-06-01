import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Copy, Hand, MapPin, MousePointer2, Plus, Redo2, RefreshCw, Save, Ticket, Trash2, Undo2 } from 'lucide-react'
import { useParams } from 'react-router-dom'

import { InteractiveSeatCanvas } from '@/components/admin/InteractiveSeatCanvas'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { GlobalLoader } from '@/components/ui/GlobalLoader'
import { Input } from '@/components/ui/Input'
import { adminApi, extractApiErrorMessage, seatmapApi } from '@/lib/api'
import { formatCurrencyVnd } from '@/lib/utils'
import type { SeatMapResponse, SeatMapSeat, ShowDetail, TicketTier } from '@/types'

const EMPTY_TIER = { code: '', name: '', description: '', base_price: '0', color: '#ef4444', is_active: true }
const EMPTY_SEAT = { seat_label: '', x: '50', y: '50', ticket_tier_id: '', price: '', is_admin_locked: false }
const EMPTY_SELECTED_SEAT_PROPERTIES = { ticket_tier_id: '', price: '', is_admin_locked: false }
const EMPTY_BULK = {
  ticket_tier_id: '',
  pattern: 'straight' as 'straight' | 'arc',
  rows: '4',
  cols: '8',
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

interface PlannerSnapshot {
  seats: SeatMapSeat[]
  deletedSeatIds: number[]
  selectedSeatIds: number[]
}

function cloneSeats(seats: SeatMapSeat[]) {
  return seats.map((seat) => ({ ...seat }))
}

function tierForm(tier: TicketTier) {
  return {
    code: tier.code,
    name: tier.name,
    description: tier.description ?? '',
    base_price: String(tier.base_price),
    color: tier.color,
    is_active: tier.is_active,
  }
}

function seatForm(seat: SeatMapSeat) {
  return {
    seat_label: seat.label,
    x: String(seat.x ?? 50),
    y: String(seat.y ?? 50),
    ticket_tier_id: seat.ticket_tier_id ? String(seat.ticket_tier_id) : '',
    price: String(seat.price),
    is_admin_locked: seat.is_admin_locked,
  }
}

function sameSeat(left: SeatMapSeat, right: SeatMapSeat) {
  return (
    left.label === right.label
    && left.x === right.x
    && left.y === right.y
    && left.ticket_tier_id === right.ticket_tier_id
    && left.price === right.price
    && left.is_admin_locked === right.is_admin_locked
  )
}

export default function AdminSeatPlanner() {
  const { eventKey = '', showId: rawShowId = '' } = useParams<{ eventKey: string; showId: string }>()
  const showId = Number(rawShowId)
  const canvasRef = useRef<HTMLDivElement>(null)
  const savedSeatsRef = useRef<SeatMapSeat[]>([])
  const tempSeatIdRef = useRef(-1)

  const [showDetail, setShowDetail] = useState<ShowDetail | null>(null)
  const [seatMap, setSeatMap] = useState<SeatMapResponse | null>(null)
  const [tiers, setTiers] = useState<TicketTier[]>([])
  const [tierEditor, setTierEditor] = useState(EMPTY_TIER)
  const [seatEditor, setSeatEditor] = useState(EMPTY_SEAT)
  const [selectedSeatProperties, setSelectedSeatProperties] = useState(EMPTY_SELECTED_SEAT_PROPERTIES)
  const [bulkEditor, setBulkEditor] = useState(EMPTY_BULK)
  const [editingTierId, setEditingTierId] = useState<number | null>(null)
  const [selectedSeatIds, setSelectedSeatIds] = useState<number[]>([])
  const [deletedSeatIds, setDeletedSeatIds] = useState<number[]>([])
  const [historyPast, setHistoryPast] = useState<PlannerSnapshot[]>([])
  const [historyFuture, setHistoryFuture] = useState<PlannerSnapshot[]>([])
  const [tool, setTool] = useState<'single' | 'bulk' | 'select' | 'pan'>('single')
  const [viewport, setViewport] = useState({ scale: 1, offsetX: 0, offsetY: 0 })
  const [canvasCursor, setCanvasCursor] = useState<{ x: number; y: number } | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [panStartCursor, setPanStartCursor] = useState<{ x: number; y: number } | null>(null)
  const [panStartOffset, setPanStartOffset] = useState<{ x: number; y: number } | null>(null)
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null)
  const [selectionCurrent, setSelectionCurrent] = useState<{ x: number; y: number } | null>(null)
  const [draggingSeatId, setDraggingSeatId] = useState<number | null>(null)
  const [dragStartPosition, setDragStartPosition] = useState<{ x: number; y: number } | null>(null)
  const [dragSelectionStart, setDragSelectionStart] = useState<Record<number, { x: number; y: number }> | null>(null)
  const [snapToGrid, setSnapToGrid] = useState(false)
  const [seatSize, setSeatSize] = useState(1.5)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const tierMap = useMemo(() => new Map(tiers.map((tier) => [tier.id, tier])), [tiers])
  const selectedSeat = useMemo(
    () => seatMap?.seats.find((seat) => seat.id === selectedSeatIds[0]) ?? null,
    [seatMap?.seats, selectedSeatIds],
  )
  const seatsByTier = useMemo(
    () => tiers.map((tier) => ({ tier, seats: seatMap?.seats.filter((seat) => seat.ticket_tier_id === tier.id) ?? [] })),
    [seatMap?.seats, tiers],
  )
  const canvasAspectRatio = seatMap?.background?.width && seatMap.background.height
    ? seatMap.background.width / seatMap.background.height
    : 5 / 3

  function notify(kind: 'success' | 'error', text: string) {
    if (kind === 'error') {
      setError(text)
      setTimeout(() => setError((current) => (current === text ? null : current)), 3500)
      return
    }
    setMessage(text)
    setTimeout(() => setMessage((current) => (current === text ? null : current)), 2500)
  }

  function snapshot(): PlannerSnapshot {
    return {
      seats: cloneSeats(seatMap?.seats ?? []),
      deletedSeatIds: [...deletedSeatIds],
      selectedSeatIds: [...selectedSeatIds],
    }
  }

  function pushHistory() {
    setHistoryPast((previous) => [...previous, snapshot()].slice(-50))
    setHistoryFuture([])
  }

  function applySnapshot(next: PlannerSnapshot) {
    setSeatMap((previous) => previous ? { ...previous, seats: cloneSeats(next.seats), seat_count: next.seats.length } : previous)
    setDeletedSeatIds([...next.deletedSeatIds])
    setSelectedSeatIds([...next.selectedSeatIds])
    setDirty(true)
  }

  function currentTierId() {
    return Number(seatEditor.ticket_tier_id || tiers[0]?.id || 0)
  }

  function setDefaultTier(tierId: number | null) {
    const value = tierId ? String(tierId) : ''
    setSeatEditor((current) => ({ ...current, ticket_tier_id: value }))
    setBulkEditor((current) => ({ ...current, ticket_tier_id: value }))
  }

  async function loadPlanner() {
    if (!eventKey || !showId || Number.isNaN(showId)) return
    setLoading(true)
    setError(null)
    try {
      const [detail, nextSeatMap, nextTiers] = await Promise.all([
        adminApi.getShow(eventKey, showId),
        seatmapApi.get(showId),
        adminApi.getShowTicketTiers(eventKey, showId),
      ])
      setShowDetail(detail)
      setSeatMap(nextSeatMap)
      setTiers(nextTiers)
      savedSeatsRef.current = cloneSeats(nextSeatMap.seats)
      setDeletedSeatIds([])
      setSelectedSeatIds([])
      setHistoryPast([])
      setHistoryFuture([])
      setDirty(false)
      setDefaultTier(nextTiers[0]?.id ?? null)
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể tải trình dựng sơ đồ.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPlanner()
    // Reload when the route changes; editor state changes must not trigger refetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventKey, showId])

  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])

  useEffect(() => {
    if (!selectedSeat) {
      setSelectedSeatProperties(EMPTY_SELECTED_SEAT_PROPERTIES)
      return
    }
    setSelectedSeatProperties({
      ticket_tier_id: selectedSeat.ticket_tier_id ? String(selectedSeat.ticket_tier_id) : '',
      price: String(selectedSeat.price),
      is_admin_locked: selectedSeat.is_admin_locked,
    })
    if (selectedSeatIds.length === 1) setSeatEditor(seatForm(selectedSeat))
  }, [selectedSeat, selectedSeatIds.length])

  function getCoordinates(clientX: number, clientY: number) {
    const element = canvasRef.current
    if (!element) return null
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    const normalize = (value: number) => snapToGrid ? Math.round(value / 5) * 5 : value
    const x = normalize(Math.max(0, Math.min(100, (((clientX - rect.left - viewport.offsetX) / viewport.scale) / rect.width) * 100)))
    const y = normalize(Math.max(0, Math.min(100, (((clientY - rect.top - viewport.offsetY) / viewport.scale) / rect.height) * 100)))
    return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) }
  }

  function handleCanvasClick(event: MouseEvent<HTMLDivElement>) {
    if (!['single', 'bulk'].includes(tool) || draggingSeatId !== null) return
    const point = getCoordinates(event.clientX, event.clientY)
    if (!point) return
    if (tool === 'bulk') {
      setBulkEditor((current) => ({ ...current, start_x: String(point.x), start_y: String(point.y) }))
      return
    }
    setSeatEditor((current) => ({ ...current, x: String(point.x), y: String(point.y) }))
  }

  function handleCanvasMouseMove(event: MouseEvent<HTMLDivElement>) {
    const point = getCoordinates(event.clientX, event.clientY)
    if (point) setCanvasCursor(point)
  }

  function handleCanvasMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (tool === 'select') {
      const point = getCoordinates(event.clientX, event.clientY)
      if (!point) return
      event.preventDefault()
      setSelectionStart(point)
      setSelectionCurrent(point)
      return
    }
    if (tool !== 'pan' && event.button !== 1 && !event.shiftKey) return
    event.preventDefault()
    setIsPanning(true)
    setPanStartCursor({ x: event.clientX, y: event.clientY })
    setPanStartOffset({ x: viewport.offsetX, y: viewport.offsetY })
  }

  function handleCanvasWheel(event: WheelEvent) {
    event.preventDefault()
    const element = canvasRef.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    const pointerX = event.clientX - rect.left
    const pointerY = event.clientY - rect.top
    setViewport((current) => {
      const factor = event.deltaY < 0 ? 1.1 : 0.9
      const scale = Math.max(0.6, Math.min(3, Number((current.scale * factor).toFixed(2))))
      return {
        scale,
        offsetX: pointerX - ((pointerX - current.offsetX) / current.scale) * scale,
        offsetY: pointerY - ((pointerY - current.offsetY) / current.scale) * scale,
      }
    })
  }

  useEffect(() => {
    if (!isPanning || !panStartCursor || !panStartOffset) return
    const onMove = (event: globalThis.MouseEvent) => {
      setViewport((current) => ({
        ...current,
        offsetX: panStartOffset.x + event.clientX - panStartCursor.x,
        offsetY: panStartOffset.y + event.clientY - panStartCursor.y,
      }))
    }
    const onUp = () => setIsPanning(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isPanning, panStartCursor, panStartOffset])

  useEffect(() => {
    if (tool !== 'select' || !selectionStart) return
    const onMove = (event: globalThis.MouseEvent) => {
      const point = getCoordinates(event.clientX, event.clientY)
      if (point) setSelectionCurrent(point)
    }
    const onUp = () => {
      const end = selectionCurrent ?? selectionStart
      const minX = Math.min(selectionStart.x, end.x)
      const maxX = Math.max(selectionStart.x, end.x)
      const minY = Math.min(selectionStart.y, end.y)
      const maxY = Math.max(selectionStart.y, end.y)
      setSelectedSeatIds((seatMap?.seats ?? []).filter((seat) => {
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
  }, [selectionCurrent, selectionStart, seatMap?.seats, tool, viewport])

  useEffect(() => {
    if (draggingSeatId === null || !dragStartPosition || !dragSelectionStart) return
    const onMove = (event: globalThis.MouseEvent) => {
      const point = getCoordinates(event.clientX, event.clientY)
      if (!point) return
      setSeatMap((current) => current ? {
        ...current,
        seats: current.seats.map((seat) => {
          const start = dragSelectionStart[seat.id]
          if (!start) return seat
          return {
            ...seat,
            x: Math.max(0, Math.min(100, Number((start.x + point.x - dragStartPosition.x).toFixed(2)))),
            y: Math.max(0, Math.min(100, Number((start.y + point.y - dragStartPosition.y).toFixed(2)))),
          }
        }),
      } : current)
      setDirty(true)
    }
    const onUp = () => {
      setDraggingSeatId(null)
      setDragStartPosition(null)
      setDragSelectionStart(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragSelectionStart, dragStartPosition, draggingSeatId, snapToGrid, viewport])

  function handleSeatMouseDown(event: MouseEvent<HTMLButtonElement>, seat: SeatMapSeat) {
    event.preventDefault()
    event.stopPropagation()
    const selection = tool === 'select' && event.shiftKey
      ? (selectedSeatIds.includes(seat.id) ? selectedSeatIds.filter((id) => id !== seat.id) : [...selectedSeatIds, seat.id])
      : (selectedSeatIds.includes(seat.id) ? selectedSeatIds : [seat.id])
    setSelectedSeatIds(selection)
    if (tool !== 'select') return
    pushHistory()
    setDraggingSeatId(seat.id)
    setDragStartPosition({ x: seat.x ?? 0, y: seat.y ?? 0 })
    setDragSelectionStart(Object.fromEntries(
      (seatMap?.seats ?? []).filter((item) => selection.includes(item.id)).map((item) => [item.id, { x: item.x ?? 0, y: item.y ?? 0 }]),
    ))
  }

  function appendSeat(next: SeatMapSeat) {
    setSeatMap((current) => current ? { ...current, seats: [...current.seats, next], seat_count: current.seat_count + 1 } : current)
  }

  function addSingleSeat() {
    const tier = tierMap.get(currentTierId())
    if (!seatMap || !tier || !seatEditor.seat_label.trim()) return
    pushHistory()
    appendSeat({
      id: tempSeatIdRef.current--,
      label: seatEditor.seat_label.trim(),
      x: Number(seatEditor.x),
      y: Number(seatEditor.y),
      ticket_tier_id: tier.id,
      ticket_tier_name: tier.name,
      price: seatEditor.price ? Number(seatEditor.price) : tier.base_price,
      status: seatEditor.is_admin_locked ? 'LOCKED' : 'AVAILABLE',
      lock_expires_at: null,
      is_locked_by_me: false,
      is_admin_locked: seatEditor.is_admin_locked,
    })
    setSeatEditor((current) => ({ ...current, seat_label: '' }))
    setDirty(true)
  }

  function applySeatChanges() {
    if (!seatMap || selectedSeatIds.length === 0) return
    const tier = tierMap.get(currentTierId())
    if (!tier) return
    pushHistory()
    setSeatMap({
      ...seatMap,
      seats: seatMap.seats.map((seat) => selectedSeatIds.includes(seat.id) ? {
        ...seat,
        label: selectedSeatIds.length === 1 ? seatEditor.seat_label.trim() || seat.label : seat.label,
        x: selectedSeatIds.length === 1 ? Number(seatEditor.x) : seat.x,
        y: selectedSeatIds.length === 1 ? Number(seatEditor.y) : seat.y,
        ticket_tier_id: tier.id,
        ticket_tier_name: tier.name,
        price: seatEditor.price ? Number(seatEditor.price) : tier.base_price,
        status: seat.status === 'SOLD' ? 'SOLD' : (seatEditor.is_admin_locked ? 'LOCKED' : 'AVAILABLE'),
        is_admin_locked: seatEditor.is_admin_locked,
      } : seat),
    })
    setDirty(true)
  }

  function applySelectedSeatProperties() {
    if (!seatMap || selectedSeatIds.length === 0) return
    const tier = tierMap.get(Number(selectedSeatProperties.ticket_tier_id))
    if (!tier) return
    pushHistory()
    setSeatMap({
      ...seatMap,
      seats: seatMap.seats.map((seat) => selectedSeatIds.includes(seat.id) ? {
        ...seat,
        ticket_tier_id: tier.id,
        ticket_tier_name: tier.name,
        price: selectedSeatProperties.price ? Number(selectedSeatProperties.price) : tier.base_price,
        status: seat.status === 'SOLD' ? 'SOLD' : (selectedSeatProperties.is_admin_locked ? 'LOCKED' : 'AVAILABLE'),
        is_admin_locked: selectedSeatProperties.is_admin_locked,
      } : seat),
    })
    setDirty(true)
  }

  function addBulkSeats() {
    if (!seatMap) return
    const tier = tierMap.get(Number(bulkEditor.ticket_tier_id || tiers[0]?.id || 0))
    if (!tier) return
    const generated: SeatMapSeat[] = []
    const labels = new Set(seatMap.seats.map((seat) => seat.label))
    const rows = Number(bulkEditor.rows)
    const cols = Number(bulkEditor.cols)
    const gapX = Number(bulkEditor.gap_x)
    const gapY = Number(bulkEditor.gap_y)
    const startX = Number(bulkEditor.start_x)
    const startY = Number(bulkEditor.start_y)

    const add = (row: number, col: number, x: number, y: number) => {
      const label = `${bulkEditor.label_prefix}${row + 1}-${col + 1}`
      if (labels.has(label) || x < 0 || x > 100 || y < 0 || y > 100) return
      labels.add(label)
      generated.push({
        id: tempSeatIdRef.current--,
        label,
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        ticket_tier_id: tier.id,
        ticket_tier_name: tier.name,
        price: tier.base_price,
        status: 'AVAILABLE',
        lock_expires_at: null,
        is_locked_by_me: false,
        is_admin_locked: false,
      })
    }

    for (let row = 0; row < rows; row += 1) {
      const seatsInRow = bulkEditor.pattern === 'arc' ? cols + row * 2 : cols
      for (let col = 0; col < seatsInRow; col += 1) {
        if (bulkEditor.pattern === 'straight') {
          add(row, col, startX + col * gapX, startY + row * gapY)
          continue
        }
        const radius = Number(bulkEditor.arc_radius) + row * gapY
        const angle = Number(bulkEditor.arc_start_angle) + (Number(bulkEditor.arc_end_angle) - Number(bulkEditor.arc_start_angle)) * (col / Math.max(seatsInRow - 1, 1))
        add(row, col, Number(bulkEditor.arc_center_x) + radius * Math.sin(angle * Math.PI / 180), Number(bulkEditor.arc_center_y) + radius * Math.cos(angle * Math.PI / 180))
      }
    }
    if (generated.length === 0) return
    pushHistory()
    setSeatMap({ ...seatMap, seats: [...seatMap.seats, ...generated], seat_count: seatMap.seat_count + generated.length })
    setDirty(true)
  }

  function deleteSelectedSeats() {
    if (!seatMap || selectedSeatIds.length === 0 || !window.confirm(`Xóa ${selectedSeatIds.length} ghế đã chọn?`)) return
    pushHistory()
    setSeatMap({ ...seatMap, seats: seatMap.seats.filter((seat) => !selectedSeatIds.includes(seat.id)), seat_count: seatMap.seat_count - selectedSeatIds.length })
    setDeletedSeatIds((current) => [...new Set([...current, ...selectedSeatIds.filter((id) => id > 0)])])
    setSelectedSeatIds([])
    setDirty(true)
  }

  function undo() {
    const previous = historyPast[historyPast.length - 1]
    if (!previous) return
    setHistoryFuture((current) => [snapshot(), ...current].slice(0, 50))
    setHistoryPast((current) => current.slice(0, -1))
    applySnapshot(previous)
  }

  function redo() {
    const next = historyFuture[0]
    if (!next) return
    setHistoryPast((current) => [...current, snapshot()].slice(-50))
    setHistoryFuture((current) => current.slice(1))
    applySnapshot(next)
  }

  function restoreSaved() {
    if (!window.confirm('Khôi phục sơ đồ về lần lưu gần nhất?')) return
    setSeatMap((current) => current ? { ...current, seats: cloneSeats(savedSeatsRef.current), seat_count: savedSeatsRef.current.length } : current)
    setDeletedSeatIds([])
    setSelectedSeatIds([])
    setHistoryPast([])
    setHistoryFuture([])
    setDirty(false)
  }

  async function savePlanner() {
    if (!eventKey || !seatMap) return
    const saved = new Map(savedSeatsRef.current.map((seat) => [seat.id, seat]))
    const created = seatMap.seats.filter((seat) => seat.id < 0)
    const updated = seatMap.seats.filter((seat) => seat.id > 0 && saved.has(seat.id) && !sameSeat(seat, saved.get(seat.id)!))
    setBusy(true)
    try {
      await adminApi.syncEventSeats(eventKey, showId, {
        create: created.map((seat) => ({
          client_id: seat.id,
          seat_label: seat.label,
          x: seat.x ?? 0,
          y: seat.y ?? 0,
          ticket_tier_id: seat.ticket_tier_id,
          price: seat.price,
          is_admin_locked: seat.is_admin_locked,
        })),
        update: updated.map((seat) => ({
          id: seat.id,
          seat_label: seat.label,
          x: seat.x ?? 0,
          y: seat.y ?? 0,
          ticket_tier_id: seat.ticket_tier_id,
          price: seat.price,
          is_admin_locked: seat.is_admin_locked,
        })),
        delete_ids: deletedSeatIds,
      })
      notify('success', 'Đã lưu thay đổi sơ đồ ghế.')
      await loadPlanner()
    } catch (errorValue) {
      notify('error', extractApiErrorMessage(errorValue, 'Không thể lưu sơ đồ ghế. Chỉ có thể sửa khi buổi diễn ở trạng thái nháp.'))
    } finally {
      setBusy(false)
    }
  }

  async function saveTier() {
    if (!tierEditor.code.trim() || !tierEditor.name.trim()) return
    if (dirty && !window.confirm('Lưu hạng vé sẽ tải lại planner. Các thay đổi ghế chưa lưu sẽ bị mất. Tiếp tục?')) return
    setBusy(true)
    try {
      const payload = {
        ...tierEditor,
        code: tierEditor.code.trim(),
        name: tierEditor.name.trim(),
        description: tierEditor.description.trim() || null,
        base_price: Number(tierEditor.base_price),
      }
      const saved = editingTierId
        ? await adminApi.updateTicketTier(eventKey, showId, editingTierId, payload)
        : await adminApi.createTicketTier(eventKey, showId, payload)
      notify('success', editingTierId ? 'Đã cập nhật hạng vé.' : 'Đã tạo hạng vé.')
      await loadPlanner()
      setEditingTierId(saved.id)
      setTierEditor(tierForm(saved))
      setDefaultTier(saved.id)
    } catch (errorValue) {
      notify('error', extractApiErrorMessage(errorValue, 'Không thể lưu hạng vé.'))
    } finally {
      setBusy(false)
    }
  }

  async function deleteTier(tierId: number) {
    if (!window.confirm('Xóa hạng vé này?')) return
    setBusy(true)
    try {
      await adminApi.deleteTicketTier(eventKey, showId, tierId)
      setEditingTierId(null)
      setTierEditor(EMPTY_TIER)
      await loadPlanner()
    } catch (errorValue) {
      notify('error', extractApiErrorMessage(errorValue, 'Không thể xóa hạng vé đang được sử dụng.'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <GlobalLoader />
  if (!seatMap) return <div className="text-sm text-red-300">Không tìm thấy sơ đồ ghế.</div>

  const selectionBox = selectionStart && selectionCurrent ? {
    left: `${Math.min(selectionStart.x, selectionCurrent.x)}%`,
    top: `${Math.min(selectionStart.y, selectionCurrent.y)}%`,
    width: `${Math.abs(selectionStart.x - selectionCurrent.x)}%`,
    height: `${Math.abs(selectionStart.y - selectionCurrent.y)}%`,
  } : null

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] admin-text-muted">Trình đặt ghế sự kiện</p>
          <h1 className="mt-2 font-display text-4xl font-black admin-text-header">{showDetail?.title ?? seatMap.show_title}</h1>
          <p className="mt-1 text-sm admin-text-muted">{showDetail?.location ?? seatMap.venue_name}</p>
        </div>
        <Button variant="outline" onClick={() => void loadPlanner()}><RefreshCw className="h-4 w-4" /> Làm mới</Button>
      </div>

      {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
      {message ? <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</div> : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.9fr)]">
        <Card>
          <CardContent className="pt-5">
            <InteractiveSeatCanvas
              canvasRef={canvasRef}
              cursor={canvasCursor}
              viewport={viewport}
              aspectRatio={canvasAspectRatio}
              cursorClassName={tool === 'pan' ? 'cursor-grab' : tool === 'select' ? 'cursor-crosshair' : 'cursor-cell'}
              onClick={handleCanvasClick}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onWheel={handleCanvasWheel}
              onZoomIn={() => setViewport((current) => ({ ...current, scale: Math.min(3, current.scale + 0.1) }))}
              onZoomOut={() => setViewport((current) => ({ ...current, scale: Math.max(0.6, current.scale - 0.1) }))}
              footerLeft={`${seatMap.seat_count} ghế · ${selectedSeatIds.length} đang chọn`}
              footerRight={`Zoom ${Math.round(viewport.scale * 100)}%`}
              toolbar={(
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="icon" variant={tool === 'single' ? 'primary' : 'outline'} onClick={() => { setTool('single'); setSelectedSeatIds([]) }} title="Đặt ghế lẻ"><Plus className="h-4 w-4" /></Button>
                  <Button size="icon" variant={tool === 'bulk' ? 'primary' : 'outline'} onClick={() => { setTool('bulk'); setSelectedSeatIds([]) }} title="Tạo cụm ghế"><Copy className="h-4 w-4" /></Button>
                  <Button size="icon" variant={tool === 'select' ? 'primary' : 'outline'} onClick={() => setTool('select')} title="Chọn và kéo ghế"><MousePointer2 className="h-4 w-4" /></Button>
                  <Button size="icon" variant={tool === 'pan' ? 'primary' : 'outline'} onClick={() => setTool('pan')} title="Di chuyển góc nhìn"><Hand className="h-4 w-4" /></Button>
                  <Button variant="outline" onClick={() => setSnapToGrid((current) => !current)}>Bám lưới {snapToGrid ? 'Bật' : 'Tắt'}</Button>
                  <Button size="icon" variant="outline" onClick={undo} disabled={historyPast.length === 0} title="Hoàn tác"><Undo2 className="h-4 w-4" /></Button>
                  <Button size="icon" variant="outline" onClick={redo} disabled={historyFuture.length === 0} title="Làm lại"><Redo2 className="h-4 w-4" /></Button>
                  <Button variant="outline" onClick={() => setViewport({ scale: 1, offsetX: 0, offsetY: 0 })}>Đặt lại góc nhìn</Button>
                  <Button onClick={() => void savePlanner()} isLoading={busy} disabled={!dirty}><Save className="h-4 w-4" /> Lưu thay đổi</Button>
                  <Button variant="outline" onClick={restoreSaved} disabled={!dirty}>Khôi phục bản đã lưu</Button>
                  <label className="ml-auto flex items-center gap-2 text-xs text-slate-300">Ghế <input type="range" min="1" max="3" step="0.1" value={seatSize} onChange={(event) => setSeatSize(Number(event.target.value))} /></label>
                </div>
              )}
            >
              {seatMap.background?.source ? <img src={seatMap.background.source} alt="Nền sơ đồ" className="pointer-events-none absolute inset-0 h-full w-full object-contain" /> : null}
              {selectionBox ? <div className="pointer-events-none absolute border border-sky-500 bg-sky-400/20" style={selectionBox} /> : null}
              {seatMap.seats.map((seat) => {
                const tier = tierMap.get(seat.ticket_tier_id ?? -1)
                const isSelected = selectedSeatIds.includes(seat.id)
                return (
                  <button
                    key={seat.id}
                    type="button"
                    title={`${seat.label} · ${tier?.name ?? 'Chưa phân hạng'}`}
                    onMouseDown={(event) => handleSeatMouseDown(event, seat)}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-sm ${isSelected ? 'ring-2 ring-sky-300 ring-offset-1' : ''}`}
                    style={{
                      left: `${seat.x ?? 0}%`,
                      top: `${seat.y ?? 0}%`,
                      width: `${seatSize}%`,
                      aspectRatio: '1',
                      backgroundColor: seat.is_admin_locked ? '#be123c' : tier?.color ?? '#334155',
                      borderColor: isSelected ? '#7dd3fc' : tier?.color ?? '#64748b',
                    }}
                  />
                )
              })}
            </InteractiveSeatCanvas>
          </CardContent>
        </Card>

        <div className="space-y-6 xl:col-start-2 xl:row-span-2 xl:row-start-1">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Ticket className="h-5 w-5" /> Tóm tắt</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-4"><span className="admin-text-muted">Sự kiện</span><span className="admin-text-body">{seatMap.event_title}</span></div>
              <div className="flex justify-between gap-4"><span className="admin-text-muted">Số hạng vé</span><span className="admin-text-body">{tiers.length}</span></div>
              <div className="flex justify-between gap-4"><span className="admin-text-muted">Số ghế hiện có</span><span className="admin-text-body">{seatMap.seat_count}</span></div>
              <div className="flex justify-between gap-4"><span className="admin-text-muted">Hạng vé đang chọn</span><span className="admin-text-body">{tierMap.get(currentTierId())?.name ?? 'Chưa chọn'}</span></div>
              <p className="pt-2 text-xs admin-text-muted">Ghế khóa bởi nhân viên hiển thị màu đỏ đậm và khách hàng không thể mua.</p>
            </CardContent>
          </Card>

          {tool === 'select' && selectedSeatIds.length > 0 ? <Card>
            <CardHeader><CardTitle>Ghế đang chọn</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm admin-text-muted">Đã chọn {selectedSeatIds.length} ghế.</p>
              <label className="block text-xs uppercase tracking-[0.18em] admin-text-muted">Hạng vé</label>
              <select className="h-11 w-full rounded-lg border admin-border admin-bg-listbox px-3 admin-text-body" value={selectedSeatProperties.ticket_tier_id} onChange={(event) => setSelectedSeatProperties({ ...selectedSeatProperties, ticket_tier_id: event.target.value })}>
                <option value="">Chọn hạng vé</option>
                {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.code} · {tier.name}</option>)}
              </select>
              <label className="block text-xs uppercase tracking-[0.18em] admin-text-muted">Giá riêng</label>
              <Input type="number" value={selectedSeatProperties.price} onChange={(event) => setSelectedSeatProperties({ ...selectedSeatProperties, price: event.target.value })} placeholder="Để trống dùng giá hạng vé" />
              <label className="flex items-center gap-2 rounded-lg border admin-border px-3 py-3 text-sm admin-text-muted"><input type="checkbox" checked={selectedSeatProperties.is_admin_locked} onChange={(event) => setSelectedSeatProperties({ ...selectedSeatProperties, is_admin_locked: event.target.checked })} /> Khóa sẵn nhóm ghế này</label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button onClick={applySelectedSeatProperties}>Áp dụng thuộc tính</Button>
                <Button variant="outline" onClick={deleteSelectedSeats}><Trash2 className="h-4 w-4" /> Xóa ghế đã chọn</Button>
              </div>
            </CardContent>
          </Card> : null}

          {tool === 'single' ? <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-emerald-400" /> Ghế lẻ</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <label className="block text-xs uppercase tracking-[0.18em] admin-text-muted">Nhãn ghế</label>
              <Input value={seatEditor.seat_label} onChange={(event) => setSeatEditor({ ...seatEditor, seat_label: event.target.value })} placeholder="A1" />
              <label className="block text-xs uppercase tracking-[0.18em] admin-text-muted">Hạng vé</label>
              <select className="h-11 w-full rounded-lg border admin-border admin-bg-listbox px-3 admin-text-body" value={seatEditor.ticket_tier_id} onChange={(event) => setSeatEditor({ ...seatEditor, ticket_tier_id: event.target.value })}>
                <option value="">Chọn hạng vé</option>
                {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.code} · {tier.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <Input type="number" value={seatEditor.x} onChange={(event) => setSeatEditor({ ...seatEditor, x: event.target.value })} placeholder="Tọa độ X" />
                <Input type="number" value={seatEditor.y} onChange={(event) => setSeatEditor({ ...seatEditor, y: event.target.value })} placeholder="Tọa độ Y" />
              </div>
              <Input type="number" value={seatEditor.price} onChange={(event) => setSeatEditor({ ...seatEditor, price: event.target.value })} placeholder="Giá riêng, để trống dùng giá hạng vé" />
              <label className="flex items-center gap-2 rounded-lg border admin-border px-3 py-3 text-sm admin-text-muted"><input type="checkbox" checked={seatEditor.is_admin_locked} onChange={(event) => setSeatEditor({ ...seatEditor, is_admin_locked: event.target.checked })} /> Khóa sẵn ghế này để khách không thể mua</label>
              <div className="flex flex-wrap gap-2">
                {selectedSeatIds.length === 0 ? <Button onClick={addSingleSeat}><Save className="h-4 w-4" /> Tạo ghế</Button> : <Button onClick={applySeatChanges}><Save className="h-4 w-4" /> Áp dụng cho {selectedSeatIds.length} ghế</Button>}
                {selectedSeatIds.length > 0 ? <Button variant="danger" onClick={deleteSelectedSeats}><Trash2 className="h-4 w-4" /></Button> : null}
              </div>
            </CardContent>
          </Card> : null}

          {tool === 'bulk' ? <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Copy className="h-5 w-5" /> Tạo cụm ghế</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <select className="h-11 w-full rounded-lg border admin-border admin-bg-listbox px-3 admin-text-body" value={bulkEditor.ticket_tier_id} onChange={(event) => setBulkEditor({ ...bulkEditor, ticket_tier_id: event.target.value })}>
                <option value="">Chọn hạng vé</option>
                {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.code} · {tier.name}</option>)}
              </select>
              <select className="h-11 w-full rounded-lg border admin-border admin-bg-listbox px-3 admin-text-body" value={bulkEditor.pattern} onChange={(event) => setBulkEditor({ ...bulkEditor, pattern: event.target.value as 'straight' | 'arc' })}>
                <option value="straight">Hàng thẳng</option>
                <option value="arc">Vòng cung</option>
              </select>
              <div className="grid grid-cols-2 gap-3">
                <Input value={bulkEditor.rows} onChange={(event) => setBulkEditor({ ...bulkEditor, rows: event.target.value })} placeholder="Số hàng" />
                <Input value={bulkEditor.cols} onChange={(event) => setBulkEditor({ ...bulkEditor, cols: event.target.value })} placeholder="Số ghế mỗi hàng" />
                <Input value={bulkEditor.start_x} onChange={(event) => setBulkEditor({ ...bulkEditor, start_x: event.target.value })} placeholder="X bắt đầu" />
                <Input value={bulkEditor.start_y} onChange={(event) => setBulkEditor({ ...bulkEditor, start_y: event.target.value })} placeholder="Y bắt đầu" />
                <Input value={bulkEditor.gap_x} onChange={(event) => setBulkEditor({ ...bulkEditor, gap_x: event.target.value })} placeholder="Khoảng cách X" />
                <Input value={bulkEditor.gap_y} onChange={(event) => setBulkEditor({ ...bulkEditor, gap_y: event.target.value })} placeholder="Khoảng cách Y" />
              </div>
              <Input value={bulkEditor.label_prefix} onChange={(event) => setBulkEditor({ ...bulkEditor, label_prefix: event.target.value })} placeholder="Tiền tố nhãn ghế" />
              {bulkEditor.pattern === 'arc' ? <div className="grid grid-cols-2 gap-3">
                <Input value={bulkEditor.arc_center_x} onChange={(event) => setBulkEditor({ ...bulkEditor, arc_center_x: event.target.value })} placeholder="Tâm X" />
                <Input value={bulkEditor.arc_center_y} onChange={(event) => setBulkEditor({ ...bulkEditor, arc_center_y: event.target.value })} placeholder="Tâm Y" />
                <Input value={bulkEditor.arc_radius} onChange={(event) => setBulkEditor({ ...bulkEditor, arc_radius: event.target.value })} placeholder="Bán kính" />
                <Input value={bulkEditor.arc_start_angle} onChange={(event) => setBulkEditor({ ...bulkEditor, arc_start_angle: event.target.value })} placeholder="Góc đầu" />
                <Input value={bulkEditor.arc_end_angle} onChange={(event) => setBulkEditor({ ...bulkEditor, arc_end_angle: event.target.value })} placeholder="Góc cuối" />
              </div> : null}
              <Button variant="outline" onClick={addBulkSeats}><Plus className="h-4 w-4" /> Tạo cụm trên canvas</Button>
            </CardContent>
          </Card> : null}
        </div>

        <Card className="xl:col-start-1 xl:row-start-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-sky-400" /> Quản lý hạng vé</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input value={tierEditor.code} onChange={(event) => setTierEditor({ ...tierEditor, code: event.target.value })} placeholder="Mã hạng vé" />
              <Input value={tierEditor.name} onChange={(event) => setTierEditor({ ...tierEditor, name: event.target.value })} placeholder="Tên hạng vé" />
            </div>
            <Input value={tierEditor.description} onChange={(event) => setTierEditor({ ...tierEditor, description: event.target.value })} placeholder="Quyền lợi hoặc ghi chú cho hạng vé" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input type="number" value={tierEditor.base_price} onChange={(event) => setTierEditor({ ...tierEditor, base_price: event.target.value })} placeholder="Giá cơ bản" />
              <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-2">
                <input
                  type="color"
                  value={tierEditor.color}
                  onChange={(event) => setTierEditor({ ...tierEditor, color: event.target.value })}
                  className="h-14 w-[52px] cursor-pointer rounded-lg border admin-border bg-transparent p-1"
                  title="Chọn màu hiển thị"
                />
                <Input value={tierEditor.color} onChange={(event) => setTierEditor({ ...tierEditor, color: event.target.value })} />
              </div>
            </div>
            <label className="flex items-center gap-2 rounded-lg border admin-border px-3 py-3 text-sm admin-text-muted"><input type="checkbox" checked={tierEditor.is_active} onChange={(event) => setTierEditor({ ...tierEditor, is_active: event.target.checked })} /> Đang hoạt động</label>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void saveTier()} isLoading={busy}><Save className="h-4 w-4" /> {editingTierId ? 'Cập nhật hạng vé' : 'Tạo hạng vé'}</Button>
              {editingTierId ? <Button variant="outline" onClick={() => { setEditingTierId(null); setTierEditor(EMPTY_TIER) }}>Tạo mới</Button> : null}
            </div>
            <div className="space-y-2 border-t admin-border pt-4">
              {tiers.map((tier) => <div key={tier.id} className="flex items-center justify-between gap-3 rounded-lg border admin-border px-4 py-3">
                <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => { setEditingTierId(tier.id); setTierEditor(tierForm(tier)); setDefaultTier(tier.id) }}>
                  <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: tier.color }} />
                  <span className="min-w-0"><span className="block truncate font-semibold admin-text-body">{tier.name}</span><span className="block truncate text-xs admin-text-muted">{tier.code} · {formatCurrencyVnd(tier.base_price)} · {tier.is_active ? 'Đang hoạt động' : 'Tạm ẩn'}</span></span>
                </button>
                <Button size="icon" variant="danger" onClick={() => void deleteTier(tier.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Danh sách ghế theo hạng vé</CardTitle></CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-2">
          {seatsByTier.map(({ tier, seats }) => <div key={tier.id} className="rounded-lg border admin-border p-4">
            <div className="mb-3 flex items-center justify-between gap-3"><span className="flex items-center gap-2 font-semibold admin-text-body"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: tier.color }} />{tier.code} · {tier.name}</span><span className="text-xs admin-text-muted">{seats.length} ghế</span></div>
            <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
              {seats.map((seat) => <button key={seat.id} type="button" onClick={() => { setTool('select'); setSelectedSeatIds([seat.id]) }} className={`rounded border px-2 py-1 text-xs ${selectedSeatIds.includes(seat.id) ? 'border-sky-400 bg-sky-500/20 text-sky-100' : 'admin-border admin-text-muted'}`}>{seat.label}</button>)}
            </div>
          </div>)}
        </CardContent>
      </Card>
    </div>
  )
}
