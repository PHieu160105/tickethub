import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Bell, Menu, Search, X } from 'lucide-react'

import { AdminSidebar } from './AdminSidebar'
import { Container } from './Container'
import { Button } from '@/components/ui/Button'
import { SearchAutocompleteInput } from '@/components/ui/SearchAutocompleteInput'

interface AdminLayoutProps {
  title?: string
  actions?: React.ReactNode
}

export function AdminLayout({ title, actions }: AdminLayoutProps) {
  const [searchValue, setSearchValue] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  return (
    <div className="flex h-screen admin-bg-page admin-text-body">
      <div className="hidden md:block">
        <AdminSidebar />
      </div>
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <div className="relative h-full w-72">
            <AdminSidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="p-4 border-b admin-border flex items-center justify-between px-4 md:px-6] backdrop-blur-sm gap-3">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-2 rounded hover:bg-white/10" onClick={() => setDrawerOpen((v) => !v)} aria-label="Toggle admin menu">
              {drawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            {title && <h1 className="text-lg font-semibold">{title}</h1>}
          </div>
          <div className="relative hidden lg:block w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
            <SearchAutocompleteInput value={searchValue} onChange={setSearchValue} placeholder="Tìm kiếm..." scope="global" className="pl-10" />
          </div>

          <div className="flex items-center gap-3">
            {actions}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand-red" />
            </Button>
          </div>
        </header>

        <div className="relative flex-1 overflow-y-auto p-4 md:p-6 admin-bg-page">
          <Container size="xl" className="relative z-10 animate-in fade-in duration-300">
            <Outlet />
          </Container>
        </div>
      </main>
    </div>
  )
}
