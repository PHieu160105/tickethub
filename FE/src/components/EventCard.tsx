import dayjs from 'dayjs'
import { Link } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import type { EventCard } from '../types'

interface EventCardProps {
  event: EventCard
}

export function EventCard({ event }: EventCardProps) {
  const { isAuthenticated, isAdmin } = useAuth()
  const shouldJoinQueue = isAuthenticated && !isAdmin && event.queue_enabled
  const destination = !isAuthenticated ? `/events/${event.slug}/seats` : shouldJoinQueue ? `/events/${event.slug}/queue` : `/events/${event.slug}/seats`

  return (
    <article className="event-card">
      <div className="event-card__media">
        <img
          src={event.cover_image_url || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80'}
          alt={event.title}
          loading="lazy"
        />
      </div>

      <div className="event-card__content">
        <span className="chip chip-primary">{event.category}</span>
        <h3>{event.title}</h3>
        <p>{event.description}</p>
        <div className="event-card__meta">
          <span>{dayjs(event.start_at).format('DD MMM YYYY • HH:mm')}</span>
          <span>{event.venue}</span>
        </div>
        <Link to={destination} className="btn btn-primary">
          {!isAuthenticated ? 'Preview Seats' : shouldJoinQueue ? 'Join Queue' : 'Book Seats'}
        </Link>
      </div>
    </article>
  )
}
