import { AdminSidebar } from './AdminSidebar';
import { Container } from './Container';
import { Outlet } from 'react-router-dom';
import { Bell, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface AdminLayoutProps {
  title?: string;
  actions?: React.ReactNode;
}

export function AdminLayout({ title, actions }: AdminLayoutProps) {
  return (
    <div className="flex h-screen bg-space-900 text-white">
      <AdminSidebar />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="p-4 border-b border-white/10 flex items-center justify-between px-6 bg-space-800/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            {title && <h1 className="text-lg font-semibold">{title}</h1>}
            <div className="relative left-50 hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Tìm kiếm..." className="pl-10 h-9 w-128 bg-space-700/50 border-white/10" />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {actions}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand-red" />
            </Button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="relative flex-1 overflow-y-auto p-6 bg-space-900">
          <div
            className="pointer-events-none absolute inset-0 opacity-25"
            style={{
              backgroundImage: `
                radial-gradient(2px 2px at 20px 30px, #eee, rgba(0,0,0,0)),
                radial-gradient(2px 2px at 40px 70px, #fff, rgba(0,0,0,0)),
                radial-gradient(2px 2px at 50px 160px, #ddd, rgba(0,0,0,0)),
                radial-gradient(2px 2px at 90px 40px, #fff, rgba(0,0,0,0)),
                radial-gradient(2px 2px at 130px 80px, #fff, rgba(0,0,0,0)),
                radial-gradient(2px 2px at 160px 120px, #ddd, rgba(0,0,0,0))
              `,
              backgroundRepeat: 'repeat',
              backgroundSize: '200px 200px',
            }}
          />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(252,83,109,0.05)_0%,_transparent_70%)]" />

          <Container size="xl" className="relative z-10 animate-in fade-in duration-300">
            <Outlet />
          </Container>
        </div>
      </main>
    </div>
  );
}
