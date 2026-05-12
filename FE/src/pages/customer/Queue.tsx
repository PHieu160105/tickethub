import { Navigate, useSearchParams } from 'react-router-dom'

export default function QueueLegacy() {
  const [searchParams] = useSearchParams()
  const showId = searchParams.get('showId')
  const eventKey = searchParams.get('eventKey')
  if (showId) {
    const next = eventKey
      ? `/queue?showId=${encodeURIComponent(showId)}&eventKey=${encodeURIComponent(eventKey)}`
      : `/queue?showId=${encodeURIComponent(showId)}`
    return <Navigate to={next} replace />
  }
  return <Navigate to="/search" replace />
}
