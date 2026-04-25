import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import {
  Calendar,
  MapPin,
  Share2,
  Heart,
  Star,
  ChevronDown,
  Clock,
} from 'lucide-react'

import { EVENT_DETAILS, getEventById } from '@/mocks'

export default function EventDetail() {
  const { id } = useParams()
  const eventId = Number(id) || 1
  const event = getEventById(eventId) || EVENT_DETAILS[0]
  
  const [isFavorite, setIsFavorite] = useState(false)
  const [activeTab, setActiveTab] = useState('concerts')
  const [locationFilter, setLocationFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('all')

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= Math.floor(rating)
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-gray-600 text-gray-600'
            }`}
          />
        ))}
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Event Not Found</h1>
          <Link to="/">
            <Button variant="primary">Back to Home</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Navbar />

      {/* Breadcrumb */}
      <div className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="text-sm text-slate-600">
            <Link to="/" className="hover:text-primary">Home</Link>
            <span className="mx-2">/</span>
            <Link to="/concerts" className="hover:text-primary">Concerts</Link>
            <span className="mx-2">/</span>
            <span className="text-slate-900 font-medium">{event.category}</span>
            <span className="mx-2">/</span>
            <span className="text-slate-900 font-medium">{event.title}</span>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative h-[300px] md:h-[400px] overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={event.image}
            alt={event.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 h-full flex items-end pb-8">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-sm font-medium text-slate-300">{event.category}</span>
              <div className="flex items-center gap-2 bg-black/50 px-3 py-1 rounded-full">
                {renderStars(event.rating)}
                <span className="text-white font-semibold">{event.rating}</span>
              </div>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
              {event.title}
            </h1>
            <div className="flex gap-4">
              <Button variant="primary" size="lg">
                Find Tickets
              </Button>
              <button
                onClick={() => setIsFavorite(!isFavorite)}
                className={`p-3 rounded-full border-2 transition-all ${
                  isFavorite
                    ? 'bg-red-500 border-red-500 text-white'
                    : 'bg-transparent border-white text-white hover:bg-white/10'
                }`}
              >
                <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Content */}
          <div className="lg:col-span-3 space-y-12">
            {/* Tabs */}
            <div className="border-b border-slate-200">
              <div className="flex gap-8">
                {[
                  { key: 'concerts', label: `Concerts • ${event.upcomingEvents.length} RESULTS` },
                  { key: 'about', label: 'About' },
                  { key: 'reviews', label: `Reviews • ${event.reviewCount} RESULTS` },
                  { key: 'fans', label: 'Fans Also Viewed' }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`pb-4 text-sm font-semibold uppercase tracking-wider border-b-2 transition-colors ${
                      activeTab === tab.key
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Concerts List */}
            {activeTab === 'concerts' && (
              <div className="space-y-6">
                {/* Filters */}
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Location</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="City or Zip Code"
                        value={locationFilter}
                        onChange={(e) => setLocationFilter(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="w-[180px]">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Dates</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <select
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="w-full pl-10 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                      >
                        <option value="all">All Dates</option>
                        <option value="this-week">This Week</option>
                        <option value="this-month">This Month</option>
                        <option value="next-month">Next Month</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Events List */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-slate-900">Concerts in United States</h3>
                  {event.upcomingEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="flex items-center gap-6 p-4 border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all bg-white"
                    >
                      <div className="flex flex-col items-center bg-slate-100 rounded-lg p-3 min-w-[80px]">
                        <span className="text-xs font-semibold text-slate-600">{evt.date.split(' ')[0]}</span>
                        <span className="text-2xl font-bold text-slate-900">{evt.date.split(' ')[1]}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-medium">{evt.time}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          <span className="font-semibold text-slate-900">{evt.location}</span>
                          <span className="text-slate-600">•</span>
                          <span className="font-semibold text-slate-900">{evt.venue}</span>
                        </div>
                        <p className="text-sm text-slate-600">{evt.tour}</p>
                      </div>
                      <Link to={`/checkout?event=${evt.id}`}>
                        <Button variant="primary" size="sm">
                          Find Tickets
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>

                {/* Load More */}
                <div className="text-center pt-6">
                  <Button variant="outline" className="mx-auto">
                    More Events
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* About Section */}
            {activeTab === 'about' && (
              <div className="prose max-w-none">
                <h2 className="text-2xl font-bold mb-4">About {event.title}</h2>
                <p className="text-slate-700 leading-relaxed mb-6">{event.description}</p>
                <div className="grid md:grid-cols-2 gap-6 mt-8">
                  <div className="p-6 bg-slate-50 rounded-lg">
                    <h3 className="font-semibold mb-3">Ticket Information</h3>
                    <ul className="space-y-2 text-sm text-slate-700">
                      <li>• General Admission starts at $50</li>
                      <li>• VIP packages available</li>
                      <li>• All tickets are mobile-only</li>
                      <li>• Will call available at venue</li>
                    </ul>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-lg">
                    <h3 className="font-semibold mb-3">Age Requirements</h3>
                    <ul className="space-y-2 text-sm text-slate-700">
                      <li>• All ages welcome</li>
                      <li>• Children under 2 free</li>
                      <li>• Valid ID required for entry</li>
                      <li>• 21+ for VIP areas</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Reviews Section */}
            {activeTab === 'reviews' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-4xl font-bold">{event.rating}</div>
                    <div>
                      {renderStars(event.rating)}
                      <p className="text-sm text-slate-600 mt-1">Based on {event.reviewCount} reviews</p>
                    </div>
                  </div>
                  <Button variant="primary">Write a review</Button>
                </div>

                <div className="space-y-6 pt-6 border-t border-slate-200">
                  {event.reviews.map((review) => (
                    <div key={review.id} className="border-b border-slate-200 pb-6">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {renderStars(review.rating)}
                            <span className="font-semibold">{review.title}</span>
                          </div>
                          <p className="text-sm text-slate-600">
                            by {review.author} on {review.date} • {review.venue}
                          </p>
                        </div>
                      </div>
                      <p className="text-slate-700">{review.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fans Also Viewed */}
            {activeTab === 'fans' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {event.relatedArtists.map((artist) => (
                  <Link key={artist.id} to={`/artist/${artist.id}`} className="group">
                    <div className="aspect-[4/3] rounded-lg overflow-hidden mb-3">
                      <img
                        src={artist.image}
                        alt={artist.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {artist.name}
                    </h3>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Right Sidebar - Advertisement */}
          <div className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
              <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-6 text-white text-center">
                <p className="text-xs uppercase tracking-wider mb-2 opacity-80">Advertisement</p>
                <div className="aspect-square rounded-lg bg-white/10 flex items-center justify-center mb-4">
                  <span className="text-sm font-medium">Ad Space</span>
                </div>
                <p className="text-sm">Bundle your ticket with a hotel and save up to 57%!</p>
                <Button variant="secondary" className="w-full mt-4">
                  Find My Hotel
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}