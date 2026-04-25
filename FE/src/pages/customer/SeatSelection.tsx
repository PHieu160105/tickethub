import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import {
  Timer,
  Calendar,
  MapPin,
  ArrowRight,
  Verified,
} from 'lucide-react'

export default function SeatSelection() {
  const [selectedSeats, setSelectedSeats] = useState([
    { id: 'B14', zone: 'Platinum', price: 249, benefits: 'Fast-Pass Entry Included' },
    { id: 'B15', zone: 'Platinum', price: 249, benefits: 'Fast-Pass Entry Included' }
  ])
  const [timeRemaining, setTimeRemaining] = useState(582) // 9:42 in seconds

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1))
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const removeSeat = (seatId: string) => {
    setSelectedSeats(prev => prev.filter(seat => seat.id !== seatId))
  }

  const subtotal = selectedSeats.reduce((sum, seat) => sum + seat.price, 0)
  const serviceFee = 18.50
  const facilityFee = 5.00
  const total = subtotal + serviceFee + facilityFee

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white font-body">
      <Navbar />

      <main className="max-w-screen-2xl mx-auto px-6 py-8">
        {/* Selection Progress Header */}
        <div className="mb-12 flex flex-col items-center">
          <div className="flex items-center w-full max-w-3xl justify-between relative">
            {/* Line */}
            <div className="absolute top-1/2 left-0 w-full h-[2px] bg-slate-800 -z-10 -translate-y-1/2"></div>
            <div className="absolute top-1/2 left-0 w-[5%] h-[2px] bg-primary -z-10 -translate-y-1/2"></div>
            {/* Steps */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold font-headline shadow-[0_0_15px_rgba(252,83,109,0.5)]">
                1
              </div>
              <span className="text-xs font-label uppercase tracking-widest text-primary">Select Seats</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center font-bold font-headline">
                2
              </div>
              <span className="text-xs font-label uppercase tracking-widest text-slate-400">Checkout</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center font-bold font-headline">
                3
              </div>
              <span className="text-xs font-label uppercase tracking-widest text-slate-400">Confirmation</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left: Seat Selection Map (70%) */}
          <div className="lg:w-[70%] space-y-6">
            <div className="backdrop-blur-xl bg-slate-900/80 rounded-xl overflow-hidden relative min-h-[600px] flex flex-col items-center py-12" style={{
              backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(252, 83, 109, 0.15) 0%, transparent 70%)'
            }}>
              {/* Stage */}
              <div className="w-[60%] h-12 bg-slate-800 rounded-b-[40px] flex items-center justify-center relative mb-16 shadow-[0_-20px_50px_-10px_rgba(252,83,109,0.4)]">
                <span className="font-headline font-bold uppercase tracking-[0.4em] text-slate-400 text-sm">S T A G E</span>
                <div className="absolute -bottom-4 flex gap-24">
                  <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_#fc536d]"></div>
                  <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_#fc536d]"></div>
                  <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_#fc536d]"></div>
                </div>
              </div>

              {/* Seat Map Visual Representation */}
              <div className="flex flex-col gap-4 items-center scale-90 md:scale-100">
                {/* VIP Zone (Gold) */}
                <div className="flex flex-col items-center gap-2 mb-4">
                  <span className="text-[10px] font-label text-secondary uppercase tracking-widest">VIP Zone</span>
                  <div className="grid grid-cols-12 gap-2">
                    {Array.from({ length: 12 }, (_, i) => (
                      <div
                        key={`vip-${i}`}
                        className={`w-4 h-4 rounded-t-sm border transition-all cursor-pointer ${
                          i === 2 || i === 8
                            ? 'bg-slate-800 border-white/10 opacity-40'
                            : 'border-secondary bg-secondary/10 hover:bg-secondary/40'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Platinum Zone (Purple) */}
                <div className="flex flex-col items-center gap-2 mb-4">
                  <span className="text-[10px] font-label text-blue-400 uppercase tracking-widest">Platinum Section</span>
                  <div className="grid grid-cols-16 gap-1.5">
                    <div className="col-span-16 grid grid-cols-16 gap-1.5">
                      {Array.from({ length: 16 }, (_, i) => (
                        <div
                          key={`plat-${i}`}
                          className={`w-3.5 h-3.5 rounded-t-sm transition-all cursor-pointer ${
                            i === 2 || i === 3
                              ? 'bg-primary border-primary shadow-[0_0_8px_#fc536d] animate-pulse'
                              : i === 9 || i === 10
                              ? 'bg-slate-800 border-white/5 opacity-40'
                              : 'border-blue-400/60 bg-blue-400/10 hover:bg-blue-400/40'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Standard Zone (Cyan/Blue) */}
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] font-label text-slate-400 uppercase tracking-widest">Standard Seating</span>
                  <div className="grid grid-cols-20 gap-1 mt-2">
                    {Array.from({ length: 20 }, (_, i) => (
                      <div
                        key={`std-${i}`}
                        className={`w-3 h-3 rounded-t-sm transition-all cursor-pointer ${
                          i === 0 || i === 1 || i === 14 || i === 15 || i === 16
                            ? 'bg-slate-800 border-white/5 opacity-40'
                            : 'border-slate-500 bg-slate-500/10 hover:bg-slate-400/30'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Map Legend */}
              <div className="absolute bottom-6 flex gap-8 px-6 py-3 backdrop-blur-xl bg-slate-900/80 rounded-full text-[10px] font-label tracking-widest uppercase">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-t-sm border border-blue-400 bg-blue-400/20"></div>
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-t-sm bg-primary shadow-[0_0_8px_#fc536d]"></div>
                  <span>Selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-t-sm bg-slate-800 border-white/10 opacity-40"></div>
                  <span>Sold</span>
                </div>
              </div>
            </div>

            {/* Event Mini Info Card */}
            <div className="flex items-center gap-6 backdrop-blur-xl bg-slate-900/80 p-6 rounded-xl border border-white/5">
              <img
                className="w-24 h-24 object-cover rounded-lg"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCsiwj8Iu6p71_c6v-g60p0Bbr4_Xiano8ZPfkGYeedl0t_tOGEvPAQcMN2Cg0VomxOxBsqYlODFEG2_gRam7nvHcEYLBpRUDlQiUuqwhFCqfMNPr338NXfj0idk-eziFf4sxqKYqjbPKfjFUVaADBYZA4GUEuedFsDpObiCY-uO7-Bz0RStcRh0sCcqDOClTXnagTZDHc_x8YSIR1miU5w7V1-SBQ090AD714oQRx4gneyOrEhWkscQdX7cKWvd99cl_bAUIXReEo"
                alt="Event"
              />
              <div>
                <h2 className="text-2xl font-headline font-bold text-white uppercase tracking-tight">
                  Neon Odyssey Tour 2024
                </h2>
                <div className="flex gap-4 mt-2 text-slate-400 text-sm">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-secondary" />
                    <span>Nov 15, 2024</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-secondary" />
                    <span>Quantum Arena, Sector 7</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Order Summary (30%) */}
          <aside className="lg:w-[30%] flex flex-col gap-6">
            {/* Countdown Timer */}
            <div className="backdrop-blur-xl bg-slate-900/80 p-4 rounded-xl flex items-center justify-between border-l-4 border-secondary border-white/5">
              <div className="flex items-center gap-3">
                <Timer className="w-5 h-5 text-secondary" />
                <span className="text-xs font-label uppercase tracking-widest text-secondary font-semibold">
                  Time Remaining
                </span>
              </div>
              <span className="text-2xl font-headline font-bold text-secondary">{formatTime(timeRemaining)}</span>
            </div>

            {/* Summary Card */}
            <div className="backdrop-blur-xl bg-slate-900/80 rounded-xl overflow-hidden flex flex-col h-full min-h-[450px] border border-white/5">
              <div className="p-6 border-b border-white/5">
                <h3 className="font-headline font-bold uppercase tracking-widest text-slate-400 text-xs">
                  Order Summary
                </h3>
              </div>
              <div className="flex-1 p-6 space-y-4 overflow-y-auto">
                {/* Selected Seat Items */}
                {selectedSeats.map((seat) => (
                  <div key={seat.id} className="flex justify-between items-center group">
                    <div className="flex flex-col">
                      <span className="font-headline font-bold text-white text-lg">
                        {seat.zone} - Row {seat.id.slice(0, 1)}, Seat {seat.id.slice(1)}
                      </span>
                      <span className="text-xs font-label uppercase text-slate-500 tracking-wider">
                        {seat.benefits}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-headline font-bold text-white">${seat.price}.00</div>
                      <button
                        onClick={() => removeSeat(seat.id)}
                        className="text-[10px] font-label text-primary uppercase hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}

                {/* Divider */}
                <div className="pt-4 border-t border-white/5 space-y-2">
                  <div className="flex justify-between text-sm text-slate-400">
                    <span>Service Fee</span>
                    <span>${serviceFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-400">
                    <span>Facility Fee</span>
                    <span>${facilityFee.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-slate-800/50">
                <div className="flex justify-between items-end mb-6">
                  <div className="flex flex-col">
                    <span className="text-xs font-label uppercase tracking-widest text-slate-400">Total Amount</span>
                    <span className="text-4xl font-headline font-bold text-secondary tracking-tighter leading-none">
                      ${total.toFixed(2)}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 mb-1">Tax incl.</span>
                </div>
                <Link to="/checkout">
                  <Button className="w-full bg-primary hover:bg-primary/90 text-on-primary py-4 rounded-xl font-headline font-bold uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(252,83,109,0.3)] hover:shadow-[0_0_30px_rgba(252,83,109,0.5)] transition-all flex items-center justify-center gap-2 group">
                    Proceed to Checkout
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Safe Checkout Badge */}
            <div className="flex items-center justify-center gap-4 text-slate-500 py-2">
              <Verified className="w-5 h-5" />
              <span className="text-[10px] font-label uppercase tracking-widest">
                Encrypted Checkout & Secure Tickets
              </span>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}