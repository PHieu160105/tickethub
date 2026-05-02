import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Send, X } from 'lucide-react'

import { CustomerSidebar } from '@/components/layout/CustomerSidebar'
import { Navbar } from '@/components/layout/Navbar'
import { useAuth } from '@/context/AuthContext'
import { helpApi } from '@/lib/api'
import { authStorage } from '@/lib/storage'
import type { HelpMessage, HelpThread } from '@/types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'
const WS_BASE = API_BASE.replace(/^http/, 'ws').replace(/\/api$/, '')

export default function Help() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
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
    if (tab === 'payments') return navigate('/payments')
    if (tab === 'settings') return navigate('/settings')
    if (tab === 'help') return navigate('/help')
    if (tab === 'logout') {
      logout()
      return navigate('/')
    }
  }

  useEffect(() => {
    void (async () => {
      const myThread = await helpApi.createOrGetMyThread()
      setThread(myThread)
      const history = await helpApi.myMessages()
      setMessages(history)
    })()
  }, [])

  useEffect(() => {
    if (!thread) return
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
  }, [thread?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  const canSend = useMemo(() => inputValue.trim().length > 0, [inputValue])

  const handleSendMessage = async () => {
    if (!canSend) return
    await helpApi.sendMyMessage(inputValue.trim())
    setInputValue('')
  }

  return (
    <>
      <Navbar />
      <div className="pt-[80px] min-h-screen bg-background flex">
        <div className="hidden lg:block">
          <CustomerSidebar activeTab="help" userName={user?.full_name ?? 'Customer'} onNavigate={onSidebarNavigate} />
        </div>
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
            <CustomerSidebar activeTab="help" userName={user?.full_name ?? 'Customer'} onNavigate={onSidebarNavigate} className="relative" />
          </div>
        )}

        <main className="flex-1 p-6 lg:p-12 max-w-5xl mx-auto">
          <button className="lg:hidden mb-4 p-2 rounded bg-surface-container" onClick={() => setDrawerOpen((v) => !v)}>
            {drawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <header className="mb-6">
            <h1 className="text-5xl font-black text-on-background font-headline tracking-tighter">Help Center</h1>
            <p className="text-on-surface-variant mt-2 max-w-lg">Chat trực tiếp với admin support.</p>
          </header>

          <div className="glass-panel rounded-2xl overflow-hidden flex flex-col h-[calc(100vh-280px)] min-h-[500px]">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${message.sender_id === user?.id ? 'bg-primary-container text-on-primary-container rounded-br-md' : 'bg-surface-container-high text-on-surface rounded-bl-md'}`}>
                    <p className="text-sm">{message.content}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="bg-surface-container-high border-t border-white/5 p-4">
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
                  placeholder="Type your message..."
                  rows={1}
                  className="w-full bg-surface-container text-on-surface placeholder:text-on-surface-variant/50 rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-primary resize-none"
                />
                <button onClick={() => void handleSendMessage()} disabled={!canSend} className="p-3 bg-primary text-on-primary rounded-xl disabled:opacity-50">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
