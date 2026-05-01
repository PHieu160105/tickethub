import LottieImport from 'lottie-react'
import { useEffect, useState } from 'react'
import LogoSVG from '@/assets/logo.svg'

const Lottie = (LottieImport as any).default || LottieImport

export function Logo() {
  return (
    <img src={LogoSVG} alt="TicketRush Logo" className="display-inline flex items-center gap-2 h-15 w-auto" />
  )
}

export function GlobalLoader() {
  const [animation, setAnimation] = useState(null)

  useEffect(() => {
    fetch('/loading.json')
      .then((res) => res.json())
      .then(setAnimation)
      .catch(console.error)
  }, [])

  if (!animation) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950 gap">
      <div className="w-40 h-40">
        <Lottie animationData={animation} />
          
      </div>
    <Logo/>
    </div>
    
  )
}