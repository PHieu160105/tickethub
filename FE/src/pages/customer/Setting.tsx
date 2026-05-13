import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CustomerSidebar } from '@/components/layout/CustomerSidebar'
import { useTheme } from '@/context/ThemeContext'
import { Menu, Moon, Sun, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

export default function CustomerSettings() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  const onSidebarNavigate = (tab: string) => {
    setDrawerOpen(false)
    if (tab === 'tickets') return navigate('/tickets')
    if (tab === 'profile') return navigate('/profile')
    if (tab === 'favourites') return navigate('/favourites') 
    if (tab === "settings") return navigate('/settings') 
    if (tab === 'help') return navigate('/help')  
    if (tab === 'logout') {
      logout()
      return navigate('/')
    }
  }

  return (
    <div className="app-theme-page pt-[35px] h-auto flex">
        <div className="hidden lg:block">
          <CustomerSidebar
            activeTab="settings"
            userName={user?.full_name ?? 'Customer'}
            membershipLevel="Stellar Member"
            onNavigate={onSidebarNavigate}
          />
        </div>
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
            <CustomerSidebar
              activeTab="settings"
              userName={user?.full_name ?? 'Customer'}
              membershipLevel="Stellar Member"
              onNavigate={onSidebarNavigate}
              className="relative"
            />
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-12 max-w-5xl mx-auto">
          <button className="lg:hidden mb-4 p-2 rounded bg-surface-container" onClick={() => setDrawerOpen((v) => !v)}>
            {drawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <header className="mb-6">
            <h1 className="text-3xl sm:text-5xl font-black text-on-background font-headline tracking-tighter">Cài đặt</h1>
            <p className="text-on-surface-variant mt-2 max-w-lg">Chế độ tự chỉnh sửa theo ý bạn!</p>
          </header>

          {/* Appearance Card */}
          <div className="rounded-2xl border border-[var(--customer-bg-opp)] customer-bg-surface p-6 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-on-background font-headline">Hiển thị</h2>
              <p className="text-slate-500 mt-1">Chỉnh sửa TicketRush hợp mắt bạn nhé!</p>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider">
                Chế độ
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={() => setTheme('dark')}
                      className={`relative p-6 rounded-xl border transition-all duration-200 ${
                        theme === 'dark'
                          ? 'bg-gradient-to-br from-red-500/20 to-red-500/5 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                          : 'bg-surface-variant border-gray-500 hover:border-primary'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <Moon className={`w-6 h-6 ${theme === 'dark' ? 'text-red-400' : 'text-slate-500'}`} />
                        <span className={`font-bold text-lg ${theme === 'dark' ? 'text-on-background' : 'text-on-surface-variant'}`}>
                          Dark Mode
                        </span>
                      </div>
                      <p className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-on-surface-variant'}`}>
                        Chế độ ban đêm, bảo vệ mắt tốt
                      </p>
                      {theme === 'dark' && (
                        <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>

                    <button
                      onClick={() => setTheme('light')}
                      className={`relative p-6 rounded-xl border transition-all duration-200 ${
                        theme === 'light'
                          ? 'bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-amber-500/30 shadow-[0_0_20px_rgba(251,191,36,0.15)]'
                          : 'bg-surface-variant border-gray-500 hover:border-secondary'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <Sun className={`w-6 h-6 ${theme === 'light' ? 'text-amber-400' : 'text-slate-500'}`} />
                        <span className={`font-bold text-lg ${theme === 'light' ? 'text-on-background' : 'text-on-surface-variant'}`}>
                          Light Mode
                        </span>
                      </div>
                      <p className={`text-sm ${theme === 'light' ? 'text-slate-300' : 'text-on-surface-variant'}`}>
                        Chế độ ban ngày, độ sáng mặc đinhj
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

                <div className="rounded-lg bg-surface-variant border border-gray-500 p-4">
                  <p className="text-sm text-on-surface-variant">
                    Nền đang chọn: <span className="font-bold text-on-background">{theme === 'dark' ? 'Dark' : 'Light'}</span>
                  </p>
                </div>
          </div>
        </main>
      </div>
  )
}
