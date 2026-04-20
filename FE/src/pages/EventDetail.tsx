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
                    {/* <div className="p-2 bg-primary/10 rounded-lg">
                      <Parking className="text-primary w-5 h-5" />
                    </div> */}
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
