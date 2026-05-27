import LottieImport from 'lottie-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '@/context/ThemeContext'
import LogoSVG from '@/assets/logo.svg'

type KieuLottieCoTheBiBaoBoi = typeof LottieImport & {
  default?: typeof LottieImport
}

const Lottie = (LottieImport as KieuLottieCoTheBiBaoBoi).default ?? LottieImport

export function Logo() {
  return (
    <img src={LogoSVG} alt="Logo TicketRush" className="display-inline flex items-center gap-2 h-15 w-auto" />
  )
}

export function GlobalLoader() {
  const { theme } = useTheme()
  const [animation, setAnimation] = useState<object | null>(null)

  useEffect(() => {
    const animationFile = theme === 'light' ? '/loadinglight.json' : '/loadingdark.json'
    fetch(animationFile)
      .then((res) => res.json())
      .then(setAnimation)
      .catch(console.error)
  }, [theme])

  if (!animation || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="h-28 w-28 sm:h-40 sm:w-40">
        <Lottie animationData={animation} />
      </div>
    </div>,
    document.body,
  )
}
