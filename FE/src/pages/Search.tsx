import { useState } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { EventCard } from '@/components/ui/EventCard'
import { FilterSection, FilterCategory, FilterOption } from '@/components/ui/Filter'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Search as SearchIcon, ChevronLeft, ChevronRight, Check } from 'lucide-react'

export default function Search() {
  const [searchQuery, setSearchQuery] = useState('Neon Dream Festival 2024')
  const [selectedCategories, setSelectedCategories] = useState(['festivals'])
  const [selectedTimeframe, setSelectedTimeframe] = useState('weekend')
  const [priceRange, setPriceRange] = useState([40, 450])

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white font-body">
      <Navbar />

      <main className="max-w-screen-2xl mx-auto px-6 py-12">
        {/* Prominent Search Bar Section */}
        <div className="mb-16 max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-headline font-black tracking-tighter mb-6 text-glow-primary">
            FIND YOUR RUSH
          </h1>
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-xl blur opacity-25 group-hover:opacity-40 transition duration-1000" />
            <div className="relative flex items-center bg-surface-container-low rounded-xl p-2 border border-outline-variant/20">
              <SearchIcon className="ml-4 text-primary w-5 h-5" />
              <Input
                className="bg-transparent border-none focus:ring-0 w-full px-4 py-3 text-lg font-body"
                placeholder="Search by artist, venue, or event..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button className="font-headline font-bold uppercase tracking-widest px-8 py-3 rounded-lg hover:scale-105 active:scale-95 transition-all">
                Search
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-10">
          {/* Filter Sidebar */}
          <aside className="w-full md:w-72 shrink-0 space-y-8">
            <FilterSection title="Filters" onReset={() => {
              setSelectedCategories([])
              setSelectedTimeframe('')
              setPriceRange([40, 450])
            }}>
              {/* Categories */}
              <FilterCategory label="Categories">
                <FilterOption
                  label="Music"
                  checked={selectedCategories.includes('music')}
                  onChange={() => toggleCategory('music')}
                />
                <FilterOption
                  label="Festivals"
                  checked={selectedCategories.includes('festivals')}
                  onChange={() => toggleCategory('festivals')}
                />
                <FilterOption
                  label="E-Sports"
                  checked={selectedCategories.includes('esports')}
                  onChange={() => toggleCategory('esports')}
                />
              </FilterCategory>

              {/* Date Range */}
              <FilterCategory label="Timeframe">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelectedTimeframe('tonight')}
                    className={`text-[10px] py-2 border rounded font-headline font-semibold uppercase tracking-tighter ${
                      selectedTimeframe === 'tonight'
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'border-outline-variant/30 bg-white/5'
                    }`}
                  >
                    Tonight
                  </button>
                  <button
                    onClick={() => setSelectedTimeframe('weekend')}
                    className={`text-[10px] py-2 border rounded font-headline font-semibold uppercase tracking-tighter ${
                      selectedTimeframe === 'weekend'
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'border-outline-variant/30 bg-white/5'
                    }`}
                  >
                    Weekend
                  </button>
                  <button className="text-[10px] py-2 border border-outline-variant/30 rounded bg-white/5 font-headline font-semibold uppercase tracking-tighter col-span-2">
                    Select Date
                  </button>
                </div>
              </FilterCategory>

              {/* Price Slider */}
              <FilterCategory label="Price Range">
                <div className="relative h-1 bg-surface-container-highest rounded-full mb-4">
                  <div className="absolute left-1/4 right-1/4 h-full bg-primary" />
                  <div className="absolute left-1/4 top-1/2 -translate-y-1/2 w-4 h-4 bg-primary border-2 border-white rounded-full cursor-pointer" />
                  <div className="absolute right-1/4 top-1/2 -translate-y-1/2 w-4 h-4 bg-primary border-2 border-white rounded-full cursor-pointer" />
                </div>
                <div className="flex justify-between text-xs font-headline font-medium">
                  <span>$40</span>
                  <span>$450+</span>
                </div>
              </FilterCategory>

              {/* Venue */}
              <FilterCategory label="Venue">
                <select className="w-full bg-surface-container-highest border-none rounded-lg text-sm p-3 focus:ring-1 focus:ring-primary">
                  <option>All Venues</option>
                  <option>Starlight Arena</option>
                  <option>The Void Club</option>
                  <option>Cosmos Stadium</option>
                </select>
              </FilterCategory>
            </FilterSection>

            <div className="glass-panel p-6 rounded-xl relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-secondary font-headline font-black text-xl mb-2">GOLDEN PASS</p>
                <p className="text-xs text-slate-400 mb-4">Access to all venue VIP lounges for one monthly price.</p>
                <button className="text-[10px] font-headline font-bold tracking-widest uppercase border border-secondary text-secondary px-4 py-2 rounded hover:bg-secondary hover:text-on-secondary transition-all">
                  Learn More
                </button>
              </div>
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-secondary/10 rounded-full blur-2xl" />
            </div>
          </aside>

          {/* Results Grid */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-baseline gap-3">
                <h2 className="text-2xl font-headline font-bold">Found 24 events</h2>
                <span className="text-sm text-slate-400 italic">for "{searchQuery}"</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-headline font-bold uppercase tracking-widest text-slate-500">Sort By:</span>
                <button className="text-sm font-semibold flex items-center gap-1 hover:text-primary transition-colors">
                  Recommended <ChevronLeft className="w-4 h-4 rotate-90" />
                </button>
              </div>
            </div>

            {/* Bento-ish Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Featured Large Card */}
              <EventCard
                variant="featured"
                image="https://lh3.googleusercontent.com/aida-public/AB6AXuA8lF7tHa8grkKZUcffQjf220e191Yds9uogkNKBZp8nCgyyFDgxCwWr3LMnQy36rZe9jfP2JdfrrV6NtbMlXWukHaWDZkCq1nvo1SKjiPvZpoV2dmA3l-xpTvQ4WIJFUyEJRrGp3U1MZr0eO4_MzMQbKOiUBfaBOonSHBuzLEfU3UOYLs86W9VegFgcE9rQkmqL9mDweguIp3AkrNs96a_JgOxJRE0G_4lThcRFtM4wxKTafu7kzO_ON6prkyCDewlFc96UTsONjM"
                title="NEON DREAM FESTIVAL 2024"
                date="Oct 24-26"
                venue="Starlight Arena"
                price="$129"
                badge="Staff Pick"
                href="/event/neon-dream"
                className="md:col-span-2 lg:col-span-2"
              />

              {/* Regular Cards */}
              <EventCard
                image="https://lh3.googleusercontent.com/aida-public/AB6AXuBeRQqxHz2C0ESUNDH0kyLd6473t-BXnsO2He63lG2ObGTEbXpL9bISwKcmnaKKeFou6zNipW7bJaWN7X2vMzPuCi_m9SU5jDr6VLDNj7Ek6cy4ayOzXWgOL8zaVBlFk7CM8kd4joA-_RbdzcqN1VolI5G5NuzEYvjnRUzgcPF0GjIRZrs7jGv8QOPFrZNoi4hzNaLnTiK4fvtb5py68YAPM0pFbjvoCtyZMhw5kPwyeuFe-LciGn3dofO9Gn5di3JKEemm36iUvfM"
                title="CYBERPUNK BEATS: AFTER DARK"
                date="12 Nov"
                venue="The Void Underground"
                price="$45.00"
                href="/event/cyberpunk-beats"
              />
              <EventCard
                image="https://lh3.googleusercontent.com/aida-public/AB6AXuBXLWFLcsoZ3FnCGc5OvZCGHm7rcf5CXinat-r-zSWh_k7RzBojmpcKwKjt8Yxkmudpi4alAgjtW3n-gcb5BBUM3RtrKFlxzz7LLsPSZmoVWniekug6Z0AEPUVju2l20us-qP0nD8LSOo2W7STNuQm96VMfOuRaMva6EdsIXbvA89d851kyyAVt1cHx9Mpof_mtKBWsozve5_Ue0Ytcc0cRaKI6T7hCd3jpq5W96bQnANSttll7ItiMoRAcR5ZS9ssdlcKpjvABUWg"
                title="LUNA SOLA: GALAXY TOUR"
                date="15 Nov"
                venue="Grand Nebula Hall"
                price="$89.00"
                href="/event/luna-sola"
              />
              <EventCard
                image="https://lh3.googleusercontent.com/aida-public/AB6AXuDKsPqi8RqPWNG-bq_iN_cRCoMz11oS5oIgQ17Y1B4e1cd0IQjbY3rgsj7nShTCGVtn_sYrsPlv_LhBzk-5eIjPIT-3Dyc0FBihOHsjSu22QaTwXruok8E0xN-a45pb3txmre725ZLOaUiB2ryvtXAqljxCONEFOYdD5ld6Vi9BZWxZpwfXYyBJVxWcjF1r7ozbbBdyA3Kp5N3OXEaLe4IsRAVt1pA8rGh7SrByjKLJguRAkF5FUXnrVkbnI2a438wfcaybfQDXJVE"
                title="INTERSTELLAR JAZZ SESSIONS"
                date="18 Nov"
                venue="Blue Moon Lounge"
                price="$35.00"
                href="/event/jazz-sessions"
              />
              <EventCard
                image="https://lh3.googleusercontent.com/aida-public/AB6AXuCidHml2cEoNSJ_OykFMGS6vr28zPvrhx_0XXsl-t0IMiXsrKbGaNF2V_8hVp0XBf0GiY2jy0otV3zKUmieBhKre_w3iEEurAsAJbclaeBDwVP-NvCKPtMRa4XGbaYi_hOlRmQVzx-zeiEgupUhqSUp4Iu2fQgRjK-FOj3aVLRy-sP3fqPNH764RMIANXmIi2bho_rdO7v_57jCx7in81sBzisSKWyDguKp1oI22CdeL2n4CAq5P1MWGh5wLYvJHjGxczjWE7TkTZM"
                title="SYNTHWAVE SUNDAY: 2099"
                date="22 Nov"
                venue="Retro Future Hub"
                price="$25.00"
                href="/event/synthwave-sunday"
              />
            </div>

            {/* Pagination */}
            <div className="mt-16 flex items-center justify-center gap-2">
              <button className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-highest text-slate-400 hover:bg-primary-container hover:text-white transition-all">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button className="w-10 h-10 flex items-center justify-center rounded-lg bg-primary text-on-primary-container font-headline font-bold">
                1
              </button>
              <button className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-highest text-slate-400 hover:text-white transition-all">
                2
              </button>
              <button className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-highest text-slate-400 hover:text-white transition-all">
                3
              </button>
              <span className="px-2 text-slate-500">...</span>
              <button className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-highest text-slate-400 hover:text-white transition-all">
                8
              </button>
              <button className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-highest text-slate-400 hover:bg-primary-container hover:text-white transition-all">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}