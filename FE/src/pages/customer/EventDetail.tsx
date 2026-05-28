import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type WheelEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { GlobalLoader } from '@/components/ui/GlobalLoader'
import { Toast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { eventsApi } from '@/features/events/api/eventsApi'
import { useEventDetail } from '@/features/events/hooks/useEvents'
import { isFavourite, toggleFavourite } from '@/lib/favourites'
import { queueApi } from '@/lib/api'
import { flashNoticeStorage, queueStorage, type FlashNotice } from '@/lib/storage'
import type { EventReview, EventStatus } from '@/types'
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Clock, Heart, MapPin, Star, Users } from 'lucide-react'

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80'
const FALLBACK_PERFORMER_IMAGE =
  'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=400&q=80'
const PERFORMER_PANEL_MAX_WIDTH = 720

type PerformerFilter = 'all' | 'main' | 'guest'

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
    draft: { text: 'Bản nháp', variant: 'default' },
    live: { text: 'Đang mở bán', variant: 'success' },
    closed: { text: 'Đã đóng', variant: 'danger' },
  }

  const variant = variants[status]
  return <Badge variant={variant.variant}>{variant.text}</Badge>
}

function showStatusBadge(show: { status: EventStatus; end_at: string }) {
  if (new Date(show.end_at).getTime() <= Date.now()) {
    return <Badge variant="danger">Đã kết thúc</Badge>
  }
  return statusBadge(show.status)
}

function canBookShow(show: { status: EventStatus; end_at: string }) {
  return show.status === 'live' && new Date(show.end_at).getTime() > Date.now()
}

function performerRoleLabel(role: 'main' | 'guest' | 'backup') {
  if (role === 'main') return 'Main'
  if (role === 'guest') return 'Guest'
  return 'Backup'
}

export default function EventDetail() {
  const { eventKey } = useParams<{ eventKey: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const { event, isLoading, error } = useEventDetail(eventKey)
  const [activeTab, setActiveTab] = useState<'info' | 'reviews'>('info')
  const [reviews, setReviews] = useState<EventReview[]>([])
  const [reviewOffset, setReviewOffset] = useState(0)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [reviewFormOpen, setReviewFormOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [fav, setFav] = useState(false)
  const [hasLoadedReviews, setHasLoadedReviews] = useState(false)
  const [flashNotice, setFlashNotice] = useState<FlashNotice | null>(null)
  const [checkingQueueShowId, setCheckingQueueShowId] = useState<number | null>(null)
  const [activePerformerShowId, setActivePerformerShowId] = useState<number | null>(null)
  const [activePerformerFilter, setActivePerformerFilter] = useState<PerformerFilter>('all')
  const [performerPanelPosition, setPerformerPanelPosition] = useState({ top: 88, left: 12, width: PERFORMER_PANEL_MAX_WIDTH })
  const showSectionRef = useRef<HTMLDivElement | null>(null)
  const showCardRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const showButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({})
  const performerPanelRef = useRef<HTMLDivElement | null>(null)
  const performerStripRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setFlashNotice(flashNoticeStorage.consume())
  }, [eventKey])

  useEffect(() => {
    setReviews([])
    setReviewOffset(0)
    setReviewError(null)
    setHasLoadedReviews(false)
  }, [eventKey])

  useEffect(() => {
    setActivePerformerShowId(null)
    setActivePerformerFilter('all')
  }, [eventKey])

  const fetchReviews = useCallback(async (nextOffset = 0, append = false) => {
    if (!eventKey) return
    setReviewLoading(true)
    setReviewError(null)
    try {
      const data = await eventsApi.reviews(eventKey, { limit: 10, offset: nextOffset })
      setReviews((previous) => (append ? [...previous, ...data] : data))
      setReviewOffset(nextOffset + data.length)
    } catch (errorValue) {
      setReviewError(errorValue instanceof Error ? errorValue.message : 'Không thể tải đánh giá')
    } finally {
      setReviewLoading(false)
    }
  }, [eventKey])

  useEffect(() => {
    if (activeTab === 'reviews' && eventKey && !hasLoadedReviews) {
      void fetchReviews(0, false)
      setHasLoadedReviews(true)
    }
  }, [activeTab, eventKey, fetchReviews, hasLoadedReviews])

  useEffect(() => {
    if (!event) return
    const favouriteKey = event.slug || event.id
    setFav(isFavourite(user?.id, favouriteKey))
  }, [event, user?.id])

  useEffect(() => {
    if (activeTab !== 'info') {
      setActivePerformerShowId(null)
    }
  }, [activeTab])

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0
    return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
  }, [reviews])

  const activePerformerShow = useMemo(
    () => event?.shows.find((show) => show.id === activePerformerShowId) ?? null,
    [activePerformerShowId, event],
  )

  const filteredPerformers = useMemo(() => {
    if (!activePerformerShow) return []
    if (activePerformerFilter === 'all') return activePerformerShow.performers
    return activePerformerShow.performers.filter((performer) => performer.role === activePerformerFilter)
  }, [activePerformerFilter, activePerformerShow])

  const updatePerformerPanelPosition = useCallback((showId: number) => {
    const sectionNode = showSectionRef.current
    const cardNode = showCardRefs.current[showId]
    if (!sectionNode || !cardNode) return

    const sectionRect = sectionNode.getBoundingClientRect()
    const cardRect = cardNode.getBoundingClientRect()
    const sectionWidth = sectionRect.width
    const horizontalPadding = sectionWidth < 768 ? 12 : 18
    const panelWidth = Math.min(PERFORMER_PANEL_MAX_WIDTH, Math.max(sectionWidth - horizontalPadding * 2, 300))
    const rawLeft = cardRect.left - sectionRect.left + cardRect.width / 2 - panelWidth / 2
    const maxLeft = Math.max(sectionWidth - panelWidth - horizontalPadding, horizontalPadding)
    const left = Math.min(Math.max(rawLeft, horizontalPadding), maxLeft)
    const top = Math.max(cardRect.top - sectionRect.top + 80, 88)

    setPerformerPanelPosition({ top, left, width: panelWidth })
  }, [])

  const togglePerformerPanel = useCallback((showId: number) => {
    setActivePerformerFilter('all')
    setActivePerformerShowId((previous) => (previous === showId ? null : showId))
  }, [])

  const scrollPerformerStrip = useCallback((direction: 'left' | 'right') => {
    const node = performerStripRef.current
    if (!node) return
    node.scrollBy({ left: direction === 'left' ? -240 : 240, behavior: 'smooth' })
  }, [])

  const handlePerformerStripWheel = useCallback((eventValue: WheelEvent<HTMLDivElement>) => {
    const node = performerStripRef.current
    if (!node) return
    if (node.scrollWidth <= node.clientWidth) return
    if (Math.abs(eventValue.deltaY) <= Math.abs(eventValue.deltaX)) return

    eventValue.preventDefault()
    node.scrollBy({ left: eventValue.deltaY, behavior: 'auto' })
  }, [])

  useEffect(() => {
    if (!activePerformerShowId) return

    const updatePosition = () => updatePerformerPanelPosition(activePerformerShowId)
    updatePosition()

    const handleEscape = (eventValue: KeyboardEvent) => {
      if (eventValue.key === 'Escape') {
        setActivePerformerShowId(null)
      }
    }

    const handlePointerDown = (eventValue: PointerEvent) => {
      const target = eventValue.target as Node | null
      if (!target) return
      if (performerPanelRef.current?.contains(target)) return
      if (Object.values(showButtonRefs.current).some((button) => button?.contains(target))) return
      setActivePerformerShowId(null)
    }

    window.addEventListener('resize', updatePosition)
    document.addEventListener('keydown', handleEscape)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      window.removeEventListener('resize', updatePosition)
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [activePerformerShowId, updatePerformerPanelPosition])

  const handleImageFile = async (file: File | null) => {
    if (!file) {
      setImageUrl(null)
      return
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('Không thể đọc file ảnh'))
      reader.readAsDataURL(file)
    })
    setImageUrl(dataUrl)
  }

  const submitReview = async () => {
    if (!eventKey) return
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    if (!content.trim()) return

    setSubmitting(true)
    setReviewError(null)
    try {
      await eventsApi.createReview(eventKey, {
        rating,
        content: content.trim(),
        image_url: imageUrl,
      })
      setReviewFormOpen(false)
      setContent('')
      setImageUrl(null)
      setRating(5)
      await fetchReviews(0, false)
    } catch (errorValue) {
      setReviewError(errorValue instanceof Error ? errorValue.message : 'Không thể gửi đánh giá')
    } finally {
      setSubmitting(false)
    }
  }

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
        navigate(`/queue?showId=${showId}&eventKey=${encodeURIComponent(String(event?.id ?? eventKey ?? ''))}`)
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
            <p className="mt-4 line-clamp-3 max-w-2xl text-slate-300">{event.description}</p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => {
                  toggleFavourite(user?.id, event)
                  setFav((value) => !value)
                }}
                className="mr-3 inline-flex items-center gap-2 rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm"
              >
                <Heart className={`h-4 w-4 ${fav ? 'fill-primary text-primary' : ''}`} />
                {fav ? 'Đã yêu thích' : 'Yêu thích'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-12 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2">
          <div className="inline-flex gap-2 rounded-xl border border-[var(--customer-bg-opp)] customer-bg-surface p-2">
            <button
              type="button"
              className={`rounded-lg px-4 py-2 text-sm ${activeTab === 'info' ? 'bg-[var(--customer-bg-opt)] text-white' : 'customer-text-body hover:bg-[var(--customer-bg-opt)]/50'}`}
              onClick={() => setActiveTab('info')}
            >
              Đặt chỗ
            </button>
            <button
              type="button"
              className={`rounded-lg px-4 py-2 text-sm ${activeTab === 'reviews' ? 'bg-[var(--customer-bg-opt)] text-white' : 'customer-text-body hover:bg-[var(--customer-bg-opt)]/50'}`}
              onClick={() => setActiveTab('reviews')}
            >
              Đánh giá
            </button>
          </div>

          {activeTab === 'info' ? (
            <>
              <div className="rounded-xl border border-[var(--customer-bg-opp)] customer-bg-surface p-6">
                <h2 className="mb-4 text-xl font-bold customer-text-body">Giới thiệu sự kiện</h2>
                <p className="leading-relaxed text-gray-500">{event.description}</p>
              </div>

              <div
                id="shows"
                ref={showSectionRef}
                className="relative overflow-visible rounded-xl border border-[var(--customer-bg-opp)] customer-bg-surface p-6"
              >
                <h2 className="mb-4 text-xl font-bold customer-text-body">Show diễn</h2>
                {event.shows.length === 0 ? (
                  <p className="text-sm text-gray-500">Sự kiện này chưa có show mở bán.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {event.shows.map((show) => {
                        const isBookable = canBookShow(show)

                        return (
                          <div
                            key={show.id}
                            ref={(node) => {
                              showCardRefs.current[show.id] = node
                            }}
                            className="rounded-lg border border-white/10 customer-bg-page p-4"
                          >
                            <div className="mb-2 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold customer-text-body">{show.title}</p>
                                <p className="mt-1 text-xs text-gray-500">{show.description}</p>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-3">
                                {showStatusBadge(show)}
                                {show.performers.length > 0 && (
                                  <button
                                    type="button"
                                    ref={(node) => {
                                      showButtonRefs.current[show.id] = node
                                    }}
                                    onClick={() => togglePerformerPanel(show.id)}
                                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10"
                                  >
                                    <Users className="h-4 w-4" />
                                    Nghệ sĩ
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="space-y-1 text-sm text-gray-600">
                              <p>{new Date(show.start_at).toLocaleString('vi-VN')}</p>
                              <p>{show.venue}</p>
                            </div>
                            {isBookable && (
                              <Button
                                className="mt-4 bg-[var(--customer-bg-opt)] hover:bg-[var(--customer-bg-opt)]/50"
                                isLoading={checkingQueueShowId === show.id}
                                onClick={() => void handleBookShow(show.id)}
                              >
                                Đặt vé
                              </Button>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {activePerformerShow && (
                        <div
                          ref={performerPanelRef}
                          className="absolute z-20 overflow-hidden rounded-2xl border border-white/12 bg-[color:color-mix(in_srgb,var(--customer-bg-surface-strong)_82%,black)] shadow-2xl backdrop-blur-xl"
                          style={{
                            top: performerPanelPosition.top,
                            left: performerPanelPosition.left,
                            width: performerPanelPosition.width,
                            maxWidth: 'calc(100% - 24px)',
                          }}
                        >
                          <div className="border-b border-white/10 px-4 py-4 sm:px-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Lineup công khai</p>
                                <h3 className="mt-2 text-lg font-semibold text-white">{activePerformerShow.title}</h3>
                              </div>
                              <div className="relative min-w-[124px]">
                                <select
                                  value={activePerformerFilter}
                                  onChange={(eventValue) => setActivePerformerFilter(eventValue.target.value as PerformerFilter)}
                                  className="h-10 w-full appearance-none rounded-lg border border-white/10 bg-[var(--customer-bg-page)] px-3 pr-10 text-sm customer-text-body outline-none transition focus:border-[var(--customer-bg-opt)] focus:ring-1 focus:ring-[var(--customer-bg-opt)]"
                                  aria-label="Lọc lineup nghệ sĩ"
                                >
                                  <option value="all">Tất cả</option>
                                  <option value="main">Main</option>
                                  <option value="guest">Guest</option>
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                              </div>
                            </div>
                          </div>

                          <div className="relative px-12 py-5 sm:px-14">
                            {filteredPerformers.length > 1 && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => scrollPerformerStrip('left')}
                                  className="absolute left-3 top-1/2 z-10 inline-flex h-10 min-w-11 -translate-y-1/2 items-center justify-center px-3 text-slate-300 transition hover:text-white"
                                  aria-label="Cuộn danh sách nghệ sĩ sang trái"
                                >
                                  <ChevronLeft className="h-5 w-5 stroke-[1.6]" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => scrollPerformerStrip('right')}
                                  className="absolute right-3 top-1/2 z-10 inline-flex h-10 min-w-11 -translate-y-1/2 items-center justify-center px-3 text-slate-300 transition hover:text-white"
                                  aria-label="Cuộn danh sách nghệ sĩ sang phải"
                                >
                                  <ChevronRight className="h-5 w-5 stroke-[1.6]" />
                                </button>
                              </>
                            )}

                            {filteredPerformers.length === 0 ? (
                              <div className="rounded-xl border border-white/8 bg-white/5 px-4 py-8 text-center text-sm text-slate-400">
                                Không có nghệ sĩ thuộc nhóm này trong lineup công khai.
                              </div>
                            ) : (
                              <div
                                ref={performerStripRef}
                                onWheel={handlePerformerStripWheel}
                                className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                              >
                                {filteredPerformers.map((performer) => (
                                  <article
                                    key={`${activePerformerShow.id}-${performer.performer_id}-${performer.role}`}
                                    className="w-[158px] shrink-0 snap-start rounded-xl border border-white/10 bg-black/20 p-3"
                                  >
                                    <img
                                      src={performer.image_url || FALLBACK_PERFORMER_IMAGE}
                                      alt={performer.stage_name}
                                      className="h-28 w-full rounded-lg object-cover"
                                    />
                                    <p className="mt-3 line-clamp-2 font-semibold text-white">{performer.stage_name}</p>
                                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                                      {performerRoleLabel(performer.role)}
                                    </p>
                                  </article>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4 rounded-xl border border-[var(--customer-bg-opp)] customer-bg-surface p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold customer-text-body">Đánh giá của khách hàng</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {reviews.length > 0 ? `Trung bình ${averageRating.toFixed(1)}/5 từ ${reviews.length} đánh giá` : 'Chưa có đánh giá'}
                  </p>
                </div>
                <Button className="bg-[var(--customer-bg-opt)] hover:bg-[var(--customer-bg-opt)]/50" onClick={() => setReviewFormOpen((previous) => !previous)}>
                  Thêm đánh giá
                </Button>
              </div>

              {reviewFormOpen && (
                <div className="space-y-3 rounded-lg customer-bg-page p-4">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} type="button" onClick={() => setRating(star)} className="p-1">
                        <Star className={`h-5 w-5 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-500'}`} />
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="w-full rounded-lg customer-bg-surface px-4 py-2.5 customer-text-body placeholder:text-gray-400 focus:outline-[var(--customer-bg-opt)] focus:ring-2 focus:ring-brand-red"
                    rows={4}
                    placeholder="Chia sẻ trải nghiệm của bạn..."
                    value={content}
                    onChange={(eventValue) => setContent(eventValue.target.value)}
                  />
                  <input type="file" accept="image/*" onChange={(eventValue) => void handleImageFile(eventValue.target.files?.[0] || null)} className="customer-text-body" />
                  {imageUrl && <img src={imageUrl} alt="Ảnh xem trước của đánh giá" className="h-32 w-32 rounded border border-[var(--customer-bg-opp)] object-cover customer-text-body" />}
                  <div className="flex justify-end">
                    <Button onClick={submitReview} isLoading={submitting} disabled={!content.trim()} className="bg-[var(--customer-bg-opt)] hover:bg-[var(--customer-bg-opt)]/50">
                      Gửi đánh giá
                    </Button>
                  </div>
                </div>
              )}

              {reviewError && <p className="text-sm text-red-300">{reviewError}</p>}

              <div className="space-y-3">
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-lg customer-bg-page p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold customer-text-body">{review.reviewer_name}</p>
                      <p className="text-xs text-gray-500">{new Date(review.created_at).toLocaleString('vi-VN')}</p>
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} className={`h-4 w-4 ${star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-500'}`} />
                      ))}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-500">{review.content}</p>
                    {review.image_url && <img src={review.image_url} alt="Ảnh đánh giá" className="mt-3 h-44 w-44 rounded border border-white/20 object-cover" />}
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <Button variant="outline" onClick={() => void fetchReviews(reviewOffset, true)} disabled={reviewLoading}>
                  {reviewLoading ? 'Đang tải...' : 'Hiện thêm'}
                </Button>
              </div>
            </div>
          )}
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
    </div>
  )
}
