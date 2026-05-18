import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { helpApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { authStorage } from '@/lib/storage'
import type { HelpMessage, HelpThread } from '@/types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'
const WS_BASE = API_BASE.replace(/^http/, 'ws').replace(/\/api$/, '')

export default function AdminHelp() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedThreadIdParam = searchParams.get('threadId')
  const [threads, setThreads] = useState<HelpThread[]>([])
  const [activeThread, setActiveThread] = useState<HelpThread | null>(null)
  const [messages, setMessages] = useState<HelpMessage[]>([])
  const [input, setInput] = useState('')

  useEffect(() => {
    void (async () => {
      const data = await helpApi.adminThreads()
      const hasUnread = data.some((thread) => thread.unread_admin > 0)
      const normalizedThreads = hasUnread ? data.map((thread) => ({ ...thread, unread_admin: 0 })) : data
      const requestedThreadId = requestedThreadIdParam ? Number(requestedThreadIdParam) : null
      const nextActiveThread =
        normalizedThreads.find((thread) => thread.id === requestedThreadId) ??
        normalizedThreads[0] ??
        null

      setThreads(normalizedThreads)
      setActiveThread(nextActiveThread)

      if (hasUnread) {
        try {
          await helpApi.adminMarkThreadsSeen()
        } catch {
          setThreads(data)
          setActiveThread(data.find((thread) => thread.id === requestedThreadId) ?? data[0] ?? null)
        }
      }
    })()
  }, [requestedThreadIdParam])

  useEffect(() => {
    if (!activeThread) return
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)
      nextParams.set('threadId', String(activeThread.id))
      return nextParams
    }, { replace: true })
  }, [activeThread, setSearchParams])

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
        setThreads((prev) =>
          prev.map((thread) =>
            thread.id === activeThread.id
              ? {
                  ...thread,
                  last_message_at: parsed.payload.created_at,
                  last_message_preview: parsed.payload.content,
                  unread_admin: 0,
                }
              : thread,
          ),
        )
        if (parsed.payload.sender_id !== user?.id) {
          void helpApi.adminMarkThreadsSeen()
        }
      }
    }
    return () => ws.close()
  }, [activeThread?.id, user?.id])

  const canSend = useMemo(() => input.trim().length > 0 && Boolean(activeThread), [input, activeThread])

  const sendMessage = async () => {
    if (!canSend || !activeThread) return
    await helpApi.adminSendMessage(activeThread.id, input.trim())
    setInput('')
  }

  return (
    <div className='space-y-6'>
      <div>
          <h2 className="text-2xl font-display font-bold admin-text-header">Trung tâm hỗ trợ</h2>
          <p className="admin-text-body mt-1">Hỗ trợ khách hàng tận tâm</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-[60vh] lg:h-[70vh]">
        <div className="rounded-xl border admin-border admin-bg-help overflow-y-auto max-h-[280px] lg:max-h-none">
          {threads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => setActiveThread(thread)}
              className={`w-full text-left p-4 border-b admin-border ${activeThread?.id === thread.id ? 'admin-bg-soft' : ''}`}
            >
              <p className="text-sm font-semibold admin-text-header">{thread.customer_name}</p>
              <p className="text-xs admin-text-muted">{thread.customer_email}</p>
              <p className="text-xs admin-text-body mt-1 line-clamp-1">{thread.last_message_preview}</p>
            </button>
          ))}
        </div>
        <div className="lg:col-span-3 rounded-xl border admin-border admin-bg-help flex flex-col min-h-[420px]">
          <div className="p-4 border-b admin-border text-sm font-semibold admin-text-header"
                style={{background: `linear-gradient(to right, var(--admin-bg-opt), var(--admin-bg-opp))`}}>{activeThread ? `Chat with ${activeThread.customer_name}` : 'Select a customer'}</div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] sm:max-w-[70%] px-3 py-2 rounded-lg ${message.sender_id === user?.id ? 'bg-[var(--admin-bg-opt)] text-white' : 'admin-bg-soft admin-text-body'}`}>
                  <p className="text-sm">{message.content}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t admin-border flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} className="flex-1 admin-text-body rounded px-3 py-2 text-sm border admin-border" placeholder="Reply..." />
            <button disabled={!canSend} onClick={() => void sendMessage()} className="px-4 py-2 rounded bg-[var(--admin-bg-opt)] disabled:opacity-40">
              Gửi 
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
