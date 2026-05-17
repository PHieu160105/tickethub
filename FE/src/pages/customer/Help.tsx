import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Send, X } from 'lucide-react'

import { CustomerSidebar } from '@/components/layout/CustomerSidebar'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { helpApi } from '@/lib/api'
import { authStorage } from '@/lib/storage'
import type { HelpMessage, HelpThread } from '@/types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'
const WS_BASE = API_BASE.replace(/^http/, 'ws').replace(/\/api$/, '')

export default function Help() {
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuth()
  const [thread, setThread] = useState<HelpThread | null>(null)
  const [messages, setMessages] = useState<HelpMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const onSidebarNavigate = (tab: string) => {
    setDrawerOpen(false)
    if (tab === 'tickets') return navigate('/tickets')
    if (tab === 'profile') return navigate('/profile')
    if (tab === 'favourites') return navigate('/favourites')
    if (tab === 'settings') return navigate('/settings')
    if (tab === 'help') return navigate('/help')
    if (tab === 'logout') {
      logout()
      return navigate('/')
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return

    void (async () => {
      const myThread = await helpApi.createOrGetMyThread()
      setThread(myThread)
      const history = await helpApi.myMessages()
      setMessages(history)
    })()
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated || !thread) return
    const token = authStorage.getToken()
    if (!token) return
    const ws = new WebSocket(`${WS_BASE}/ws/help/${thread.id}?token=${encodeURIComponent(token)}`)
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data) as { type: string; payload: HelpMessage }
      if (parsed.type === 'help_message') {
        setMessages((prev) => [...prev, parsed.payload])
      }
    }
    return () => ws.close()
  }, [isAuthenticated, thread])

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  const canSend = useMemo(() => inputValue.trim().length > 0, [inputValue])

  const handleSendMessage = async () => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    if (!canSend) return
    await helpApi.sendMyMessage(inputValue.trim())
    setInputValue('')
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const formatMessageTime = (value: string) =>
    new Date(value).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })

  return (
    <div className="app-theme-page pt-[35px] h-help flex">
        <div className="hidden lg:block">
          <CustomerSidebar activeTab="help" userName={user?.full_name ?? 'Khách hàng'} onNavigate={onSidebarNavigate} />
        </div>
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
            <CustomerSidebar activeTab="help" userName={user?.full_name ?? 'Khách hàng'} onNavigate={onSidebarNavigate} className="relative" />
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-12 max-w-5xl mx-auto">
          <button className="lg:hidden mb-4 p-2 rounded bg-surface-container" onClick={() => setDrawerOpen((v) => !v)}>
            {drawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <header className="mb-6">
            <h1 className="text-3xl sm:text-5xl font-black text-on-background font-headline tracking-tighter">Trung tâm hỗ trợ</h1>
            <p className="text-on-surface-variant mt-2 max-w-lg">Trao đổi trực tiếp với đội ngũ quản trị TicketRush.</p>
          </header>

          {!isAuthenticated ? (
            <div className="customer-bg-surface border-1 border-[var(--customer-bg-opp)] rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-black customer-text-header">Cần đăng nhập để mở hội thoại hỗ trợ</h2>
              <p className="mt-3 text-sm text-on-surface-variant">
                Trung tâm hỗ trợ gắn tin nhắn với tài khoản để admin tra cứu lịch sử và phản hồi chính xác.
              </p>
              <Button className="mt-6" onClick={() => navigate('/login')}>
                Đăng nhập để chat với hỗ trợ
              </Button>
            </div>
          ) : (

          <div className="customer-bg-surface border-1 border-[var(--customer-bg-opp)] rounded-2xl overflow-hidden flex flex-col h-[calc(100vh-220px)] sm:h-[calc(100vh-250px)] lg:h-[calc(100vh-280px)] min-h-[420px] sm:min-h-[500px]">
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.map((message) => (
                <div key={message.id} className={`${message.sender_id === user?.id ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className={`max-w-[88%] sm:max-w-[70%] rounded-xl px-2 py-2 customer-text-body`}>
                    <p className="text-[10px] font-bold tracking-wider opacity-80">
                      {message.sender_id === user?.id ? 'Bạn' : 'Quản trị viên'}
                    </p>
                  </div>
                  <div className={`max-w-[88%] sm:max-w-[70%] rounded-xl px-4 py-3 ${message.sender_id === user?.id ? 'bg-[var(--customer-bg-opt)] customer-text-body' : 'bg-[var(--customer-bg-help)] text-on-surface'}`}>
                    <p className="text-sm">{message.content}</p>
                  </div>
                  <div className={`max-w-[88%] sm:max-w-[70%] rounded-xl px-2 py-2 customer-text-body`}>
                    <p className="text-[10px] opacity-70">{formatMessageTime(message.created_at)}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="bg-[var(--customer-bg-help)] border-t border-white/5 p-4">
              <div className="flex items-end gap-3">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void handleSendMessage()
                    }
                  }}
                  placeholder="Nhập nội dung tin nhắn..."
                  aria-label="Nhập nội dung tin nhắn hỗ trợ"
                  rows={1}
                  className="w-full customer-bg-page customer-text-body placeholder:text-on-surface-variant/50 rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-[var(--customer-bg-opt)] resize-none"
                />
                <button onClick={() => void handleSendMessage()} disabled={!canSend} className="p-3 bg-[var(--customer-bg-opt)] text-on-primary rounded-xl disabled:opacity-50">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
          )}
        </main>
      </div>
  )
}
