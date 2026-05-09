import LottieImport from 'lottie-react'
import { useEffect, useState } from 'react'
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

  useEffect(() => {
    const animationFile = theme === 'light' ? '/loadinglight.json' : '/loadingdark.json'
    fetch(animationFile)
      .then((res) => res.json())
      .then(setAnimation)
      .catch(console.error)
  }, [theme])

  if (!animation) return null

  return (
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center ${theme === 'light' ? 'bg-white' : 'bg-slate-950'}`}>
      <div className="w-40 h-40">
        <Lottie animationData={animation} />
      </div>
      <Logo/>
    </div>
  )
}
