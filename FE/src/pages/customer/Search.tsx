import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { EventCard } from '@/components/ui/EventCard'
// import { GlobalLoader } from '@/components/ui/GlobalLoader'
import { Input } from '@/components/ui/Input'
import { Toast } from '@/components/ui/Toast'
import { useEvents } from '@/features/events/hooks/useEvents'
import { flashNoticeStorage, type FlashNotice } from '@/lib/storage'
import { formatCurrencyVnd } from '@/lib/utils'
import { Calendar, ChevronLeft, ChevronRight, DollarSign, MapPin, Search as SearchIcon, SlidersHorizontal, X } from 'lucide-react'

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80'
const DEFAULT_PRICE_LIMIT = 5_000_000

export default function Search() {
  const [urlParams, setUrlParams] = useSearchParams()
  const urlParamsKey = urlParams.toString()
  const initialQuery = urlParams.get('q') ?? ''
  const initialCategory = urlParams.get('category') ?? 'all'
  const [searchInput, setSearchInput] = useState(initialQuery)
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [selectedCategory, setSelectedCategory] = useState(initialCategory || 'all')
  const [selectedVenue, setSelectedVenue] = useState('all')
  const [priceRange, setPriceRange] = useState<[number, number]>([0, DEFAULT_PRICE_LIMIT])
  const [hasTouchedPriceRange, setHasTouchedPriceRange] = useState(false)
  const [sortBy, setSortBy] = useState<'recommended' | 'date' | 'title'>('recommended')
  const [currentPage, setCurrentPage] = useState(1)
  const [flashNotice, setFlashNotice] = useState<FlashNotice | null>(() => flashNoticeStorage.consume())
  const itemsPerPage = 6

  const { events, isLoading, error } = useEvents({
    search: searchQuery || undefined,
    category: selectedCategory === 'all' ? undefined : selectedCategory,
  })

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setSearchInput(initialQuery)
      setSearchQuery(initialQuery)
      setSelectedCategory(initialCategory || 'all')
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [initialCategory, initialQuery, urlParamsKey])

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(new Set(events.map((event) => event.category).filter(Boolean)))
    return ['all', ...uniqueCategories]
  }, [events])

  const venues = useMemo(() => {
    const uniqueVenues = Array.from(new Set(events.map((event) => event.venue).filter(Boolean)))
    return ['all', ...uniqueVenues]
  }, [events])

  const priceRangeLimit = useMemo(() => {
    const highestEventPrice = events.reduce((currentMax, event) => Math.max(currentMax, Number(event.max_price) || 0), 0)
    return Math.max(DEFAULT_PRICE_LIMIT, highestEventPrice)
  }, [events])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      if (!hasTouchedPriceRange) {
        setPriceRange([0, priceRangeLimit])
        return
      }

      setPriceRange((prev) => (prev[1] > priceRangeLimit ? [0, priceRangeLimit] : prev))
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [hasTouchedPriceRange, priceRangeLimit])

  const filteredResults = useMemo(() => {
    let results = [...events]

    if (selectedVenue !== 'all') {
      results = results.filter((event) => event.venue === selectedVenue)
    }

    results = results.filter((event) => (Number(event.max_price) || 0) <= priceRange[1])

    if (sortBy === 'date') {
      results.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    } else if (sortBy === 'title') {
      results.sort((a, b) => a.title.localeCompare(b.title))
    }

    return results
  }, [events, priceRange, selectedVenue, sortBy])

  const totalPages = Math.ceil(filteredResults.length / itemsPerPage)
  const paginatedResults = filteredResults.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const activeFiltersCount =
    Number(selectedCategory !== 'all') + Number(selectedVenue !== 'all') + Number(priceRange[1] < priceRangeLimit)

  const onSearchSubmit = () => {
    setCurrentPage(1)
    const nextSearch = searchInput.trim()
    setSearchQuery(nextSearch)
    const nextParams = new URLSearchParams(urlParams)
    if (nextSearch) nextParams.set('q', nextSearch)
    else nextParams.delete('q')
    if (selectedCategory !== 'all') nextParams.set('category', selectedCategory)
    else nextParams.delete('category')
    setUrlParams(nextParams, { replace: true })
  }

  const resetFilters = () => {
    setSearchInput('')
    setSearchQuery('')
    setSelectedCategory('all')
    setSelectedVenue('all')
    setHasTouchedPriceRange(false)
    setPriceRange([0, priceRangeLimit])
    setSortBy('recommended')
    setCurrentPage(1)
    setUrlParams({}, { replace: true })
  }

  // Nếu muốn khóa toàn trang trong lúc tải danh sách sự kiện, có thể bật lại GlobalLoader tại đây.

  return (
    <div className="min-h-screen text-white">
      {flashNotice && (
        <div className="fixed right-4 top-24 z-[100] w-[calc(100vw-2rem)] max-w-sm">
          <Toast
            variant={flashNotice.variant ?? 'warning'}
            title={flashNotice.title}
            description={flashNotice.description}
            onClose={() => setFlashNotice(null)}
          />
        </div>
      )}
      <main className="app-theme-page max-w-screen-2xl mx-auto px-6 py-12">
        <div className="mb-16 max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-headline font-black tracking-tighter mb-6 customer-text-header">Tìm sự kiện</h1>
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-xl blur opacity-25 group-hover:opacity-40 transition duration-1000" />
            <div className="relative flex items-center customer-bg-surface rounded-xl p-2 border border-white/10">
              <SearchIcon className="ml-4 text-primary w-5 h-5" />
              <Input
                className="bg-transparent border-none focus:ring-0 w-full px-4 py-3 text-lg font-body placeholder:text-slate-500"
                placeholder="Tìm kiếm tên sự kiện, địa điểm,..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    onSearchSubmit()
                  }
                }}
              />
              {searchInput && (
                <button onClick={() => setSearchInput('')} className="mr-2 p-1 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              )}
              <Button
                className="tracking-widest uppercase px-8 py-3 rounded-xl hover:scale-105 active:scale-95 transition-all bg-[var(--customer-bg-opt)]"
                onClick={onSearchSubmit}
              >
                Tìm
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-10">
          <aside className="w-full md:w-72 shrink-0 space-y-6">
            <div className="rounded-xl border border-[var(--customer-bg-opp)] p-5 customer-bg-surface space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm uppercase tracking-widest customer-text-body">Bộ lọc</h3>
                <button className="text-xs text-primary hover:underline" onClick={resetFilters}>
                  Đặt lại
                </button>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest customer-text-body mb-2">Thể loại</label>
                <select
                  value={selectedCategory}
                  onChange={(event) => {
                    setSelectedCategory(event.target.value)
                    setCurrentPage(1)
                    const nextParams = new URLSearchParams(urlParams)
                    const nextCategory = event.target.value
                    if (nextCategory !== 'all') nextParams.set('category', nextCategory)
                    else nextParams.delete('category')
                    setUrlParams(nextParams, { replace: true })
                  }}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category === 'all' ? 'Tất cả' : category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest customer-text-body mb-2">Địa điểm</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <select
                    value={selectedVenue}
                    onChange={(event) => {
                      setSelectedVenue(event.target.value)
                      setCurrentPage(1)
                    }}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-9 py-2"
                  >
                    {venues.map((venue) => (
                      <option key={venue} value={venue}>
                        {venue === 'all' ? 'Tất cả' : venue}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest customer-text-body mb-2">Khoảng giá</label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm customer-text-body">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    <span>
                      {formatCurrencyVnd(priceRange[0])} - {formatCurrencyVnd(priceRange[1])}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2_000_000}
                    step={50_000}
                    value={priceRange[1]}
                    onChange={(event) => {
                      setHasTouchedPriceRange(true)
                      setPriceRange([0, Number(event.target.value)])
                      setCurrentPage(1)
                    }}
                    className="w-full accent-[var(--customer-bg-opt)]"
                  />
                </div>
              </div>
            </div>
          </aside>

          <div className="flex-1">
            <div className="flex items-center justify-between mb-8 gap-4">
              <div className="flex items-baseline gap-3 flex-wrap">
                <h2 className="text-2xl font-headline font-bold customer-text-body">Đã tìm được {filteredResults.length} sự kiện</h2>
                {searchQuery && <span className="text-sm text-slate-400 italic">cho từ khóa "{searchQuery}"</span>}
                {activeFiltersCount > 0 && (
                  <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded-full">{activeFiltersCount} bộ lọc đang bật</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-headline font-bold uppercase tracking-widest text-slate-500">
                  <SlidersHorizontal className="w-4 h-4 inline mr-1" />
                  Sắp xếp:
                </span>
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as 'recommended' | 'date' | 'title')}
                  className="text-sm font-semibold bg-slate-800 border border-white/10 rounded-lg px-3 py-2"
                >
                  <option value="recommended">Gợi ý</option>
                  <option value="date">Ngày diễn</option>
                  <option value="title">Tên sự kiện</option>
                </select>
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-20 customer-text-body">Đang tải sự kiện...</div>
            ) : error ? (
              <div className="text-center py-20">
                <p className="text-red-400 mb-4">{error}</p>
                <Button onClick={onSearchSubmit}>Thử lại</Button>
              </div>
            ) : paginatedResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedResults.map((event) => (
                  <EventCard
                    key={event.id}
                    image={event.cover_image_url || FALLBACK_IMAGE}
                    title={event.title}
                    date={event.start_at}
                    endDate={event.end_at}
                    venue={event.venue}
                    price="Xem giá ghế"
                    badge={event.category}
                    href={`/event/${event.id}`}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-800 mb-6">
                  <SearchIcon className="w-10 h-10 text-slate-500" />
                </div>
                <h3 className="text-2xl font-headline font-bold mb-2">Không tìm thấy sự kiện</h3>
                <p className="text-slate-400 mb-6">Thử sử dụng bộ lọc hoặc tìm kiếm lại</p>
                <Button onClick={resetFilters} variant="primary">
                  Xóa tất cả lọc
                </Button>
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-16 flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:bg-primary-container hover:text-white transition-all disabled:opacity-50"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {Array.from({ length: totalPages }, (_, index) => index + 1)
                  .slice(0, 7)
                  .map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-10 h-10 flex items-center justify-center rounded-lg font-headline font-bold transition-all ${
                        currentPage === page ? 'bg-primary text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:bg-primary-container hover:text-white transition-all disabled:opacity-50"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            <div className="mt-8 text-slate-500 text-xs flex items-center gap-2 uppercase tracking-wider">
              <Calendar className="w-4 h-4" />
              Múi giờ Hà nội UTC+7
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
