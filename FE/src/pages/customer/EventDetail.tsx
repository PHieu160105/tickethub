import { useEffect, useState, type ComponentProps } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Calendar, Clock, MapPin, Users } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { GlobalLoader } from '@/components/ui/GlobalLoader'
import { Toast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { useEventDetail } from '@/features/events/hooks/useEvents'
import { queueApi } from '@/lib/api'
import { flashNoticeStorage, queueStorage, type FlashNotice } from '@/lib/storage'
import type { EventStatus } from '@/types'

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80'

function formatDate(date: string) {
  return new Date(date).toLocaleString('vi-VN', {
    weekday: 'short',
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusBadge(status: EventStatus) {
  const variants: Record<EventStatus, { text: string; variant: ComponentProps<typeof Badge>['variant'] }> = {
    draft: { text: 'Ban nhap', variant: 'default' },
    live: { text: 'Dang mo ban', variant: 'success' },
    closed: { text: 'Da dong', variant: 'danger' },
  }

  const variant = variants[status]
  return <Badge variant={variant.variant}>{variant.text}</Badge>
}

function showStatusBadge(show: { status: EventStatus; end_at: string }) {
  if (new Date(show.end_at).getTime() <= Date.now()) {
    return <Badge variant="danger">Da ket thuc</Badge>
  }
  return statusBadge(show.status)
}

function canBookShow(show: { status: EventStatus; end_at: string }) {
  return show.status === 'live' && new Date(show.end_at).getTime() > Date.now()
}

export default function EventDetail() {
  const { eventKey } = useParams<{ eventKey: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { event, isLoading, error } = useEventDetail(eventKey)
  const [flashNotice, setFlashNotice] = useState<FlashNotice | null>(null)
  const [checkingQueueShowId, setCheckingQueueShowId] = useState<number | null>(null)

  useEffect(() => {
    setFlashNotice(flashNoticeStorage.consume())
  }, [eventKey])

  const handleBookShow = async (showId: number) => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    setCheckingQueueShowId(showId)
    try {
      const queueEntry = await queueApi.join(showId)
      if (queueEntry.token) {
        queueStorage.setToken(showId, queueEntry.token)
      }

      if (queueEntry.status === 'waiting') {
        navigate(`/queue?showId=${showId}&eventKey=${encodeURIComponent(String(event?.slug ?? eventKey ?? ''))}`)
        return
      }

      navigate(`/shows/${showId}/seats`)
    } catch {
      navigate(`/shows/${showId}/seats`)
    } finally {
      setCheckingQueueShowId(null)
    }
  }

  if (isLoading) {
    return <GlobalLoader />
  }

  const flashNoticeNode = flashNotice ? (
    <div className="fixed right-4 top-24 z-[100] w-[calc(100vw-2rem)] max-w-sm">
      <Toast
        variant={flashNotice.variant ?? 'warning'}
        title={flashNotice.title}
        description={flashNotice.description}
        onClose={() => setFlashNotice(null)}
      />
    </div>
  ) : null

  if (error || !event) {
    return (
      <div className="min-h-screen text-white">
        {flashNoticeNode}
        <main className="max-w-7xl mx-auto px-4 py-24 text-center">
          <h1 className="text-3xl font-bold mb-3">Khong tim thay su kien</h1>
          <p className="text-slate-400 mb-6">{error ?? 'Su kien nay khong ton tai hoac dang tam an.'}</p>
          <Link to="/search">
            <Button>Quay lai tim kiem</Button>
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen text-white">
      {flashNoticeNode}
      <section className="relative h-[340px] md:h-[420px] overflow-hidden">
        <img src={event.cover_image_url || FALLBACK_IMAGE} alt={event.title} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/40" />

        <div className="relative max-w-7xl mx-auto px-4 h-full flex items-end pb-10">
          <div className="max-w-4xl">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-secondary bg-black/40 px-3 py-1 rounded-full mb-3">
              {event.category}
            </p>
            <h1 className="text-4xl md:text-6xl font-black leading-tight">{event.title}</h1>
            <p className="text-slate-300 mt-4 max-w-2xl line-clamp-3">{event.description}</p>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-[var(--customer-bg-opp)] customer-bg-surface p-6">
            <h2 className="text-xl customer-text-body font-bold mb-4">Gioi thieu su kien</h2>
            <p className="text-gray-500 leading-relaxed">{event.description}</p>
          </div>

          <div id="shows" className="rounded-xl border border-[var(--customer-bg-opp)] customer-bg-surface p-6">
            <h2 className="text-xl customer-text-body font-bold mb-4">Lich show</h2>
            {event.shows.length === 0 ? (
              <p className="text-sm text-gray-500">Su kien nay chua co show mo ban.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {event.shows.map((show) => {
                  const isBookable = canBookShow(show)

                  return (
                    <div key={show.id} className="rounded-lg customer-bg-page border border-white/10 p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="font-semibold customer-text-body">{show.title}</p>
                          <p className="text-xs text-gray-500 mt-1">{show.description}</p>
                        </div>
                        {showStatusBadge(show)}
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>{new Date(show.start_at).toLocaleString('vi-VN')}</p>
                        <p>{show.venue}</p>
                      </div>
                      {isBookable && (
                        <Button
                          className="mt-4 bg-[var(--customer-bg-opt)] hover:bg-[var(--customer-bg-opt)]/50"
                          isLoading={checkingQueueShowId === show.id}
                          onClick={() => void handleBookShow(show.id)}
                        >
                          Dat ve
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-[var(--customer-bg-opp)] customer-bg-surface p-6 space-y-4">
            <h3 className="text-lg font-bold customer-text-body">Thong tin su kien</h3>
            <div className="flex items-start gap-3 text-slate-500">
              <Calendar className="w-5 h-5 text-secondary mt-0.5" />
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500">Bat dau</p>
                <p>{formatDate(event.start_at)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-slate-500">
              <Clock className="w-5 h-5 text-secondary mt-0.5" />
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500">Ket thuc</p>
                <p>{formatDate(event.end_at)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-slate-500">
              <MapPin className="w-5 h-5 text-secondary mt-0.5" />
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500">Dia diem</p>
                <p>{event.venue}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-slate-500">
              <Users className="w-5 h-5 text-secondary mt-0.5" />
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500">So show</p>
                <p>{event.shows.length}</p>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}
