import { CheckCircle2, Clock3, Lock } from 'lucide-react'

import type { SeatZone } from '@/types'

interface SeatMapLegendProps {
  zones?: SeatZone[]
}

const stateItems = [
  {
    key: 'selected',
    label: 'Selected',
    description: 'Blue ring',
    className: 'border-sky-300 bg-sky-500 text-slate-950',
    icon: CheckCircle2,
  },
  {
    key: 'held',
    label: 'Held By You',
    description: 'Purple ring',
    className: 'border-violet-300/60 bg-violet-500/20 text-violet-100',
    icon: Clock3,
  },
  {
    key: 'locked',
    label: 'Locked / Sold',
    description: 'Dimmed seat',
    className: 'border-amber-400/30 bg-slate-800 text-slate-300',
    icon: Lock,
  },
]

export function SeatMapLegend({ zones = [] }: SeatMapLegendProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Seat Types</p>
        <div className="mt-3 grid grid-cols-1 gap-2">
          {zones.map((zone) => (
            <div key={zone.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2">
              <div className="flex items-center gap-3">
                <span
                  className="h-4 w-4 rounded-full border border-white/20"
                  style={{ backgroundColor: zone.color }}
                />
                <div>
                  <p className="text-sm font-semibold text-white">{zone.name}</p>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{zone.code}</p>
                </div>
              </div>
              <p className="text-sm font-semibold text-slate-200">${Number(zone.price).toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Seat States</p>
        <div className="mt-3 grid grid-cols-1 gap-2">
          {stateItems.map((item) => {
            const Icon = item.icon
            return (
              <div key={item.key} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${item.className}`}>
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-current/20 bg-black/10">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-[11px] uppercase tracking-[0.18em] opacity-75">{item.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
