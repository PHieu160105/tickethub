import { useEffect, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'

import { postAuthorizedJsonKeepalive } from '@/lib/api'
import { queueStorage } from '@/lib/storage'

type QueueFlowRoute = {
  showId: number
  kind: 'queue' | 'seats' | 'checkout'
}

function parseQueueFlowRoute(pathname: string, search: string): QueueFlowRoute | null {
  const params = new URLSearchParams(search)

  if (pathname === '/queue') {
    const showId = Number(params.get('showId') ?? '')
    return Number.isFinite(showId) && showId > 0 ? { showId, kind: 'queue' } : null
  }

  if (pathname === '/checkout') {
    const showId = Number(params.get('showId') ?? '')
    return Number.isFinite(showId) && showId > 0 ? { showId, kind: 'checkout' } : null
  }

  const seatMatch = pathname.match(/^\/shows\/(\d+)\/seats$/)
  if (seatMatch) {
    const showId = Number(seatMatch[1])
    return Number.isFinite(showId) && showId > 0 ? { showId, kind: 'seats' } : null
  }

  return null
}

function isSameShowQueueFlow(previous: QueueFlowRoute, next: QueueFlowRoute | null): boolean {
  return Boolean(next && previous.showId === next.showId)
}

function leaveQueueFlow(route: QueueFlowRoute | null) {
  if (!route) return

  const token = queueStorage.getToken(route.showId)
  if (!token) return

  queueStorage.clearToken(route.showId)
  postAuthorizedJsonKeepalive(`/shows/${route.showId}/queue/leave/${encodeURIComponent(token)}`, {})
}

export function QueueSessionGuard() {
  const location = useLocation()
  const currentRoute = useMemo(
    () => parseQueueFlowRoute(location.pathname, location.search),
    [location.pathname, location.search],
  )
  const previousRouteRef = useRef<QueueFlowRoute | null>(currentRoute)
  const currentRouteRef = useRef<QueueFlowRoute | null>(currentRoute)

  useEffect(() => {
    const previousRoute = previousRouteRef.current

    if (previousRoute && !isSameShowQueueFlow(previousRoute, currentRoute)) {
      leaveQueueFlow(previousRoute)
    }

    previousRouteRef.current = currentRoute
    currentRouteRef.current = currentRoute
  }, [currentRoute])

  useEffect(() => {
    const handlePageHide = () => {
      leaveQueueFlow(currentRouteRef.current)
    }

    window.addEventListener('pagehide', handlePageHide)
    return () => window.removeEventListener('pagehide', handlePageHide)
  }, [])

  return null
}
