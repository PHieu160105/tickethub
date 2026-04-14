import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

import { AdminSidebar } from '../components/AdminSidebar'
import { adminApi, eventApi, extractApiErrorMessage } from '../lib/api'
import type { EventCard, EventDetailStats, EventStatus } from '../types'

interface ZoneForm {
  code: string
  name: string
  row_count: number
  seats_per_row: number
  price: number
  color: string
}

const categoryOptions = ['Concert', 'Festival', 'Sports', 'Theater', 'Conference'] as const

interface AdminListFilters {
  search: string
  category: string
  start_at: string
  end_at: string
}

interface EditEventForm {
  title: string
  description: string
  category: string
  venue: string
  start_at: string
  end_at: string
  cover_image_url: string
  status: EventStatus
  queue_enabled: boolean
  hold_minutes: number
  queue_release_batch: number
  max_active_queue_tokens: number
}

const statusOptions: EventStatus[] = ['draft', 'live', 'closed']
const seatZonePalette = ['#ffd9de', '#fff0c8', '#dff7d8', '#e7dcff', '#d8f3ff', '#ffe1ef'] as const

export function AdminEventsPage() {
  const [events, setEvents] = useState<EventCard[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [listFilters, setListFilters] = useState<AdminListFilters>({ search: '', category: 'all', start_at: '', end_at: '' })
  const [deletingEventId, setDeletingEventId] = useState<number | null>(null)
  const [statsLoadingId, setStatsLoadingId] = useState<number | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [activeStats, setActiveStats] = useState<EventDetailStats | null>(null)
  const [editingEvent, setEditingEvent] = useState<EventCard | null>(null)
  const [editForm, setEditForm] = useState<EditEventForm | null>(null)

  const [zones, setZones] = useState<ZoneForm[]>([
    { code: 'VIP', name: 'VIP Zone', row_count: 8, seats_per_row: 12, price: 149, color: '#e7dcff' },
    { code: 'A', name: 'Premium A', row_count: 10, seats_per_row: 15, price: 99, color: '#ffd9de' },
    { code: 'B', name: 'General B', row_count: 12, seats_per_row: 18, price: 69, color: '#dff7d8' },
    { code: 'C', name: 'Saver C', row_count: 10, seats_per_row: 16, price: 45, color: '#fff0c8' },
  ])

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Concert',
    venue: '',
    start_at: dayjs().add(7, 'day').format('YYYY-MM-DDTHH:mm'),
    end_at: dayjs().add(7, 'day').add(3, 'hour').format('YYYY-MM-DDTHH:mm'),
    cover_image_url:
      'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=1200&q=80',
    hold_minutes: 10,
    queue_enabled: true,
    queue_release_batch: 50,
    max_active_queue_tokens: 200,
  })

  const fetchEvents = async (filters: AdminListFilters = listFilters) => {
    try {
      setLoading(true)
      setEventsError(null)
      const data = await adminApi.listEvents({
        search: filters.search.trim() || undefined,
        category: filters.category === 'all' ? undefined : filters.category,
        start_from: filters.start_at ? dayjs(filters.start_at).toISOString() : undefined,
        end_to: filters.end_at ? dayjs(filters.end_at).toISOString() : undefined,
      })
      setEvents(data)
    } catch (caughtError) {
      setEventsError(extractApiErrorMessage(caughtError, 'Failed to load events. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchEvents()
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleImageFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    setMessage(null)

    try {
      const uploaded = await adminApi.uploadEventImage(file)
      setForm((previousForm) => ({ ...previousForm, cover_image_url: uploaded.image_url }))
      setMessage('Image uploaded successfully.')
    } catch (caughtError) {
      setMessage(extractApiErrorMessage(caughtError, 'Failed to upload image. Please use jpg/png/webp under 10MB.'))
    } finally {
      setUploadingImage(false)
      event.target.value = ''
    }
  }

  const handleZoneChange = <K extends keyof ZoneForm>(index: number, key: K, value: ZoneForm[K]) => {
    setZones((previousZones) => previousZones.map((zone, zoneIndex) => (zoneIndex === index ? { ...zone, [key]: value } : zone)))
  }

  const handleCreateEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      await adminApi.createEvent({
        ...form,
        status: 'live',
        start_at: dayjs(form.start_at).toISOString(),
        end_at: dayjs(form.end_at).toISOString(),
        zones,
      })

      setMessage('Event created successfully and seat matrix generated.')
      setForm((previousForm) => ({ ...previousForm, title: '', description: '', venue: '' }))
      await fetchEvents()
    } catch (caughtError) {
      setMessage(extractApiErrorMessage(caughtError, 'Failed to create event. Please review input values.'))
    } finally {
      setSaving(false)
    }
  }

  const openEditPanel = async (eventData: EventCard) => {
    setMessage(null)

    try {
      const detail = await eventApi.detail(eventData.slug)
      setEditingEvent(eventData)
      setEditForm({
        title: detail.title,
        description: detail.description,
        category: detail.category,
        venue: detail.venue,
        start_at: dayjs(detail.start_at).format('YYYY-MM-DDTHH:mm'),
        end_at: dayjs(detail.end_at).format('YYYY-MM-DDTHH:mm'),
        cover_image_url: detail.cover_image_url,
        status: detail.status,
        queue_enabled: detail.queue_enabled,
        hold_minutes: detail.hold_minutes,
        queue_release_batch: detail.queue_release_batch,
        max_active_queue_tokens: detail.max_active_queue_tokens,
      })
    } catch (caughtError) {
      setMessage(extractApiErrorMessage(caughtError, 'Failed to load event details for editing.'))
    }
  }

  const handleUpdateEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingEvent || !editForm) return

    setUpdating(true)
    setMessage(null)

    try {
      await adminApi.updateEvent(editingEvent.slug, {
        title: editForm.title,
        description: editForm.description,
        category: editForm.category,
        venue: editForm.venue,
        start_at: dayjs(editForm.start_at).toISOString(),
        end_at: dayjs(editForm.end_at).toISOString(),
        cover_image_url: editForm.cover_image_url,
        status: editForm.status,
        queue_enabled: editForm.queue_enabled,
        hold_minutes: editForm.hold_minutes,
        queue_release_batch: editForm.queue_release_batch,
        max_active_queue_tokens: editForm.max_active_queue_tokens,
      })

      setMessage('Event updated successfully.')
      setEditingEvent(null)
      setEditForm(null)
      await fetchEvents()
    } catch (caughtError) {
      setMessage(extractApiErrorMessage(caughtError, 'Failed to update event. Please review values and try again.'))
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteEvent = async (eventData: EventCard) => {
    const confirmed = window.confirm(`Delete event "${eventData.title}"? This will remove its seats and linked orders.`)
    if (!confirmed) return

    setDeletingEventId(eventData.id)
    setMessage(null)

    try {
      await adminApi.deleteEvent(eventData.slug)
      if (editingEvent?.id === eventData.id) {
        setEditingEvent(null)
        setEditForm(null)
      }
      if (activeStats?.event_id === eventData.id) {
        setActiveStats(null)
      }
      setMessage('Event deleted successfully.')
      await fetchEvents()
    } catch (caughtError) {
      setMessage(extractApiErrorMessage(caughtError, 'Delete failed. Please try again.'))
    } finally {
      setDeletingEventId(null)
    }
  }

  const handleViewStats = async (eventData: EventCard) => {
    setStatsError(null)
    setStatsLoadingId(eventData.id)

    try {
      const stats = await adminApi.eventStats(eventData.slug)
      setActiveStats(stats)
    } catch (caughtError) {
      setStatsError(extractApiErrorMessage(caughtError, 'Unable to load event statistics.'))
    } finally {
      setStatsLoadingId(null)
    }
  }

  return (
    <main className="admin-shell">
      <AdminSidebar />

      <section className="admin-content">
        <header className="section-head section-head--hero admin-hero-head">
          <h1>Event Management</h1>
          <p>Launch, tune, and monitor released events with full control over lifecycle, seats, and analytics.</p>
        </header>

        <section className="panel">
          <h2>Create New Event</h2>
          <form className="admin-form" onSubmit={handleCreateEvent}>
            <label>
              Event Name
              <input
                required
                minLength={3}
                maxLength={255}
                value={form.title}
                onChange={(event) => setForm((previousForm) => ({ ...previousForm, title: event.target.value }))}
              />
            </label>

            <label>
              Description
              <textarea
                required
                minLength={10}
                value={form.description}
                onChange={(event) => setForm((previousForm) => ({ ...previousForm, description: event.target.value }))}
              />
            </label>

            <div className="admin-form__grid">
              <label>
                Category
                <select
                  required
                  value={form.category}
                  onChange={(event) => setForm((previousForm) => ({ ...previousForm, category: event.target.value }))}
                >
                  {categoryOptions.map((categoryOption) => (
                    <option key={categoryOption} value={categoryOption}>
                      {categoryOption}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Venue
                <input
                  required
                  value={form.venue}
                  onChange={(event) => setForm((previousForm) => ({ ...previousForm, venue: event.target.value }))}
                />
              </label>
            </div>

            <div className="admin-form__grid">
              <label>
                Start Time
                <input
                  type="datetime-local"
                  required
                  value={form.start_at}
                  onChange={(event) => setForm((previousForm) => ({ ...previousForm, start_at: event.target.value }))}
                />
              </label>
              <label>
                End Time
                <input
                  type="datetime-local"
                  required
                  value={form.end_at}
                  onChange={(event) => setForm((previousForm) => ({ ...previousForm, end_at: event.target.value }))}
                />
              </label>
            </div>

            <label>
              Cover Image URL
              <input
                value={form.cover_image_url}
                onChange={(event) => setForm((previousForm) => ({ ...previousForm, cover_image_url: event.target.value }))}
              />
            </label>

            <div className="admin-upload-box">
              <label>
                Upload Event Image
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleImageFileSelect(event)} />
              </label>
              {uploadingImage && <p className="state-text">Uploading image...</p>}
              {form.cover_image_url && <img src={form.cover_image_url} alt="Event cover preview" className="admin-upload-preview" />}
            </div>

            <div className="admin-form__grid">
              <label>
                Hold Minutes
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={form.hold_minutes}
                  onChange={(event) => setForm((previousForm) => ({ ...previousForm, hold_minutes: Number(event.target.value) }))}
                />
              </label>
              <label>
                Queue Batch Size
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={form.queue_release_batch}
                  onChange={(event) =>
                    setForm((previousForm) => ({ ...previousForm, queue_release_batch: Number(event.target.value) }))
                  }
                />
              </label>
              <label>
                Max Active Queue Tokens
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={form.max_active_queue_tokens}
                  onChange={(event) =>
                    setForm((previousForm) => ({ ...previousForm, max_active_queue_tokens: Number(event.target.value) }))
                  }
                />
              </label>
            </div>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.queue_enabled}
                onChange={(event) => setForm((previousForm) => ({ ...previousForm, queue_enabled: event.target.checked }))}
              />
              Enable Virtual Queue
            </label>

            <section className="zone-builder">
              <div className="zone-builder__head">
                <h3>Seat Matrix Zones</h3>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    setZones((previousZones) => [
                      ...previousZones,
                      {
                        code: `Z${previousZones.length + 1}`,
                        name: 'New Zone',
                        row_count: 6,
                        seats_per_row: 10,
                        price: 79,
                        color: seatZonePalette[previousZones.length % seatZonePalette.length],
                      },
                    ])
                  }
                >
                  Add Zone
                </button>
              </div>

              <div className="zone-builder__list">
                {zones.map((zone, index) => (
                  <article key={`${zone.code}-${index}`} className="zone-builder__item">
                    <div className="admin-form__grid">
                      <label>
                        Code
                        <input value={zone.code} onChange={(event) => handleZoneChange(index, 'code', event.target.value)} />
                      </label>
                      <label>
                        Name
                        <input value={zone.name} onChange={(event) => handleZoneChange(index, 'name', event.target.value)} />
                      </label>
                    </div>

                    <div className="admin-form__grid">
                      <label>
                        Rows
                        <input
                          type="number"
                          min={1}
                          max={40}
                          value={zone.row_count}
                          onChange={(event) => handleZoneChange(index, 'row_count', Number(event.target.value))}
                        />
                      </label>
                      <label>
                        Seats / Row
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={zone.seats_per_row}
                          onChange={(event) => handleZoneChange(index, 'seats_per_row', Number(event.target.value))}
                        />
                      </label>
                      <label>
                        Price
                        <input
                          type="number"
                          min={1}
                          value={zone.price}
                          onChange={(event) => handleZoneChange(index, 'price', Number(event.target.value))}
                        />
                      </label>
                      <label>
                        Color
                        <input type="color" value={zone.color} onChange={(event) => handleZoneChange(index, 'color', event.target.value)} />
                      </label>
                    </div>

                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setZones((previousZones) => previousZones.filter((_, zoneIndex) => zoneIndex !== index))}
                      disabled={zones.length === 1}
                    >
                      Remove Zone
                    </button>
                  </article>
                ))}
              </div>
            </section>

            {message && <p className="state-text">{message}</p>}

            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save & Launch Event'}
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>Current Events</h2>

          <form
            className="admin-list-filter"
            onSubmit={(event) => {
              event.preventDefault()
              void fetchEvents(listFilters)
            }}
          >
            <input
              type="search"
              value={listFilters.search}
              onChange={(event) => setListFilters((previous) => ({ ...previous, search: event.target.value }))}
              placeholder="Search event name or venue"
            />

            <select
              value={listFilters.category}
              onChange={(event) => setListFilters((previous) => ({ ...previous, category: event.target.value }))}
            >
              <option value="all">All categories</option>
              {categoryOptions.map((categoryOption) => (
                <option key={categoryOption} value={categoryOption}>
                  {categoryOption}
                </option>
              ))}
            </select>

            <input
              type="datetime-local"
              value={listFilters.start_at}
              onChange={(event) => setListFilters((previous) => ({ ...previous, start_at: event.target.value }))}
            />

            <input
              type="datetime-local"
              value={listFilters.end_at}
              onChange={(event) => setListFilters((previous) => ({ ...previous, end_at: event.target.value }))}
            />

            <button type="submit" className="btn btn-primary">
              Filter
            </button>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                const resetFilters: AdminListFilters = { search: '', category: 'all', start_at: '', end_at: '' }
                setListFilters(resetFilters)
                void fetchEvents(resetFilters)
              }}
            >
              Reset
            </button>
          </form>

          {loading && <p className="state-text">Loading events...</p>}
          {eventsError && <p className="state-text state-text--error">{eventsError}</p>}
          {statsError && <p className="state-text state-text--error">{statsError}</p>}
          <div className="admin-event-list">
            {events.map((event) => (
              <article key={event.id} className="admin-event-item">
                <img src={event.cover_image_url || 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=800&q=80'} alt={event.title} />
                <div>
                  <strong>{event.title}</strong>
                  <p>
                    {dayjs(event.start_at).format('DD MMM YYYY HH:mm')} • {event.venue}
                  </p>
                  <div className="admin-event-meta">
                    <span className="chip chip-ghost">{event.category}</span>
                    <span className="chip chip-primary">{event.status}</span>
                  </div>

                  <div className="admin-event-actions">
                    <button type="button" className="btn btn-ghost" onClick={() => void openEditPanel(event)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => void handleViewStats(event)}
                      disabled={statsLoadingId === event.id}
                    >
                      {statsLoadingId === event.id ? 'Loading...' : 'View Stats'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-soft-danger"
                      onClick={() => void handleDeleteEvent(event)}
                      disabled={deletingEventId === event.id}
                    >
                      {deletingEventId === event.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {editingEvent && editForm && (
            <section className="panel admin-detail-panel">
              <div className="admin-detail-head">
                <h3>Edit Event: {editingEvent.title}</h3>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setEditingEvent(null)
                    setEditForm(null)
                  }}
                >
                  Close
                </button>
              </div>

              <form className="admin-form" onSubmit={handleUpdateEvent}>
                <div className="admin-form__grid">
                  <label>
                    Event Name
                    <input
                      required
                      value={editForm.title}
                      onChange={(event) => setEditForm((previous) => (previous ? { ...previous, title: event.target.value } : previous))}
                    />
                  </label>
                  <label>
                    Venue
                    <input
                      required
                      value={editForm.venue}
                      onChange={(event) => setEditForm((previous) => (previous ? { ...previous, venue: event.target.value } : previous))}
                    />
                  </label>
                </div>

                <label>
                  Description
                  <textarea
                    required
                    value={editForm.description}
                    onChange={(event) => setEditForm((previous) => (previous ? { ...previous, description: event.target.value } : previous))}
                  />
                </label>

                <div className="admin-form__grid">
                  <label>
                    Category
                    <select
                      value={editForm.category}
                      onChange={(event) => setEditForm((previous) => (previous ? { ...previous, category: event.target.value } : previous))}
                    >
                      {categoryOptions.map((categoryOption) => (
                        <option key={categoryOption} value={categoryOption}>
                          {categoryOption}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Status
                    <select
                      value={editForm.status}
                      onChange={(event) =>
                        setEditForm((previous) =>
                          previous
                            ? {
                                ...previous,
                                status: event.target.value as EventStatus,
                              }
                            : previous,
                        )
                      }
                    >
                      {statusOptions.map((statusOption) => (
                        <option key={statusOption} value={statusOption}>
                          {statusOption}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="admin-form__grid">
                  <label>
                    Start Time
                    <input
                      type="datetime-local"
                      required
                      value={editForm.start_at}
                      onChange={(event) => setEditForm((previous) => (previous ? { ...previous, start_at: event.target.value } : previous))}
                    />
                  </label>
                  <label>
                    End Time
                    <input
                      type="datetime-local"
                      required
                      value={editForm.end_at}
                      onChange={(event) => setEditForm((previous) => (previous ? { ...previous, end_at: event.target.value } : previous))}
                    />
                  </label>
                </div>

                <label>
                  Cover Image URL
                  <input
                    value={editForm.cover_image_url}
                    onChange={(event) => setEditForm((previous) => (previous ? { ...previous, cover_image_url: event.target.value } : previous))}
                  />
                </label>

                <div className="admin-form__grid">
                  <label>
                    Hold Minutes
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={editForm.hold_minutes}
                      onChange={(event) =>
                        setEditForm((previous) => (previous ? { ...previous, hold_minutes: Number(event.target.value) } : previous))
                      }
                    />
                  </label>
                  <label>
                    Queue Batch Size
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={editForm.queue_release_batch}
                      onChange={(event) =>
                        setEditForm((previous) => (previous ? { ...previous, queue_release_batch: Number(event.target.value) } : previous))
                      }
                    />
                  </label>
                  <label>
                    Max Active Queue Tokens
                    <input
                      type="number"
                      min={1}
                      max={5000}
                      value={editForm.max_active_queue_tokens}
                      onChange={(event) =>
                        setEditForm((previous) =>
                          previous ? { ...previous, max_active_queue_tokens: Number(event.target.value) } : previous,
                        )
                      }
                    />
                  </label>
                </div>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editForm.queue_enabled}
                    onChange={(event) =>
                      setEditForm((previous) => (previous ? { ...previous, queue_enabled: event.target.checked } : previous))
                    }
                  />
                  Enable Virtual Queue
                </label>

                <button type="submit" className="btn btn-primary" disabled={updating}>
                  {updating ? 'Updating...' : 'Save Changes'}
                </button>
              </form>
            </section>
          )}

          {activeStats && (
            <section className="panel admin-detail-panel">
              <div className="admin-detail-head">
                <h3>{activeStats.event_title} - Detailed Stats</h3>
                <button type="button" className="btn btn-ghost" onClick={() => setActiveStats(null)}>
                  Close
                </button>
              </div>

              <div className="admin-stats-grid">
                <article className="kpi-card">
                  <p>Total Seats</p>
                  <h3>{activeStats.total_seats}</h3>
                </article>
                <article className="kpi-card">
                  <p>Sold Seats</p>
                  <h3>{activeStats.sold_seats}</h3>
                </article>
                <article className="kpi-card">
                  <p>Tickets Issued</p>
                  <h3>{activeStats.tickets_issued}</h3>
                </article>
                <article className="kpi-card kpi-card--danger">
                  <p>Canceled Tickets</p>
                  <h3>{activeStats.canceled_tickets}</h3>
                </article>
                <article className="kpi-card">
                  <p>Total Revenue</p>
                  <h3>${activeStats.total_revenue.toLocaleString()}</h3>
                </article>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Zone</th>
                      <th>Color</th>
                      <th>Total</th>
                      <th>Sold</th>
                      <th>Locked</th>
                      <th>Available</th>
                      <th>Occupancy</th>
                      <th>Price Range</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeStats.zone_stats.map((zone) => (
                      <tr key={zone.zone_id}>
                        <td>
                          {zone.zone_code} - {zone.zone_name}
                        </td>
                        <td>
                          <span className="seat-dot" style={{ background: zone.color }} />
                        </td>
                        <td>{zone.total_seats}</td>
                        <td>{zone.sold_seats}</td>
                        <td>{zone.locked_seats}</td>
                        <td>{zone.available_seats}</td>
                        <td>{zone.occupancy_rate}%</td>
                        <td>
                          ${zone.min_price.toFixed(2)} - ${zone.max_price.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </section>
      </section>
    </main>
  )
}
