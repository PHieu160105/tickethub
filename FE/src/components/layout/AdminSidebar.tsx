import { cn } from '@/lib/utils';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Users, BarChart3, Settings, LogOut, Ticket } from 'lucide-react';

const adminLinks = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Sự kiện', href: '/admin/events', icon: CalendarDays },
  { label: 'Vé & Doanh thu', href: '/admin/tickets', icon: Ticket },
  { label: 'Thống kê', href: '/admin/analytics', icon: BarChart3 },
  { label: 'Người dùng', href: '/admin/users', icon: Users },
  { label: 'Cài đặt', href: '/admin/settings', icon: Settings },
];

export function AdminSidebar() {
  return (
    <aside className="w-64 bg-space-800 border-r border-white/10 flex flex-col h-full">
      <div className="p-4 border-b border-white/10">
        <span className="text-lg font-display font-bold">
          <span className="text-brand-red">Ticket</span>
          <span className="text-brand-yellow">Rush</span>
          <span className="text-xs ml-2 px-2 py-0.5 rounded bg-brand-red/20 text-brand-red">Admin</span>
        </span>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {adminLinks.map(({ label, href, icon: Icon }) => (
          <NavLink
            key={href}
            to={href}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-brand-red/10 text-brand-red border border-brand-red/20'
                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-red-400 transition-colors">
          <LogOut className="h-5 w-5" />
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}