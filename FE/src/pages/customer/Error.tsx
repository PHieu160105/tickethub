import { Link, useNavigate } from 'react-router-dom';
import { Search, Home, ArrowLeft, Satellite } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Footer } from '@/components/layout/Footer';

interface ErrorPageProps {
  statusCode?: number;
  title?: string;
  message?: string;
}

export function ErrorPage({
  statusCode = 404,
  title = "Page Not Found",
  message = "Looks like you're lost in space... The event you're looking for has drifted beyond the event horizon."
}: ErrorPageProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#0a0e27] to-[#1a1f3a] text-[#dee0ff] font-body overflow-hidden">
      {/* Top Navigation */}
      <header className="fixed top-0 left-0 w-full z-50 px-6 py-4 flex justify-between items-center bg-slate-950/20 backdrop-blur-sm">
        <Link to="/" className="text-2xl font-black italic tracking-tighter text-red-500 uppercase font-headline">
          TicketRush
        </Link>
        <nav className="hidden md:flex gap-8 items-center font-headline text-slate-300">
          <Link to="/search" className="hover:text-white transition-colors">Events</Link>
          <Link to="/venues" className="hover:text-white transition-colors">Venues</Link>
          <Link to="/deals" className="hover:text-white transition-colors">Deals</Link>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center px-6 relative pt-16">
        {/* Background Effects */}
        <div className="absolute inset-0 z-0 opacity-30" style={{
          backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }}></div>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-container/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-tertiary-container/5 rounded-full blur-[150px]"></div>

        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center relative z-10">
          {/* Visual Side */}
          <div className="flex justify-center md:justify-end order-1 md:order-2">
            <div className="relative w-64 h-64 md:w-96 md:h-96 animate-float">
              <div className="absolute inset-0 glass-panel rounded-full border border-white/10 flex items-center justify-center overflow-hidden">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBujX6dJHvYzmjag9-VzBVgBpIwzwGv2w1JCCXwh53UHcba4hnO3KogJvHdZdSz3QgAR1Zjj3-UbJdYUAHeanGW4xkLqaCJTUE_OPo_aLubaUcbuQ8r98lVSzGpE4hC5U_vbwEuOGwJulterxGaajtAyH394BamuO09tq20YpYWDB7z1NlBWFS8rls7fbUlLMpfcLpOQgyypYX1sYoLcxwqObimzkB1vMWG40BoKaXkoCcyJdmtTILGPIyZ7VBRGQvmdFP_E5Hs_qU"
                  alt="Lost Astronaut"
                  className="w-full h-full object-cover grayscale opacity-80"
                />
              </div>
              {/* Decorative Orbital Ring */}
              <div className="absolute -inset-4 border-2 border-dashed border-primary/20 rounded-full animate-[spin_20s_linear_infinite]"></div>
              {/* Signal Icon */}
              <div className="absolute top-4 right-4 w-12 h-12 bg-secondary rounded-full flex items-center justify-center text-on-secondary-fixed shadow-[0_0_15px_#f0c03e]">
                <Satellite className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Textual Content Side */}
          <div className="text-center md:text-left order-2 md:order-1">
            <div className="inline-block px-4 py-1 glass-panel rounded-full mb-6 border border-white/5">
              <span className="font-headline text-xs font-bold uppercase tracking-[0.2em] text-secondary">Signal Lost</span>
            </div>

            <h1 className="font-headline text-6xl md:text-8xl font-black tracking-tighter text-white mb-2 italic">
              {statusCode}
            </h1>

            <h2 className="font-headline text-2xl md:text-3xl font-bold tracking-tight text-primary mb-6">
              {title}
            </h2>

            <p className="font-body text-lg text-on-surface-variant mb-10 max-w-md mx-auto md:mx-0 leading-relaxed">
              {message}
            </p>

            {/* Interactive Search Section */}
            <div className="relative max-w-md mb-8 group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                <Search className="w-5 h-5" />
              </div>
              <Input
                placeholder="Search for another event..."
                className="w-full bg-surface-container-highest/50 border-0 focus:ring-1 focus:ring-primary rounded-xl py-4 pl-12 pr-4 text-on-surface placeholder:text-slate-500 glass-panel transition-all"
              />
            </div>

            {/* Call to Action */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <Button
                variant="primary"
                className="bg-primary-container text-on-primary-container font-headline font-bold py-4 px-8 rounded-xl hover:scale-105 active:scale-95 transition-all duration-300 gap-2"
                onClick={() => navigate('/')}
              >
                <Home className="w-5 h-5" />
                Back to Home
              </Button>
              <Button
                variant="outline"
                className="glass-panel text-white font-headline font-semibold py-4 px-8 rounded-xl border border-white/10 hover:bg-white/5 transition-all active:scale-95 gap-2"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="w-5 h-5" />
                Go Back
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />

      {/* Custom Styles */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .glass-panel {
          backdrop-filter: blur(12px) saturate(180%);
          background: rgba(26, 30, 55, 0.8);
          border-top: 1px solid rgba(255, 178, 183, 0.2);
        }
      `}</style>
    </div>
  );
}

export default ErrorPage;