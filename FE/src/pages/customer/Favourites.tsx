import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Menu, X } from 'lucide-react'

import { CustomerSidebar } from '@/components/layout/CustomerSidebar'
import { useAuth } from '@/context/AuthContext'
import { listFavourites, removeFavourite, type FavouriteItem } from '@/lib/favourites'

export default function Favourites() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [favourites, setFavourites] = useState<FavouriteItem[]>(() => listFavourites(user?.id))
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setFavourites(listFavourites(user?.id))
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [user?.id])

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
    if (tab === 'settings') return navigate('/settings')
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
            activeTab="favourites"
            userName={user?.full_name ?? 'Khách hàng'}
            membershipLevel="Thành viên TicketRush"
            onNavigate={onSidebarNavigate}
          />
        </div>
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
            <CustomerSidebar
              activeTab="favourites"
              userName={user?.full_name ?? 'Khách hàng'}
              membershipLevel="Thành viên TicketRush"
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
            <h1 className="text-3xl sm:text-5xl font-black text-on-background font-headline tracking-tighter">Yêu thích</h1>
            <p className="text-on-surface-variant mt-2 max-w-lg">Những sự kiện bạn yêu thích!</p>
          </header>

          {favourites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant">
              <Heart className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-bold">Chưa có sự kiện yêu thích.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {favourites.map((event) => (
                <div key={event.id} className="glass-panel rounded-xl overflow-hidden group hover:border-primary/30 transition-all duration-300">
                  <div className="relative h-48 overflow-hidden">
                    <img src={event.cover_image_url} alt={event.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                    <button
                      onClick={() => setFavourites(removeFavourite(user?.id, event.id))}
                      className="absolute top-3 right-3 p-2 rounded-full bg-background/50 backdrop-blur-sm hover:bg-primary/20 transition-colors"
                    >
                      <Heart className="w-5 h-5 text-primary fill-primary" />
                    </button>
                    <span className="absolute bottom-3 left-3 px-3 py-1 bg-primary/80 text-on-primary text-xs font-bold uppercase tracking-widest rounded-full">{event.category}</span>
                  </div>

                  <div className="p-5 space-y-3">
                    <h3 className="text-lg font-black text-on-background font-headline leading-tight line-clamp-2">{event.title}</h3>
                    <p className="text-on-surface-variant text-sm">{event.venue}</p>
                    <button
                      onClick={() => navigate(`/event/${event.slug}`)}
                      className="w-full mt-4 bg-primary-container text-on-primary-container py-3 rounded-xl font-bold text-sm uppercase tracking-widest hover:shadow-[0_0_15px_rgba(252,83,109,0.4)] transition-all active:scale-95"
                    >
                      Xem sự kiện
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
  )
}
