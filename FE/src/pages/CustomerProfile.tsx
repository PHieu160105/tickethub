import React, { useState } from 'react';
import { StatCard } from '../components/ui/StatCard';
import { CustomerSidebar } from '../components/layout/CustomerSidebar';

const CustomerProfile: React.FC = () => {
  const [profileData, setProfileData] = useState({
    fullName: 'Marcus Voyager',
    email: 'marcus.v@cosmic.com',
    phone: '+1 (555) 234-5678',
    location: 'San Francisco, CA',
    language: 'English (US)',
    currency: 'USD ($)',
    twoFactorEnabled: false,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] to-[#1a1f3a] text-[#dee0ff] font-body selection:bg-primary-container selection:text-on-primary-container">
      {/* Top Navigation Bar */}
      <header className="bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50 border-b border-white/10 shadow-[0_0_15px_rgba(233,69,96,0.2)]">
        <div className="flex justify-between items-center w-full px-6 py-4 max-w-screen-2xl mx-auto">
          <div className="text-2xl font-black italic tracking-tighter text-red-500 uppercase font-headline">
            TicketRush
          </div>
          <nav className="hidden md:flex items-center gap-8 font-headline font-bold tracking-tight">
            <a className="text-slate-300 hover:text-white transition-colors" href="#">Events</a>
            <a className="text-slate-300 hover:text-white transition-colors" href="#">Venues</a>
            <a className="text-slate-300 hover:text-white transition-colors" href="#">Deals</a>
            <a className="text-red-500 border-b-2 border-red-500 pb-1" href="#">My Tickets</a>
          </nav>
          <div className="flex items-center gap-4">
            <div className="relative hidden lg:block">
              <input className="bg-surface-container-highest/50 border-none rounded-full px-4 py-1.5 text-sm focus:ring-1 focus-ring-primary w-64 text-on-surface-variant" placeholder="Search events..." type="text"/>
            </div>
            <button className="text-slate-300 hover:bg-white/5 p-2 rounded-full transition-all duration-300 active:scale-90">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="text-slate-300 hover:bg-white/5 p-2 rounded-full transition-all duration-300 active:scale-90">
              <span className="material-symbols-outlined">shopping_cart</span>
            </button>
            <div className="w-10 h-10 rounded-full border-2 border-primary overflow-hidden">
              <img alt="User profile" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBBpVFotIOM_CAG3j95-kR8iwtagTj5T-IL7EeB2SdQbm49bD1SSMFHNOO1Z_C-aL5QDMrjgGRuYRz02i9sdycdLW0MesoYUUhg_uv7e2b4KZYWM78g-vboMzD7QK_uQRu6ulvka3SaD-7uLhws8GScHPW2pqnCPC6fP20hawTpqeOKd3tDfPsATini3T3iZ-5EB27IjnNbW2DZM9399QdWVA_kLgQMOQq_jAFbYJY5B2W-CByjn9wKUXIGtzU4hsKV8zOYtmRriPs" className="w-full h-full object-cover"/>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto flex flex-col md:flex-row min-h-[calc(100vh-80px)]">
        <CustomerSidebar activeTab="profile" userName="Marcus Voyager" membershipLevel="Elite Voyager Member" />

        <main className="flex-1 p-6 md:p-10 space-y-12 overflow-x-hidden">
          <section className="relative">
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/10 blur-[100px] rounded-full"></div>
            <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
              <div className="relative group">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-surface-container-highest overflow-hidden shadow-2xl">
                  <img alt="User avatar" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCmdg28w6ZpSQFRFip_k58b_uYURDtOmdcNmy5seFpybIN8uXii-vgN2cl4nMhx99bwMv4to2C96o6_p5dpKJDXiCgAd3Z0j4ufbOZYXOI5TU5MDdgLP9R-uepkHv4z-hdSZjnbDUoqf2SH1SliISSuvLsFY7frad0AuVyPm6U1JVR1k7r5w0DtHcX84vEWN6ZPy7a2Zz2qWZg0yQ9G-uUNdo9l6-RHjSbr1SsKH2jnxWnK0mCQJ-WxnOw_G2K__vG4GzQddJOodZ4" className="w-full h-full object-cover"/>
                </div>
                <button className="absolute bottom-2 right-2 bg-primary text-on-primary-container p-2 rounded-full shadow-lg hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-sm">edit</span>
                </button>
              </div>
              <div className="text-center md:text-left">
                <h1 className="text-4xl md:text-5xl font-headline font-black tracking-tighter mb-2 text-white">MARCUS VOYAGER</h1>
                <p className="font-body text-secondary flex items-center justify-center md:justify-start gap-2">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
                  Elite Voyager Member since Dec 2022
                </p>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <StatCard title="Total Spent" value="$4,280" icon={<span className="material-symbols-outlined">payments</span>} />
            <StatCard title="Events Attended" value="24" icon={<span className="material-symbols-outlined">celebration</span>} />
            <StatCard title="Favorite Artists" value="12" icon={<span className="material-symbols-outlined">favorite</span>} />
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <section className="lg:col-span-8 glass-panel p-8 rounded-2xl space-y-8">
              <div>
                <h2 className="text-xl font-headline font-bold text-white mb-6 flex items-center gap-3">
                  <span className="w-1 h-6 bg-primary rounded-full"></span>Personal Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="font-label text-[10px] tracking-widest uppercase text-slate-500">Full Name</label>
                    <input className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface focus:ring-1 focus:ring-primary transition-all" type="text" value={profileData.fullName} onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}/>
                  </div>
                  <div className="space-y-2">
                    <label className="font-label text-[10px] tracking-widest uppercase text-slate-500">Email Address</label>
                    <input className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface focus:ring-1 focus:ring-primary transition-all" type="email" value={profileData.email} onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}/>
                  </div>
                  <div className="space-y-2">
                    <label className="font-label text-[10px] tracking-widest uppercase text-slate-500">Phone Number</label>
                    <input className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface focus:ring-1 focus:ring-primary transition-all" type="tel" value={profileData.phone} onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}/>
                  </div>
                  <div className="space-y-2">
                    <label className="font-label text-[10px] tracking-widest uppercase text-slate-500">Location</label>
                    <input className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface focus:ring-1 focus:ring-primary transition-all" type="text" value={profileData.location} onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}/>
                  </div>
                </div>
              </div>
              <div className="pt-6 border-t border-white/5">
                <button className="bg-primary text-on-primary-container px-8 py-3 rounded-xl font-headline font-bold uppercase tracking-wider text-sm shadow-[0_0_15px_rgba(233,69,96,0.4)] hover:brightness-110 active:scale-95 transition-all">Update Profile</button>
              </div>
            </section>

            <div className="lg:col-span-4 space-y-8">
              <section className="glass-panel p-8 rounded-2xl space-y-6">
                <h2 className="text-xl font-headline font-bold text-white flex items-center gap-3">
                  <span className="w-1 h-6 bg-secondary rounded-full"></span>Preferences
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-body text-slate-300">Language</span>
                    <select className="bg-surface-container-highest border-none rounded-lg text-xs font-headline font-bold py-1 pl-2 pr-8 text-on-surface focus:ring-0" value={profileData.language} onChange={(e) => setProfileData({ ...profileData, language: e.target.value })}>
                      <option>English (US)</option><option>French</option><option>Japanese</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-body text-slate-300">Currency</span>
                    <select className="bg-surface-container-highest border-none rounded-lg text-xs font-headline font-bold py-1 pl-2 pr-8 text-on-surface focus:ring-0" value={profileData.currency} onChange={(e) => setProfileData({ ...profileData, currency: e.target.value })}>
                      <option>USD ($)</option><option>EUR (€)</option><option>GBP (£)</option>
                    </select>
                  </div>
                </div>
              </section>

              <section className="glass-panel p-8 rounded-2xl space-y-6">
                <h2 className="text-xl font-headline font-bold text-white flex items-center gap-3">
                  <span className="w-1 h-6 bg-tertiary rounded-full"></span>Security
                </h2>
                <div className="space-y-4">
                  <button className="w-full flex items-center justify-between text-left p-3 rounded-xl hover:bg-white/5 transition-colors group">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-slate-500">lock</span>
                      <span className="text-sm font-body text-slate-300">Change Password</span>
                    </div>
                    <span className="material-symbols-outlined text-slate-600 group-hover:text-primary transition-colors">chevron_right</span>
                  </button>
                  <div className="flex items-center justify-between p-3 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-slate-500">verified_user</span>
                      <div className="flex flex-col">
                        <span className="text-sm font-body text-slate-300">Two-Factor Auth</span>
                        <span className="text-[10px] text-primary">Highly Recommended</span>
                      </div>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <div className="w-11 h-6 bg-surface-container-highest rounded-full border border-white/10"></div>
                      <div className={`absolute left-1 top-1 w-4 h-4 rounded-full transition-transform ${profileData.twoFactorEnabled ? 'bg-primary translate-x-5' : 'bg-slate-400'}`}></div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>

      <footer className="bg-slate-950 border-t border-white/5 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 px-6 max-w-screen-2xl mx-auto">
          <div className="col-span-2 md:col-span-1 space-y-4">
            <div className="text-xl font-black text-red-500 font-headline uppercase">TicketRush</div>
            <p className="text-slate-500 text-xs font-headline font-semibold tracking-wide">© 2024 TicketRush. Powered by the Cosmic Voyager.</p>
          </div>
          <div className="space-y-2">
            <p className="font-label text-[10px] tracking-widest uppercase text-slate-400 mb-4">Platform</p>
            <a className="block text-slate-500 hover:text-red-400 transition-colors font-label text-xs uppercase" href="#">Help Center</a>
            <a className="block text-slate-500 hover:text-red-400 transition-colors font-label text-xs uppercase" href="#">Sell Tickets</a>
            <a className="block text-slate-500 hover:text-red-400 transition-colors font-label text-xs uppercase" href="#">Artist Portal</a>
          </div>
          <div className="space-y-2">
            <p className="font-label text-[10px] tracking-widest uppercase text-slate-400 mb-4">Legal</p>
            <a className="block text-slate-500 hover:text-red-400 transition-colors font-label text-xs uppercase" href="#">Terms of Service</a>
            <a className="block text-slate-500 hover:text-red-400 transition-colors font-label text-xs uppercase" href="#">Privacy Policy</a>
            <a className="block text-slate-500 hover:text-red-400 transition-colors font-label text-xs uppercase" href="#">Affiliates</a>
          </div>
          <div className="space-y-4">
            <p className="font-label text-[10px] tracking-widest uppercase text-slate-400 mb-4">Newsletter</p>
            <div className="flex gap-2">
              <input className="bg-surface-container-low border-none rounded-lg text-xs w-full" placeholder="Email" type="email"/>
              <button className="bg-primary text-on-primary-container p-2 rounded-lg"><span className="material-symbols-outlined text-sm">send</span></button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default CustomerProfile;