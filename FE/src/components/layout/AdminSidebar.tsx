import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, Building2, CalendarDays, IdCard, LayoutDashboard, LogOut, Settings, Ticket, Users } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAuth } from '../../context/AuthContext'

const eventStaffLinks = [
  { label: 'Tổng quan', href: '/admin', icon: LayoutDashboard, exact: true },
  { label: 'Sự kiện', href: '/admin/events', icon: CalendarDays, exact: false },
  { label: 'Bố cục địa điểm', href: '/admin/venues', icon: Building2, exact: false },
  { label: 'Vé và doanh thu', href: '/admin/tickets', icon: Ticket, exact: false },
]

const systemAdminLinks = [
  { label: 'Báo cáo hệ thống', href: '/admin', icon: LayoutDashboard, exact: true },
  { label: 'Thống kê', href: '/admin/analytics', icon: BarChart3, exact: false },
  { label: 'Người dùng', href: '/admin/users', icon: Users, exact: false },
  { label: 'Nhân viên sự kiện', href: '/admin/staff', icon: IdCard, exact: false },
  { label: 'Cài đặt', href: '/admin/settings', icon: Settings, exact: false },
]

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const adminLinks = user?.user_type === 'SYSTEM_ADMIN' ? systemAdminLinks : eventStaffLinks

  const handleLogout = () => {
    logout()
    onNavigate?.()
    navigate('/login')
  }

  const isActiveLink = (href: string, exact: boolean) => {
    if (exact) return location.pathname === href
    return location.pathname === href || location.pathname.startsWith(href + '/')
  }

  return (
    <aside className="w-64 admin-bg-card admin-text-body border-r admin-border flex flex-col h-full shadow-2xl">
      <div className="border-b admin-border p-4">
        <span className="flex items-start text-lg font-display font-bold">
          <p className="text-lg">TICKETHUB</p>
          <span className="relative top-0.9 ml-1 rounded bg-brand-red/20 px-1 py-0.5 text-xs text-brand-red">
            {user?.user_type === 'SYSTEM_ADMIN' ? 'Quản trị hệ thống' : 'Nhân viên sự kiện'}
          </span>
        </span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {adminLinks.map(({ label, href, icon: Icon, exact }) => (
          <NavLink
            key={href}
            to={href}
            className={() =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                isActiveLink(href, exact)
                  ? 'bg-[var(--admin-bg-opt)] text-brand-red border border-secondary/20'
                  : 'admin-text-body hover:bg-[var(--admin-btn-ghost-bg-hover)] hover:text-[var(--admin-text-header)]',
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t admin-border p-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium admin-text-muted transition-colors hover:bg-[var(--admin-btn-ghost-bg-hover)] hover:text-red-400"
        >
          <LogOut className="h-5 w-5" />
          Đăng xuất
        </button>
      </div>
    </aside>
  )
}
