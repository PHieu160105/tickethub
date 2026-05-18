import { CheckCircle2, Clock3, Lock } from 'lucide-react'

import { formatCurrencyVnd } from '@/lib/utils'
import type { SeatMapZone, SeatZone } from '@/types'

interface SeatMapLegendProps {
  zones?: Array<SeatZone | SeatMapZone>
}

const stateItems = [
  {
    key: 'available',
    label: 'Còn trống',
    description: 'Màu theo khu vực',
    className: 'border-slate-300 bg-slate-100 text-slate-900',
    icon: CheckCircle2,
  },
  {
    key: 'held',
    label: 'Bạn đang giữ',
    description: 'Ghế màu xanh lá',
    className: 'border-emerald-300/70 bg-emerald-700 text-emerald-50',
    icon: Clock3,
  },
  {
    key: 'locked',
    label: 'Đang giữ',
    description: 'Khách khác đang giữ',
    className: 'border-amber-300/70 bg-amber-900 text-amber-100',
    icon: Lock,
  },
  {
    key: 'sold',
    label: 'Đã bán',
    description: 'Không thể mua tiếp',
    className: 'border-slate-500 bg-slate-700 text-slate-100',
    icon: Lock,
  },
]

export function SeatMapLegend({ zones = [] }: SeatMapLegendProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.24em] text-gray-500">Loại ghế</p>
        <div className="mt-3 grid grid-cols-1 gap-2">
          {zones.map((zone) => (
            <div key={zone.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
              <div className="flex items-center gap-3">
                <span
                  className="h-4 w-4 rounded-full border border-white/20"
                  style={{ backgroundColor: zone.color }}
                />
                <div>
                  <p className="text-sm font-semibold text-white">{zone.name}</p>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white">{zone.code}</p>
                </div>
              </div>
              <p className="text-sm font-semibold text-slate-200">{formatCurrencyVnd(zone.price)}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Trạng thái ghế</p>
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
