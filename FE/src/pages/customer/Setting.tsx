import { useNavigate } from 'react-router-dom'
import { CustomerSidebar } from '@/components/layout/CustomerSidebar'
import { Navbar } from '@/components/layout/Navbar'
import { useTheme } from '@/context/ThemeContext'
import { Moon, Sun } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

export default function CustomerSettings() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { theme, setTheme } = useTheme()

  const onSidebarNavigate = (tab: string) => {
    if (tab === 'tickets') return navigate('/tickets')
    if (tab === 'profile') return navigate('/profile')
    if (tab === 'favourites') return navigate('/favourites') 
    if (tab === 'payments') return navigate('/payments')  
    if (tab === "settings") return navigate('/settings') 
    if (tab === 'help') return navigate('/help')  
    if (tab === 'logout') {
      logout()
      return navigate('/')
    }
  }

  return (
    <>
      <Navbar />
      <div className="pt-[80px] min-h-screen flex">
        <CustomerSidebar
          activeTab="settings"
          userName="Customer"
          membershipLevel="Stellar Member"
          onNavigate={onSidebarNavigate}
        />

        <main className="flex-1 p-8 lg:p-12 max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-black text-on-background font-headline tracking-tight">Settings</h1>
            <p className="text-slate-500 mt-2">Manage your account settings and preferences.</p>
          </div>

          {/* Appearance Card */}
          <div className="rounded-2xl border border-white/10 bg-surface p-6 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-on-background font-headline">Appearance</h2>
              <p className="text-slate-500 mt-1">Customize how TicketRush looks for you.</p>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider">
                Theme Preference
              </label>

              <div className="grid grid-cols-2 gap-4">
                {/* Dark Mode Option */}
                <button
                  onClick={() => setTheme('dark')}
                  className={`relative p-6 rounded-xl border transition-all duration-200 ${
                    theme === 'dark'
                      ? 'bg-gradient-to-br from-red-500/20 to-red-500/5 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                      : 'bg-surface-variant border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Moon className={`w-6 h-6 ${theme === 'dark' ? 'text-red-400' : 'text-slate-500'}`} />
                    <span className={`font-bold text-lg ${theme === 'dark' ? 'text-on-background' : 'text-on-surface-variant'}`}>
                      Dark Mode
                    </span>
                  </div>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-on-surface-variant'}`}>
                    Easy on the eyes, perfect for night viewing.
                  </p>
                  {theme === 'dark' && (
                    <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>

                {/* Light Mode Option */}
                <button
                  onClick={() => setTheme('light')}
                  className={`relative p-6 rounded-xl border transition-all duration-200 ${
                    theme === 'light'
                      ? 'bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-amber-500/30 shadow-[0_0_20px_rgba(251,191,36,0.15)]'
                      : 'bg-surface-variant border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Sun className={`w-6 h-6 ${theme === 'light' ? 'text-amber-400' : 'text-slate-500'}`} />
                    <span className={`font-bold text-lg ${theme === 'light' ? 'text-on-background' : 'text-on-surface-variant'}`}>
                      Light Mode
                    </span>
                  </div>
                  <p className={`text-sm ${theme === 'light' ? 'text-slate-300' : 'text-on-surface-variant'}`}>
                    Clean and bright, ideal for daytime use.
                  </p>
                  {theme === 'light' && (
                    <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Current Theme Display */}
            <div className="rounded-lg bg-surface-variant border border-white/10 p-4">
              <p className="text-sm text-on-surface-variant">
                Current theme: <span className="font-bold text-on-background">{theme === 'dark' ? 'Dark' : 'Light'}</span>
              </p>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}