import { useMemo, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { EventCard } from '@/components/ui/EventCard'
import { GlobalLoader } from '@/components/ui/GlobalLoader'
import { useEvents } from '@/features/events/hooks/useEvents'
import { CalendarDays, MapPin, Sparkles } from 'lucide-react'

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80'

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}

export default function Home() {
  const { events, isLoading, error } = useEvents()

  const topEvents = useMemo(() => events.slice(0, 3), [events])
  const [currentIndex, setCurrentIndex] = useState(0)

  const heroEvent = topEvents[currentIndex]

  const featuredEvents = useMemo(() => events.slice(0, 6), [events])

  const categoryList = useMemo(() => {
    return Array.from(new Set(events.map((event) => event.category).filter(Boolean))).slice(0, 8)
  }, [events])

  useEffect(() => {
    if (topEvents.length === 0) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % topEvents.length)
    }, 4000) // 4s đổi slide

    return () => clearInterval(interval)
  }, [topEvents])

  if (isLoading) {
    return <GlobalLoader />
  }

  return (
    <main className="app-theme-page min-h-screen text-on-background">
      <section className="relative h-[480px] md:h-[480px] overflow-hidden border-b border-white/10">
        {heroEvent ? (
          <>
            <div className="absolute inset-0">
              {topEvents.map((event, index) => (
                <img
                  key={event.id}
                  src={event.cover_image_url || FALLBACK_IMAGE}
                  alt={event.title}
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
                    index === currentIndex ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              ))}
            </div>
            <div className="absolute inset-0" 
                 style={{
                    background: `linear-gradient(to right, var(--customer-bg-surface), color-mix(in srgb, var(--customer-bg-surface) 80%, transparent), transparent)`
                 }} 
            />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800" />
        )}

        <div className="relative max-w-7xl mx-auto px-6 py-20">
          {isLoading ? (
            <p className="text-slate-300">Loading events...</p>
          ) : error ? (
            <p className="text-amber-300">{error}</p>
          ) : heroEvent ? (
            <div className="max-w-5xl space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--customer-bg-opp)] bg-black/30 px-4 py-2 text-xs uppercase tracking-[0.2em]">
                <Sparkles className="h-4 w-4" />
                Sự kiện nổi bật
              </div>
              <h1 className="text-4xl md:text-6xl font-black leading-tight">{heroEvent.title}</h1>
              <p className="customer-text-body max-w-2xl line-clamp-3">{heroEvent.description}</p>
              <div className="flex flex-wrap gap-4 text-sm customer-text-body">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-cyan-500" />
                  {formatDate(heroEvent.start_at)}
                </span>
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-red-500" />
                  {heroEvent.venue}
                </span>
              </div>
              <div className="flex gap-3">
                <Link to={`/event/${heroEvent.slug || heroEvent.id}`}>
                  <Button size="md" variant={"primary"}>Chi tiết</Button>
                </Link>
                <Link to="/search">
                  <Button size="md" variant="outline">
                    Sự kiện khác
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl space-y-4">
              <h1 className="text-4xl md:text-5xl font-black">Hiện chưa có sự kiện đang mở bán</h1>
              <p className="text-slate-400">Vui lòng quay lại sau hoặc tìm các sự kiện sắp diễn ra.</p>
              <Link to="/search">
                <Button>Đi tới tìm kiếm</Button>
              </Link>
            </div>
          )}
        </div>
        <button
          onClick={() => setCurrentIndex((prev) => (prev - 1 + topEvents.length) % topEvents.length)}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10"
        >
          ◀
        </button>

        <button
          onClick={() => setCurrentIndex((prev) => (prev + 1) % topEvents.length)}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10"
        >
          ▶
        </button>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {topEvents.map((_, index) => (
          <div
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`h-2 w-2 rounded-full cursor-pointer ${
              index === currentIndex ? 'bg-white' : 'bg-white/40'
            }`}
          />
        ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-12 space-y-10">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">Sự kiện gần đây</h2>
          <div className="w-20 h-8 flex items-center justify-center customer-bg-surface border-1 border-[var(--customer-bg-opp)] customer-text-body hover:text-on-background rounded-xl">
          <Link to="/search" className="text-sm font-bold">
            Xem tất cả
          </Link>
          </div>
        </div>

        {isLoading ? (
          <p className="text-slate-400">Đang tải sự kiện...</p>
        ) : featuredEvents.length === 0 ? (
          <p className="text-slate-400">Không có sự kiện khả dụng.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredEvents.map((event) => (
              <EventCard
                key={event.id}
                image={event.cover_image_url || FALLBACK_IMAGE}
                title={event.title}
                date={formatDate(event.start_at)}
                venue={event.venue}
                price="Xem chi tiết"
                badge={event.category}
                href={`/event/${event.slug || event.id}`}
              />
            ))}
          </div>
        )}

        <div>
          <h3 className="text-xl font-bold mb-4">Thể loại</h3>
          <div className="flex flex-wrap gap-3">
            {categoryList.map((category) => (
              <Link
                key={category}
                to={`/search?category=${encodeURIComponent(category)}`}
                className="rounded-full border border-white/20 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
              >
                {category}
              </Link>
            ))}
            {categoryList.length === 0 && <p className="text-sm text-slate-400">Không tìm thấy thể loại.</p>}
          </div>
        </div>
      </section>
    </main>
  )
}
