import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import {
  Calendar,
  MapPin,
  CreditCard,
  Share2,
  Heart,
  Parking,
  Info,
  Plus,
  Minus,
  Users,
  Star
} from 'lucide-react'

export default function EventDetail() {
  const [selectedTier, setSelectedTier] = useState('General Admission - ₫500,000')
  const [quantity, setQuantity] = useState(2)

  const ticketTiers = [
    { name: 'General Admission', price: 500000, available: 12 },
    { name: 'Premium Stalls', price: 850000, available: 5 },
    { name: 'Galactic VIP', price: 2500000, available: 2 }
  ]

  const artists = [
    {
      name: 'X-NEBULA',
      stage: 'Main Stage • 11:00 PM',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDXTneio-5nNwDz1Ffl7stHMw5qgt6968Ppud5CVp3UusND18ClpYpZh0q5QDP1QrCMFdvAiFYSA75_0jOxZoxTe318IucMP5CL6q6n94LtJbnRYRXmbn4IV80lAfupkWfbP_hptPdrMHsIuHVvtnL_Hc9owOQJGLfilLtuNt1OUB1CzDLUOyaDshReWA0gjw9x4fpnj2U-0h4vzyGIbSPoejTSCN8Xlc6qW9nz8-_v64YmWP9YpA7qkhfBgelo0g23aKUpjbIgBkY'
    },
    {
      name: 'CYBER GLITCH',
      stage: 'The Void • 09:30 PM',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCpm77bkfvril2rQPhmJyG2NmY-WK-N29B_8jYzQsg0s6fG-WK4yEW1z6TCBPWRqmpP3eMadk2kqmMFY7r1dPl5f13X5oZxNhDNUu_DpLy1tr-QMDQ6iy26wko5okF_fXdaQpr8iPeRh-aU9JOfQxr4KNxSqhi5ctcN9WC3v6XNZfqvMM6hhg5ZCsHSdOlSmrTL-YNZgkhA3vCdmZ4Y1HcKR8s__FIy-MZzFDoujhMzsom7jFlTavR7_jhLt8a9L_ykvkVattPAyow'
    },
    {
      name: 'LYRA-7',
      stage: 'Acoustic Dome • 07:00 PM',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDjgRHgTLKJ7WBfqi5DUNRw6F7v2KN_dggAEvs70jKYlR1a90n59NiUrhmIj05GYT4lqueLK9Z1KqY5qqwhSggMMpqRotdmvbqfzbUvtf97HHrD5-BS52HfcuSWCV201wPF6b94U1MbqHOu34lan9mZKcwNHIqhCIq6KiynNiyHgGRFH3D1LTsLFQX4zVrnR486lkwfGLlWrVlfJHs1dBRGhjZw-zdsuMP83MSxywQff_njvkZqsrXUSyE2Xt7sqFosHCOxAE638bo'
    }
  ]

  const selectedTierData = ticketTiers.find(tier => `${tier.name} - ₫${tier.price.toLocaleString()}` === selectedTier)
  const subtotal = selectedTierData ? selectedTierData.price * quantity : 0
  const serviceFee = Math.round(subtotal * 0.045)
  const total = subtotal + serviceFee

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white font-body">
      <Navbar />

      <main className="relative">
        {/* Hero Section */}
        <section className="relative h-[614px] md:h-[819px] w-full overflow-hidden">
          <div className="absolute inset-0">
            <img
              alt="Pulsar Beats Festival Banner"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDlxvf03yapYGPNLNjDTeaVw6IIYW0N4brNmNPuHrIZVQWBK_zgJ_Xs6uhUb457U0V7vRHnlfZymmnIJb64gjoeYztkl_h2UK-AaWLW67vw-Soq9_pEk6xZ0-g5Kw-3QFUHpfMuRCYSE5le9maZr7O4rXPLZUI1IXPmZkRR9oMc4A6it_cMReIfAgSVaKVY6v4qMzAUAOGxIc2dQmv8WhrHLw9IWdtluNd-420-aowZ56kQ2dhcH6uXarhAvwbFAoJUDrXr95O9bHU"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950/90"></div>
          </div>
          <div className="absolute bottom-0 left-0 w-full px-6 pb-12 md:pb-24">
            <div className="max-w-screen-2xl mx-auto flex flex-col md:flex-row justify-between items-end gap-8">
              <div className="max-w-4xl">
                <div className="inline-block bg-primary px-3 py-1 rounded-sm mb-4">
                  <span className="text-on-primary-container font-label uppercase tracking-[0.2em] text-xs font-bold">Sold Out Risk: High</span>
                </div>
                <h1 className="text-5xl md:text-8xl font-headline font-bold tracking-tight text-white mb-4">
                  Pulsar Beats <span className="text-primary italic">Festival</span>
                </h1>
                <p className="text-xl md:text-2xl text-slate-300 font-body max-w-2xl">
                  An interstellar odyssey through sound, light, and dimension. Join 50,000 voyagers in the heart of the Orion sector.
                </p>
              </div>
              <div className="flex gap-4 mb-4">
                <button className="p-4 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all">
                  <Share2 className="w-5 h-5" />
                </button>
                <button className="p-4 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all text-primary">
                  <Heart className="w-5 h-5" style={{ fill: 'currentColor' }} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Sticky Info Bar */}
        <div className="sticky top-[72px] z-40 backdrop-blur-xl bg-slate-900/80 border-y border-white/5 py-4 px-6 mb-12">
          <div className="max-w-screen-2xl mx-auto flex flex-wrap justify-between items-center gap-6">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <Calendar className="text-primary w-5 h-5" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-label">Date</p>
                  <p className="font-headline font-semibold">Oct 24, 2024</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="text-primary w-5 h-5" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-label">Venue</p>
                  <p className="font-headline font-semibold">Orion Zenith Arena</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CreditCard className="text-secondary w-5 h-5" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-label">Starting From</p>
                  <p className="font-headline font-semibold text-secondary">₫500,000+</p>
                </div>
              </div>
            </div>
            <div className="hidden lg:flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-sm font-label text-slate-400">LIVE BOOKING ACTIVE</span>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="max-w-screen-2xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 pb-24">
          {/* Left Column: Details */}
          <div className="lg:col-span-8 space-y-16">
            {/* About */}
            <section>
              <h2 className="text-3xl font-headline font-bold mb-6 flex items-center gap-4">
                <span className="w-12 h-[1px] bg-primary"></span>
                About This Event
              </h2>
              <div className="prose prose-invert max-w-none space-y-6 text-slate-300 leading-relaxed">
                <p className="text-lg">Step into a realm where reality blurs with the digital infinite. Pulsar Beats Festival isn't just a concert—it's a multi-sensory pilgrimage. Experience the world's most advanced 4D spatial audio system and 360-degree holographic visual arrays that transform the Orion Zenith Arena into a breathing cosmic entity.</p>
                <p>This year's theme, <span className="text-secondary italic">"The Event Horizon,"</span> explores the intersection of synth-heavy industrial techno and ethereal ambient soundscapes. Prepare for 12 hours of uninterrupted velocity.</p>
              </div>
            </section>

            {/* Featured Artists */}
            <section>
              <h2 className="text-3xl font-headline font-bold mb-8 flex items-center gap-4">
                <span className="w-12 h-[1px] bg-primary"></span>
                Featured Artists
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                {artists.map((artist, index) => (
                  <div key={index} className="group relative overflow-hidden rounded-xl bg-slate-800 p-4 transition-all hover:bg-slate-700 border border-white/5">
                    <img
                      alt={artist.name}
                      className="w-full aspect-square object-cover rounded-lg mb-4 filter grayscale group-hover:grayscale-0 transition-all duration-500"
                      src={artist.image}
                    />
                    <h3 className="font-headline font-bold text-xl">{artist.name}</h3>
                    <p className="text-sm text-primary uppercase tracking-tighter font-label">{artist.stage}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Venue & Logistics */}
            <section className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <h2 className="text-3xl font-headline font-bold flex items-center gap-4">
                  <span className="w-12 h-[1px] bg-primary"></span>
                  Venue Details
                </h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-900 border border-white/5">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Parking className="text-primary w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold">Parking Available</h4>
                      <p className="text-sm text-slate-400">Zone A & B open from 4:00 PM. Pre-book parking for a 20% discount.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-900 border border-white/5">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Info className="text-primary w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold">Entry Requirements</h4>
                      <p className="text-sm text-slate-400">18+ Only. Valid ID and digital ticket required at all checkpoints.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl overflow-hidden h-64 border border-white/10 grayscale contrast-125 opacity-80 hover:opacity-100 transition-all">
                <img
                  alt="Venue Map"
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuD5VMJzRgB194cmOHTHkSnE9U7U2rmhuFMvhgmw_B6wQa6-sjeiAh1z7Gj9dG_pk2S6ozTNtC-sVRvFdKirN8oYV7gJ_SgjXhIvhjjJOOeSOQVed2XsoQHvl83OmSuSBYYF8AQ-eQvxZyw0g2jasTbaOloZctQCP2yGtRrdJrsGMthfx_rP0-Fq8R1n59rmymarcBN8dUTbyMYi-ieJ1pomRIhubCiRvFM4H5SX4cZzD1LKFeSYPdLLM9On9GjbPIYDzKoZh-1OZSM"
                />
              </div>
            </section>
          </div>

          {/* Right Column: Quick Booking */}
          <div className="lg:col-span-4">
            <div className="sticky top-32 backdrop-blur-xl bg-slate-900/80 p-8 rounded-2xl border border-white/10 shadow-2xl space-y-8">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <h3 className="text-2xl font-headline font-bold">Quick Booking</h3>
                  <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs font-bold font-label animate-pulse">
                    Only {selectedTierData?.available || 12} tickets left!
                  </span>
                </div>
                <div className="space-y-6">
                  {/* Type Selector */}
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-slate-500 font-label">Ticket Tier</label>
                    <select
                      className="w-full bg-slate-800 border-none rounded-xl py-4 px-4 text-white focus:ring-2 focus:ring-primary"
                      value={selectedTier}
                      onChange={(e) => setSelectedTier(e.target.value)}
                    >
                      {ticketTiers.map((tier) => (
                        <option key={tier.name} value={`${tier.name} - ₫${tier.price.toLocaleString()}`}>
                          {tier.name} - ₫{tier.price.toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Qty Selector */}
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-slate-500 font-label">Quantity</label>
                    <div className="flex items-center justify-between bg-slate-800 rounded-xl p-2">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-xl font-headline font-bold">{quantity.toString().padStart(2, '0')}</span>
                      <button
                        onClick={() => setQuantity(Math.min(10, quantity + 1))}
                        className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Price Breakdown */}
                  <div className="pt-6 border-t border-white/5 space-y-3">
                    <div className="flex justify-between text-slate-400">
                      <span>Tickets ({quantity}x)</span>
                      <span>₫{subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Service Fee</span>
                      <span>₫{serviceFee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold font-headline pt-2 text-secondary">
                      <span>Total Price</span>
                      <span>₫{total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <Link to="/seat-selection">
                <Button className="w-full bg-primary hover:bg-primary/90 py-5 rounded-xl font-headline font-black text-on-primary uppercase tracking-widest shadow-[0_0_15px_rgba(252,83,109,0.4)] transition-all active:scale-95">
                  Select Seats
                </Button>
              </Link>

              <div className="text-center space-y-4">
                <p className="text-xs text-slate-500 uppercase tracking-tighter">Secure Checkout Powered by Interstellar Pay</p>
                <div className="flex justify-center gap-4 opacity-50 grayscale">
                  <CreditCard className="w-5 h-5" />
                  <Users className="w-5 h-5" />
                  <Star className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
</head>
<body class="min-h-screen">
<!-- Top Navigation Shell -->
<nav class="bg-slate-950/80 backdrop-blur-xl docked full-width top-0 sticky z-50 border-b border-white/10 shadow-[0_0_15px_rgba(233,69,96,0.2)]">
<div class="flex justify-between items-center w-full px-6 py-4 max-w-screen-2xl mx-auto">
<div class="text-2xl font-black italic tracking-tighter text-red-500 uppercase font-['Space_Grotesk']">
                TicketRush
            </div>
<div class="hidden md:flex items-center space-x-8 font-['Space_Grotesk']">
<a class="text-red-500 border-b-2 border-red-500 pb-1 font-bold tracking-tight" href="#">Events</a>
<a class="text-slate-300 hover:text-white transition-colors transition-all duration-300" href="#">Venues</a>
<a class="text-slate-300 hover:text-white transition-colors transition-all duration-300" href="#">Deals</a>
<a class="text-slate-300 hover:text-white transition-colors transition-all duration-300" href="#">My Tickets</a>
</div>
<div class="flex items-center space-x-6">
<div class="hidden lg:flex items-center bg-white/5 rounded-full px-4 py-2 border border-white/10">
<span class="material-symbols-outlined text-slate-400 mr-2">search</span>
<input class="bg-transparent border-none focus:ring-0 text-sm w-48 text-white placeholder-slate-500" placeholder="Search events..." type="text"/>
</div>
<div class="flex items-center space-x-4">
<button class="text-slate-300 hover:bg-white/5 transition-all duration-300 p-2 rounded-full scale-95 active:scale-90 transition-transform">
<span class="material-symbols-outlined" data-icon="notifications">notifications</span>
</button>
<button class="text-slate-300 hover:bg-white/5 transition-all duration-300 p-2 rounded-full scale-95 active:scale-90 transition-transform">
<span class="material-symbols-outlined" data-icon="shopping_cart">shopping_cart</span>
</button>
<img alt="User profile" class="w-10 h-10 rounded-full border-2 border-primary/30" data-alt="Close up portrait of a stylish person with neon rim lighting against a dark urban backdrop" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCpkG1PatttrYwTvcNEh4FN6b1_UtnwkSQLrlrcbVIft0Zb4N4b_hfChWgI6ZD3-aCizQWAcKsFdayjNiacDsYjV2UK-KV1Lt-qsVrBBzHem49I80sNGj9hzmbBcFIzwZ-4lU2mi5FInIgIbLZZpg2IJF7T5ibgcoYDqQlNOXPyZpbtdLi5ihwsZDAWCkUWONBJ8ZEydwPNMPmpzI9b1mztBTsiF9LRn31HxEG5xNXYt5kxu9WOj-mSy7d0TjIavWHEEI30GEWMxRE"/>
</div>
</div>
</div>
</nav>
<main class="relative">
<!-- Hero Section -->
<section class="relative h-[614px] md:h-[819px] w-full overflow-hidden">
<div class="absolute inset-0">
<img alt="Pulsar Beats Festival Banner" class="w-full h-full object-cover" data-alt="Massive outdoor electronic dance music festival at night with giant laser beams and cosmic nebula projections on stage" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDlxvf03yapYGPNLNjDTeaVw6IIYW0N4brNmNPuHrIZVQWBK_zgJ_Xs6uhUb457U0V7vRHnlfZymmnIJb64gjoeYztkl_h2UK-AaWLW67vw-Soq9_pEk6xZ0-g5Kw-3QFUHpfMuRCYSE5le9maZr7O4rXPLZUI1IXPmZkRR9oMc4A6it_cMReIfAgSVaKVY6v4qMzAUAOGxIc2dQmv8WhrHLw9IWdtluNd-420-aowZ56kQ2dhcH6uXarhAvwbFAoJUDrXr95O9bHU"/>
<div class="absolute inset-0 hero-gradient"></div>
</div>
<div class="absolute bottom-0 left-0 w-full px-6 pb-12 md:pb-24">
<div class="max-w-screen-2xl mx-auto flex flex-col md:flex-row justify-between items-end gap-8">
<div class="max-w-4xl">
<div class="inline-block bg-primary px-3 py-1 rounded-sm mb-4">
<span class="text-on-primary-container font-label uppercase tracking-[0.2em] text-xs font-bold">Sold Out Risk: High</span>
</div>
<h1 class="text-5xl md:text-8xl font-headline font-bold tracking-tight text-on-surface mb-4">
                            Pulsar Beats <span class="text-primary italic">Festival</span>
</h1>
<p class="text-xl md:text-2xl text-on-surface-variant font-body max-w-2xl">
                            An interstellar odyssey through sound, light, and dimension. Join 50,000 voyagers in the heart of the Orion sector.
                        </p>
</div>
<div class="flex gap-4 mb-4">
<button class="p-4 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all">
<span class="material-symbols-outlined" data-icon="share">share</span>
</button>
<button class="p-4 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all text-primary">
<span class="material-symbols-outlined" data-icon="favorite" style="font-variation-settings: 'FILL' 1;">favorite</span>
</button>
</div>
</div>
</div>
</section>
<!-- Sticky Info Bar -->
<div class="sticky top-[72px] z-40 glass-panel border-y border-white/5 py-4 px-6 mb-12">
<div class="max-w-screen-2xl mx-auto flex flex-wrap justify-between items-center gap-6">
<div class="flex items-center gap-8">
<div class="flex items-center gap-3">
<span class="material-symbols-outlined text-primary" data-icon="calendar_today">calendar_today</span>
<div>
<p class="text-[10px] uppercase tracking-widest text-slate-500 font-label">Date</p>
<p class="font-headline font-semibold">Oct 24, 2024</p>
</div>
</div>
<div class="flex items-center gap-3">
<span class="material-symbols-outlined text-primary" data-icon="location_on">location_on</span>
<div>
<p class="text-[10px] uppercase tracking-widest text-slate-500 font-label">Venue</p>
<p class="font-headline font-semibold">Orion Zenith Arena</p>
</div>
</div>
<div class="flex items-center gap-3">
<span class="material-symbols-outlined text-secondary" data-icon="payments">payments</span>
<div>
<p class="text-[10px] uppercase tracking-widest text-slate-500 font-label">Starting From</p>
<p class="font-headline font-semibold text-secondary">₫500,000+</p>
</div>
</div>
</div>
<div class="hidden lg:flex items-center gap-2">
<span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
<span class="text-sm font-label text-slate-400">LIVE BOOKING ACTIVE</span>
</div>
</div>
</div>
<!-- Content Grid -->
<div class="max-w-screen-2xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 pb-24">
<!-- Left Column: Details -->
<div class="lg:col-span-8 space-y-16">
<!-- About -->
<section>
<h2 class="text-3xl font-headline font-bold mb-6 flex items-center gap-4">
<span class="w-12 h-[1px] bg-primary"></span>
                        About This Event
                    </h2>
<div class="prose prose-invert max-w-none space-y-6 text-on-surface-variant leading-relaxed">
<p class="text-lg">Step into a realm where reality blurs with the digital infinite. Pulsar Beats Festival isn't just a concert—it's a multi-sensory pilgrimage. Experience the world's most advanced 4D spatial audio system and 360-degree holographic visual arrays that transform the Orion Zenith Arena into a breathing cosmic entity.</p>
<p>This year's theme, <span class="text-secondary italic">"The Event Horizon,"</span> explores the intersection of synth-heavy industrial techno and ethereal ambient soundscapes. Prepare for 12 hours of uninterrupted velocity.</p>
</div>
</section>
<!-- Featured Artists -->
<section>
<h2 class="text-3xl font-headline font-bold mb-8 flex items-center gap-4">
<span class="w-12 h-[1px] bg-primary"></span>
                        Featured Artists
                    </h2>
<div class="grid grid-cols-2 sm:grid-cols-3 gap-6">
<!-- Artist 1 -->
<div class="group relative overflow-hidden rounded-xl bg-surface-container-low p-4 transition-all hover:bg-surface-container border border-white/5">
<img alt="X-NEBULA" class="w-full aspect-square object-cover rounded-lg mb-4 filter grayscale group-hover:grayscale-0 transition-all duration-500" data-alt="Close up of a futuristic electronic music producer with chrome headwear and glowing circuitry face paint" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDXTneio-5nNwDz1Ffl7stHMw5qgt6968Ppud5CVp3UusND18ClpYpZh0q5QDP1QrCMFdvAiFYSA75_0jOxZoxTe318IucMP5CL6q6n94LtJbnRYRXmbn4IV80lAfupkWfbP_hptPdrMHsIuHVvtnL_Hc9owOQJGLfilLtuNt1OUB1CzDLUOyaDshReWA0gjw9x4fpnj2U-0h4vzyGIbSPoejTSCN8Xlc6qW9nz8-_v64YmWP9YpA7qkhfBgelo0g23aKUpjbIgBkY"/>
<h3 class="font-headline font-bold text-xl">X-NEBULA</h3>
<p class="text-sm text-primary uppercase tracking-tighter font-label">Main Stage • 11:00 PM</p>
</div>
<!-- Artist 2 -->
<div class="group relative overflow-hidden rounded-xl bg-surface-container-low p-4 transition-all hover:bg-surface-container border border-white/5">
<img alt="CYBER GLITCH" class="w-full aspect-square object-cover rounded-lg mb-4 filter grayscale group-hover:grayscale-0 transition-all duration-500" data-alt="Dynamic portrait of a DJ performing with multiple keyboards and glowing modular synthesizers" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCpm77bkfvril2rQPhmJyG2NmY-WK-N29B_8jYzQsg0s6fG-WK4yEW1z6TCBPWRqmpP3eMadk2kqmMFY7r1dPl5f13X5oZxNhDNUu_DpLy1tr-QMDQ6iy26wko5okF_fXdaQpr8iPeRh-aU9JOfQxr4KNxSqhi5ctcN9WC3v6XNZfqvMM6hhg5ZCsHSdOlSmrTL-YNZgkhA3vCdmZ4Y1HcKR8s__FIy-MZzFDoujhMzsom7jFlTavR7_jhLt8a9L_ykvkVattPAyow"/>
<h3 class="font-headline font-bold text-xl">CYBER GLITCH</h3>
<p class="text-sm text-primary uppercase tracking-tighter font-label">The Void • 09:30 PM</p>
</div>
<!-- Artist 3 -->
<div class="group relative overflow-hidden rounded-xl bg-surface-container-low p-4 transition-all hover:bg-surface-container border border-white/5">
<img alt="LYRA-7" class="w-full aspect-square object-cover rounded-lg mb-4 filter grayscale group-hover:grayscale-0 transition-all duration-500" data-alt="Profile of a singer with shimmering iridescent skin and galactic themed makeup under ultraviolet light" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDjgRHgTLKJ7WBfqi5DUNRw6F7v2KN_dggAEvs70jKYlR1a90n59NiUrhmIj05GYT4lqueLK9Z1KqY5qqwhSggMMpqRotdmvbqfzbUvtf97HHrD5-BS52HfcuSWCV201wPF6b94U1MbqHOu34lan9mZKcwNHIqhCIq6KiynNiyHgGRFH3D1LTsLFQX4zVrnR486lkwfGLlWrVlfJHs1dBRGhjZw-zdsuMP83MSxywQff_njvkZqsrXUSyE2Xt7sqFosHCOxAE638bo"/>
<h3 class="font-headline font-bold text-xl">LYRA-7</h3>
<p class="text-sm text-primary uppercase tracking-tighter font-label">Acoustic Dome • 07:00 PM</p>
</div>
</div>
</section>
<!-- Venue & Logistics -->
<section class="grid md:grid-cols-2 gap-8">
<div class="space-y-6">
<h2 class="text-3xl font-headline font-bold flex items-center gap-4">
<span class="w-12 h-[1px] bg-primary"></span>
                            Venue Details
                        </h2>
<div class="space-y-4">
<div class="flex items-start gap-4 p-4 rounded-xl bg-surface-container-lowest border border-white/5">
<span class="material-symbols-outlined text-primary p-2 bg-primary/10 rounded-lg">local_parking</span>
<div>
<h4 class="font-bold">Parking Available</h4>
<p class="text-sm text-on-surface-variant">Zone A &amp; B open from 4:00 PM. Pre-book parking for a 20% discount.</p>
</div>
</div>
<div class="flex items-start gap-4 p-4 rounded-xl bg-surface-container-lowest border border-white/5">
<span class="material-symbols-outlined text-primary p-2 bg-primary/10 rounded-lg">info</span>
<div>
<h4 class="font-bold">Entry Requirements</h4>
<p class="text-sm text-on-surface-variant">18+ Only. Valid ID and digital ticket required at all checkpoints.</p>
</div>
</div>
</div>
</div>
<div class="rounded-2xl overflow-hidden h-64 border border-white/10 grayscale contrast-125 opacity-80 hover:opacity-100 transition-all">
<img alt="Venue Map" class="w-full h-full object-cover" data-alt="Stylized dark architectural map of a futuristic stadium complex with neon highlighted access routes" data-location="Ho Chi Minh City" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD5VMJzRgB194cmOHTHkSnE9U7U2rmhuFMvhgmw_B6wQa6-sjeiAh1z7Gj9dG_pk2S6ozTNtC-sVRvFdKirN8oYV7gJ_SgjXhIvhjjJOOeSOQVed2XsoQHvl83OmSuSBYYF8AQ-eQvxZyw0g2jasTbaOloZctQCP2yGtRrdJrsGMthfx_rP0-Fq8R1n59rmymarcBN8dUTbyMYi-ieJ1pomRIhubCiRvFM4H5SX4cZzD1LKFeSYPdLLM9On9GjbPIYDzKoZh-1OZSM"/>
</div>
</section>
</div>
<!-- Right Column: Quick Booking -->
<div class="lg:col-span-4">
<div class="sticky top-32 glass-panel p-8 rounded-2xl border border-white/10 shadow-2xl space-y-8">
<div>
<div class="flex justify-between items-start mb-6">
<h3 class="text-2xl font-headline font-bold">Quick Booking</h3>
<span class="bg-error/20 text-error px-3 py-1 rounded-full text-xs font-bold font-label animate-pulse">Only 12 tickets left!</span>
</div>
<div class="space-y-6">
<!-- Type Selector -->
<div class="space-y-2">
<label class="text-xs uppercase tracking-widest text-slate-500 font-label">Ticket Tier</label>
<select class="w-full bg-surface-container-highest border-none rounded-xl py-4 px-4 text-on-surface focus:ring-2 focus:ring-primary">
<option>General Admission - ₫500,000</option>
<option>Premium Stalls - ₫850,000</option>
<option>Galactic VIP - ₫2,500,000</option>
</select>
</div>
<!-- Qty Selector -->
<div class="space-y-2">
<label class="text-xs uppercase tracking-widest text-slate-500 font-label">Quantity</label>
<div class="flex items-center justify-between bg-surface-container-highest rounded-xl p-2">
<button class="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10">
<span class="material-symbols-outlined">remove</span>
</button>
<span class="text-xl font-headline font-bold">02</span>
<button class="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10">
<span class="material-symbols-outlined">add</span>
</button>
</div>
</div>
<!-- Price Breakdown -->
<div class="pt-6 border-t border-white/5 space-y-3">
<div class="flex justify-between text-on-surface-variant">
<span>Tickets (2x)</span>
<span>₫1,000,000</span>
</div>
<div class="flex justify-between text-on-surface-variant">
<span>Service Fee</span>
<span>₫45,000</span>
</div>
<div class="flex justify-between text-xl font-bold font-headline pt-2 text-secondary">
<span>Total Price</span>
<span>₫1,045,000</span>
</div>
</div>
</div>
</div>
<button class="w-full bg-primary-container hover:bg-primary py-5 rounded-xl font-headline font-black text-on-primary-container uppercase tracking-widest aurora-glow transition-all active:scale-95">
                        Select Seats
                    </button>
<div class="text-center space-y-4">
<p class="text-xs text-slate-500 uppercase tracking-tighter">Secure Checkout Powered by Interstellar Pay</p>
<div class="flex justify-center gap-4 opacity-50 grayscale">
<span class="material-symbols-outlined">credit_card</span>
<span class="material-symbols-outlined">account_balance_wallet</span>
<span class="material-symbols-outlined">qr_code</span>
</div>
</div>
</div>
</div>
</div>
</main>
<!-- Footer -->
<footer class="bg-slate-950 full-width py-12 border-t border-white/5">
<div class="grid grid-cols-2 md:grid-cols-4 gap-8 px-6 max-w-screen-2xl mx-auto">
<div class="col-span-2 md:col-span-1">
<div class="text-xl font-black text-red-500 mb-6 font-['Space_Grotesk'] uppercase">TicketRush</div>
<p class="text-slate-500 text-sm leading-relaxed mb-6 font-['Be_Vietnam_Pro']">The ultimate portal for cosmic experiences and rhythmic escapes. Founded in the void, built for the future.</p>
<p class="text-slate-500 text-[10px] uppercase tracking-widest font-['Space_Grotesk'] font-semibold">© 2024 TicketRush. Powered by the Cosmic Voyager.</p>
</div>
<div class="space-y-4">
<h4 class="font-['Space_Grotesk'] tracking-wide uppercase text-xs font-semibold text-red-400">Navigation</h4>
<nav class="flex flex-col space-y-2">
<a class="text-slate-500 hover:text-red-400 transition-colors opacity-80 hover:opacity-100 font-['Space_Grotesk'] text-sm" href="#">Terms of Service</a>
<a class="text-slate-500 hover:text-red-400 transition-colors opacity-80 hover:opacity-100 font-['Space_Grotesk'] text-sm" href="#">Privacy Policy</a>
<a class="text-slate-500 hover:text-red-400 transition-colors opacity-80 hover:opacity-100 font-['Space_Grotesk'] text-sm" href="#">Help Center</a>
</nav>
</div>
<div class="space-y-4">
<h4 class="font-['Space_Grotesk'] tracking-wide uppercase text-xs font-semibold text-red-400">Collaborate</h4>
<nav class="flex flex-col space-y-2">
<a class="text-slate-500 hover:text-red-400 transition-colors opacity-80 hover:opacity-100 font-['Space_Grotesk'] text-sm" href="#">Sell Tickets</a>
<a class="text-slate-500 hover:text-red-400 transition-colors opacity-80 hover:opacity-100 font-['Space_Grotesk'] text-sm" href="#">Artist Portal</a>
<a class="text-slate-500 hover:text-red-400 transition-colors opacity-80 hover:opacity-100 font-['Space_Grotesk'] text-sm" href="#">Affiliates</a>
</nav>
</div>
<div class="space-y-4">
<h4 class="font-['Space_Grotesk'] tracking-wide uppercase text-xs font-semibold text-red-400">Connect</h4>
<div class="flex gap-4">
<button class="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center hover:text-red-400 transition-colors">
<span class="material-symbols-outlined text-lg">public</span>
</button>
<button class="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center hover:text-red-400 transition-colors">
<span class="material-symbols-outlined text-lg">forum</span>
</button>
</div>
</div>
</div>
</footer>
</body></html>