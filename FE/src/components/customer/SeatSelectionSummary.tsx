import type { SeatMapSeat } from '@/types'

interface SeatSelectionSummaryProps {
  selectedSeats: SeatMapSeat[]
  lockedSeats: SeatMapSeat[]
  subtotal: number
}

export function SeatSelectionSummary({
  selectedSeats,
  lockedSeats,
  subtotal,
}: SeatSelectionSummaryProps) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-slate-500">
          <span>Selected Seats</span>
          <span>{selectedSeats.length}</span>
        </div>
        <div className="mt-3 max-h-56 space-y-2 overflow-auto">
          {selectedSeats.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 bg-slate-950/50 px-3 py-4 text-sm text-slate-400">
              No seats selected yet.
            </p>
          ) : (
            selectedSeats.map((seat) => (
              <div key={seat.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-800/70 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-white">{seat.label}</p>
                  <p className="text-xs text-slate-400">{seat.section_name ?? 'General admission'}</p>
                </div>
                <p className="text-sm font-semibold text-white">${Number(seat.price).toFixed(2)}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-slate-500">
          <span>Checkout Holds</span>
          <span>{lockedSeats.length}</span>
        </div>
        <div className="mt-3 max-h-40 space-y-2 overflow-auto">
          {lockedSeats.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 bg-slate-950/50 px-3 py-4 text-sm text-slate-400">
              No seats are being held for checkout right now.
            </p>
          ) : (
            lockedSeats.map((seat) => (
              <div key={seat.id} className="flex items-center justify-between rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-violet-50">{seat.label}</p>
                  <p className="text-xs text-violet-100/70">{seat.section_name ?? 'General admission'}</p>
                </div>
                <p className="text-sm font-semibold text-violet-50">${Number(seat.price).toFixed(2)}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
        <div className="flex items-center justify-between text-sm text-slate-300">
          <span>Subtotal</span>
          <span className="font-semibold text-white">${subtotal.toFixed(2)}</span>
        </div>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
          Hold starts when you continue to checkout.
        </p>
      </div>
    </div>
  )
}
