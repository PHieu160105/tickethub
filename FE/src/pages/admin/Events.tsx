import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Edit, MapPin, Plus, Search, Ticket, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { ShowPerformersModal } from '@/components/admin/ShowPerformersModal'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { GlobalLoader } from '@/components/ui/GlobalLoader'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { adminApi, extractApiErrorMessage } from '@/lib/api'
import type { EventCard, EventDetail, EventStatus, SeatSource, ShowSummary, VenueLayoutItem, VenueSummary } from '@/types'

interface EventFormState {
  title: string
  description: string
  category: string
  start_date: string
  end_date: string
  status: EventStatus
  cover_image_url: string
  image_file: File | null
}

interface ShowFormState {
  title: string
  description: string
  location: string
  show_date: string
  start_time: string
  end_time: string
  status: EventStatus
  hold_minutes: string
  seat_source: SeatSource
  create_seed_zone: boolean
  venue_id: string
  venue_layout_id: string
  zone_code: string
  zone_name: string
  row_count: string
  seats_per_row: string
  zone_price: string
  zone_color: string
}

const EVENT_CATEGORY_OPTIONS = [
  { value: 'MUSIC', label: 'Âm nhạc' },
  { value: 'THEATER', label: 'Kịch' },
  { value: 'DANCE', label: 'Vũ đạo' },
  { value: 'TRADITIONAL', label: 'Truyền thống' },
  { value: 'COMEDY', label: 'Hài' },
  { value: 'CIRCUS', label: 'Xiếc' },
  { value: 'OTHER', label: 'Khác' },
] as const

const INITIAL_EVENT_FORM: EventFormState = {
  title: '',
  description: '',
  category: '',
  start_date: '',
  end_date: '',
  status: 'LIVE',
  cover_image_url: '',
  image_file: null,
}

const INITIAL_SHOW_FORM: ShowFormState = {
  title: '',
  description: '',
  location: '',
  show_date: '',
  start_time: '19:00',
  end_time: '21:00',
  status: 'DRAFT',

  hold_minutes: '10',
  seat_source: 'FREE_FORM',
  create_seed_zone: false,
  venue_id: '',
  venue_layout_id: '',
  zone_code: 'A',
  zone_name: 'Khu tiêu chuẩn',
  row_count: '10',
  seats_per_row: '20',
  zone_price: '500000',
  zone_color: '#024ddf',
}

const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh'

function statusBadge(status: EventStatus) {
  const variants: Record<EventStatus, { text: string; className: string }> = {
    DRAFT: { text: 'Bản nháp', className: 'bg-gray-500/20 text-gray-300' },
    LIVE: { text: 'Đang mở bán', className: 'bg-green-700/20 text-green-300' },
    CLOSED: { text: 'Đã đóng', className: 'bg-red-500/20 text-red-300' },
  }

  const variant = variants[status]
  return <Badge className={variant.className}>{variant.text}</Badge>
}

function getVietnamDateTimeParts(value: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(date)

  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

function formatUtcDateInput(value: string) {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function formatVietnamDateInput(value: string) {
  const parts = getVietnamDateTimeParts(value)
  if (!parts) return ''
  return `${parts.year}-${parts.month}-${parts.day}`
}

function formatVietnamTimeInput(value: string) {
  const parts = getVietnamDateTimeParts(value)
  if (!parts) return ''
  return `${parts.hour}:${parts.minute}`
}

function vietnamDateTimeInputToUtcParts(dateValue: string, timeValue: string) {
  const instant = new Date(`${dateValue}T${timeValue}:00+07:00`)
  if (Number.isNaN(instant.getTime())) {
    return { date: dateValue, time: timeValue }
  }

  const isoValue = instant.toISOString()
  return {
    date: isoValue.slice(0, 10),
    time: isoValue.slice(11, 16),
  }
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('vi-VN', { timeZone: VIETNAM_TIME_ZONE })
}

export default function AdminEvents() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<EventCard[]>([])
  const [venues, setVenues] = useState<VenueSummary[]>([])
  const [venueLayouts, setVenueLayouts] = useState<VenueLayoutItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | EventStatus>('all')
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [showModalOpen, setShowModalOpen] = useState(false)
  const [performerModalOpen, setPerformerModalOpen] = useState(false)

  const [editingEvent, setEditingEvent] = useState<EventCard | null>(null)
  const [activeEvent, setActiveEvent] = useState<EventDetail | null>(null)
  const [editingShow, setEditingShow] = useState<ShowSummary | null>(null)
  const [performerShow, setPerformerShow] = useState<ShowSummary | null>(null)
  const [eventForm, setEventForm] = useState<EventFormState>(INITIAL_EVENT_FORM)
  const [showForm, setShowForm] = useState<ShowFormState>(INITIAL_SHOW_FORM)

  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        const haystack = `${event.title} ${event.venue} ${event.category}`.toLowerCase()
        const matchesSearch = haystack.includes(searchTerm.toLowerCase())
        const matchesStatus = statusFilter === 'all' || event.status === statusFilter
        return matchesSearch && matchesStatus
      }),
    [events, searchTerm, statusFilter],
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

  async function loadVenues() {
    try {
      const response = await adminApi.listVenues({ limit: 200 })
      setVenues(response)
    } catch {
      setVenues([])
    }
  }

  async function loadEventDetail(eventKey: string) {
    const response = await adminApi.getEvent(eventKey)
    setActiveEvent(response)
    return response
  }

  useEffect(() => {
    void loadEvents()
    void loadVenues()
  }, [])

  function resetEventForm() {
    setEventForm(INITIAL_EVENT_FORM)
    setEditingEvent(null)
    setFormError(null)
  }

  function resetShowForm(eventDetail?: EventDetail | null) {
    setShowForm({
      ...INITIAL_SHOW_FORM,
      show_date: eventDetail ? formatUtcDateInput(eventDetail.start_at) : '',
    })
    setEditingShow(null)
    setVenueLayouts([])
    setFormError(null)
  }

  function openCreateEventModal() {
    resetEventForm()
    setEventModalOpen(true)
  }

  function openEditEventModal(event: EventCard) {
    setEditingEvent(event)
    setFormError(null)
    setEventForm({
      title: event.title,
      description: event.description,
      category: event.category,
      start_date: formatUtcDateInput(event.start_at),
      end_date: formatUtcDateInput(event.end_at),
      status: event.status,
      cover_image_url: event.cover_image_url || '',
      image_file: null,
    })
    setEventModalOpen(true)
  }

  async function openDetailModal(event: EventCard) {
    setError(null)
    try {
      await loadEventDetail(event.slug)
      setDetailModalOpen(true)
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể tải chi tiết sự kiện.'))
    }
  }

  async function handleDeleteEvent(eventItem: EventCard) {
    if (eventItem.status !== 'DRAFT') {
      if (!window.confirm('Sự kiện phải ở trạng thái Draft trước khi xóa. Chuyển sự kiện này về Draft ngay?')) return
      try {
        await adminApi.updateEvent(eventItem.slug, { status: 'DRAFT' })
        await loadEvents()
        if (activeEvent?.slug === eventItem.slug) {
          await loadEventDetail(eventItem.slug)
        }
      } catch (errorValue) {
        setError(extractApiErrorMessage(errorValue, 'Không thể chuyển sự kiện về Draft.'))
      }
      return
    }

    const eventKey = eventItem.slug
    if (!window.confirm('Bạn có chắc muốn xóa sự kiện này?')) return
    try {
      await adminApi.deleteEvent(eventKey)
      setEvents((previous) => previous.filter((event) => event.slug !== eventKey))
      if (activeEvent?.slug === eventKey) {
        setActiveEvent(null)
        setDetailModalOpen(false)
      }
    } catch (errorValue) {
      setError(extractApiErrorMessage(errorValue, 'Không thể xóa sự kiện.'))
    }
  }

  async function handleEventSubmit() {
    if (!eventForm.title || !eventForm.description || !eventForm.category || !eventForm.start_date || !eventForm.end_date) {
      setFormError('Vui lòng nhập đầy đủ thông tin sự kiện.')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      let coverImageUrl = eventForm.cover_image_url
      if (eventForm.image_file) {
        const upload = await adminApi.uploadEventImage(eventForm.image_file)
        coverImageUrl = upload.image_url
      }

      const payload = {
        title: eventForm.title,
        description: eventForm.description,
        category: eventForm.category,
        start_date: eventForm.start_date,
        end_date: eventForm.end_date,
        status: eventForm.status,
        cover_image_url: coverImageUrl,
      }

      if (editingEvent) {
        await adminApi.updateEvent(editingEvent.slug, payload)
      } else {
        await adminApi.createEvent(payload)
      }

      setEventModalOpen(false)
      resetEventForm()
      await loadEvents()
      if (activeEvent && editingEvent?.slug === activeEvent.slug) {
        await loadEventDetail(activeEvent.slug)
      }
    } catch (errorValue) {
      setFormError(extractApiErrorMessage(errorValue, 'Không thể lưu sự kiện.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleVenueChange(venueId: string) {
    setShowForm((previous) => ({
      ...previous,
      venue_id: venueId,
      venue_layout_id: '',
      location: venueId ? venues.find((item) => item.id === Number(venueId))?.name ?? previous.location : previous.location,
    }))

    if (!venueId) {
      setVenueLayouts([])
      return
    }

    try {
      const response = await adminApi.listLayouts(Number(venueId))
      setVenueLayouts(response)
    } catch {
      setVenueLayouts([])
    }
  }

  async function openCreateShowModal() {
    if (!activeEvent) return
    resetShowForm(activeEvent)
    setShowModalOpen(true)
  }

  async function openEditShowModal(show: ShowSummary) {
    if (!activeEvent) return

    if (show.status !== 'DRAFT') {
      if (!window.confirm('Show đang Live. Show sẽ được chuyển về Draft trước khi chỉnh sửa. Tiếp tục?')) return
      try {
        await adminApi.updateShow(activeEvent.slug, show.id, { status: 'DRAFT' })
        await loadEventDetail(activeEvent.slug)
        await loadEvents()
      } catch (errorValue) {
        setFormError(extractApiErrorMessage(errorValue, 'Không thể chuyển show về Draft.'))
        return
      }
    }

    const detail = await adminApi.getShow(activeEvent.slug, show.id)

    setEditingShow(show)
    setFormError(null)
    const nextForm: ShowFormState = {
      ...INITIAL_SHOW_FORM,
      title: detail.title,
      description: detail.description,
      location: detail.location,
      show_date: formatVietnamDateInput(detail.start_at),
      start_time: formatVietnamTimeInput(detail.start_at),
      end_time: formatVietnamTimeInput(detail.end_at),
      status: detail.status,
      seat_source: detail.seat_source,
      create_seed_zone: false,
      venue_id: '',
      venue_layout_id: detail.venue_layout_id ? String(detail.venue_layout_id) : '',
      hold_minutes: String(detail.hold_minutes),
      zone_code: 'A',
      zone_name: 'Khu tiêu chuẩn',
      row_count: '10',
      seats_per_row: '20',
      zone_price: '500000',
      zone_color: '#024ddf',
    }

    setShowForm(nextForm)
    setVenueLayouts([])
    setShowModalOpen(true)
  }

  async function openSeatPlanner(show: ShowSummary) {
    if (!activeEvent) return
    if (show.status !== 'DRAFT') {
      if (!window.confirm('Seat Planner là thao tác chỉnh sửa show. Show sẽ được chuyển về Draft trước khi mở planner. Tiếp tục?')) return
      try {
        await adminApi.updateShow(activeEvent.slug, show.id, { status: 'DRAFT' })
        await loadEventDetail(activeEvent.slug)
        await loadEvents()
      } catch (errorValue) {
        setFormError(extractApiErrorMessage(errorValue, 'Không thể chuyển show về Draft.'))
        return
      }
    }

    navigate(`/admin/events/${activeEvent.slug}/shows/${show.id}/seating`)
  }

  function openPerformerModal(show: ShowSummary) {
    setPerformerShow(show)
    setPerformerModalOpen(true)
  }

  async function handleDeleteShow(show: ShowSummary) {
    if (!activeEvent) return
    if (show.status !== 'DRAFT') {
      if (!window.confirm(`Show "${show.title}" phải ở trạng thái Draft trước khi xóa. Chuyển về Draft ngay?`)) return
      try {
        await adminApi.updateShow(activeEvent.slug, show.id, { status: 'DRAFT' })
        await loadEventDetail(activeEvent.slug)
        await loadEvents()
      } catch (errorValue) {
        setFormError(extractApiErrorMessage(errorValue, 'Không thể chuyển show về Draft.'))
      }
      return
    }
    if (!window.confirm(`Xóa show "${show.title}"?`)) return
    try {
      await adminApi.deleteShow(activeEvent.slug, show.id)
      await loadEventDetail(activeEvent.slug)
      await loadEvents()
    } catch (errorValue) {
      setFormError(extractApiErrorMessage(errorValue, 'Không thể xóa show.'))
    }
  }

  async function handleShowSubmit() {
    if (!activeEvent) return
    if (!showForm.title || !showForm.description || !showForm.location || !showForm.show_date || !showForm.start_time || !showForm.end_time) {
      setFormError('Vui lòng nhập đầy đủ thông tin show.')
      return
    }
    if (showForm.seat_source === 'LAYOUT' && !editingShow && (!showForm.venue_id || !showForm.venue_layout_id)) {
      setFormError('Vui lòng chọn venue và layout cho show này.')
      return
    }
    if (showForm.seat_source === 'FREE_FORM' && !editingShow && showForm.create_seed_zone && (!showForm.zone_code || !showForm.zone_name)) {
      setFormError('Vui lòng cấu hình zone khởi tạo cho show chọn chỗ tự do.')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      const utcStart = vietnamDateTimeInputToUtcParts(showForm.show_date, showForm.start_time)
      const utcEnd = vietnamDateTimeInputToUtcParts(showForm.show_date, showForm.end_time)
      const payload = {
        title: showForm.title,
        description: showForm.description,
        location: showForm.location,
        show_date: utcStart.date,
        start_time: utcStart.time,
        end_time: utcEnd.time,
        status: showForm.status,
        hold_minutes: Number(showForm.hold_minutes),
        seat_source: showForm.seat_source,
        ...(editingShow
          ? {}
          : showForm.seat_source === 'LAYOUT'
            ? {
                venue_id: Number(showForm.venue_id),
                venue_layout_id: Number(showForm.venue_layout_id),
                zones: [],
              }
            : {
                zones: showForm.create_seed_zone
                  ? [
                      {
                        code: showForm.zone_code,
                        name: showForm.zone_name,
                        row_count: Number(showForm.row_count),
                        seats_per_row: Number(showForm.seats_per_row),
                        price: Number(showForm.zone_price),
                        color: showForm.zone_color,
                        generate_seats: true,
                      },
                    ]
                  : [],
              }),
      }

      if (editingShow) {
        await adminApi.updateShow(activeEvent.slug, editingShow.id, payload)
      } else {
        await adminApi.createShow(activeEvent.slug, payload)
      }

      await loadEventDetail(activeEvent.slug)
      await loadEvents()
      setShowModalOpen(false)
      resetShowForm(activeEvent)
    } catch (errorValue) {
      setFormError(extractApiErrorMessage(errorValue, 'Không thể lưu show.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <GlobalLoader />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold admin-text-header">Quản lý Event / Show</h1>
          <p className="mt-1 text-sm text-gray-400">Event chỉ giữ metadata. Show giữ venue, seat planner và ticket logic.</p>
        </div>
        <Button variant="primary" onClick={openCreateEventModal}>
          <Plus className="mr-2 h-4 w-4" /> Tạo event
        </Button>
      </div>

      {error && (
        <Card className="border-red-500/30 bg-red-500/10">
          <CardContent className="pt-6 text-sm text-red-200">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="pl-10" placeholder="Tìm theo tên event, venue hoặc category..." />
            </div>
            <select
              className="rounded-lg border border-white/10 admin-bg-listbox px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | EventStatus)}
            >
              <option value="all">Tất cả status</option>
              <option value="DRAFT">Bản nháp</option>
              <option value="LIVE">Đang mở bán</option>
              <option value="CLOSED">Đã đóng</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {filteredEvents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">Không có event phù hợp.</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {filteredEvents.map((event) => (
            <Card
              key={event.id}
              className="bg-space-900/90 transition-all hover:border-brand-red/30"
              style={
                event.cover_image_url
                  ? {
                      backgroundImage: `linear-gradient(180deg, rgba(4, 7, 20, 0.4), rgba(4, 7, 20, 0.7)), url(${event.cover_image_url})`,
                      backgroundPosition: 'center',
                      backgroundSize: 'cover',
                    }
                  : undefined
              }
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg text-slate-300">{event.title}</CardTitle>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-300">{event.description}</p>
                  </div>
                  {statusBadge(event.status)}
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-brand-red" />
                    <span>{formatDateTime(event.start_at)} - {formatDateTime(event.end_at)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-emerald-400" />
                    <span className="truncate">{event.venue || 'Chưa có show'}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="warning" size="sm">{event.category}</Badge>
                  <Badge variant="default" size="sm">Mã sự kiện #{event.id}</Badge>
                </div>

                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <Button variant="ghost" size="sm" className="text-slate-200 hover:text-slate-500" onClick={() => void openDetailModal(event)}>
                    <Ticket className="h-4 w-4" /> Chi tiết
                  </Button>
                  <Button variant="ghost" size="sm" className="text-slate-200 hover:text-slate-500" onClick={() => openEditEventModal(event)}>
                    <Edit className="h-4 w-4" /> Sửa event
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => void handleDeleteEvent(event)}>
                    <Trash2 className="h-4 w-4" /> Xóa
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={eventModalOpen}
        onClose={() => {
          setEventModalOpen(false)
          resetEventForm()
        }}
        title={editingEvent ? 'Cập nhật event' : 'Tạo event mới'}
        className="max-w-2xl"
      >
        <div className="space-y-4">
          {formError && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{formError}</div>}

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Tên event</label>
            <Input className="text-white" value={eventForm.title} onChange={(event) => setEventForm((prev) => ({ ...prev, title: event.target.value }))} />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Mô tả</label>
            <textarea
              className="w-full rounded-lg border border-white/20 bg-space-700/50 px-4 py-2.5 text-white"
              rows={4}
              value={eventForm.description}
              onChange={(event) => setEventForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-white">Thể loại</label>
              <select className="w-full rounded-lg border border-white/10 admin-bg-listbox px-3 py-2 text-gray-500" value={eventForm.category} onChange={(event) => setEventForm((prev) => ({ ...prev, category: event.target.value }))}>
                <option value="">Chọn thể loại</option>
                {EVENT_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">Trạng thái</label>
              <select className="w-full rounded-lg border border-white/10 admin-bg-listbox px-3 py-2 text-gray-500" value={eventForm.status} onChange={(event) => setEventForm((prev) => ({ ...prev, status: event.target.value as EventStatus }))}>
                <option value="LIVE">Đang mở bán</option>
                <option value="DRAFT">Bản nháp</option>
                <option value="CLOSED">Đã đóng</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">Ngày bắt đầu</label>
              <Input className="text-white" type="date" value={eventForm.start_date} onChange={(event) => setEventForm((prev) => ({ ...prev, start_date: event.target.value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">Ngày kết thúc</label>
              <Input className="text-white" type="date" value={eventForm.end_date} onChange={(event) => setEventForm((prev) => ({ ...prev, end_date: event.target.value }))} />
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">Ảnh cover</label>
            <input
              type="file"
              accept="image/*"
              className="w-full text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-brand-red file:px-4 file:py-2 file:font-semibold file:text-white"
              onChange={(event) => setEventForm((prev) => ({ ...prev, image_file: event.target.files?.[0] ?? null }))}
            />
            {eventForm.cover_image_url && (
              <img src={eventForm.cover_image_url} alt="Ảnh bìa sự kiện xem trước" className="max-h-48 w-full rounded-lg border border-white/10 object-cover" />
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" className='text-primary' onClick={() => setEventModalOpen(false)}>Hủy</Button>
            <Button variant="primary" onClick={() => void handleEventSubmit()} isLoading={saving}>
              {editingEvent ? 'Cập nhật event' : 'Tạo event'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false)
          setActiveEvent(null)
        }}
        title={activeEvent ? `Show của ${activeEvent.title}` : 'Chi tiết event'}
        className="max-w-5xl"
      >
        {activeEvent && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-gray-300">{activeEvent.category}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {formatDateTime(activeEvent.start_at)} - {formatDateTime(activeEvent.end_at)}
                </p>
              </div>
              <Button variant="primary" onClick={() => void openCreateShowModal()}>
                <Plus className="mr-2 h-4 w-4" /> Tạo show
              </Button>
            </div>

            {activeEvent.shows.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-gray-400">Event này chưa có show nào.</CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {activeEvent.shows.map((show) => (
                  <Card key={show.id} className="border-white/10 customer-bg-page">
                    <CardContent className="pt-6">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold customer-text-header">{show.title}</h3>
                            {statusBadge(show.status)}
                            <Badge variant="info" size="sm">{show.seat_source === 'LAYOUT' ? 'Theo layout' : 'Tự do'}</Badge>
                          </div>
                          <p className="text-sm text-gray-500">{show.description}</p>
                          <div className="space-y-1 text-sm text-gray-400">
                            <p>{formatDateTime(show.start_at)} - {formatDateTime(show.end_at)}</p>
                            <p>{show.location}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openPerformerModal(show)}>
                            Nghệ sĩ
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => void openSeatPlanner(show)}>
                            Sơ đồ ghế
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => void openEditShowModal(show)}>
                            <Edit className="h-4 w-4" /> Sửa show
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => void handleDeleteShow(show)}>
                            <Trash2 className="h-4 w-4" /> Xóa show
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showModalOpen}
        onClose={() => {
          setShowModalOpen(false)
          resetShowForm(activeEvent)
        }}
        title={editingShow ? 'Cập nhật show' : 'Tạo show mới'}
        className="max-w-3xl"
      >
        <div className="max-h-[75vh] space-y-4 overflow-y-auto pr-2">
          {formError && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{formError}</div>}

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Tên show</label>
            <Input className="text-white" value={showForm.title} onChange={(event) => setShowForm((prev) => ({ ...prev, title: event.target.value }))} />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Mô tả</label>
            <textarea
              className="w-full rounded-lg border border-white/20 bg-space-700/50 px-4 py-2.5 text-white"
              rows={4}
              value={showForm.description}
              onChange={(event) => setShowForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">Địa điểm</label>
              <Input
                className="text-white"
                value={showForm.location}
                disabled={showForm.seat_source === 'LAYOUT'}
                onChange={(event) => setShowForm((prev) => ({ ...prev, location: event.target.value }))}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">Trạng thái</label>
              <select className="w-full rounded-lg border border-white/10 admin-bg-listbox px-3 py-2 text-gray-500" value={showForm.status} onChange={(event) => setShowForm((prev) => ({ ...prev, status: event.target.value as EventStatus }))}>
                <option value="LIVE">Đang mở bán</option>
                <option value="DRAFT">Bản nháp</option>
                <option value="CLOSED">Đã đóng</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">Ngày diễn</label>
              <Input
                className="text-white"
                type="date"
                min={activeEvent ? formatUtcDateInput(activeEvent.start_at) : undefined}
                max={activeEvent ? formatUtcDateInput(activeEvent.end_at) : undefined}
                value={showForm.show_date}
                onChange={(event) => setShowForm((prev) => ({ ...prev, show_date: event.target.value }))}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">Bắt đầu</label>
              <Input className="text-white" type="time" value={showForm.start_time} onChange={(event) => setShowForm((prev) => ({ ...prev, start_time: event.target.value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">Kết thúc</label>
              <Input className="text-white" type="time" value={showForm.end_time} onChange={(event) => setShowForm((prev) => ({ ...prev, end_time: event.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">Thời gian giữ ghế</label>
              <Input className="text-white" type="number" min={1} value={showForm.hold_minutes} onChange={(event) => setShowForm((prev) => ({ ...prev, hold_minutes: event.target.value }))} />
            </div>
          </div>

          {!editingShow && (
            <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <button
                  type="button"
                  className={`rounded-xl border px-4 py-4 text-left transition ${showForm.seat_source === 'FREE_FORM' ? 'border-brand-red/40 bg-brand-red/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                  onClick={() => setShowForm((prev) => ({ ...prev, seat_source: 'FREE_FORM', venue_id: '', venue_layout_id: '' }))}
                >
                  <p className="font-semibold text-white">Chọn chỗ tự do</p>
                  <p className="mt-1 text-sm text-slate-400">Dùng một seat plan chung và chỉnh toàn bộ trong Seat Planner.</p>
                </button>
                <button
                  type="button"
                  className={`rounded-xl border px-4 py-4 text-left transition ${showForm.seat_source === 'LAYOUT' ? 'border-brand-red/40 bg-brand-red/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                  onClick={() => setShowForm((prev) => ({ ...prev, seat_source: 'LAYOUT' }))}
                >
                  <p className="font-semibold text-white">Venue Layout</p>
                  <p className="mt-1 text-sm text-slate-400">Clone layout đã dựng từ Venue Studio.</p>
                </button>
              </div>

              {showForm.seat_source === 'LAYOUT' ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-300">Venue template</label>
                    <select className="w-full rounded-lg border border-white/10 admin-bg-listbox px-3 py-2 text-gray-500" value={showForm.venue_id} onChange={(event) => void handleVenueChange(event.target.value)}>
                      <option value="">Chọn venue</option>
                      {venues.map((venue) => (
                        <option key={venue.id} value={venue.id}>{venue.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-300">Layout</label>
                    <select className="w-full rounded-lg border border-white/10 admin-bg-listbox px-3 py-2 text-gray-500" value={showForm.venue_layout_id} onChange={(event) => setShowForm((prev) => ({ ...prev, venue_layout_id: event.target.value }))} disabled={!showForm.venue_id}>
                      <option value="">{showForm.venue_id ? 'Chọn layout' : 'Chọn venue trước'}</option>
                      {venueLayouts.map((layout) => (
                        <option key={layout.id} value={layout.id}>{layout.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={showForm.create_seed_zone}
                      onChange={(event) => setShowForm((prev) => ({ ...prev, create_seed_zone: event.target.checked }))}
                    />
                    Tạo zone mẫu khi khởi tạo show
                  </label>
                  {showForm.create_seed_zone && (
                    <>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-300">Zone code</label>
                      <Input className="text-white" value={showForm.zone_code} onChange={(event) => setShowForm((prev) => ({ ...prev, zone_code: event.target.value }))} />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-300">Tên khu</label>
                      <Input className="text-white" value={showForm.zone_name} onChange={(event) => setShowForm((prev) => ({ ...prev, zone_name: event.target.value }))} />
                    </div>
                  </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-300">Rows</label>
                      <Input className="text-white" type="number" min={1} value={showForm.row_count} onChange={(event) => setShowForm((prev) => ({ ...prev, row_count: event.target.value }))} />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-300">Seats / row</label>
                      <Input className="text-white" type="number" min={1} value={showForm.seats_per_row} onChange={(event) => setShowForm((prev) => ({ ...prev, seats_per_row: event.target.value }))} />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-300">Price</label>
                      <Input className="text-white" type="number" min={1} value={showForm.zone_price} onChange={(event) => setShowForm((prev) => ({ ...prev, zone_price: event.target.value }))} />
                    </div>
                  </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-300">Zone color</label>
                        <div className="grid grid-cols-[68px_1fr] gap-3">
                          <input
                            type="color"
                            value={showForm.zone_color}
                            onChange={(event) => setShowForm((prev) => ({ ...prev, zone_color: event.target.value }))}
                            className="h-11 w-full rounded-lg border border-white/10 bg-space-700/50 p-1"
                          />
                          <Input className="text-white" value={showForm.zone_color} onChange={(event) => setShowForm((prev) => ({ ...prev, zone_color: event.target.value }))} />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {editingShow && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              Venue layout nguồn không đổi sau khi show đã tạo. Muốn đổi seat source, hãy tạo show mới.
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowModalOpen(false)}>Hủy</Button>
            <Button variant="primary" onClick={() => void handleShowSubmit()} isLoading={saving}>
              {editingShow ? 'Cập nhật show' : 'Tạo show'}
            </Button>
          </div>
        </div>
      </Modal>

      <ShowPerformersModal
        isOpen={performerModalOpen}
        show={performerShow}
        onClose={() => {
          setPerformerModalOpen(false)
          setPerformerShow(null)
        }}
        onSaved={async () => {
          if (activeEvent) {
            await loadEventDetail(activeEvent.slug)
          }
          await loadEvents()
        }}
      />
    </div>
  )
}
