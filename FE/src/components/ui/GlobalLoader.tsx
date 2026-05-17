import { createPortal } from 'react-dom'

import { useTheme } from '@/context/ThemeContext'
import LogoSVG from '@/assets/logo.svg'

export function Logo() {
  return (
    <img src={LogoSVG} alt="Logo TicketRush" className="display-inline flex items-center gap-2 h-15 w-auto" />
  )
}

export function GlobalLoader() {
  const { theme } = useTheme()
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
        <div className="flex h-28 w-28 items-center justify-center rounded-full border border-white/10 bg-white/5 sm:h-40 sm:w-40">
          <div
            className="h-12 w-12 animate-spin rounded-full border-4 border-solid border-white/20 border-t-white sm:h-16 sm:w-16"
            aria-label={`Loading indicator for ${theme} theme`}
          />
        </div>
        <div className="hidden md:block">
          <Logo />
        </div>
      </div>,
    document.body,
  )
}
