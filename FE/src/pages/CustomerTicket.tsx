import React, { useState } from 'react';
import { TicketCard } from '../components/ui/TicketCard';
import { CustomerSidebar } from '../components/layout/CustomerSidebar';

const CustomerTicket: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');

  const tickets = [
    {
      id: 1,
      eventTitle: 'Neon Nebula: Live in Orion',
      ticketNumber: 'TR-8829-X',
      date: 'Oct 24, 2024',
      location: 'The Supernova Arena',
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAPoRLUR94VxdNMZU6eczD5L4Vb9x4zvCHESwz5Qr2kyHC3kWOPSy0777q6jzR1OUWmjlFHPKNuBTNHKtE3IpWp7LjhEvbp35d0WjLvTgyO3O87XwCPdeGN1z5JGmFIg47JsLYazJT4h1_P12t0pq_iLZqK07r6DoxUdFrS4J-2vqEiWSdZnqJyO5gRaIilwjsMeYnqvEaJJGthdzu7u1dSAKKtHYIkN2fpEj8f62edEgHUxFFSXUvcctHk94tDwRrLkbdgXdSqQa0',
      status: 'confirmed' as const,
    },
    {
      id: 2,
      eventTitle: 'Warp Speed Festival 3024',
      ticketNumber: 'TR-1105-V',
      date: 'Nov 12, 2024',
      location: 'Lunar Base Alpha',
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBYPTg8N2MSd6Lr_OZNVFqe9J7l_bZ9KN_8RZcMEk9OlKcH3S0SZ1ZOMVpz-DHimn_VllZsO376X1BwrP0VRPOIO2dOSmLIhECejxroX-0ZQi3iSKJ29T5ei0Y707BeBNIZCROoIO7NPIdQQ9cj59Vm8AqD_nIhL-7IlEoKV7WWf07twvN4_ACOnofbUPVAZACgsRXThJ5-FJAw7TFQpkfMY7jQrSgMaLoxHB1-VxOGsYAjzMPsQ7ISpNfCKp7-Yo0gDYFDOKTFjUU',
      status: 'confirmed' as const,
    },
    {
      id: 3,
      eventTitle: 'Cosmic Voyager Gala',
      ticketNumber: 'TR-PREM-001',
      date: 'DEC 31, 2024',
      location: 'Nebula Hall, Sector 7',
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBHEbmjooa91O0jOJEm6UsGxfuN9aVq_jmYuruwWdndcDxMlM5aqbXR-LpZqUC0u_BRP19gP2H_JwEsTKd9o1WMDvcFcJ6Ys-03gyvXj_IuHp7Avvx-cWymjPNJxuIcrK-0PfUFuKzvWsB72bKYpwbpVw5JzHp0aZY0RW3dZeZxa9PWZlylps3jQP-4z8iRGPSukU5B3abBSz6lqEsZB9TY7b9N5y2IOKHuqngUJz88HijyPiOOgO-My4yrohagvJzVJnPrtJCCW5g',
      status: 'confirmed' as const,
      isFeatured: true,
      additionalInfo: [
        { label: 'Star Date', value: 'DEC 31, 2024' },
        { label: 'Galaxy Location', value: 'Nebula Hall, Sector 7' },
        { label: 'Gate Pass', value: 'Hangar 99' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] to-[#1a1f3a] text-[#dee0ff] font-body">
      {/* Top Navigation Bar */}
      <header className="bg-slate-950/80 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50 shadow-[0_0_15px_rgba(233,69,96,0.2)]">
        <div className="flex justify-between items-center w-full px-6 py-4 max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-8">
            <div className="text-2xl font-black italic tracking-tighter text-red-500 uppercase font-headline">
              TicketRush
            </div>
            <nav className="hidden md:flex gap-6">
              <a className="text-slate-300 hover:text-white transition-colors font-['Space_Grotesk'] font-bold tracking-tight" href="#">
                Events
              </a>
              <a className="text-slate-300 hover:text-white transition-colors font-['Space_Grotesk'] font-bold tracking-tight" href="#">
                Venues
              </a>
              <a className="text-slate-300 hover:text-white transition-colors font-['Space_Grotesk'] font-bold tracking-tight" href="#">
                Deals
              </a>
              <a className="text-red-500 border-b-2 border-red-500 pb-1 font-['Space_Grotesk'] font-bold tracking-tight" href="#">
                My Tickets
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex bg-white/5 rounded-full px-4 py-1.5 items-center gap-2 border border-white/10">
              <span className="material-symbols-outlined text-slate-400 text-lg">search</span>
              <input
                className="bg-transparent border-none focus:ring-0 text-sm w-48 text-white placeholder-slate-500"
                placeholder="Find stars..."
                type="text"
              />
            </div>
            <button className="material-symbols-outlined text-slate-300 hover:text-red-400 transition-colors">
              notifications
            </button>
            <button className="material-symbols-outlined text-slate-300 hover:text-red-400 transition-colors">
              shopping_cart
            </button>
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary-container">
              <img
                alt="User profile"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDpmxNGn5W6mI7iCD4GiEuifgXkamRp7Dm6BxPvJP0K1bwFJ6rJ7ubRKRdK2izhPmHDAfvW9ZK2BFVGGGsGgAH_lhbNhm2KnAj7bf0Urx9A5mohUXtkp-zJMy3TPAfhYb3u7xGannqj52V8LV4pNn5VsjfTkEIjSvrFosY_P6Jrat4B2HQTapiJn-qpXmdJ9Mo3Ncx3UsMEcHNjt3Vrcd3tQLmHdBZDJeRgP9zC9H15X282BLpjXq3Mv-sJTMZDFPgw5Gjasi0ODaY"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto flex min-h-[calc(100vh-80px)]">
        {/* Sidebar Navigation */}
        <CustomerSidebar activeTab="tickets" userName="Alex Voyager" membershipLevel="Stellar Member" />

        {/* Main Content Area */}
        <main className="flex-1 p-6 md:p-12 overflow-y-auto">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <h1 className="text-5xl font-black font-headline text-white tracking-tighter mb-2">
                My Tickets
              </h1>
              <p className="text-on-surface-variant max-w-md">
                Access your boarding passes to the most exclusive experiences in the galaxy.
              </p>
            </div>
            {/* Tabs */}
            <div className="flex p-1 bg-surface-container-highest/50 rounded-full border border-white/5 backdrop-blur-sm self-start">
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`px-6 py-2 rounded-full font-semibold text-sm transition-all ${
                  activeTab === 'upcoming'
                    ? 'bg-primary-container text-on-primary-container'
                    : 'text-on-surface-variant hover:text-white'
                }`}
              >
                Upcoming
              </button>
              <button
                onClick={() => setActiveTab('past')}
                className={`px-6 py-2 rounded-full font-semibold text-sm transition-all ${
                  activeTab === 'past'
                    ? 'bg-primary-container text-on-primary-container'
                    : 'text-on-surface-variant hover:text-white'
                }`}
              >
                Past
              </button>
              <button
                onClick={() => setActiveTab('cancelled')}
                className={`px-6 py-2 rounded-full font-semibold text-sm transition-all ${
                  activeTab === 'cancelled'
                    ? 'bg-primary-container text-on-primary-container'
                    : 'text-on-surface-variant hover:text-white'
                }`}
              >
                Cancelled
              </button>
            </div>
          </header>

          {/* Ticket List */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {tickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                eventTitle={ticket.eventTitle}
                ticketNumber={ticket.ticketNumber}
                date={ticket.date}
                location={ticket.location}
                imageUrl={ticket.imageUrl}
                status={ticket.status}
                isFeatured={ticket.isFeatured}
                additionalInfo={ticket.additionalInfo}
                onViewDetails={() => console.log('View details:', ticket.id)}
                onDownload={() => console.log('Download:', ticket.id)}
              />
            ))}
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-slate-950 py-12 border-t border-white/5 mt-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 px-6 max-w-screen-2xl mx-auto">
          <div className="col-span-2 md:col-span-1">
            <div className="text-xl font-black text-red-500 font-headline italic uppercase mb-6">
              TicketRush
            </div>
            <p className="text-slate-500 text-xs font-label leading-relaxed">
              Elevating your experience beyond the terrestrial. The galaxy's leading platform for moments that matter.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <h4 className="text-white font-headline font-bold text-sm uppercase tracking-widest mb-2">
              Navigation
            </h4>
            <a className="text-slate-500 hover:text-red-400 transition-colors text-xs font-['Space_Grotesk'] tracking-wide uppercase font-semibold" href="#">
              Help Center
            </a>
            <a className="text-slate-500 hover:text-red-400 transition-colors text-xs font-['Space_Grotesk'] tracking-wide uppercase font-semibold" href="#">
              Sell Tickets
            </a>
            <a className="text-slate-500 hover:text-red-400 transition-colors text-xs font-['Space_Grotesk'] tracking-wide uppercase font-semibold" href="#">
              Artist Portal
            </a>
          </div>
          <div className="flex flex-col gap-4">
            <h4 className="text-white font-headline font-bold text-sm uppercase tracking-widest mb-2">
              Legal
            </h4>
            <a className="text-slate-500 hover:text-red-400 transition-colors text-xs font-['Space_Grotesk'] tracking-wide uppercase font-semibold" href="#">
              Terms of Service
            </a>
            <a className="text-slate-500 hover:text-red-400 transition-colors text-xs font-['Space_Grotesk'] tracking-wide uppercase font-semibold" href="#">
              Privacy Policy
            </a>
            <a className="text-slate-500 hover:text-red-400 transition-colors text-xs font-['Space_Grotesk'] tracking-wide uppercase font-semibold" href="#">
              Affiliates
            </a>
          </div>
          <div className="flex flex-col gap-6">
            <h4 className="text-white font-headline font-bold text-sm uppercase tracking-widest">
              Connect
            </h4>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary-container transition-all group">
                <span className="material-symbols-outlined text-slate-400 group-hover:text-on-primary-container text-sm">
                  public
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary-container transition-all group">
                <span className="material-symbols-outlined text-slate-400 group-hover:text-on-primary-container text-sm">
                  alternate_email
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary-container transition-all group">
                <span className="material-symbols-outlined text-slate-400 group-hover:text-on-primary-container text-sm">
                  smart_display
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-600 font-label leading-tight">
              © 2024 TicketRush. Powered by the Cosmic Voyager.
            </p>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-panel border-t border-white/10 px-6 py-4 flex justify-between items-center z-50">
        <button className="flex flex-col items-center gap-1 text-slate-400">
          <span className="material-symbols-outlined">explore</span>
          <span className="text-[10px] font-label uppercase">Explore</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-primary-fixed-dim">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            confirmation_number
          </span>
          <span className="text-[10px] font-label uppercase">Tickets</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400">
          <span className="material-symbols-outlined">favorite</span>
          <span className="text-[10px] font-label uppercase">Saves</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400">
          <span className="material-symbols-outlined">person</span>
          <span className="text-[10px] font-label uppercase">Profile</span>
        </button>
      </nav>
    </div>
  );
};

export default CustomerTicket;