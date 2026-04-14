import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'

import { EventCard } from '../components/EventCard'
import { eventApi, extractApiErrorMessage } from '../lib/api'
import type { EventCard as EventCardType } from '../types'

const categoryFilters = [
  { label: 'All Events', value: 'all' },
  { label: 'Concerts', value: 'Concert' },
  { label: 'Festivals', value: 'Festival' },
  { label: 'Sports', value: 'Sports' },
  { label: 'Theater', value: 'Theater' },
] as const

interface EventFilters {
  search: string
  category: (typeof categoryFilters)[number]['value']
  start_at: string
  end_at: string
}

export function HomePage() {
  const [events, setEvents] = useState<EventCardType[]>([])
  const [filters, setFilters] = useState<EventFilters>({
    search: '',
    category: 'all',
    start_at: '',
    end_at: '',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = async (nextFilters: EventFilters) => {
    try {
      setLoading(true)
      setError(null)
      const data = await eventApi.list({
        search: nextFilters.search.trim() || undefined,
        category: nextFilters.category === 'all' ? undefined : nextFilters.category,
        start_from: nextFilters.start_at ? dayjs(nextFilters.start_at).toISOString() : undefined,
        end_to: nextFilters.end_at ? dayjs(nextFilters.end_at).toISOString() : undefined,
      })
      setEvents(data)
    } catch (caughtError) {
      setError(extractApiErrorMessage(caughtError, 'Failed to load events. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchEvents(filters)
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const heroEvent = useMemo(() => events[0], [events])

  return (
    <main className="page page-home">
      <section className="hero app-container">
        <div className="hero__overlay" />
        <div className="hero__content">
          <span className="hero__eyebrow">Digital Concierge Ticketing</span>
          <h1>
            Experience the <br />
            Electric Moment.
          </h1>
          <p>
            TicketRush powers high-concurrency flash sales with real-time seat maps, virtual queue admission, and secure
            digital tickets.
          </p>

          <form
            className="hero__search"
            onSubmit={(event) => {
              event.preventDefault()
              void fetchEvents(filters)
            }}
          >
            <input
              type="search"
              value={filters.search}
              onChange={(event) => setFilters((previous) => ({ ...previous, search: event.target.value }))}
              placeholder="Search concert, festival, sports..."
            />
            <button type="submit" className="btn btn-primary">
              Find Events
            </button>
          </form>
        </div>
      </section>

      <section className="app-container panel event-filters-panel">
        <div className="event-filter-chips">
          {categoryFilters.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`btn ${filters.category === item.value ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => {
                const nextFilters = { ...filters, category: item.value }
                setFilters(nextFilters)
                void fetchEvents(nextFilters)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <form
          className="event-filter-form"
          onSubmit={(event) => {
            event.preventDefault()
            void fetchEvents(filters)
          }}
        >
          <label>
            Start From
            <input
              type="datetime-local"
              value={filters.start_at}
              onChange={(event) => setFilters((previous) => ({ ...previous, start_at: event.target.value }))}
            />
          </label>
          <label>
            End To
            <input
              type="datetime-local"
              value={filters.end_at}
              onChange={(event) => setFilters((previous) => ({ ...previous, end_at: event.target.value }))}
            />
          </label>
          <button type="submit" className="btn btn-primary">
            Apply Filters
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              const resetFilters: EventFilters = { search: '', category: 'all', start_at: '', end_at: '' }
              setFilters(resetFilters)
              void fetchEvents(resetFilters)
            }}
          >
            Reset
          </button>
        </form>
      </section>

      {heroEvent && (
        <section className="feature-event app-container">
          <div className="feature-event__left">
            <span className="chip chip-ghost">Trending Now</span>
            <h2>{heroEvent.title}</h2>
            <p>{heroEvent.description}</p>
          </div>
          <img
            src={heroEvent.cover_image_url || 'https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2?auto=format&fit=crop&w=1200&q=80'}
            alt={heroEvent.title}
          />
        </section>
      )}

      <section className="app-container section-stack">
        <div className="section-head">
          <h2>Upcoming Events</h2>
          <p>Live inventory, dynamic seat map, and queue admission built-in.</p>
        </div>

        {loading && <p className="state-text">Loading events...</p>}
        {error && <p className="state-text state-text--error">{error}</p>}

        {!loading && !error && (
          <div className="event-grid">
            {events.map((event) => (
              <EventCard event={event} key={event.id} />
            ))}

            {events.length === 0 && <p className="state-text">No events found for your search.</p>}
          </div>
        )}
      </section>
    </main>
  )
}
