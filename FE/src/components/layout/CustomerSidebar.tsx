import React from 'react';

interface CustomerSidebarProps {
  userName?: string;
  userAvatar?: string;
  membershipLevel?: string;
  activeTab?: string;
  onNavigate?: (tab: string) => void;
}

export const CustomerSidebar: React.FC<CustomerSidebarProps> = ({
  userName = 'Alex Voyager',
  userAvatar,
  membershipLevel = 'Stellar Member',
  activeTab = 'tickets',
  onNavigate,
}) => {
  const menuItems = [
    { id: 'tickets', icon: 'confirmation_number', label: 'My Tickets' },
    { id: 'profile', icon: 'person', label: 'My Profile' },
    { id: 'favorites', icon: 'favorite', label: 'Watchlist' },
    { id: 'payments', icon: 'payments', label: 'Payment Methods' },
  ];

  const supportItems = [
    { id: 'settings', icon: 'settings', label: 'Settings' },
    { id: 'help', icon: 'help', label: 'Help Center' },
    { id: 'logout', icon: 'logout', label: 'Sign Out' },
  ];

  return (
    <aside className="w-full md:w-72 glass-panel border-r border-white/5 p-6 space-y-8">
      {/* User Profile Section */}
      <div className="flex flex-col items-center text-center gap-3">
        <div className="relative">
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-secondary shadow-[0_0_20px_rgba(240,192,62,0.3)]">
            {userAvatar ? (
              <img
                alt="Avatar"
                src={userAvatar}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-surface-container-highest flex items-center justify-center">
                <span className="material-symbols-outlined text-slate-400">
                  person
                </span>
              </div>
            )}
          </div>
          <div className="absolute bottom-0 right-0 bg-secondary rounded-full p-1 border-2 border-background">
            <span
              className="material-symbols-outlined text-background text-xs"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              star
            </span>
          </div>
        </div>
        <div>
          <h3 className="font-headline font-bold text-white tracking-tight">
            {userName}
          </h3>
          <p className="text-xs text-secondary font-label uppercase tracking-widest mt-1">
            {membershipLevel}
          </p>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="space-y-2">
        <p className="font-label text-[10px] tracking-[0.2em] uppercase text-slate-500 px-4">
          Account
        </p>
        {menuItems.map((item) => (
          <a
            key={item.id}
            onClick={() => onNavigate?.(item.id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${
              activeTab === item.id
                ? 'bg-primary-container/10 text-primary-fixed-dim border border-primary/20'
                : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontVariationSettings:
                  activeTab === item.id ? "'FILL' 1" : "'FILL' 0",
              }}
            >
              {item.icon}
            </span>
            <span className="font-headline font-bold text-sm tracking-tight">
              {item.label}
            </span>
          </a>
        ))}
      </div>

      {/* Support Navigation */}
      <div className="space-y-2">
        <p className="font-label text-[10px] tracking-[0.2em] uppercase text-slate-500 px-4">
          Support
        </p>
        {supportItems.map((item) => (
          <a
            key={item.id}
            onClick={() => onNavigate?.(item.id)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span className="font-headline font-bold text-sm tracking-tight">
              {item.label}
            </span>
          </a>
        ))}
      </div>
    </aside>
  );
};