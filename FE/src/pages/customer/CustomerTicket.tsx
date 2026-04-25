import React, { useState } from 'react';
import { CustomerSidebar } from '@/components/layout/CustomerSidebar';
import { Navbar } from '@/components/layout/Navbar'; // Đảm bảo đường dẫn đúng
import { TicketCard } from '@/components/ui/TicketCard'; // Component vé của bạn
import { 
  Ticket, Search, Bell, ShoppingCart, Globe, Mail, MonitorPlay, 
  Compass, Heart, User, Calendar, MapPin 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CustomerTicket: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');

  const tickets = [
    { id: 1, eventTitle: 'Neon Nebula: Live in Orion', ticketNumber: 'TR-8829-X', date: 'Oct 24, 2026', location: 'The Supernova Arena', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAPoRLUR94VxdNMZU6eczD5L4Vb9x4zvCHESwz5Qr2kyHC3kWOPSy0777q6jzR1OUWmjlFHPKNuBTNHKtE3IpWp7LjhEvbp35d0WjLvTgyO3O87XwCPdeGN1z5JGmFIg47JsLYazJT4h1_P12t0pq_iLZqK07r6DoxUdFrS4J-2vqEiWSdZnqJyO5gRaIilwjsMeYnqvEaJJGthdzu7u1dSAKKtHYIkN2fpEj8f62edEgHUxFFSXUvcctHk94DwRrLkbdgXdSqQa0', status: 'confirmed' as const },
    { id: 2, eventTitle: 'Warp Speed Festival 3026', ticketNumber: 'TR-1105-V', date: 'Nov 12, 2026', location: 'Lunar Base Alpha', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBYPTg8N2MSd6Lr_OZNVFqe9J7l_bZ9KN_8RZcMEk9OlKcH3S0SZ1ZOMVpz-DHimn_VllZsO376X1BwrP0VRPOIO2dOSmLIhECejxroX-0ZQi3iSKJ29T5ei0Y707BeBNIZCROoIO7NPIdQQ9cj59Vm8AqD_nIhL-7IlEoKV7WWf07twvN4_ACOnofbUPVAZACgsRXThJ5-FJAw7TFQpkfMY7jQrSgMaLoxHB1-VxOGsYAjzMPsQ7ISpNfCKp7-Yo0gDYFDOKTFjUU', status: 'confirmed' as const },
  ];

  return (
    <>
      <Navbar />
      <div className="pt-[80px] min-h-screen bg-[#0B0F19] flex">
        
        {/* Sidebar */}
        <CustomerSidebar 
          activeTab="tickets" 
          userName="Alex Voyager" 
          membershipLevel="Stellar Member" 
          onNavigate={(tab) => navigate(`/customer/${tab}`)}
        />

        {/* Main Content */}
        <main className="flex-1 p-8 lg:p-12">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <h1 className="text-5xl font-black text-white font-headline tracking-tighter">My Tickets</h1>
              <p className="text-slate-400 mt-2 max-w-lg">Access your boarding passes to the most exclusive experiences in the galaxy.</p>
            </div>
            
            {/* Tabs */}
            <div className="flex p-1 bg-slate-900 border border-white/5 rounded-full backdrop-blur-sm">
              {(['upcoming', 'past', 'cancelled'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-2 rounded-full font-bold text-sm transition-all capitalize ${
                    activeTab === tab 
                      ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg shadow-red-500/20' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
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
                onViewDetails={() => console.log('View details:', ticket.id)}
                onDownload={() => console.log('Download:', ticket.id)}
              />
            ))}
            {tickets.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
                <Ticket className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg font-bold">No {activeTab} tickets found.</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Footer (Giống Home nhưng sửa icon) */}
      <footer className="bg-slate-950 border-t border-white/5 py-12 mt-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 px-6 max-w-screen-2xl mx-auto">
          <div className="col-span-2 md:col-span-1">
            <div className="text-xl font-black text-red-500 font-headline uppercase mb-4">TicketRush</div>
            <p className="text-slate-500 text-xs">Elevating your experience beyond the terrestrial.</p>
          </div>
          <div className="space-y-3">
            <h4 className="text-white font-bold text-xs uppercase tracking-widest mb-2">Navigation</h4>
            <a href="#" className="block text-slate-500 hover:text-red-400 text-xs font-bold uppercase transition-colors">Help Center</a>
            <a href="#" className="block text-slate-500 hover:text-red-400 text-xs font-bold uppercase transition-colors">Sell Tickets</a>
            <a href="#" className="block text-slate-500 hover:text-red-400 text-xs font-bold uppercase transition-colors">Artist Portal</a>
          </div>
          <div className="space-y-3">
            <h4 className="text-white font-bold text-xs uppercase tracking-widest mb-2">Legal</h4>
            <a href="#" className="block text-slate-500 hover:text-red-400 text-xs font-bold uppercase transition-colors">Terms of Service</a>
            <a href="#" className="block text-slate-500 hover:text-red-400 text-xs font-bold uppercase transition-colors">Privacy Policy</a>
            <a href="#" className="block text-slate-500 hover:text-red-400 text-xs font-bold uppercase transition-colors">Affiliates</a>
          </div>
          <div className="space-y-4">
            <h4 className="text-white font-bold text-xs uppercase tracking-widest">Connect</h4>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-red-500 transition-colors cursor-pointer"><Globe className="w-4 h-4 text-slate-400" /></div>
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-red-500 transition-colors cursor-pointer"><Mail className="w-4 h-4 text-slate-400" /></div>
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-red-500 transition-colors cursor-pointer"><MonitorPlay className="w-4 h-4 text-slate-400" /></div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default CustomerTicket;