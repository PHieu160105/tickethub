import { useMemo, useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import type { GamePlayResponse, GameStatusResponse } from '@/types'

interface LuckyWheelProps {
  status: GameStatusResponse | null
  onPlay: () => Promise<GamePlayResponse | null> | void
  playsLeft: number
}

export function LuckyWheel({ status, onPlay, playsLeft }: LuckyWheelProps) {
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<GamePlayResponse | null>(null)

  const segments = useMemo(() => status?.remaining_prizes ?? [], [status?.remaining_prizes])

  const colors = [
    '#0ea5e9',
    '#22c55e',
    '#f59e0b',
    '#f97316',
    '#ec4899',
    '#6366f1',
    '#14b8a6',
    '#ef4444',
  ]
  const idleSpeed = 0.15 // độ/frame (có thể chỉnh)
  const rafRef = useRef<number | null>(null)

  const segmentAngles = useMemo(() => {
    const totalWeight = segments.reduce((a, s) => a + (s.weight ?? 0), 0)

    let current = 0

    return segments.map((seg) => {
      const ratio = totalWeight > 0 ? (seg.weight ?? 0) / totalWeight : 0
      const angle = ratio * 360

      const start = current
      const end = current + angle

      current = end

      return { start, end }
    })
  }, [segments])

  const handleSpin = async () => {
    if (spinning || playsLeft <= 0 || segments.length === 0) return

    // ❗ dừng idle animation
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    setSpinning(true)

    const response = await onPlay()
    if (!response) {
      setSpinning(false)
      return
    }

    const targetIndex = Math.max(0, Math.min(response.segment_index, segments.length - 1))

    const target = segmentAngles[targetIndex]
    const midAngle = (target.start + target.end) / 2
    const targetAngle = 360 - midAngle - 90

    const nextRotation = rotation + 360 * 6 + targetAngle

    setRotation(nextRotation)
    setResult(response)

    setTimeout(() => setSpinning(false), 4200)
  }

  useEffect(() => {
    if (spinning) return // ❗ đang quay thật thì dừng idle

    const animate = () => {
      setRotation((prev) => prev + idleSpeed)
      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [spinning])

  return (
    <div className="space-y-4">
      {/* 🎡 Wheel */}
      <div className="relative mx-auto h-64 w-64">
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 text-red-600 text-xl">
          ▼
        </div>
        <svg
          viewBox="0 0 32 32"
          className="w-64 h-64 transition-transform duration-[4000ms] ease-out"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <defs>
            <clipPath id="circleClip">
              <circle cx="16" cy="16" r="16" />
            </clipPath>
          </defs>

          <g clipPath="url(#circleClip)">
            {(() => {
              const totalWeight = segments.reduce((a, s) => a + (s.weight ?? 0), 0)

              let cumulative = 0

              return segments.map((seg, idx) => {
                // 🔥 CHỌN 1 TRONG 2:

                // 👉 cách 1: theo weight
                const value =
                  totalWeight > 0 ? (seg.weight ?? 0) / totalWeight : 0

                // 👉 cách 2: theo số lượng (bật nếu muốn)
                // const value =
                //   totalRemaining > 0 ? (seg.remaining_qty ?? 0) / totalRemaining : 0

                const dash = value * 100
                const gap = 100 - dash

                const color = colors[idx % colors.length]

                const circle = (
                  <circle
                    key={idx}
                    r="16"
                    cx="16"
                    cy="16"
                    fill="transparent"
                    stroke={color}
                    strokeWidth="32"
                    strokeDasharray={`${dash} ${gap}`}
                    strokeDashoffset={-cumulative}
                  />
                )

                cumulative += dash
                return circle
              })
            })()}
          </g>
        </svg>
      </div>

      {/* 🎮 Button */}
      <Button
        variant={"primary"}
        onClick={() => void handleSpin()}
        disabled={spinning || playsLeft <= 0}
        isLoading={spinning}
      >
        Quay Vòng Quay ({playsLeft})
      </Button>

      {/* 🏆 Result */}
      {result && (
        <p className="text-xs text-emerald-300 text-center">
          Kết quả: {result.tier_name}{' '}
          {result.discount_code ? `(${result.discount_code})` : ''}
        </p>
      )}
    </div>
  )
}