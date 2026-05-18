import React from 'react'
import { Calendar, MapPin } from 'lucide-react'

interface TicketCardProps {
  eventTitle: string
  ticketNumber: string
  date: string
  location: string
  imageUrl: string
  status?: 'confirmed' | 'pending'
  isFeatured?: boolean
  additionalInfo?: {
    label: string
    value: string
  }[]
  onDownload?: () => void
  onViewDetails?: () => void
}

export const TicketCard: React.FC<TicketCardProps> = ({
  eventTitle,
  ticketNumber,
  date,
  location,
  imageUrl,
  status = 'confirmed',
  isFeatured = false,
  additionalInfo = [],
}) => {
  const statusColors = {
    confirmed: 'bg-secondary/10 text-secondary border-secondary/20',
    pending: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  }

  return (
    <div
      className={`customer-bg-surface border-1 border-[var(--customer-bg-opp)] rounded-full overflow-hidden flex flex-col md:flex-row relative group ${
        isFeatured ? 'xl:col-span-2 border-primary-container/30' : ''
      }`}
    >
      <div className={`w-full md:w-48 h-64 md:h-auto overflow-hidden relative ${isFeatured ? 'md:w-72' : ''}`}>
        <img alt="Ảnh đại diện sự kiện" src={imageUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
        <div
          className={`absolute inset-0 bg-gradient-to-t from-background/80 to-transparent md:hidden ${
            isFeatured ? 'bg-gradient-to-r from-transparent via-transparent to-surface-container/60' : ''
          }`}
        />
        {isFeatured && (
          <div className="absolute top-4 left-4">
            <span className="px-4 py-1 bg-secondary text-background font-black text-xs uppercase tracking-[0.2em] rounded-full">
              Hạng đặc biệt
            </span>
          </div>
        )}
      </div>

      <div className={`flex-1 p-8 flex flex-col justify-between ${isFeatured ? 'p-8 md:p-12 flex flex-col justify-center' : ''}`}>
        <div>
          <div className="flex justify-between items-start mb-4">
            <span className={`px-3 py-1 border rounded-full text-[10px] font-black uppercase tracking-widest ${statusColors[status]}`}>
              {status === 'confirmed' ? 'Đã xác nhận' : 'Đang xử lý'}
            </span>
          </div>
          <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">{ticketNumber}</p>
          <h2
            className={`font-black font-headline customer-text-body leading-tight mb-2 uppercase tracking-tighter ${
              isFeatured ? 'text-4xl md:text-5xl' : 'text-2xl'
            }`}
          >
            {eventTitle}
          </h2>

          {isFeatured && additionalInfo.length > 0 && (
            <p className="text-on-surface-variant mb-8 max-w-lg">
              Vé đặc biệt bao gồm quyền ưu tiên check-in và các tiện ích cao cấp của sự kiện.
            </p>
          )}

          <div className={`flex flex-wrap gap-x-6 gap-y-2 text-on-surface-variant text-sm mb-6 ${isFeatured ? 'gap-8 mb-10' : ''}`}>
            {isFeatured && additionalInfo.length > 0 ? (
              additionalInfo.map((info, index) => (
                <div key={index} className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{info.label}</span>
                  <span className="text-white font-bold text-lg">{info.value}</span>
                </div>
              ))
            ) : (
              <div className="flex-col">
                <div className="flex items-center gap-1.5">
                  <Calendar className="text-primary w-4 h-4" />
                  <span>{date}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <MapPin className="text-primary w-4 h-4" />
                  <span>{location}</span>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
