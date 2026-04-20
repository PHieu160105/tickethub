import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Sparkles, ArrowRight } from 'lucide-react'

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(252,83,109,0.2),_transparent_35%)] pb-20 pt-24 sm:pt-32">
        <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-slate-950/80 to-transparent" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-10 px-4 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <div className="max-w-2xl space-y-8">
            <div className="inline-flex items-center gap-3 rounded-full bg-primary px-4 py-2 text-xs uppercase tracking-[0.3em] text-on-primary-container shadow-lg shadow-primary/25">
              <Sparkles className="h-4 w-4" />
              Live events starting soon
            </div>
            <div className="space-y-6">
              <h1 className="text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
                The future of ticketing is here.
              </h1>
              <p className="max-w-xl text-lg text-slate-300 sm:text-xl">
                Discover sky-high events, reserve your seats, and enter the rush with seamless booking from anywhere.
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link to="/search">
                <Button className="min-w-[180px]" variant="primary" size="lg">
                  Browse Events
                </Button>
              </Link>
              <Link to="/login">
                <Button className="min-w-[180px]" variant="outline" size="lg">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid w-full max-w-md gap-4 text-sm sm:text-base">
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/20">
              <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Featured</span>
              <h2 className="mt-4 text-2xl font-bold">Pulsar Beats Festival</h2>
              <p className="mt-3 text-slate-300">A multi-sensory night with the hottest DJs, holographic shows, and high-velocity crowds.</p>
              <div className="mt-6 flex items-center justify-between text-slate-400">
                <span>Oct 24, 2024</span>
                <span>Orion Zenith Arena</span>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/20">
              <span className="text-xs uppercase tracking-[0.3em] text-slate-400">VIP Access</span>
              <h2 className="mt-4 text-2xl font-bold">Galactic VIP</h2>
              <p className="mt-3 text-slate-300">Elevate your night with private lounges, premium seating, and exclusive perks.</p>
              <Link to="/tickets" className="mt-6 inline-flex items-center gap-2 text-primary hover:underline">
                View My Tickets <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-3">
          <article className="rounded-3xl bg-slate-900/80 p-8 shadow-xl shadow-black/20">
            <p className="text-sm uppercase tracking-[0.3em] text-secondary">Smart Search</p>
            <h2 className="mt-4 text-2xl font-bold">Find events faster</h2>
            <p className="mt-4 text-slate-300">Use personalized search to filter by artists, dates, or venues and land your perfect plan.</p>
            <Link to="/search" className="mt-6 inline-flex items-center gap-2 text-white hover:text-primary">
              Search now <ArrowRight className="h-4 w-4" />
            </Link>
          </article>

          <article className="rounded-3xl bg-slate-900/80 p-8 shadow-xl shadow-black/20">
            <p className="text-sm uppercase tracking-[0.3em] text-secondary">Easy checkout</p>
            <h2 className="mt-4 text-2xl font-bold">Book in under 60 seconds</h2>
            <p className="mt-4 text-slate-300">Secure checkout and instant confirmation keep your experience swift and reliable.</p>
            <Link to="/checkout" className="mt-6 inline-flex items-center gap-2 text-white hover:text-primary">
              Checkout sample <ArrowRight className="h-4 w-4" />
            </Link>
          </article>

          <article className="rounded-3xl bg-slate-900/80 p-8 shadow-xl shadow-black/20">
            <p className="text-sm uppercase tracking-[0.3em] text-secondary">Your profile</p>
            <h2 className="mt-4 text-2xl font-bold">Keep your details ready</h2>
            <p className="mt-4 text-slate-300">Update your preferences, payment information, and event alerts in one place.</p>
            <Link to="/profile" className="mt-6 inline-flex items-center gap-2 text-white hover:text-primary">
              View profile <ArrowRight className="h-4 w-4" />
            </Link>
          </article>
        </div>
      </section>
    </main>
  )
}
