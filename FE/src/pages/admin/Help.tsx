import { useEffect, useMemo, useState } from 'react'
import { helpApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { authStorage } from '@/lib/storage'
import type { HelpMessage, HelpThread } from '@/types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'
const WS_BASE = API_BASE.replace(/^http/, 'ws').replace(/\/api$/, '')

export default function AdminHelp() {
  const { user } = useAuth()
  const [threads, setThreads] = useState<HelpThread[]>([])
  const [activeThread, setActiveThread] = useState<HelpThread | null>(null)
  const [messages, setMessages] = useState<HelpMessage[]>([])
  const [input, setInput] = useState('')

  useEffect(() => {
    void (async () => {
      const data = await helpApi.adminThreads()
      setThreads(data)
      if (data[0]) setActiveThread(data[0])
    })()
  }, [])

  useEffect(() => {
    if (!activeThread) return
    void (async () => {
      const data = await helpApi.adminMessages(activeThread.id)
      setMessages(data)
    })()
  }, [activeThread?.id])

  useEffect(() => {
    if (!activeThread) return
    const token = authStorage.getToken()
    if (!token) return
    const ws = new WebSocket(`${WS_BASE}/ws/help/${activeThread.id}?token=${encodeURIComponent(token)}`)
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data) as { type: string; payload: HelpMessage }
      if (parsed.type === 'help_message') {
        setMessages((prev) => [...prev, parsed.payload])
      }
    }
    return () => ws.close()
  }, [activeThread?.id])

  const canSend = useMemo(() => input.trim().length > 0 && Boolean(activeThread), [input, activeThread])

  const sendMessage = async () => {
    if (!canSend || !activeThread) return
    await helpApi.adminSendMessage(activeThread.id, input.trim())
    setInput('')
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[80vh]">
      <div className="rounded-xl border border-white/10 bg-slate-900/70 overflow-y-auto">
        {threads.map((thread) => (
          <button key={thread.id} onClick={() => setActiveThread(thread)} className={`w-full text-left p-4 border-b border-white/10 ${activeThread?.id === thread.id ? 'bg-white/10' : ''}`}>
            <p className="text-sm font-semibold">{thread.customer_name}</p>
            <p className="text-xs text-slate-400">{thread.customer_email}</p>
            <p className="text-xs text-slate-500 mt-1 line-clamp-1">{thread.last_message_preview}</p>
          </button>
        ))}
      </div>
      <div className="lg:col-span-2 rounded-xl border border-white/10 bg-slate-900/70 flex flex-col">
        <div className="p-4 border-b border-white/10 text-sm font-semibold">{activeThread ? `Chat with ${activeThread.customer_name}` : 'Select a customer'}</div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] px-3 py-2 rounded-lg ${message.sender_id === user?.id ? 'bg-primary text-white' : 'bg-slate-800 text-slate-100'}`}>
                <p className="text-sm">{message.content}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-white/10 flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} className="flex-1 bg-slate-800 rounded px-3 py-2 text-sm" placeholder="Reply..." />
          <button disabled={!canSend} onClick={() => void sendMessage()} className="px-4 py-2 rounded bg-primary disabled:opacity-40">
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
