import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { 
  Sparkles, ArrowRight, X, ChevronLeft, ChevronRight,
  Music, Theater, Star, Ticket, User, Search, Flame, Laugh, Trophy
} from 'lucide-react'

import {
  HERO_EVENTS,
  FEATURED_EVENTS,
  TRENDING_SEARCHES,
  RECENTLY_VIEWED,
  CATEGORIES,
  FEATURE_ITEMS
} from '@/mocks'

const ICON_MAP = {
  Music, Sports: Trophy, Comedy: Laugh, Theater,
  Star, Ticket, User, Search
} as const

export default function Home() {
  const [currentHero, setCurrentHero] = useState(0)
  const [recentlyViewed, setRecentlyViewed] = useState(RECENTLY_VIEWED)

  // Auto-rotate hero slider
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHero((prev) => (prev + 1) % HERO_EVENTS.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [])

  const removeRecentlyViewed = (id: number) => {
    setRecentlyViewed(prev => prev.filter(item => item.id !== id))
  }

  const nextHero = () => {
    setCurrentHero((prev) => (prev + 1) % HERO_EVENTS.length)
  }

  const prevHero = () => {
    setCurrentHero((prev) => (prev - 1 + HERO_EVENTS.length) % HERO_EVENTS.length)
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Hero Slider Section */}
      <section className="relative h-[400px] sm:h-[500px] overflow-hidden">
        {HERO_EVENTS.map((event, index) => (
          <div
            key={event.id}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentHero ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${event.image})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
            
            <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center">
              <div className="max-w-2xl space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/20 px-4 py-2 text-xs uppercase tracking-[0.3em] text-primary border border-primary/30">
                  <Sparkles className="h-4 w-4" />
                  Featured Event
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight">
                  {event.title}
                </h1>
                <p className="text-xl sm:text-2xl text-slate-300">
                  {event.subtitle}
                </p>
                <Link to="/search">
                  <Button className="min-w-[180px]" variant="primary" size="lg">
                    {event.cta}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ))}

        {/* Hero Navigation */}
        <button
          onClick={prevHero}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button
          onClick={nextHero}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        {/* Hero Dots */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {HERO_EVENTS.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentHero(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentHero ? 'w-8 bg-primary' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      </section>

      {/* Main Content Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Content - 3 columns */}
          <div className="lg:col-span-3 space-y-12">
            {/* Featured Events Grid */}
            <div>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Flame className="h-6 w-6 text-orange-500" />
                Hot Events
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {FEATURED_EVENTS.map((event) => (
                  <Link 
                    key={event.id} 
                    to={`/event/${event.id}`}
                    className="group relative overflow-hidden rounded-2xl bg-slate-900 border border-white/10 hover:border-primary/50 transition-all duration-300"
                  >
                    <div className="aspect-[4/3] overflow-hidden">
                      <img 
                        src={event.image} 
                        alt={event.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1 rounded-full bg-primary text-xs font-bold uppercase tracking-wider">
                        {event.tag || event.category}
                      </span>
                    </div>
                    <div className="p-5">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">
                        {event.category}
                      </p>
                      <h3 className="text-lg font-bold group-hover:text-primary transition-colors">
                        {event.title}
                      </h3>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Trending Searches */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Flame className="h-6 w-6 text-red-500" />
                  Trending Searches
                </h2>
                <div className="flex gap-2">
                  <button className="p-2 rounded-lg bg-slate-900 border border-white/10 hover:border-primary/50 transition-colors">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button className="p-2 rounded-lg bg-slate-900 border border-white/10 hover:border-primary/50 transition-colors">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                {TRENDING_SEARCHES.map((item) => (
                  <Link 
                    key={item.id} 
                    to={`/search?q=${item.name}`}
                    className="flex-shrink-0 group"
                  >
                    <div className="w-32 sm:w-40 space-y-3">
                      <div className="aspect-[4/3] rounded-xl overflow-hidden border border-white/10 group-hover:border-primary/50 transition-colors">
                        <img 
                          src={item.image} 
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">
                          {item.category}
                        </p>
                        <p className="font-semibold text-sm group-hover:text-primary transition-colors">
                          {item.name}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Recently Viewed */}
            <div>
              <h2 className="text-2xl font-bold mb-6">Recently Viewed</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {recentlyViewed.map((item) => (
                  <div 
                    key={item.id} 
                    className="group relative rounded-xl bg-slate-900/50 border border-white/10 p-3 hover:border-primary/30 transition-all"
                  >
                    <button
                      onClick={() => removeRecentlyViewed(item.id)}
                      className="absolute top-2 right-2 p-1 rounded-full bg-slate-800/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <div className="aspect-square rounded-lg overflow-hidden mb-3">
                      <img 
                        src={item.image} 
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-xs font-medium line-clamp-2">{item.name}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Categories */}
            <div>
              <h2 className="text-2xl font-bold mb-6">Browse by Category</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {CATEGORIES.map((category) => {
                  const Icon = ICON_MAP[category.iconKey]
                  return (
                    <Link
                      key={category.id}
                      to={`/search?category=${category.name.toLowerCase()}`}
                      className="group relative overflow-hidden rounded-2xl bg-slate-900 border border-white/10 p-6 hover:border-primary/50 transition-all duration-300"
                    >
                      <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${category.color} mb-4`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="text-lg font-bold group-hover:text-primary transition-colors">
                        {category.name}
                      </h3>
                      <ArrowRight className="absolute bottom-6 right-6 h-5 w-5 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all" />
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right Sidebar - Features */}
          <div className="space-y-4">
            <h3 className="text-sm uppercase tracking-[0.3em] text-slate-400 mb-4">Featured</h3>
            {FEATURE_ITEMS.map((item, index) => {
              const Icon = ICON_MAP[item.iconKey]
              return (
                <Link
                  key={index}
                  to={item.link}
                  className="group block rounded-xl bg-slate-900/80 border border-white/10 p-5 hover:border-primary/50 transition-all duration-300"
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${item.color}`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-sm mb-1 group-hover:text-primary transition-colors">
                        {item.title}
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </Link>
              )
            })}

            {/* Advertisement Placeholder */}
            <div className="rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 p-6 text-center">
              <p className="text-xs uppercase tracking-wider mb-2 opacity-80">Advertisement</p>
              <div className="aspect-[4/3] rounded-lg bg-white/10 flex items-center justify-center">
                <span className="text-sm font-medium">Ad Space</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}