import type { SeatMapSeat } from '@/types'
import { formatCurrencyVnd } from '@/lib/utils'

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
          <span>Ghế đã chọn</span>
          <span>{selectedSeats.length}</span>
        </div>
        <div className="mt-3 max-h-56 space-y-2 overflow-auto border border-dashed border-[var(--customer-bg-opp)] customer-bg-surface">
          {selectedSeats.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--customer-bg-opp)] customer-bg-surface px-3 py-4 text-sm text-slate-400">
              Chưa chọn ghế nào.
            </p>
          ) : (
            selectedSeats.map((seat) => (
              <div key={seat.id} className="flex items-center justify-between rounded-xl border border-dashed border-[var(--customer-bg-opp)] customer-bg-surface px-3 py-2">
                <div>
                  <p className="text-sm font-semibold customer-text-body">{seat.label}</p>
                  <p className="text-xs text-gray-500">{seat.zone_name ?? 'Vé phổ thông'}</p>
                </div>
                <p className="text-sm font-semibold customer-text-body">{formatCurrencyVnd(seat.price)}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-slate-500">
          <span>Ghế đang giữ</span>
          <span>{lockedSeats.length}</span>
        </div>
        <div className="mt-3 max-h-40 space-y-2 overflow-auto">
          {lockedSeats.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 bg-slate-950/50 px-3 py-4 text-sm text-slate-400">
              Hiện chưa có ghế nào được giữ cho bước thanh toán.
            </p>
          ) : (
            lockedSeats.map((seat) => (
              <div key={seat.id} className="flex items-center justify-between rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-violet-50">{seat.label}</p>
                  <p className="text-xs text-violet-100/70">{seat.zone_name ?? 'Vé phổ thông'}</p>
                </div>
                <p className="text-sm font-semibold text-violet-50">{formatCurrencyVnd(seat.price)}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--customer-bg-opp)] customer-bg-surface p-4">
        <div className="flex items-center justify-between text-sm text-slate-300">
          <span>Tạm tính</span>
          <span className="font-semibold text-white">{formatCurrencyVnd(subtotal)}</span>
        </div>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
          Thời gian giữ ghế bắt đầu khi bạn tiếp tục sang bước thanh toán.
        </p>
      </div>
    </div>
  )
}
