import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { GlobalLoader } from '@/components/ui/GlobalLoader'
import { eventsApi } from '@/features/events/api/eventsApi'
import { useEventDetail } from '@/features/events/hooks/useEvents'
import { useAuth } from '@/context/AuthContext'
import type { EventReview, EventStatus } from '@/types'
import { Calendar, Clock, MapPin, Star, Users } from 'lucide-react'
import { Heart } from 'lucide-react'
import { isFavourite, toggleFavourite } from '@/lib/favourites'

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
  const variants: Record<EventStatus, { text: string; className: string }> = {
    draft: { text: 'Draft', className: 'bg-gray-500/50 text-white' },
    live: { text: 'Live', className: 'bg-green-500/50 text-white' },
    closed: { text: 'Closed', className: 'bg-red-500/50 text-white' },
  }

  const variant = variants[status]
  return <Badge className={variant.className}>{variant.text}</Badge>
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

  useEffect(() => {
    setReviews([])
    setReviewOffset(0)
    setReviewError(null)
    setHasLoadedReviews(false)
  }, [eventKey])

  const fetchReviews = useCallback(async (nextOffset = 0, append = false) => {
    if (!eventKey) return
    setReviewLoading(true)
    setReviewError(null)
    try {
      const data = await eventsApi.reviews(eventKey, { limit: 10, offset: nextOffset })
      setReviews((prev) => (append ? [...prev, ...data] : data))
      setReviewOffset(nextOffset + data.length)
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : 'Không thể tải đánh giá')
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

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0
    return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
  }, [reviews])

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
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : 'Không thể gửi đánh giá')
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return <GlobalLoader />
  }

  if (error || !event) {
    return (
      <div className="min-h-screen text-white">
        <main className="max-w-7xl mx-auto px-4 py-24 text-center">
          <h1 className="text-3xl font-bold mb-3">Không tìm thấy sự kiện</h1>
          <p className="text-slate-400 mb-6">{error ?? 'Sự kiện này không tồn tại hoặc đang tạm ẩn.'}</p>
          <Link to="/search">
            <Button>Quay lại tìm kiếm</Button>
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen text-white">
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
            <div className="mt-6">
              <button
                type="button"
                onClick={() => {
                  if (!event) return
                  toggleFavourite(user?.id, event)
                  setFav((v) => !v)
                }}
                className="mr-3 inline-flex items-center gap-2 rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm"
              >
                <Heart className={`w-4 h-4 ${fav ? 'fill-primary text-primary' : ''}`} />
                {fav ? 'Đã yêu thích' : 'Yêu thích'}
              </button>
              <Link to="#shows">
              </Link>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-[var(--customer-bg-opp)] customer-bg-surface p-2 inline-flex gap-2">
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'info' ? 'bg-[var(--customer-bg-opt)] text-white' : 'customer-text-body hover:bg-[var(--customer-bg-opt)]/50'}`}
              onClick={() => setActiveTab('info')}
            >
              Đặt chỗ
            </button>
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'reviews' ? 'bg-[var(--customer-bg-opt)] text-white' : 'customer-text-body hover:bg-[var(--customer-bg-opt)]/50'}`}
              onClick={() => setActiveTab('reviews')}
            >
              Đánh giá
            </button>
          </div>

          {activeTab === 'info' ? (
            <>
              <div className="rounded-xl border border-[var(--customer-bg-opp)] customer-bg-surface p-6">
                <h2 className="text-xl customer-text-body font-bold mb-4">Giới thiệu sự kiện</h2>
                <p className="text-gray-500 leading-relaxed">{event.description}</p>
              </div>

              <div id="shows" className="rounded-xl border border-[var(--customer-bg-opp)] customer-bg-surface p-6">
                <h2 className="text-xl customer-text-body font-bold mb-4">Show diễn</h2>
                {event.shows.length === 0 ? (
                  <p className="text-sm text-gray-500">Sự kiện này chưa có show mở bán.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {event.shows.map((show) => (
                      <div key={show.id} className="rounded-lg customer-bg-page border border-white/10 p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <p className="font-semibold customer-text-body">{show.title}</p>
                            <p className="text-xs text-gray-500 mt-1">{show.description}</p>
                          </div>
                          {statusBadge(show.status)}
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>{new Date(show.start_at).toLocaleString('vi-VN')}</p>
                          <p>{show.venue}</p>
                        </div>
                        <Link to={`/shows/${show.id}/seats`} className="mt-4 inline-block ">
                          <Button className='bg-[var(--customer-bg-opt)] hover:bg-[var(--customer-bg-opt)]/50'>Đặt vé</Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-xl border  border-[var(--customer-bg-opp)] customer-bg-surface p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold customer-text-body">Đánh giá của khách hàng</h2>
                  <p className="text-sm text-slate-400 mt-1">
                    {reviews.length > 0 ? `Trung bình ${averageRating.toFixed(1)}/5 từ ${reviews.length} đánh giá` : 'Chưa có đánh giá'}
                  </p>
                </div>
                <Button className= 'bg-[var(--customer-bg-opt)] hover:bg-[var-(--customer-bg-opt)]/50' onClick={() => setReviewFormOpen((prev) => !prev)}>Thêm đánh giá</Button>
              </div>

              {reviewFormOpen && (
                <div className="rounded-lg customer-bg-page p-4 space-y-3">
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
                    onChange={(e) => setContent(e.target.value)}
                  />
                  <input type="file" accept="image/*" onChange={(e) => void handleImageFile(e.target.files?.[0] || null)} className="customer-text-body" />
                  {imageUrl && <img src={imageUrl} alt="Ảnh xem trước của đánh giá" className="w-32 h-32 customer-text-body object-cover rounded border border-[var(--customer-bg-opp)]" />}
                  <div className="flex justify-end">
                    <Button onClick={submitReview} isLoading={submitting} disabled={!content.trim()} className='bg-[var(--customer-bg-opt)] hover:bg-[var(--customer-bg-opt)]/50'>
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
                    <div className="flex items-center gap-1 mt-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} className={`h-4 w-4 ${star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-500'}`} />
                      ))}
                    </div>
                    <p className="text-sm text-gray-500 mt-2 whitespace-pre-wrap">{review.content}</p>
                    {review.image_url && <img src={review.image_url} alt="Ảnh đánh giá" className="mt-3 w-44 h-44 object-cover rounded border border-white/20" />}
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
          <div className="rounded-xl border border-[var(--customer-bg-opp)] customer-bg-surface p-6 space-y-4">
            <h3 className="text-lg font-bold customer-text-body">Thông tin sự kiện</h3>
            <div className="flex items-start gap-3 text-slate-500">
              <Calendar className="w-5 h-5 text-secondary mt-0.5" />
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500">Bắt đầu</p>
                <p>{formatDate(event.start_at)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-slate-500">
              <Clock className="w-5 h-5 text-secondary mt-0.5" />
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500">Kết thúc</p>
                <p>{formatDate(event.end_at)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-slate-500">
              <MapPin className="w-5 h-5 text-secondary mt-0.5" />
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500">Địa điểm</p>
                <p>{event.venue}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-slate-500">
              <Users className="w-5 h-5 text-secondary mt-0.5" />
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
