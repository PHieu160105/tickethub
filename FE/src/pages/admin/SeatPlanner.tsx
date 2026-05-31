import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { Layers3, Plus, RefreshCw, Save, Trash2 } from 'lucide-react'
import { useParams } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { GlobalLoader } from '@/components/ui/GlobalLoader'
import { Input } from '@/components/ui/Input'
import { adminApi, eventApi, extractApiErrorMessage, seatmapApi } from '@/lib/api'
import type { SeatMapResponse, TicketTier } from '@/types'

const EMPTY_TIER = { code: '', name: '', description: '', base_price: '0', color: '#ef4444', is_active: true }
const EMPTY_SEAT = { seat_label: '', x: '50', y: '50', ticket_tier_id: '', price: '', is_admin_locked: false }
const EMPTY_BULK = { ticket_tier_id: '', pattern: 'straight' as 'straight' | 'arc', rows: '4', cols: '8', gap_x: '4', gap_y: '4', start_x: '20', start_y: '20', label_prefix: 'A' }

function tierForm(tier: TicketTier) {
  return { code: tier.code, name: tier.name, description: tier.description ?? '', base_price: String(tier.base_price), color: tier.color, is_active: tier.is_active }
}

export default function AdminSeatPlanner() {
  const { eventKey = '', showId: rawShowId = '' } = useParams<{ eventKey: string; showId: string }>()
  const showId = Number(rawShowId)
  const [seatMap, setSeatMap] = useState<SeatMapResponse | null>(null)
  const [tiers, setTiers] = useState<TicketTier[]>([])
  const [tierEditor, setTierEditor] = useState(EMPTY_TIER)
  const [seatEditor, setSeatEditor] = useState(EMPTY_SEAT)
  const [bulkEditor, setBulkEditor] = useState(EMPTY_BULK)
  const [editingTierId, setEditingTierId] = useState<number | null>(null)
  const [editingSeatId, setEditingSeatId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const tierMap = useMemo(() => new Map(tiers.map((tier) => [tier.id, tier])), [tiers])
  const canvasAspectRatio = seatMap?.background?.width && seatMap.background.height
    ? `${seatMap.background.width} / ${seatMap.background.height}`
    : '5 / 3'

  async function loadPlanner() {
    if (!eventKey || !showId) return
    setLoading(true)
    setError(null)
    try {
      const [, nextSeatMap, nextTiers] = await Promise.all([
        eventApi.show(showId),
        seatmapApi.get(showId),
        adminApi.getShowTicketTiers(eventKey, showId),
      ])
      setSeatMap(nextSeatMap)
      setTiers(nextTiers)
      if (!seatEditor.ticket_tier_id && nextTiers[0]) {
        setSeatEditor((current) => ({ ...current, ticket_tier_id: String(nextTiers[0].id) }))
        setBulkEditor((current) => ({ ...current, ticket_tier_id: String(nextTiers[0].id) }))
      }
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

  async function saveTier() {
    if (!tierEditor.code.trim() || !tierEditor.name.trim()) return
    setBusy(true)
    try {
      const payload = { ...tierEditor, code: tierEditor.code.trim(), name: tierEditor.name.trim(), description: tierEditor.description.trim() || null, base_price: Number(tierEditor.base_price) }
      const saved = editingTierId
        ? await adminApi.updateTicketTier(eventKey, showId, editingTierId, payload)
        : await adminApi.createTicketTier(eventKey, showId, payload)
      setMessage(editingTierId ? 'Đã cập nhật hạng vé.' : 'Đã tạo hạng vé.')
      setEditingTierId(saved.id)
      setTierEditor(tierForm(saved))
      await loadPlanner()
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể lưu hạng vé. Chỉ có thể sửa khi buổi diễn ở trạng thái nháp.'))
    } finally {
      setBusy(false)
    }
  }

  async function deleteTier(tierId: number) {
    if (!window.confirm('Xóa hạng vé này?')) return
    try {
      await adminApi.deleteTicketTier(eventKey, showId, tierId)
      if (editingTierId === tierId) {
        setEditingTierId(null)
        setTierEditor(EMPTY_TIER)
      }
      await loadPlanner()
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể xóa hạng vé.'))
    }
  }

  function canvasCoordinates(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
    }
  }

  async function saveSeat() {
    if (!seatEditor.seat_label.trim()) return
    setBusy(true)
    try {
      const payload = {
        seat_label: seatEditor.seat_label.trim(),
        x: Number(seatEditor.x),
        y: Number(seatEditor.y),
        ticket_tier_id: seatEditor.ticket_tier_id ? Number(seatEditor.ticket_tier_id) : null,
        price: seatEditor.price ? Number(seatEditor.price) : null,
        is_admin_locked: seatEditor.is_admin_locked,
      }
      if (editingSeatId) await adminApi.updateEventSeat(eventKey, showId, editingSeatId, payload)
      else await adminApi.createEventSeatSingle(eventKey, showId, payload)
      setEditingSeatId(null)
      setSeatEditor({ ...EMPTY_SEAT, ticket_tier_id: seatEditor.ticket_tier_id })
      setMessage('Đã lưu ghế của buổi diễn.')
      await loadPlanner()
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể lưu ghế. Chỉ có thể sửa khi buổi diễn ở trạng thái nháp.'))
    } finally {
      setBusy(false)
    }
  }

  async function createBulkSeats() {
    setBusy(true)
    try {
      await adminApi.createEventSeatBulk(eventKey, showId, {
        ticket_tier_id: bulkEditor.ticket_tier_id ? Number(bulkEditor.ticket_tier_id) : null,
        pattern: bulkEditor.pattern,
        rows: Number(bulkEditor.rows),
        cols: Number(bulkEditor.cols),
        gap_x: Number(bulkEditor.gap_x),
        gap_y: Number(bulkEditor.gap_y),
        start_x: Number(bulkEditor.start_x),
        start_y: Number(bulkEditor.start_y),
        label_prefix: bulkEditor.label_prefix,
      })
      setMessage('Đã tạo cụm ghế.')
      await loadPlanner()
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể tạo cụm ghế.'))
    } finally {
      setBusy(false)
    }
  }

  async function deleteSeat(seatId: number) {
    if (!window.confirm('Xóa ghế này?')) return
    try {
      await adminApi.deleteEventSeat(eventKey, showId, seatId)
      await loadPlanner()
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể xóa ghế sinh từ bố cục. Bạn vẫn có thể đổi hạng vé hoặc khóa ghế.'))
    }
  }

  if (loading) return <GlobalLoader />
  if (!seatMap) return <div className="text-sm text-red-300">Không tìm thấy sơ đồ ghế.</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] admin-text-muted">Buổi diễn #{showId}</p>
          <h2 className="font-display text-3xl font-bold admin-text-header">Trình dựng sơ đồ</h2>
          <p className="mt-1 text-sm admin-text-muted">Hạng vé là phân loại bán vé, không phải khu vực vật lý trên canvas.</p>
        </div>
        <Button variant="outline" onClick={() => void loadPlanner()}><RefreshCw className="h-4 w-4" /> Làm mới</Button>
      </div>
      {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
      {message ? <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.4fr_0.85fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Layers3 className="h-5 w-5" /> Hạng vé</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Mã hạng vé" value={tierEditor.code} onChange={(event) => setTierEditor({ ...tierEditor, code: event.target.value })} />
            <Input placeholder="Tên hạng vé" value={tierEditor.name} onChange={(event) => setTierEditor({ ...tierEditor, name: event.target.value })} />
            <Input placeholder="Mô tả" value={tierEditor.description} onChange={(event) => setTierEditor({ ...tierEditor, description: event.target.value })} />
            <Input type="number" placeholder="Giá cơ bản" value={tierEditor.base_price} onChange={(event) => setTierEditor({ ...tierEditor, base_price: event.target.value })} />
            <div className="flex gap-2"><Input type="color" value={tierEditor.color} onChange={(event) => setTierEditor({ ...tierEditor, color: event.target.value })} /><Input value={tierEditor.color} onChange={(event) => setTierEditor({ ...tierEditor, color: event.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm admin-text-body"><input type="checkbox" checked={tierEditor.is_active} onChange={(event) => setTierEditor({ ...tierEditor, is_active: event.target.checked })} /> Đang mở bán</label>
            <div className="flex gap-2"><Button onClick={() => void saveTier()} isLoading={busy}><Save className="h-4 w-4" /> Lưu</Button><Button variant="outline" onClick={() => { setEditingTierId(null); setTierEditor(EMPTY_TIER) }}>Tạo mới</Button></div>
            <div className="space-y-2 border-t border-white/10 pt-3">
              {tiers.map((tier) => <div key={tier.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2"><button type="button" className="flex flex-1 items-center gap-2 text-left" onClick={() => { setEditingTierId(tier.id); setTierEditor(tierForm(tier)); setSeatEditor({ ...seatEditor, ticket_tier_id: String(tier.id) }); setBulkEditor({ ...bulkEditor, ticket_tier_id: String(tier.id) }) }}><span className="h-3 w-3 rounded-full" style={{ backgroundColor: tier.color }} /><span><span className="block font-semibold admin-text-body">{tier.name}</span><span className="text-xs admin-text-muted">{tier.code} · {Number(tier.base_price).toLocaleString('vi-VN')} đ</span></span></button><Button size="icon" variant="danger" onClick={() => void deleteTier(tier.id)}><Trash2 className="h-4 w-4" /></Button></div>)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Canvas ghế</CardTitle></CardHeader>
          <CardContent>
            <div onClick={(event) => { const point = canvasCoordinates(event); setSeatEditor({ ...seatEditor, x: point.x.toFixed(2), y: point.y.toFixed(2) }) }} className="relative overflow-hidden rounded-lg border border-slate-300 bg-white" style={{ aspectRatio: canvasAspectRatio, backgroundImage: 'linear-gradient(to right, rgba(148,163,184,.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,.25) 1px, transparent 1px)', backgroundSize: '10% 10%' }}>
              {seatMap.background?.source ? <img src={seatMap.background.source} alt="Ảnh nền canvas" className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-80" /> : null}
              {seatMap.seats.map((seat) => {
                const tier = tierMap.get(seat.ticket_tier_id ?? -1)
                return <button key={seat.id} type="button" title={`${seat.label} · ${seat.ticket_tier_name ?? 'Chưa phân hạng'}`} onClick={(event) => { event.stopPropagation(); setEditingSeatId(seat.id); setSeatEditor({ seat_label: seat.label, x: String(seat.x ?? 50), y: String(seat.y ?? 50), ticket_tier_id: seat.ticket_tier_id ? String(seat.ticket_tier_id) : '', price: String(seat.price), is_admin_locked: seat.is_admin_locked }) }} className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow" style={{ left: `${seat.x ?? 0}%`, top: `${seat.y ?? 0}%`, backgroundColor: seat.is_admin_locked ? '#be123c' : tier?.color ?? '#334155' }} />
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Ghế của buổi diễn</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Nhãn ghế" value={seatEditor.seat_label} onChange={(event) => setSeatEditor({ ...seatEditor, seat_label: event.target.value })} />
            <select className="h-11 w-full rounded-lg border admin-border admin-bg-listbox px-3 admin-text-body" value={seatEditor.ticket_tier_id} onChange={(event) => setSeatEditor({ ...seatEditor, ticket_tier_id: event.target.value })}><option value="">Chưa phân hạng</option>{tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.code} · {tier.name}</option>)}</select>
            <div className="grid grid-cols-2 gap-2"><Input type="number" value={seatEditor.x} onChange={(event) => setSeatEditor({ ...seatEditor, x: event.target.value })} /><Input type="number" value={seatEditor.y} onChange={(event) => setSeatEditor({ ...seatEditor, y: event.target.value })} /></div>
            <Input type="number" placeholder="Giá riêng, để trống dùng giá hạng vé" value={seatEditor.price} onChange={(event) => setSeatEditor({ ...seatEditor, price: event.target.value })} />
            <label className="flex items-center gap-2 text-sm admin-text-body"><input type="checkbox" checked={seatEditor.is_admin_locked} onChange={(event) => setSeatEditor({ ...seatEditor, is_admin_locked: event.target.checked })} /> Khóa ghế</label>
            <div className="flex gap-2"><Button onClick={() => void saveSeat()} isLoading={busy}><Save className="h-4 w-4" /> Lưu ghế</Button>{editingSeatId ? <Button variant="danger" onClick={() => void deleteSeat(editingSeatId)}><Trash2 className="h-4 w-4" /></Button> : null}</div>
            <div className="space-y-3 border-t border-white/10 pt-4">
              <p className="font-semibold admin-text-body">Tạo cụm ghế</p>
              <select className="h-11 w-full rounded-lg border admin-border admin-bg-listbox px-3 admin-text-body" value={bulkEditor.ticket_tier_id} onChange={(event) => setBulkEditor({ ...bulkEditor, ticket_tier_id: event.target.value })}><option value="">Hạng vé mặc định</option>{tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.code} · {tier.name}</option>)}</select>
              <div className="grid grid-cols-2 gap-2"><Input value={bulkEditor.rows} onChange={(event) => setBulkEditor({ ...bulkEditor, rows: event.target.value })} placeholder="Số hàng" /><Input value={bulkEditor.cols} onChange={(event) => setBulkEditor({ ...bulkEditor, cols: event.target.value })} placeholder="Số cột" /><Input value={bulkEditor.start_x} onChange={(event) => setBulkEditor({ ...bulkEditor, start_x: event.target.value })} placeholder="X bắt đầu" /><Input value={bulkEditor.start_y} onChange={(event) => setBulkEditor({ ...bulkEditor, start_y: event.target.value })} placeholder="Y bắt đầu" /><Input value={bulkEditor.gap_x} onChange={(event) => setBulkEditor({ ...bulkEditor, gap_x: event.target.value })} placeholder="Khoảng X" /><Input value={bulkEditor.gap_y} onChange={(event) => setBulkEditor({ ...bulkEditor, gap_y: event.target.value })} placeholder="Khoảng Y" /></div>
              <Input value={bulkEditor.label_prefix} onChange={(event) => setBulkEditor({ ...bulkEditor, label_prefix: event.target.value })} placeholder="Tiền tố nhãn" />
              <Button variant="outline" onClick={() => void createBulkSeats()}><Plus className="h-4 w-4" /> Tạo cụm</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
