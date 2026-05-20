import { cn } from '@/lib/utils'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Building2, LayoutDashboard, CalendarDays, Users, BarChart3, Settings, LogOut, Ticket, MessageCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import LogoSVG from '@/assets/logo.svg'

const adminLinks = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, exact: true },
  { label: 'Sự kiện', href: '/admin/events', icon: CalendarDays, exact: false },
  { label: 'Venue Studio', href: '/admin/venues', icon: Building2, exact: false },
  { label: 'Vé & Doanh thu', href: '/admin/tickets', icon: Ticket, exact: false },
  { label: 'Thống kê', href: '/admin/analytics', icon: BarChart3, exact: false },
  { label: 'Người dùng', href: '/admin/users', icon: Users, exact: false },
  { label: 'Help', href: '/admin/help', icon: MessageCircle, exact: false },
  { label: 'Cài đặt', href: '/admin/settings', icon: Settings, exact: false },
]

export function Logo() {
  return <img src={LogoSVG} alt="Logo TicketRush" className="display-inline flex items-center gap-2 h-10 w-auto" />
}

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

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
          <Logo />
          <span className="relative top-0.9 ml-1 px-1 py-0.5 rounded bg-brand-red/20 text-brand-red text-s">Admin</span>
        </span>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {adminLinks.map(({ label, href, icon: Icon, exact }) => (
          <NavLink
            key={href}
            to={href}
            className={() =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActiveLink(href, exact ?? false)
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

      <div className="p-4 border-t admin-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium admin-text-muted hover:bg-[var(--admin-btn-ghost-bg-hover)] hover:text-red-400 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Đăng xuất
        </button>
      </div>
    </aside>
  )
}
