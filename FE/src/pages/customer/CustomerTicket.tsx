import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { CustomerSidebar } from '@/components/layout/CustomerSidebar'
import { Navbar } from '@/components/layout/Navbar'
//import { GlobalLoader } from '@/components/ui/GlobalLoader'
import { TicketCard } from '@/components/ui/TicketCard'
import { useAuth } from '@/context/AuthContext'
import { useCancelTicket, useMyTickets } from '@/features/booking/hooks/useBooking'
import type { TicketItem } from '@/types'
import { Globe, Mail, MonitorPlay, Ticket } from 'lucide-react'

type TicketTab = 'upcoming' | 'past' | 'cancelled'

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}

function toCardStatus(ticket: TicketItem): 'confirmed' | 'pending' | 'cancelled' {
  if (ticket.seat_status === 'sold') return 'confirmed'
  if (ticket.seat_status === 'locked') return 'pending'
  return 'cancelled'
}

const CustomerTicket: React.FC = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<TicketTab>('upcoming')
  const [pendingCancelTicketId, setPendingCancelTicketId] = useState<number | null>(null)

  const { tickets, isLoading, error, refetch } = useMyTickets()
  const { cancelTicket, error: cancelError } = useCancelTicket()

  useEffect(() => {
    void refetch()
  }, [refetch])

  // if (isLoading) {
  //   return <GlobalLoader />
  // }

  const filteredTickets = useMemo(() => {
    const now = Date.now()

    return tickets.filter((ticket) => {
      const eventTime = new Date(ticket.event_date).getTime()
      const isPast = eventTime < now

      if (activeTab === 'upcoming') return !isPast && ticket.seat_status === 'sold'
      if (activeTab === 'past') return isPast && ticket.seat_status === 'sold'
      return ticket.seat_status !== 'sold'
    })
  }, [tickets, activeTab])

  const onSidebarNavigate = (tab: string) => {
    if (tab === 'tickets') return navigate('/tickets')
    if (tab === 'profile') return navigate('/profile')
    if (tab === 'favourites') return navigate('/favourites') 
    if (tab === 'payments') return navigate('/payments')  
    if (tab === "settings") return navigate('/settings') 
    if (tab === 'help') return navigate('/help')  
    if (tab === 'logout') {
      logout()
      return navigate('/')
    }
  }

  const onViewDetails = (ticket: TicketItem) => {
    navigate(`/event/${ticket.event_slug}`)
  }

  const onDownload = (ticket: TicketItem) => {
    navigator.clipboard.writeText(ticket.qr_payload).catch(() => undefined)
    window.alert(`Copied QR payload for ${ticket.ticket_code}`)
  }

  const onCancelTicket = async (ticket: TicketItem) => {
    const confirmed = window.confirm(`Cancel ticket ${ticket.ticket_code}?`)
    if (!confirmed) return

    try {
      setPendingCancelTicketId(ticket.ticket_id)
      await cancelTicket(ticket.ticket_id)
      await refetch()
    } finally {
      setPendingCancelTicketId(null)
    }
  }

  return (
    <>
      <Navbar />
      <div className="pt-[80px] min-h-screen bg-[#0B0F19] flex">
        <CustomerSidebar
          activeTab="tickets"
          userName={user?.full_name ?? 'Customer'}
          membershipLevel="Stellar Member"
          onNavigate={onSidebarNavigate}
        />

        <main className="flex-1 p-8 lg:p-12">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <h1 className="text-5xl font-black text-white font-headline tracking-tighter">Vé của tôi</h1>
              <p className="text-slate-400 mt-2 max-w-lg">Chúc bạn có trải nghiệm tuyệt vời vơi TicketRush</p>
            </div>

            <div className="flex p-1 bg-slate-900 border border-white/5 rounded-full backdrop-blur-sm">
              {(['upcoming', 'past', 'cancelled'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-2 rounded-full font-bold text-sm transition-all capitalize ${
                    activeTab === tab ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg shadow-red-500/20' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </header>

          {isLoading ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
              <p className="text-lg font-bold">Loading tickets...</p>
            </div>
          ) : error ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-amber-300">
              <p className="text-lg font-bold mb-3">{error}</p>
              <button className="text-sm underline" onClick={() => void refetch()}>
                Retry
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {filteredTickets.map((ticket) => (
                <div key={ticket.ticket_id} className="space-y-3">
                  <TicketCard
                    eventTitle={ticket.event_title}
                    ticketNumber={ticket.ticket_code}
                    date={formatDate(ticket.event_date)}
                    location={`${ticket.venue} | ${ticket.seat_label}`}
                    imageUrl={ticket.event_cover_image_url}
                    status={toCardStatus(ticket)}
                    onViewDetails={() => onViewDetails(ticket)}
                    onDownload={() => onDownload(ticket)}
                  />
                  {activeTab === 'upcoming' && ticket.seat_status === 'sold' && (
                    <div className="flex justify-end">
                      <button
                        className="text-xs px-3 py-2 rounded-lg border border-red-400/30 text-red-300 hover:bg-red-500/10 disabled:opacity-60"
                        disabled={pendingCancelTicketId === ticket.ticket_id}
                        onClick={() => void onCancelTicket(ticket)}
                      >
                        {pendingCancelTicketId === ticket.ticket_id ? 'Cancelling...' : 'Cancel Ticket'}
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {filteredTickets.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
                  <Ticket className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-lg font-bold">No {activeTab} tickets found.</p>
                </div>
              )}
            </div>
          )}
          {cancelError && <p className="text-amber-300 text-sm mt-4">{cancelError}</p>}
        </main>
      </div>

      <footer className="bg-slate-950 border-t border-white/5 py-12 mt-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 px-6 max-w-screen-2xl mx-auto">
          <div className="col-span-2 md:col-span-1">
            <div className="text-xl font-black text-red-500 font-headline uppercase mb-4">TicketRush</div>
            <p className="text-slate-500 text-xs">Elevating your experience beyond the terrestrial.</p>
          </div>
          <div className="space-y-3">
            <h4 className="text-white font-bold text-xs uppercase tracking-widest mb-2">Navigation</h4>
            <a href="#" className="block text-slate-500 hover:text-red-400 text-xs font-bold uppercase transition-colors">
              Help Center
            </a>
            <a href="#" className="block text-slate-500 hover:text-red-400 text-xs font-bold uppercase transition-colors">
              Sell Tickets
            </a>
            <a href="#" className="block text-slate-500 hover:text-red-400 text-xs font-bold uppercase transition-colors">
              Artist Portal
            </a>
          </div>
          <div className="space-y-3">
            <h4 className="text-white font-bold text-xs uppercase tracking-widest mb-2">Legal</h4>
            <a href="#" className="block text-slate-500 hover:text-red-400 text-xs font-bold uppercase transition-colors">
              Terms of Service
            </a>
            <a href="#" className="block text-slate-500 hover:text-red-400 text-xs font-bold uppercase transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="block text-slate-500 hover:text-red-400 text-xs font-bold uppercase transition-colors">
              Affiliates
            </a>
          </div>
          <div className="space-y-4">
            <h4 className="text-white font-bold text-xs uppercase tracking-widest">Connect</h4>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-red-500 transition-colors cursor-pointer">
                <Globe className="w-4 h-4 text-slate-400" />
              </div>
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-red-500 transition-colors cursor-pointer">
                <Mail className="w-4 h-4 text-slate-400" />
              </div>
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-red-500 transition-colors cursor-pointer">
                <MonitorPlay className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}

export default CustomerTicket
