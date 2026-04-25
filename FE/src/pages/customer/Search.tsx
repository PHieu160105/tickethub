import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { EventCard } from '@/components/ui/EventCard'
import { FilterSection, FilterCategory, FilterOption } from '@/components/ui/Filter'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { 
  Search as SearchIcon, 
  ChevronLeft, 
  ChevronRight, 
  X,
  SlidersHorizontal,
  Calendar,
  MapPin,
  DollarSign
} from 'lucide-react'

import { 
  SEARCH_RESULTS, 
  VENUES, 
  CATEGORIE,
  TIMEFRAMES 
} from '@/mocks'

export default function Search() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedTimeframe, setSelectedTimeframe] = useState('')
  const [priceRange, setPriceRange] = useState([40, 450])
  const [selectedVenue, setSelectedVenue] = useState('All Venues')
  const [sortBy, setSortBy] = useState('recommended')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 6

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category) 
        ? prev.filter(c => c !== category) 
        : [...prev, category]
    )
    setCurrentPage(1)
  }

  const handlePriceChange = (index: number, value: number) => {
    const newRange = [...priceRange]
    newRange[index] = value
    if (index === 0 && value > priceRange[1] - 10) {
      newRange[1] = value + 10
    }
    if (index === 1 && value < priceRange[0] + 10) {
      newRange[0] = value - 10
    }
    setPriceRange(newRange)
    setCurrentPage(1)
  }

  const resetFilters = () => {
    setSelectedCategories([])
    setSelectedTimeframe('')
    setPriceRange([40, 450])
    setSelectedVenue('All Venues')
    setSearchQuery('')
    setCurrentPage(1)
  }

  // Filter and search logic
  const filteredResults = useMemo(() => {
    let results = [...SEARCH_RESULTS]

    // Search query filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      results = results.filter(event =>
        event.title.toLowerCase().includes(query) ||
        event.venue.toLowerCase().includes(query) ||
        event.category.toLowerCase().includes(query)
      )
    }

    // Category filter
    if (selectedCategories.length > 0) {
      results = results.filter(event =>
        selectedCategories.includes(event.category)
      )
    }

    // Venue filter
    if (selectedVenue !== 'All Venues') {
      results = results.filter(event =>
        event.venue === selectedVenue
      )
    }

    // Price range filter
    results = results.filter(event => {
      const price = parseInt(event.price.replace('$', ''))
      return price >= priceRange[0] && price <= priceRange[1]
    })

    // Timeframe filter (simplified - in real app would filter by date)
    if (selectedTimeframe) {
      // Add date filtering logic here
    }

    // Sorting
    switch (sortBy) {
      case 'price-low':
        results.sort((a, b) => parseInt(a.price.replace('$', '')) - parseInt(b.price.replace('$', '')))
        break
      case 'price-high':
        results.sort((a, b) => parseInt(b.price.replace('$', '')) - parseInt(a.price.replace('$', '')))
        break
      case 'date':
        results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        break
      default:
        // Recommended - keep featured first
        results.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0))
    }

    return results
  }, [searchQuery, selectedCategories, selectedVenue, priceRange, selectedTimeframe, sortBy])

  // Pagination
  const totalPages = Math.ceil(filteredResults.length / itemsPerPage)
  const paginatedResults = filteredResults.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const activeFiltersCount = 
    selectedCategories.length + 
    (selectedVenue !== 'All Venues' ? 1 : 0) + 
    (selectedTimeframe ? 1 : 0) +
    (priceRange[0] !== 40 || priceRange[1] !== 450 ? 1 : 0)

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      
      <main className="max-w-screen-2xl mx-auto px-6 py-12">
        {/* Prominent Search Bar Section */}
        <div className="mb-16 max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-headline font-black tracking-tighter mb-6">
            FIND YOUR RUSH
          </h1>
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-xl blur opacity-25 group-hover:opacity-40 transition duration-1000" />
            <div className="relative flex items-center bg-slate-900/80 rounded-xl p-2 border border-white/10">
              <SearchIcon className="ml-4 text-primary w-5 h-5" />
              <Input
                className="bg-transparent border-none focus:ring-0 w-full px-4 py-3 text-lg font-body placeholder:text-slate-500"
                placeholder="Search by artist, venue, or event..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mr-2 p-1 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              )}
              <Button className="font-headline font-bold uppercase tracking-widest px-8 py-3 rounded-lg hover:scale-105 active:scale-95 transition-all">
                Search
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-10">
          {/* Filter Sidebar */}
          <aside className="w-full md:w-72 shrink-0 space-y-8">
            <FilterSection 
              title="Filters" 
              onReset={resetFilters}
              activeFiltersCount={activeFiltersCount}
            >
              {/* Categories */}
              <FilterCategory label="Categorie">
                {CATEGORIE.map((cat) => (
                  <FilterOption
                    key={cat.key}
                    label={cat.label}
                    checked={selectedCategories.includes(cat.key)}
                    onChange={() => toggleCategory(cat.key)}
                  />
                ))}
              </FilterCategory>

              {/* Date Range */}
              <FilterCategory label="Timeframe">
                <div className="grid grid-cols-2 gap-2">
                  {TIMEFRAMES.slice(0, 2).map((tf) => (
                    <button
                      key={tf.key}
                      onClick={() => setSelectedTimeframe(selectedTimeframe === tf.key ? '' : tf.key)}
                      className={`text-[10px] py-2 border rounded font-headline font-semibold uppercase tracking-tighter transition-all ${
                        selectedTimeframe === tf.key
                          ? 'border-primary/50 bg-primary/10 text-primary'
                          : 'border-white/10 bg-white/5 hover:border-white/30'
                      }`}
                    >
                      {tf.label}
                    </button>
                  ))}
                  <button className="text-[10px] py-2 border border-white/10 rounded bg-white/5 font-headline font-semibold uppercase tracking-tighter col-span-2 hover:border-white/30 transition-all">
                    <Calendar className="w-3 h-3 inline mr-2" />
                    Select Date
                  </button>
                </div>
              </FilterCategory>

              {/* Price Slider */}
              <FilterCategory label="Price Range">
                <div className="relative h-2 bg-slate-700 rounded-full mb-6">
                  <div 
                    className="absolute h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                    style={{
                      left: `${(priceRange[0] / 450) * 100}%`,
                      right: `${100 - (priceRange[1] / 450) * 100}%`
                    }}
                  />
                  <input
                    type="range"
                    min="0"
                    max="450"
                    value={priceRange[0]}
                    onChange={(e) => handlePriceChange(0, parseInt(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    style={{ pointerEvents: 'auto' }}
                  />
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-primary border-2 border-white rounded-full cursor-pointer shadow-lg hover:scale-110 transition-transform"
                    style={{ left: `calc(${(priceRange[0] / 450) * 100}% - 10px)` }}
                  />
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-primary border-2 border-white rounded-full cursor-pointer shadow-lg hover:scale-110 transition-transform"
                    style={{ right: `calc(${100 - (priceRange[1] / 450) * 100}% - 10px)` }}
                  />
                </div>
                <div className="flex justify-between items-center text-xs font-headline font-medium">
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-slate-400" />
                    <span>${priceRange[0]}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>${priceRange[1]}+</span>
                    <DollarSign className="w-3 h-3 text-slate-400" />
                  </div>
                </div>
              </FilterCategory>

              {/* Venue */}
              <FilterCategory label="Venue">
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={selectedVenue}
                    onChange={(e) => {
                      setSelectedVenue(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg text-sm p-3 pl-10 focus:ring-2 focus:ring-primary focus:border-transparent appearance-none cursor-pointer hover:border-white/30 transition-colors"
                  >
                    {VENUES.map((venue) => (
                      <option key={venue} value={venue}>
                        {venue}
                      </option>
                    ))}
                  </select>
                  <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 rotate-90 pointer-events-none" />
                </div>
              </FilterCategory>
            </FilterSection>

            {/* Golden Pass Card */}
            <div className="glass-panel p-6 rounded-xl relative overflow-hidden border border-white/10 bg-gradient-to-br from-yellow-500/10 to-orange-500/10">
              <div className="relative z-10">
                <p className="text-yellow-400 font-headline font-black text-xl mb-2">GOLDEN PASS</p>
                <p className="text-xs text-slate-300 mb-4">Access to all venue VIP lounges for one monthly price.</p>
                <button className="text-[10px] font-headline font-bold tracking-widest uppercase border border-yellow-400 text-yellow-400 px-4 py-2 rounded hover:bg-yellow-400 hover:text-slate-900 transition-all">
                  Learn More
                </button>
              </div>
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-yellow-400/10 rounded-full blur-2xl" />
            </div>
          </aside>

          {/* Results Grid */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-baseline gap-3">
                <h2 className="text-2xl font-headline font-bold">
                  Found {filteredResults.length} events
                </h2>
                {searchQuery && (
                  <span className="text-sm text-slate-400 italic">
                    for "{searchQuery}"
                  </span>
                )}
                {activeFiltersCount > 0 && (
                  <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded-full">
                    {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''} active
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-headline font-bold uppercase tracking-widest text-slate-500">
                  <SlidersHorizontal className="w-4 h-4 inline mr-1" />
                  Sort By:
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="text-sm font-semibold bg-slate-800 border border-white/10 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer hover:border-white/30 transition-colors"
                >
                  <option value="recommended">Recommended</option>
                  <option value="date">Date</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                </select>
              </div>
            </div>

            {/* Results Grid */}
            {paginatedResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Featured Large Card */}
                {paginatedResults[0]?.isFeatured && currentPage === 1 && (
                  <EventCard
                    variant="featured"
                    image={paginatedResults[0].image}
                    title={paginatedResults[0].title}
                    date={paginatedResults[0].date}
                    venue={paginatedResults[0].venue}
                    price={paginatedResults[0].price}
                    badge={paginatedResults[0].badge}
                    href={`/event/${paginatedResults[0].id}`}
                    className="md:col-span-2 lg:col-span-2"
                  />
                )}

                {/* Regular Cards */}
                {paginatedResults.slice(paginatedResults[0]?.isFeatured && currentPage === 1 ? 1 : 0).map((event) => (
                  <EventCard
                    key={event.id}
                    image={event.image}
                    title={event.title}
                    date={event.date}
                    venue={event.venue}
                    price={event.price}
                    badge={event.badge}
                    href={`/event/${event.id}`}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-800 mb-6">
                  <SearchIcon className="w-10 h-10 text-slate-500" />
                </div>
                <h3 className="text-2xl font-headline font-bold mb-2">No events found</h3>
                <p className="text-slate-400 mb-6">Try adjusting your filters or search query</p>
                <Button onClick={resetFilters} variant="primary">
                  Clear All Filters
                </Button>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-16 flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:bg-primary-container hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-10 h-10 flex items-center justify-center rounded-lg font-headline font-bold transition-all ${
                        currentPage === pageNum
                          ? 'bg-primary text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:bg-primary-container hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}