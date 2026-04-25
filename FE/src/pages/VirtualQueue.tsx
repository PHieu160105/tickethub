import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, Sparkles, Clock, AlertTriangle, 
  CheckCircle, Loader2, Ticket
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Navbar } from '@/components/layout/Navbar';

interface QueueState {
  position: number;
  totalUsers: number;
  estimatedWaitTime: number; // in minutes
  progress: number; // percentage
  eventId: string;
  eventTitle: string;
  eventDate: string;
  venue: string;
}

const VirtualQueue: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [queueData, setQueueData] = useState<QueueState>({
    position: 105,
    totalUsers: 2341,
    estimatedWaitTime: 4,
    progress: 0,
    eventId: 'nebula-noise-2024',
    eventTitle: 'NEBULA NOISE WORLD TOUR',
    eventDate: 'Dec 24, 2024',
    venue: 'Galactic Arena',
  });
  
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Simulate queue progress
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
      
      // Simulate position decreasing
      setQueueData(prev => {
        const newPosition = Math.max(1, prev.position - Math.floor(Math.random() * 3));
        const newProgress = Math.min(95, ((prev.totalUsers - newPosition) / prev.totalUsers) * 100);
        
        return {
          ...prev,
          position: newPosition,
          progress: newProgress,
        };
      });

      // Auto-redirect when position <= 10
      if (queueData.position <= 10 && !isRedirecting) {
        handleRedirect();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [queueData.position, isRedirecting]);

  const handleRedirect = () => {
    setIsRedirecting(true);
    setTimeout(() => {
      // Redirect to seat selection page
      navigate(`/event/${queueData.eventId}/seats`, { 
        state: { queueToken: 'verified' } 
      });
    }, 2000);
  };

  const handleBackToHome = () => {
    if (window.confirm('Leaving this page will cause you to lose your spot in the queue. Are you sure?')) {
      navigate('/');
    }
  };

  const formatWaitTime = (minutes: number) => {
    if (minutes < 1) return 'Less than 1 minute';
    if (minutes === 1) return '1 minute';
    return `Approx. ${minutes} minutes`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      {/* Celestial Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-surface-container via-background to-surface-container-lowest" />
        <div className="absolute inset-0 opacity-30">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width: Math.random() * 3 + 'px',
                height: Math.random() * 3 + 'px',
                top: Math.random() * 100 + '%',
                left: Math.random() * 100 + '%',
                animation: `pulse ${Math.random() * 3 + 2}s ease-in-out infinite`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pt-24 pb-12 relative z-10">
        {/* Animated Galaxy Spinner */}
        <div className="relative mb-12">
          <div className="w-36 h-36 rounded-full border-2 border-primary/10 border-t-4 border-r-4 border-t-primary border-r-secondary animate-spin shadow-[0_0_30px_rgba(252,83,109,0.2)]">
            <div className="absolute inset-3 rounded-full border border-tertiary/10 border-l-4 border-b-4 border-l-tertiary border-b-primary animate-[spin_6s_linear_infinite_reverse]" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-12 h-12 text-primary animate-pulse" />
          </div>
        </div>

        {/* Queue Status */}
        <div className="text-center mb-10 space-y-4">
          <h1 className="font-headline text-5xl md:text-7xl font-black tracking-tighter text-on-surface uppercase">
            You're in line!
          </h1>
          <p className="font-headline text-2xl md:text-3xl font-bold">
            <span className="text-secondary">#{queueData.position.toLocaleString()}</span>
            <span className="text-on-surface-variant/60"> of {queueData.totalUsers.toLocaleString()}</span>
          </p>
        </div>

        {/* Queue Info Card */}
        <div className="w-full max-w-4xl glass-panel rounded-2xl p-8 md:p-12 shadow-2xl border border-white/5 backdrop-blur-xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Progress */}
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-secondary animate-pulse" />
                  <span className="text-on-surface-variant text-xs uppercase tracking-[0.2em] font-bold">
                    Estimated Wait Time
                  </span>
                </div>
                <p className="text-2xl font-headline font-bold text-on-surface">
                  {formatWaitTime(queueData.estimatedWaitTime)}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className="text-on-surface-variant text-xs uppercase tracking-[0.2em] font-bold">
                    Progress
                  </span>
                  <span className="text-tertiary text-sm font-bold">
                    {queueData.progress.toFixed(0)}% complete
                  </span>
                </div>
                <div className="h-3 w-full bg-surface-container-lowest rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary via-tertiary to-secondary transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(252,83,109,0.5)]"
                    style={{ width: `${queueData.progress}%` }}
                  />
                </div>
              </div>

              {isRedirecting && (
                <div className="flex items-center gap-3 text-primary animate-pulse">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="font-headline font-bold">Redirecting to seat selection...</span>
                </div>
              )}
            </div>

            {/* Right: Warning */}
            <div className="bg-surface-container-low/50 rounded-xl p-6 border border-outline-variant/10">
              <div className="flex gap-4">
                <AlertTriangle className="w-6 h-6 text-secondary flex-shrink-0" />
                <div className="space-y-3">
                  <h3 className="font-headline font-bold text-on-surface uppercase text-sm tracking-tighter">
                    Important Notice
                  </h3>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    Please <strong className="text-primary">DO NOT refresh</strong> this page or navigate away. 
                    Closing this window will result in losing your spot in the queue.
                  </p>
                  <div className="flex items-center gap-2 text-sm text-on-surface-variant/80 italic">
                    <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                    You will be automatically redirected.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Event Info */}
        <div className="mt-12 flex flex-col md:flex-row items-center gap-6 opacity-80 hover:opacity-100 transition-all duration-500 group">
          <div className="w-24 h-24 rounded-xl overflow-hidden border border-white/10 shadow-xl group-hover:scale-105 transition-transform">
            <img 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBxnExSKwiz6iKy1ij4GZIVecWKCq2NKBAh7HD8675p8-KEzL_u4z4IGwQKWfksRlAHOWEA37nT6IlZjHzGMF7PJsneiPw75E6e1RAUbbLrHiJNdbAtIMMFywf1IkBXk7oQifjsjNAPOgC5eMmxp9XdoY-Dn42ltJjj1WwEB71-2L0nrvk90xUFiFPZ2n2NUsU7T-p7_4jkYiKsAz6h5dvpUn3P_gbRGnnkijPfn3T5rdbNe2JUCoQ5EZSWX0ZA2bQ6pIinrhtChSQ" 
              alt="Event"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="text-center md:text-left">
            <span className="text-tertiary text-[10px] font-black uppercase tracking-[0.3em] block mb-1">
              Live Reservation For
            </span>
            <h2 className="font-headline text-2xl font-bold text-on-surface">
              {queueData.eventTitle}
            </h2>
            <p className="text-on-surface-variant text-sm">
              {queueData.venue} • {queueData.eventDate}
            </p>
          </div>
        </div>

        {/* Back Button */}
        <button
          onClick={handleBackToHome}
          className="mt-8 flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors text-sm font-bold uppercase tracking-widest group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Home
        </button>
      </main>

      {/* Footer */}
      <footer className="w-full py-8 bg-surface-container-lowest border-t border-white/5 relative z-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-lg font-black text-primary font-headline uppercase">
            TicketRush
          </div>
          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
            <CheckCircle className="w-4 h-4 text-secondary" />
            Systems Operational
          </div>
        </div>
      </footer>
    </div>
  );
};

export default VirtualQueue;