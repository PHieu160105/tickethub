import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Search, Menu, X, User, Ticket } from 'lucide-react'
import { NavLink, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import LogoSVG from '@/assets/logo.svg'

const navLinks = [
  { label: 'Sự kiện', href: '/search' },
  { label: 'Hồ sơ', href: '/profile' },
  { label: 'Vé của tôi', href: '/tickets' },
]

export function Logo() {
  return (
    <Link to="/" aria-label="TicketRush Home" className="flex items-center gap-2">
      <img src={LogoSVG} alt="TicketRush Logo" className="h-8 w-auto" />
      <span className="text-lg font-black uppercase tracking-[0.3em] text-white">TicketRush</span>
    </Link>
  )
}

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        isScrolled
          ? 'bg-slate-950/90 backdrop-blur-xl border-b border-white/10 shadow-[0_0_15px_rgba(233,69,96,0.2)]'
          : 'bg-slate-950/70 backdrop-blur-md border-b border-white/5'
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Logo />

        <div className="hidden md:flex flex-1 items-center justify-between gap-6">
          <nav className="flex items-center gap-2">
            {navLinks.map((link) => (
              <NavLink
                key={link.href}
                to={link.href}
                className={({ isActive }) =>
                  cn(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Tìm kiếm sự kiện..." className="pl-10 h-10" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <>
              <Button variant="ghost" size="icon" className="hidden sm:inline-flex">
                <Ticket className="h-5 w-5" />
              </Button>
              <Button variant="outline" size="sm" className="gap-2 hidden sm:inline-flex">
                <User className="h-4 w-4" />
                Tài khoản
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                Đăng nhập
              </Button>
              <Button variant="primary" size="sm">
                Đăng ký
              </Button>
            </>
          )}

          <button
            className="md:hidden p-2 rounded-lg hover:bg-white/10"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-slate-950/95 backdrop-blur-xl border-t border-white/10">
          <div className="space-y-3 px-4 py-4">
            {navLinks.map((link) => (
              <NavLink
                key={link.href}
                to={link.href}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'block rounded-lg px-4 py-3 text-base font-medium transition-colors',
                    isActive ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5'
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
            <div className="pt-3 border-t border-white/10">
              <Input placeholder="Tìm kiếm..." className="w-full" />
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

