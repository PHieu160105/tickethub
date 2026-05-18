import LottieImport from 'lottie-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '@/context/ThemeContext'
import LogoSVG from '@/assets/logo.svg'

const Lottie = (LottieImport as any).default || LottieImport

export function Logo() {
  return (
    <img src={LogoSVG} alt="TicketRush Logo" className="display-inline flex items-center gap-2 h-15 w-auto" />
  )
}

export function GlobalLoader() {
  const { theme } = useTheme()
  const [animation, setAnimation] = useState(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const animationFile = theme === 'light' ? '/loadinglight.json' : '/loadingdark.json'
    fetch(animationFile)
      .then((res) => res.json())
      .then(setAnimation)
      .catch(console.error)
  }, [theme])

  if (!animation || !mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
        <div className="h-28 w-28 sm:h-40 sm:w-40">
          <Lottie animationData={animation} />
        </div>
        <div className="hidden md:block">
          <Logo />
        </div>
      </div>,
    document.body,
  )
}