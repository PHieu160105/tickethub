import React, { useState } from 'react';
import { CustomerSidebar } from '@/components/layout/CustomerSidebar';
import { Navbar } from '@/components/layout/Navbar'; // Đảm bảo đường dẫn đúng
import { 
  User, Mail, Phone, MapPin, Camera, CreditCard, 
  PartyPopper, Heart, Star, Globe, Lock, ShieldCheck 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CustomerProfile: React.FC = () => {
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState({
    fullName: 'Marcus Voyager',
    email: 'marcus.v@cosmic.com',
    phone: '+1 (555) 234-5678',
    location: 'San Francisco, CA',
    language: 'English (US)',
    currency: 'USD ($)',
  });

  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = () => {
    setIsUpdating(true);
    setTimeout(() => setIsUpdating(false), 1000);
  };

  return (
    <>
      <Navbar />
      <div className="pt-[80px] min-h-screen bg-[#0B0F19] flex">
        {/* Sidebar */}
        <CustomerSidebar 
          activeTab="profile" 
          userName="Marcus Voyager" 
          membershipLevel="Elite Voyager Member" 
          onNavigate={(tab) => navigate(`/customer/${tab}`)}
        />

        {/* Main Content */}
        <main className="flex-1 p-8 lg:p-12 max-w-5xl mx-auto space-y-10">
          
          {/* Header Profile */}
          <div className="flex items-center gap-8 mb-10">
            <div className="relative group">
              <div className="w-32 h-32 rounded-3xl bg-slate-800 border-4 border-slate-700 overflow-hidden flex items-center justify-center shadow-xl">
                 <User className="w-16 h-16 text-slate-500" />
              </div>
              <button className="absolute -bottom-3 -right-3 bg-red-500 p-3 rounded-full shadow-lg hover:bg-red-400 transition-colors">
                <Camera className="w-5 h-5 text-white" />
              </button>
            </div>
            <div>
              <h1 className="text-4xl font-black text-white font-headline tracking-tight">MARCUS VOYAGER</h1>
              <div className="flex items-center gap-2 mt-2">
                <Star className="w-5 h-5 text-amber-400 fill-current" />
                <span className="text-amber-400 font-bold uppercase tracking-widest text-sm">Elite Voyager Member</span>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900/60 border border-white/5 p-6 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Spent</p>
                <p className="text-3xl font-black text-white">$4,280</p>
              </div>
              <div className="p-3 bg-white/5 rounded-xl"><CreditCard className="w-6 h-6 text-slate-400" /></div>
            </div>
            <div className="bg-slate-900/60 border border-white/5 p-6 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Events Attended</p>
                <p className="text-3xl font-black text-white">24</p>
              </div>
              <div className="p-3 bg-white/5 rounded-xl"><PartyPopper className="w-6 h-6 text-slate-400" /></div>
            </div>
            <div className="bg-slate-900/60 border border-white/5 p-6 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Favorite Artists</p>
                <p className="text-3xl font-black text-white">12</p>
              </div>
              <div className="p-3 bg-white/5 rounded-xl"><Heart className="w-6 h-6 text-slate-400" /></div>
            </div>
          </div>

          {/* Profile Form & Settings Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left: Personal Info */}
            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                <span className="w-1 h-6 bg-red-500 rounded-full"></span> Personal Information
              </h2>
              
              <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <input 
                        type="text" 
                        value={profileData.fullName}
                        onChange={(e) => setProfileData({...profileData, fullName: e.target.value})}
                        className="w-full bg-slate-800/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <input 
                        type="email" 
                        value={profileData.email}
                        onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                        className="w-full bg-slate-800/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <input 
                        type="tel" 
                        value={profileData.phone}
                        onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                        className="w-full bg-slate-800/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Location</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <input 
                        type="text" 
                        value={profileData.location}
                        onChange={(e) => setProfileData({...profileData, location: e.target.value})}
                        className="w-full bg-slate-800/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all" 
                      />
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={handleUpdate}
                  disabled={isUpdating}
                  className="mt-4 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-red-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdating ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </div>

            {/* Right: Preferences & Security */}
            <div className="space-y-8">
              {/* Preferences */}
              <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-6 space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="w-1 h-5 bg-amber-400 rounded-full"></span> Preferences
                </h3>
                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-400 text-sm">Language</span>
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <Globe className="w-4 h-4 text-slate-500" />
                    <span>{profileData.language}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 border-t border-white/5">
                  <span className="text-slate-400 text-sm">Currency</span>
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <CreditCard className="w-4 h-4 text-slate-500" />
                    <span>{profileData.currency}</span>
                  </div>
                </div>
              </div>

              {/* Security */}
              <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-6 space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="w-1 h-5 bg-blue-500 rounded-full"></span> Security
                </h3>
                <button className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors group">
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-slate-500 group-hover:text-blue-400" />
                    <span className="text-sm font-bold text-slate-300 group-hover:text-white">Change Password</span>
                  </div>
                </button>
                <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors group">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-slate-500 group-hover:text-blue-400" />
                    <span className="text-sm font-bold text-slate-300 group-hover:text-white">Two-Factor Auth</span>
                  </div>
                  <div className="w-10 h-5 bg-slate-700 rounded-full relative cursor-pointer">
                    <div className="absolute left-1 top-1 w-3 h-3 bg-slate-400 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default CustomerProfile;