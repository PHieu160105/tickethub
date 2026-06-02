import { useEffect, useMemo, useState, type ComponentProps } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Calendar,
  Clock,
  MapPin,
  Ticket,
  Users,
} from 'lucide-react'

import { PerformerCarouselModal } from '@/components/customer/PerformerCarouselModal'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { GlobalLoader } from '@/components/ui/GlobalLoader'
import { Toast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { useEventDetail } from '@/features/events/hooks/useEvents'
import { queueApi } from '@/lib/api'
import { flashNoticeStorage, queueStorage, type FlashNotice } from '@/lib/storage'
import type { EventStatus, ShowSummary } from '@/types'

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
    DRAFT: { text: 'Bản nháp', variant: 'default' },
    LIVE: { text: 'Đang mở bán', variant: 'success' },
    CLOSED: { text: 'Đã đóng', variant: 'danger' },
    CANCELLED: { text: 'Đã hủy', variant: 'warning' },
  }

  const variant = variants[status]
  return <Badge variant={variant.variant}>{variant.text}</Badge>
}

function showStatusBadge(show: Pick<ShowSummary, 'status' | 'end_at'>) {
  if (new Date(show.end_at).getTime() <= Date.now()) {
    return <Badge variant="danger">Đã kết thúc</Badge>
  }
  return statusBadge(show.status)
}

function canBookShow(show: Pick<ShowSummary, 'status' | 'end_at'>) {
  return show.status === 'LIVE' && new Date(show.end_at).getTime() > Date.now()
}

export default function EventDetail() {
  const { eventKey } = useParams<{ eventKey: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { event, isLoading, error } = useEventDetail(eventKey)

  const [flashNotice, setFlashNotice] = useState<FlashNotice | null>(null)
  const [checkingQueueShowId, setCheckingQueueShowId] = useState<number | null>(null)
  const [activePerformerShowId, setActivePerformerShowId] = useState<number | null>(null)

  useEffect(() => {
    setFlashNotice(flashNoticeStorage.consume())
  }, [eventKey])

  useEffect(() => {
    setActivePerformerShowId(null)
  }, [eventKey])

  const activePerformerShow = useMemo(
    () => event?.shows.find((show) => show.id === activePerformerShowId) ?? null,
    [activePerformerShowId, event],
  )

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

      if (queueEntry.status === 'WAITING') {
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
        <main className="mx-auto max-w-7xl px-4 py-24 text-center">
          <h1 className="mb-3 text-3xl font-bold">Không tìm thấy sự kiện</h1>
          <p className="mb-6 text-slate-400">{error ?? 'Sự kiện này không tồn tại hoặc đang tạm ẩn.'}</p>
          <Button onClick={() => navigate('/search')}>Quay lại tìm kiếm</Button>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen text-white">
      {flashNoticeNode}

      <section className="relative h-[340px] overflow-hidden md:h-[420px]">
        <img src={event.cover_image_url || FALLBACK_IMAGE} alt={event.title} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/40" />

        <div className="relative mx-auto flex h-full max-w-7xl items-end px-4 pb-10">
          <div className="max-w-4xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 text-xs uppercase tracking-[0.2em] text-secondary">
              {event.category}
            </p>
            <h1 className="text-4xl font-black leading-tight md:text-6xl">{event.title}</h1>
            <p className="mt-4 max-w-2xl line-clamp-3 text-slate-300">{event.description}</p>
          </div>
        </div>
      </section>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-12 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-[var(--customer-bg-opp)] customer-bg-surface p-6">
            <h2 className="mb-4 text-xl font-bold customer-text-body">Giới thiệu sự kiện</h2>
            <p className="leading-relaxed text-gray-500">{event.description}</p>
          </div>

          <div
            id="shows"
            className="rounded-xl border border-[var(--customer-bg-opp)] customer-bg-surface p-6"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold customer-text-body">Show diễn</h2>
              <Badge variant="outline">{event.shows.length} show</Badge>
            </div>

            {event.shows.length === 0 ? (
              <p className="text-sm text-gray-500">Sự kiện này chưa có show mở bán.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4">
                  {event.shows.map((show) => {
                    const isBookable = canBookShow(show)

                    return (
                      <div
                        key={show.id}
                        className="rounded-lg border border-white/10 customer-bg-page p-4"
                      >
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold customer-text-body">{show.title}</p>
                            <p className="mt-1 text-xs text-gray-500">{show.description}</p>
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-3">
                            {showStatusBadge(show)}
                            {show.performers.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => setActivePerformerShowId(show.id)}
                                className="inline-flex items-center gap-2 rounded-lg border border-[var(--customer-border)] px-3 py-2 text-sm customer-text-body transition hover:bg-[var(--customer-bg-soft)]"
                              >
                                <Users className="h-4 w-4" />
                                Nghệ sĩ
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div className="space-y-2 text-sm text-gray-600">
                          <p className="inline-flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-secondary" />
                            {formatDate(show.start_at)}
                          </p>
                          <p className="inline-flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-secondary" />
                            {show.location}
                          </p>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400">
                            <Users className="h-4 w-4" />
                            {show.performers.length} lineup công khai
                          </div>
                          {isBookable ? (
                            <Button
                              className="bg-[var(--customer-bg-opt)] hover:bg-[var(--customer-bg-opt)]/50"
                              isLoading={checkingQueueShowId === show.id}
                              onClick={() => void handleBookShow(show.id)}
                            >
                              <Ticket className="h-4 w-4" />
                              Đặt vé
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>

              </>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="space-y-4 rounded-xl border border-[var(--customer-bg-opp)] customer-bg-surface p-6">
            <h3 className="text-lg font-bold customer-text-body">Thông tin sự kiện</h3>

            <div className="flex items-start gap-3 text-slate-500">
              <Calendar className="mt-0.5 h-5 w-5 text-secondary" />
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500">Bắt đầu</p>
                <p>{formatDate(event.start_at)}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 text-slate-500">
              <Clock className="mt-0.5 h-5 w-5 text-secondary" />
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500">Kết thúc</p>
                <p>{formatDate(event.end_at)}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 text-slate-500">
              <MapPin className="mt-0.5 h-5 w-5 text-secondary" />
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500">Địa điểm</p>
                <p>{event.venue}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 text-slate-500">
              <Users className="mt-0.5 h-5 w-5 text-secondary" />
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500">Số show</p>
                <p>{event.shows.length}</p>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {activePerformerShow ? (
        <PerformerCarouselModal show={activePerformerShow} onClose={() => setActivePerformerShowId(null)} />
      ) : null}
    </div>
  )
}
