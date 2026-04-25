import React from 'react';
import { 
  Ticket, User, Heart, CreditCard, Settings, 
  HelpCircle, LogOut, Star, Camera 
} from 'lucide-react';

interface CustomerSidebarProps {
  activeTab: 'tickets' | 'profile' | 'favorites' | 'payments' | 'settings' | 'help';
  userName?: string;
  membershipLevel?: string;
  onNavigate?: (tab: string) => void;
}

export const CustomerSidebar: React.FC<CustomerSidebarProps> = ({
  activeTab,
  userName = 'Alex Voyager',
  membershipLevel = 'Stellar Member',
  onNavigate,
}) => {
  // Cấu hình Menu chính (Account)
  const menuItems = [
    { id: 'tickets', icon: Ticket, label: 'My Tickets' },
    { id: 'profile', icon: User, label: 'My Profile' },
    { id: 'favorites', icon: Heart, label: 'Watchlist' },
    { id: 'payments', icon: CreditCard, label: 'Payment Methods' },
  ];

  // Cấu hình Menu hỗ trợ (Support)
  const supportItems = [
    { id: 'settings', icon: Settings, label: 'Settings' },
    { id: 'help', icon: HelpCircle, label: 'Help Center' },
    { id: 'logout', icon: LogOut, label: 'Sign Out' },
  ];

  const isActive = (id: string) => activeTab === id;

  return (
    <aside className="w-72 h-[calc(100vh-80px)] bg-slate-900/50 border-r border-white/5 p-6 flex flex-col gap-8 sticky top-[80px] overflow-y-auto">
      
      {/* User Profile Section */}
      <div className="flex flex-col items-center text-center pb-6 border-b border-white/5">
        <div className="relative mb-4 group">
          <div className="w-24 h-24 rounded-2xl bg-slate-800 border-2 border-amber-400/30 overflow-hidden flex items-center justify-center relative shadow-[0_0_15px_rgba(251,191,36,0.15)]">
            {/* Avatar Placeholder */}
            <User className="w-12 h-12 text-slate-500" />
            {/* Badge Star */}
            <div className="absolute bottom-0 right-0 bg-amber-400 p-1.5 rounded-full border-4 border-slate-900">
              <Star className="w-3 h-3 text-slate-900 fill-current" />
            </div>
          </div>
        </div>
        
        <h3 className="text-white font-bold text-lg font-headline">{userName}</h3>
        <p className="text-amber-400 text-xs font-bold uppercase tracking-widest mt-1">{membershipLevel}</p>
      </div>

      {/* Main Navigation */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3 px-2">
          Account
        </p>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate?.(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
              isActive(item.id)
                ? 'bg-gradient-to-r from-red-500/20 to-red-500/5 text-red-400 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <item.icon className={`w-5 h-5 transition-colors ${isActive(item.id) ? 'text-red-400' : 'text-slate-500 group-hover:text-white'}`} />
            <span className={`font-semibold text-sm ${isActive(item.id) ? 'text-red-400' : 'text-slate-300 group-hover:text-white'}`}>
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {/* Support Navigation */}
      <div className="space-y-2 mt-auto">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3 px-2">
          Support
        </p>
        {supportItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate?.(item.id)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-all"
          >
            <item.icon className="w-5 h-5 text-slate-500 group-hover:text-white" />
            <span className="font-semibold text-sm">{item.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
};