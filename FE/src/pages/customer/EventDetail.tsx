import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/Button'
import { GlobalLoader } from '@/components/ui/GlobalLoader'
import { LuckyWheel } from '@/components/game/LuckyWheel'
import { ScratchCard } from '@/components/game/ScratchCard'
import { eventsApi } from '@/features/events/api/eventsApi'
import { useEventDetail } from '@/features/events/hooks/useEvents'
import { useAuth } from '@/context/AuthContext'
import { useGame } from '@/context/GameContext'
import { extractApiErrorMessage, gameApi } from '@/lib/api'
import type { EventReview, GamePlayResponse } from '@/types'
import { Calendar, Clock, MapPin, Star, Users } from 'lucide-react'
import { Heart } from 'lucide-react'
import { isFavourite, toggleFavourite } from '@/lib/favourites'

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80'

function formatDate(date: string) {
  return new Date(date).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function EventDetail() {
  const { eventKey } = useParams<{ eventKey: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const { event, isLoading, error } = useEventDetail(eventKey)
  const { status: gameStatus, playsLeft, error: gameError, refreshStatus } = useGame()
  const [activeTab, setActiveTab] = useState<'info' | 'reviews' | 'game'>('info')
  const [reviews, setReviews] = useState<EventReview[]>([])
  const [reviewOffset, setReviewOffset] = useState(0)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [reviewFormOpen, setReviewFormOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [gameNotice, setGameNotice] = useState<string>('')
  const [showConfetti, setShowConfetti] = useState(false)
  const [gameModal, setGameModal] = useState<{
    open: boolean
    type: 'wheel' | 'scratch' | null
  }>({ open: false, type: null })
  const [fav, setFav] = useState(false)

  async function fetchReviews(nextOffset = 0, append = false) {
    if (!eventKey) return
    setReviewLoading(true)
    setReviewError(null)
    try {
      const data = await eventsApi.reviews(eventKey, { limit: 10, offset: nextOffset })
      setReviews((prev) => (append ? [...prev, ...data] : data))
      setReviewOffset(nextOffset + data.length)
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : 'Failed to load reviews')
    } finally {
      setReviewLoading(false)
    }
  }

  useEffect(() => {
    if (eventKey) {
      void fetchReviews(0, false)
    }
  }, [eventKey])
  useEffect(() => {
    if (!event) return
    setFav(isFavourite(user?.id, event.slug || event.id))
  }, [event?.id, event?.slug, user?.id])

  useEffect(() => {
    if (!event) return
    void refreshStatus(event.id)
    const timer = window.setInterval(() => {
      void refreshStatus(event.id)
    }, 20000)
    return () => window.clearInterval(timer)
  }, [event?.id, refreshStatus])

  useEffect(() => {
    if (gameModal.open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }, [gameModal.open])

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
      reader.onerror = () => reject(new Error('Cannot read image file'))
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
      setReviewError(e instanceof Error ? e.message : 'Failed to submit review')
    } finally {
      setSubmitting(false)
    }
  }

  const playGame = async (gameType: 'wheel' | 'scratch'): Promise<GamePlayResponse | null> => {
    if (!event) return null
    if (!isAuthenticated) {
      navigate('/login')
      return null
    }
    setGameNotice('')
    try {
      const sign = await gameApi.sign(event.id, gameType)
      const result = await gameApi.play({
        event_id: event.id,
        game_type: gameType,
        nonce: sign.nonce,
        timestamp: sign.timestamp,
        signed_payload: sign.signed_payload,
      })
      const won = Boolean(result.discount_code)
      setGameNotice(result.discount_code ? `Bạn trúng ${result.tier_name} (${result.discount_percent}%)` : '')
      if (won) {
        setShowConfetti(true)
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'triangle'
        osc.frequency.value = 660
        gain.gain.value = 0.05
        osc.start()
        osc.stop(ctx.currentTime + 0.15)
        window.setTimeout(() => setShowConfetti(false), 1500)
      }
      await refreshStatus(event.id)
      return result
    } catch (e) {
      setGameNotice(extractApiErrorMessage(e, 'Không thể chơi game lúc này'))
      return null
    }
  }

  if (isLoading) {
    return <GlobalLoader />
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-24 text-center">
          <h1 className="text-3xl font-bold mb-3">Event Not Found</h1>
          <p className="text-slate-400 mb-6">{error ?? 'This event does not exist or is unavailable.'}</p>
          <Link to="/search">
            <Button>Back to Search</Button>
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />

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
              <Link to={event.queue_enabled ? `/queue?eventKey=${event.slug || event.id}` : `/event/${event.slug || event.id}/seats`}>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-2 inline-flex gap-2">
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'info' ? 'bg-primary text-white' : 'text-slate-300 hover:bg-white/10'}`}
              onClick={() => setActiveTab('info')}
            >
              Đặt chỗ
            </button>
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'reviews' ? 'bg-primary text-white' : 'text-slate-300 hover:bg-white/10'}`}
              onClick={() => setActiveTab('reviews')}
            >
              Đánh giá
            </button>
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'game' ? 'bg-primary text-white' : 'text-slate-300 hover:bg-white/10'}`}
              onClick={() => setActiveTab('game')}
            >
              Giảm giá
            </button>
          </div>

          {activeTab === 'info' ? (
            <>
              <div className="rounded-xl border border-white/10 bg-slate-900/70 p-6">
                <h2 className="text-xl font-bold mb-4">Giới thiệu sự kiện</h2>
                <p className="text-slate-300 leading-relaxed">{event.description}</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/70 p-6">
                <h2 className="text-xl font-bold mb-4">Seat Zones</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {event.zones.map((zone) => (
                    <div key={zone.id} className="rounded-lg bg-slate-800/70 border border-white/10 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold">{zone.name}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/10">{zone.code}</span>
                      </div>
                      <div className="text-sm text-slate-300 space-y-1">
                        <p>
                          {zone.row_count} rows x {zone.seats_per_row} seats
                        </p>
                        <p className="text-secondary font-semibold">${Number(zone.price).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : activeTab === 'reviews' ? (
            <div className="rounded-xl border border-white/10 bg-slate-900/70 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Customer Reviews</h2>
                  <p className="text-sm text-slate-400 mt-1">
                    {reviews.length > 0 ? `Average ${averageRating.toFixed(1)}/5 from ${reviews.length} reviews` : 'No reviews yet'}
                  </p>
                </div>
                <Button onClick={() => setReviewFormOpen((prev) => !prev)}>Thêm đánh giá</Button>
              </div>

              {reviewFormOpen && (
                <div className="rounded-lg border border-white/10 bg-slate-800/50 p-4 space-y-3">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} type="button" onClick={() => setRating(star)} className="p-1">
                        <Star className={`h-5 w-5 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-500'}`} />
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="w-full rounded-lg border bg-slate-900/80 border-white/20 px-4 py-2.5 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red"
                    rows={4}
                    placeholder="Chia sẻ trải nghiệm của bạn..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                  <input type="file" accept="image/*" onChange={(e) => void handleImageFile(e.target.files?.[0] || null)} />
                  {imageUrl && <img src={imageUrl} alt="Review preview" className="w-32 h-32 object-cover rounded border border-white/20" />}
                  <div className="flex justify-end">
                    <Button onClick={submitReview} isLoading={submitting} disabled={!content.trim()}>
                      Gửi đánh giá
                    </Button>
                  </div>
                </div>
              )}

              {reviewError && <p className="text-sm text-red-300">{reviewError}</p>}

              <div className="space-y-3">
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-lg border border-white/10 bg-slate-800/40 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{review.reviewer_name}</p>
                      <p className="text-xs text-slate-400">{new Date(review.created_at).toLocaleString('vi-VN')}</p>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} className={`h-4 w-4 ${star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-500'}`} />
                      ))}
                    </div>
                    <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap">{review.content}</p>
                    {review.image_url && <img src={review.image_url} alt="Review" className="mt-3 w-44 h-44 object-cover rounded border border-white/20" />}
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <Button variant="outline" onClick={() => void fetchReviews(reviewOffset, true)} disabled={reviewLoading}>
                  {reviewLoading ? 'Loading...' : 'Hiện thêm'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-slate-900/70 p-6 space-y-3 relative overflow-hidden">
              <h3 className="text-lg font-bold">Phiếu giảm giá may mắn</h3>
              <p className="text-xs text-slate-400">
                Reset: {gameStatus ? new Date(gameStatus.next_reset_time).toLocaleString('vi-VN') : '--'}
              </p>
              {gameStatus && (
                <div className="text-xs text-slate-300 space-y-1">
                  <p className="text-m text-white font-bold">Tỷ lệ phần thưởng</p>
                  {gameStatus.remaining_prizes.map((item) => (
                    <p key={item.tier_name}>
                      {item.tier_name}: con {item.remaining_qty}
                    </p>
                  ))}
                </div>
              )}
              <LuckyWheel status={gameStatus} playsLeft={playsLeft.wheel} onPlay={() => setGameModal({ open: true, type: 'wheel' })} />
              <ScratchCard playsLeft={playsLeft.scratch} onPlay={() => setGameModal({ open: true, type: 'scratch' })} />
              {gameError && <p className="text-xs text-amber-300">{gameError}</p>}
              {gameNotice && <p className="text-xs text-emerald-300">{gameNotice}</p>}
              {showConfetti && (
                <div className="pointer-events-none absolute inset-0 flex items-start justify-center text-2xl animate-pulse">
                  <span>🎉🎉🎉</span>
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-6 space-y-4">
            <h3 className="text-lg font-bold">Event Info</h3>
            <div className="flex items-start gap-3 text-slate-300">
              <Calendar className="w-5 h-5 text-secondary mt-0.5" />
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400">Starts</p>
                <p>{formatDate(event.start_at)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-slate-300">
              <Clock className="w-5 h-5 text-secondary mt-0.5" />
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400">Ends</p>
                <p>{formatDate(event.end_at)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-slate-300">
              <MapPin className="w-5 h-5 text-secondary mt-0.5" />
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400">Venue</p>
                <p>{event.venue}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-slate-300">
              <Users className="w-5 h-5 text-secondary mt-0.5" />
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400">Queue</p>
                <p>{event.queue_enabled ? 'Enabled' : 'Disabled'}</p>
              </div>
            </div>
          </div>

          <Link to={event.queue_enabled ? `/queue?eventKey=${event.slug || event.id}` : `/event/${event.slug || event.id}/seats`}>
            <Button className="w-full" size="lg">
              {event.queue_enabled ? 'Continue To Queue' : 'Continue To Seats'}
            </Button>
          </Link>
        </aside>
      </main>

      {gameModal.open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          
          {/* Overlay nền */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setGameModal({ open: false, type: null })}
          />

          {/* Nội dung popup */}
          <div className="relative z-10 w-[90%] max-w-md rounded-xl bg-slate-900 border border-white/10 p-6 shadow-2xl">
            
            <button
              className="absolute top-3 right-3 text-slate-400 hover:text-white"
              onClick={() => setGameModal({ open: false, type: null })}
            >
              ✕
            </button>

            <h3 className="text-lg font-bold mb-4 text-center">
              {gameModal.type === 'wheel' ? 'Vòng quay may mắn' : 'Cào vé'}
            </h3>

            {gameModal.type === 'wheel' ? (
              <LuckyWheel
                status={gameStatus}
                playsLeft={playsLeft.wheel}
                onPlay={async () => await playGame('wheel')}
              />
            ) : (
              <ScratchCard
                playsLeft={playsLeft.scratch}
                onPlay={() => {return playGame('scratch')}}
              />
            )}

            {gameNotice && (
              <p className="text-sm text-emerald-300 mt-4 text-center">
                {gameNotice}
              </p>
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
