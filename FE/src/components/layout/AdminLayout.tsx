import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, X } from 'lucide-react'

import { Container } from './Container'
import { AdminSidebar } from './AdminSidebar'

interface AdminLayoutProps {
  title?: string
  actions?: React.ReactNode
}

export function AdminLayout({ title, actions }: AdminLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  return (
    <div className="app-theme-page flex h-screen admin-text-body">
      <div className="hidden md:block">
        <AdminSidebar />
      </div>
      {drawerOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <button className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <div className="relative h-full w-64">
            <AdminSidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <main className="flex-1 flex min-h-0 flex-col overflow-visible">
        <header className="relative z-[70] flex items-center justify-between gap-3 border-b admin-border p-4 backdrop-blur-sm md:px-6">
          <div className="flex items-center gap-3">
            <button className="rounded p-2 hover:bg-white/10 md:hidden" onClick={() => setDrawerOpen((value) => !value)} aria-label="Mo hoac dong menu quan tri">
              {drawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            {title && <h1 className="text-lg font-semibold">{title}</h1>}
          </div>
          <div className="flex items-center gap-3">{actions}</div>
        </header>

        <div className="relative z-10 flex-1 overflow-y-auto p-4 md:p-6">
          <Container size="xl" className="relative z-10 animate-in fade-in duration-300">
            <Outlet />
          </Container>
        </div>
      </main>
    </div>
  )
}
