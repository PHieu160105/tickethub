import type { EventCard, EventDetail } from '@/types'

export interface FavouriteItem {
  id: number
  slug: string
  title: string
  venue: string
  category: string
  start_at: string
  cover_image_url: string
}

function keyByUser(userId: number | undefined) {
  return `ticketrush:favourites:${userId ?? "guest"}`
}

export function listFavourites(userId: number | undefined): FavouriteItem[] {
  const raw = localStorage.getItem(keyByUser(userId))
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as FavouriteItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function isFavourite(userId: number | undefined, eventSlugOrId: string | number): boolean {
  return listFavourites(userId).some((item) => item.slug === String(eventSlugOrId) || item.id === Number(eventSlugOrId))
}

export function toggleFavourite(userId: number | undefined, event: EventCard | EventDetail): FavouriteItem[] {
  const current = listFavourites(userId)
  const key = event.slug || String(event.id)
  const exists = current.some((item) => item.slug === key || item.id === event.id)
  const next = exists
    ? current.filter((item) => item.slug !== key && item.id !== event.id)
    : [
        {
          id: event.id,
          slug: key,
          title: event.title,
          venue: event.venue,
          category: event.category,
          start_at: event.start_at,
          cover_image_url: event.cover_image_url,
        },
        ...current,
      ]
  localStorage.setItem(keyByUser(userId), JSON.stringify(next))
  return next
}

export function removeFavourite(userId: number | undefined, eventId: number): FavouriteItem[] {
  const next = listFavourites(userId).filter((item) => item.id !== eventId)
  localStorage.setItem(keyByUser(userId), JSON.stringify(next))
  return next
}
