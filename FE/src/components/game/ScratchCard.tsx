import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/Button'
import type { GamePlayResponse } from '@/types'

interface ScratchCardProps {
  onPlay: () => Promise<GamePlayResponse | null> | void
  playsLeft: number
}

export function ScratchCard({ onPlay, playsLeft }: ScratchCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [result, setResult] = useState<GamePlayResponse | null>(null)
  const [readyToScratch, setReadyToScratch] = useState(false)
  const [loading, setLoading] = useState(false)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx || !readyToScratch) return
    const radius = 16
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.beginPath()
    ctx.moveTo(radius, 0)
    ctx.lineTo(canvas.width - radius, 0)
    ctx.quadraticCurveTo(canvas.width, 0, canvas.width, radius)
    ctx.lineTo(canvas.width, canvas.height - radius)
    ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - radius, canvas.height)
    ctx.lineTo(radius, canvas.height)
    ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - radius)
    ctx.lineTo(0, radius)
    ctx.quadraticCurveTo(0, 0, radius, 0)
    ctx.closePath()
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    gradient.addColorStop(0, '#64748b')
    gradient.addColorStop(1, '#334155')
    ctx.fillStyle = gradient
    ctx.fill()
    ctx.fillStyle = '#e2e8f0'
    ctx.font = 'bold 18px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Cào để nhận thưởng', canvas.width / 2, canvas.height / 2)
  }, [readyToScratch, result])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !readyToScratch) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let pressed = false
    const scratch = (x: number, y: number) => {
      const radius = 18
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
      gradient.addColorStop(0, 'rgba(0,0,0,1)')
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
    const onDown = () => {
      pressed = true
    }
    const onUp = () => {
      pressed = false
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      let transparentCount = 0
      for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] < 20) transparentCount += 1
      }
      const ratio = transparentCount / (canvas.width * canvas.height)
      if (ratio >= 0.35) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        setRevealed(true)
      }
    }
    const onMove = (e: MouseEvent) => {
      if (!pressed) return
      const rect = canvas.getBoundingClientRect()
      scratch(e.clientX - rect.left, e.clientY - rect.top)
    }
    canvas.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    canvas.addEventListener('mousemove', onMove)
    return () => {
      canvas.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      canvas.removeEventListener('mousemove', onMove)
    }
  }, [readyToScratch])

  const play = async () => {
    if (playsLeft <= 0) return
    setLoading(true)
    const response = await onPlay()
    setLoading(false)
    if (response) {
      setResult(response)
      setReadyToScratch(true)
      setRevealed(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
        <p className="text-xs text-slate-400 mb-2">Cào hết thẻ để xem kết quả.</p>
        <div className="relative w-[320px] max-w-full">
          <div className="absolute inset-0 flex items-center justify-center text-center px-4">
            <p className="text-sm text-white font-semibold">
              {result && revealed ? `${result.tier_name}${result.discount_code ? ` - ${result.discount_code}` : ''}` : 'Bấm chơi để bắt đầu cào'}
            </p>
          </div>
          <canvas ref={canvasRef} width={320} height={150} className="relative rounded-lg border border-white/20" />
        </div>
      </div>
      <Button onClick={() => void play()} isLoading={loading} disabled={loading || playsLeft <= 0}>
        Chơi Scratch Card
      </Button>
    </div>
  )
}
