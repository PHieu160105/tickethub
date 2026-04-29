import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { adminApi, extractApiErrorMessage } from '@/lib/api'
import type { EventCard, EventStatus, SeatZone } from '@/types'
import { Calendar, Clock, Edit, Filter, MapPin, Search, Trash2, Users, LayoutGrid, Palette, Plus, Check, Loader2, Wand2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Listbox } from '@headlessui/react';

interface EventFormState {
  title: string
  description: string
  category: string
  venue: string
  start_at: string
  end_at: string
  status: EventStatus
  queue_enabled: boolean
  hold_minutes: string
  queue_release_batch: string
  max_active_queue_tokens: string
  zone_code: string
  zone_name: string
  row_count: string
  seats_per_row: string
  zone_price: string
  zone_color: string
  cover_image_url: string
  image_file: File | null
}

const INITIAL_FORM: EventFormState = {
  title: '',
  description: '',
  category: '',
  venue: '',
  start_at: '',
  end_at: '',
  status: 'live',
  queue_enabled: true,
  hold_minutes: '10',
  queue_release_batch: '50',
  max_active_queue_tokens: '200',
  zone_code: 'A',
  zone_name: 'Standard',
  row_count: '10',
  seats_per_row: '20',
  zone_price: '500000',
  zone_color: '#024ddf',
  cover_image_url: '',
  image_file: null,
}

function toDatetimeLocal(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const timezoneOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

function statusBadge(status: EventStatus) {
  const variants: Record<EventStatus, { text: string; className: string }> = {
    draft: { text: 'Draft', className: 'bg-gray-500/20 text-gray-300' },
    live: { text: 'Live', className: 'bg-green-500/20 text-green-300' },
    closed: { text: 'Closed', className: 'bg-red-500/20 text-red-300' },
  }
  const { text, className } = variants[status]
  return <Badge className={className}>{text}</Badge>
}

type Status = {
  value: string;
  label: string;
};

interface StatusSelectProps {
  statusFilter: 'all' | EventStatus;
  setStatusFilter: React.Dispatch<React.SetStateAction<'all' | EventStatus>>;
}

function StatusSelect({ statusFilter, setStatusFilter }: StatusSelectProps) {
  const statuses: Status[] = [
    { value: 'all', label: 'Tất cả status' },
    { value: 'draft', label: 'Draft' },
    { value: 'live', label: 'Live' },
    { value: 'closed', label: 'Closed' },
  ];

  return (
    <Listbox value={statusFilter} onChange={(value) => setStatusFilter(value)}>
      <div className="relative">
        <Listbox.Button className="w-48 px-3 py-2 bg-space-800 text-white border border-gray-600 rounded-md shadow-sm text-left">
          {statuses.find((r) => r.value === statusFilter)?.label}
        </Listbox.Button>
        <Listbox.Options className="absolute z-50 mt-1 w-48 bg-space-900 text-white border border-white/20 rounded-md shadow-lg">
          {statuses.map((status) => (
            <Listbox.Option
              key={status.value}
              value={status.value}
              className="px-3 py-2 cursor-pointer hover:bg-space-700"
            >
              {status.label}
            </Listbox.Option>
          ))}
        </Listbox.Options>
      </div>
    </Listbox>
  );
}


export default function AdminEvents() {
  const navigate = useNavigate()
  // Existing Event States
  const [events, setEvents] = useState<EventCard[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | EventStatus>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EventCard | null>(null)
  const [form, setForm] = useState(INITIAL_FORM)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  // NEW: Zone Management States
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false)
  const [currentEventSlug, setCurrentEventSlug] = useState<string | null>(null)
  const [zones, setZones] = useState<SeatZone[]>([])
  const [zoneLoading, setZoneLoading] = useState(false)
  const [zoneError, setZoneError] = useState<string | null>(null)
  const [editingZoneId, setEditingZoneId] = useState<number | null>(null)
  const [zoneForm, setZoneForm] = useState({
    code: '',
    name: '',
    row_count: 10,
    seats_per_row: 20,
    price: 500000,
    color: '#024ddf'
  })

  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        const matchesSearch =
          event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          event.venue.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesStatus = statusFilter === 'all' || event.status === statusFilter
        return matchesSearch && matchesStatus
      }),
    [events, searchTerm, statusFilter]
  )

  async function loadEvents() {
    setLoading(true)
    setError(null)
    try {
      const response = await adminApi.listEvents()
      setEvents(response)
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể tải danh sách sự kiện.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadEvents()
  }, [])

  // Event CRUD Handlers
  function openCreateModal() {
    setEditingEvent(null)
    setForm(INITIAL_FORM)
    setFormError(null)
    setIsModalOpen(true)
  }

  function openEditModal(event: EventCard) {
    setEditingEvent(event)
    setFormError(null)
    setForm({
      ...form,
      title: event.title,
      description: event.description,
      category: event.category,
      venue: event.venue,
      start_at: toDatetimeLocal(event.start_at),
      end_at: toDatetimeLocal(event.end_at),
      status: event.status,
      queue_enabled: event.queue_enabled,
      cover_image_url: event.cover_image_url || '',
    })
    setIsModalOpen(true)
  }

  async function handleDeleteEvent(eventKey: string) {
    const accepted = window.confirm('Bạn có chắc chắn muốn xóa sự kiện này?')
    if (!accepted) return
    try {
      await adminApi.deleteEvent(eventKey)
      setEvents((previous) => previous.filter((event) => event.slug !== eventKey))
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể xóa sự kiện.'))
    }
  }

  async function handleSubmit() {
    if (!form.title || !form.description || !form.category || !form.venue || !form.start_at || !form.end_at) {
      setFormError('Vui lòng nhập đầy đủ thông tin bắt buộc.')
      return
    }
    setSaving(true)
    setFormError(null)

    try {
      let coverImageUrl = form.cover_image_url
      if (form.image_file) {
        const uploadResponse = await adminApi.uploadEventImage(form.image_file)
        coverImageUrl = uploadResponse.image_url
      }

      const basePayload: Record<string, unknown> = {
        title: form.title,
        description: form.description,
        category: form.category,
        venue: form.venue,
        start_at: new Date(form.start_at).toISOString(),
        end_at: new Date(form.end_at).toISOString(),
        status: form.status,
        queue_enabled: form.queue_enabled,
        hold_minutes: Number(form.hold_minutes),
        queue_release_batch: Number(form.queue_release_batch),
        max_active_queue_tokens: Number(form.max_active_queue_tokens),
      }

      if (coverImageUrl) basePayload.cover_image_url = coverImageUrl

      if (editingEvent) {
        const updated = await adminApi.updateEvent(editingEvent.slug, basePayload)
        setEvents((previous) => previous.map((event) => (event.id === updated.id ? updated : event)))
      } else {
        const created = await adminApi.createEvent({
          ...basePayload,
          zones: [
            {
              code: form.zone_code,
              name: form.zone_name,
              row_count: Number(form.row_count),
              seats_per_row: Number(form.seats_per_row),
              price: Number(form.zone_price),
              color: form.zone_color,
            },
          ],
        })
        setEvents((previous) => [created, ...previous])
      }

      setFormError(null)
      setIsModalOpen(false)
    } catch (errorValue) {
      setFormError(extractApiErrorMessage(errorValue, 'Không thể lưu sự kiện.'))
    } finally {
      setSaving(false)
    }
  }

  // NEW: Zone Handlers
  async function openZoneModal(slug: string) {
    setCurrentEventSlug(slug)
    setIsZoneModalOpen(true)
    await fetchZones(slug)
  }

  async function fetchZones(slug: string) {
    setZoneLoading(true)
    setZoneError(null)
    try {
      // ⚠️ Thay thế bằng API thực tế của bạn
      const response = await adminApi.getZones?.(slug) ?? []
      setZones(Array.isArray(response) ? response : [])
    } catch (e) {
      setZoneError(extractApiErrorMessage(e, 'Không thể tải danh sách zone.'))
    } finally {
      setZoneLoading(false)
    }
  }

  function resetZoneForm() {
    setEditingZoneId(null)
    setZoneForm({ code: '', name: '', row_count: 10, seats_per_row: 20, price: 500000, color: '#024ddf' })
  }

  function handleEditZone(zone: SeatZone) {
    setEditingZoneId(zone.id)
    setZoneForm({
      code: zone.code,
      name: zone.name,
      row_count: zone.row_count,
      seats_per_row: zone.seats_per_row,
      price: zone.price,
      color: zone.color
    })
  }

  async function handleZoneSubmit() {
    if (!currentEventSlug) return
    setZoneLoading(true)
    setZoneError(null)
    try {
      if (editingZoneId) {
        await adminApi.updateZone?.(currentEventSlug, editingZoneId, zoneForm)
      } else {
        await adminApi.createZone?.(currentEventSlug, zoneForm)
      }
      resetZoneForm()
      await fetchZones(currentEventSlug)
    } catch (e) {
      setZoneError(extractApiErrorMessage(e, 'Lỗi khi lưu zone.'))
    } finally {
      setZoneLoading(false)
    }
  }

  async function handleDeleteZone(zoneId: number) {
    if (!currentEventSlug || !window.confirm('Bạn có chắc muốn xóa zone này?')) return
    try {
      await adminApi.deleteZone?.(currentEventSlug, zoneId)
      await fetchZones(currentEventSlug)
    } catch (e) {
      setZoneError(extractApiErrorMessage(e, 'Lỗi khi xóa zone.'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Quản lý sự kiện</h1>
        <Button
          className="py-4 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary-container font-headline font-bold uppercase tracking-widest text-sm glow-button hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 group/btn"
          variant="primary" onClick={openCreateModal}>
          <Plus className="mr-2 h-4 w-4" /> Tạo sự kiện
        </Button>
      </div>

      {error && (
        <Card className="border-red-500/30 bg-red-500/10">
          <CardContent className="pt-6 text-sm text-red-200">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Tìm theo tên sự kiện hoặc địa điểm..."
                className="pl-10"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <div className="relative">
                <StatusSelect statusFilter={statusFilter} setStatusFilter={setStatusFilter} />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                  <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="pt-6 text-sm text-gray-300">Đang tải sự kiện...</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredEvents.map((event) => {
            const startDate = new Date(event.start_at)
            const endDate = new Date(event.end_at)
            return (
              <Card
                key={event.id}
                className="group hover:border-brand-red/30 transition-all bg-space-900/90"
                style={
                  event.cover_image_url
                    ? {
                      backgroundImage: `linear-gradient(180deg, rgba(3,7,18,0.72) 0%, rgba(3,7,18,0.88) 60%, rgba(3,7,18,0.94) 100%), url(${event.cover_image_url})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }
                    : undefined
                }
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{event.title}</CardTitle>
                      <p className="text-sm text-gray-400 mt-1 line-clamp-2">{event.description}</p>
                    </div>
                    {statusBadge(event.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-gray-200 col-span-2">
                      <Calendar className="h-4 w-4 text-brand-red" />
                      <span>
                        {startDate.toLocaleString('vi-VN')} - {endDate.toLocaleString('vi-VN')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-200 col-span-2">
                      <MapPin className="h-4 w-4 text-green-400" />
                      <span className="truncate">{event.venue}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-200 col-span-2">
                      <Users className="h-4 w-4 text-cyan-400" />
                      <span>Queue: {event.queue_enabled ? 'enabled' : 'disabled'}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" size="sm">{event.category}</Badge>
                    <Badge variant="default" size="sm">/{event.slug}</Badge>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    {/* ✅ Đã sửa nút Zone để mở đúng modal quản lý zone */}
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/events/${event.slug}/seating`)}>
                      <Wand2 className="h-4 w-4" /> Seat Planner
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openZoneModal(event.slug)}>
                      <LayoutGrid className="h-4 w-4" /> Zone
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEditModal(event)}>
                      <Edit className="h-4 w-4" /> Sửa
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300"
                      onClick={() => void handleDeleteEvent(event.slug)}
                    >
                      <Trash2 className="h-4 w-4" /> Xóa
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {!loading && filteredEvents.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">Không tìm thấy sự kiện phù hợp.</CardContent>
        </Card>
      )}

      {/* Event Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setFormError(null)
          setIsModalOpen(false)
        }}
        title={editingEvent ? 'Cập nhật sự kiện' : 'Tạo sự kiện mới'}
        className="max-w-2xl"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {formError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-200">
              {formError}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Tên sự kiện</label>
            <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Mô tả</label>
            <textarea className="w-full rounded-lg border bg-space-700/50 border-white/20 px-4 py-2.5 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
              <Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Venue</label>
              <Input value={form.venue} onChange={(event) => setForm({ ...form, venue: event.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Start at</label>
              <Input type="datetime-local" value={form.start_at} onChange={(event) => setForm({ ...form, start_at: event.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">End at</label>
              <Input type="datetime-local" value={form.end_at} onChange={(event) => setForm({ ...form, end_at: event.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
              <select className="w-full rounded-lg border bg-space-700/50 border-white/20 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-red" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as EventStatus })}>
                <option value="draft">Draft</option>
                <option value="live">Live</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Queue</label>
              <select className="w-full rounded-lg border bg-space-700/50 border-white/20 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-red" value={form.queue_enabled ? 'true' : 'false'} onChange={(event) => setForm({ ...form, queue_enabled: event.target.value === 'true' })}>
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>
          </div>
          <div className="pt-3 border-t border-white/10">
            <p className="text-sm text-gray-300 mb-3">Theme / Cover Image</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Upload image from device</label>
                <input type="file" accept="image/*" onChange={(event) => {
                  const file = event.target.files?.[0] || null
                  setForm({ ...form, image_file: file })
                  if (file) {
                    const reader = new FileReader()
                    reader.onload = (e) => setForm((prev) => ({ ...prev, cover_image_url: e.target?.result as string }))
                    reader.readAsDataURL(file)
                  } else {
                    setForm({ ...form, cover_image_url: '' })
                  }
                }} className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-red file:text-white hover:file:bg-brand-red/90" />
              </div>
              {form.cover_image_url && (
                <div className="mt-2">
                  <p className="text-sm text-gray-400 mb-2">Preview:</p>
                  <img src={form.cover_image_url} alt="Cover preview" className="w-full max-h-48 object-cover rounded-lg border border-white/20" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Hold (min)</label>
              <Input type="number" min={1} value={form.hold_minutes} onChange={(event) => setForm({ ...form, hold_minutes: event.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Release batch</label>
              <Input type="number" min={1} value={form.queue_release_batch} onChange={(event) => setForm({ ...form, queue_release_batch: event.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Max queue</label>
              <Input type="number" min={1} value={form.max_active_queue_tokens} onChange={(event) => setForm({ ...form, max_active_queue_tokens: event.target.value })} />
            </div>
          </div>
          {!editingEvent && (
            <>
              <div className="pt-3 border-t border-white/10">
                <p className="text-sm text-gray-300 mb-3">Zone khởi tạo (bắt buộc khi tạo mới)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-300 mb-2">Zone code</label><Input value={form.zone_code} onChange={(event) => setForm({ ...form, zone_code: event.target.value })} /></div>
                  <div><label className="block text-sm font-medium text-gray-300 mb-2">Zone name</label><Input value={form.zone_name} onChange={(event) => setForm({ ...form, zone_name: event.target.value })} /></div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div><label className="block text-sm font-medium text-gray-300 mb-2">Rows</label><Input type="number" min={1} value={form.row_count} onChange={(event) => setForm({ ...form, row_count: event.target.value })} /></div>
                  <div><label className="block text-sm font-medium text-gray-300 mb-2">Seats/row</label><Input type="number" min={1} value={form.seats_per_row} onChange={(event) => setForm({ ...form, seats_per_row: event.target.value })} /></div>
                  <div><label className="block text-sm font-medium text-gray-300 mb-2">Price</label><Input type="number" min={1} value={form.zone_price} onChange={(event) => setForm({ ...form, zone_price: event.target.value })} /></div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Zone color</label>
                  <Input value={form.zone_color} onChange={(event) => setForm({ ...form, zone_color: event.target.value })} />
                </div>
              </div>
            </>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                setFormError(null)
                setIsModalOpen(false)
              }}
            >
              Hủy
            </Button>
            <Button variant="primary" onClick={() => void handleSubmit()} isLoading={saving}>{editingEvent ? 'Cập nhật' : 'Tạo mới'}</Button>
          </div>
        </div>
      </Modal>

      {/* ✅ NEW: Zone Management Modal */}
      <Modal isOpen={isZoneModalOpen} onClose={() => setIsZoneModalOpen(false)} title={`Quản lý Zone - ${currentEventSlug}`} className="max-w-3xl">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {zoneError && (
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-sm text-red-200">{zoneError}</div>
          )}

          {/* Zone List */}
          <div className="space-y-3">
            {zoneLoading ? (
              <div className="flex items-center justify-center py-4 text-gray-400"><Loader2 className="animate-spin mr-2" /> Đang tải zones...</div>
            ) : zones.length === 0 ? (
              <div className="text-center py-4 text-gray-400 text-sm">Chưa có zone nào. Hãy thêm zone mới bên dưới.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {zones.map((zone) => (
                  <div key={zone.id} className="p-3 rounded-lg bg-space-800/50 border border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded border border-white/20 flex-shrink-0" style={{ backgroundColor: zone.color }} />
                      <div>
                        <p className="text-sm font-medium text-white">{zone.name} <span className="text-gray-500 text-xs">({zone.code})</span></p>
                        <p className="text-xs text-gray-400">{zone.row_count} hàng x {zone.seats_per_row} ghế | {zone.price.toLocaleString('vi-VN')}đ</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleEditZone(zone)} className="p-1.5 rounded hover:bg-white/10 text-blue-400 transition" title="Sửa"><Edit className="h-4 w-4" /></button>
                      <button onClick={() => handleDeleteZone(zone.id)} className="p-1.5 rounded hover:bg-white/10 text-red-400 transition" title="Xóa"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/10">
            <p className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <Palette className="h-4 w-4" /> {editingZoneId ? 'Chỉnh sửa Zone' : 'Thêm Zone mới'}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Zone Code</label>
                <Input value={zoneForm.code} onChange={(e) => setZoneForm({ ...zoneForm, code: e.target.value })} placeholder="VD: A, B, VIP" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Zone Name</label>
                <Input value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} placeholder="VD: Standard, VIP" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Rows</label>
                <Input type="number" min={1} value={zoneForm.row_count} onChange={(e) => setZoneForm({ ...zoneForm, row_count: Number(e.target.value) })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Seats/Row</label>
                <Input type="number" min={1} value={zoneForm.seats_per_row} onChange={(e) => setZoneForm({ ...zoneForm, seats_per_row: Number(e.target.value) })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Price</label>
                <Input type="number" min={0} value={zoneForm.price} onChange={(e) => setZoneForm({ ...zoneForm, price: Number(e.target.value) })} />
              </div>
            </div>

            {/* ✅ Visual Color Picker */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Zone Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={zoneForm.color || '#000000'}
                  onChange={(e) => setZoneForm({ ...zoneForm, color: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent p-0"
                  title="Chọn màu trực tiếp"
                />
                <Input
                  value={zoneForm.color}
                  onChange={(e) => setZoneForm({ ...zoneForm, color: e.target.value })}
                  placeholder="#024ddf"
                  className="flex-1"
                />
                <div
                  className="w-8 h-8 rounded border border-white/20 shadow-inner transition-colors"
                  style={{ backgroundColor: zoneForm.color || '#000000' }}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
            {editingZoneId && (
              <Button variant="ghost" onClick={resetZoneForm}>Hủy chỉnh sửa</Button>
            )}
            <Button variant="primary" onClick={handleZoneSubmit} isLoading={zoneLoading}>
              {editingZoneId ? <><Check className="mr-2 h-4 w-4" /> Cập nhật</> : <><Plus className="mr-2 h-4 w-4" /> Thêm Zone</>}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}






