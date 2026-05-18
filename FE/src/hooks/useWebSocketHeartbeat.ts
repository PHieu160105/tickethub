import { useEffect, useRef } from 'react'

interface UseWebSocketHeartbeatOptions {
  url: string | null
  onMessage?: (event: MessageEvent) => void
  onOpen?: () => void
  onClose?: () => void
}

function normalizeWebSocketUrl(rawUrl: string | null): string | null {
  if (!rawUrl) return null

  const trimmed = rawUrl.trim()
  if (!trimmed || trimmed.includes('<URL>')) return null

  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
    return trimmed
  }

  if (trimmed.startsWith('http://')) {
    return `ws://${trimmed.slice('http://'.length)}`
  }

  if (trimmed.startsWith('https://')) {
    return `wss://${trimmed.slice('https://'.length)}`
  }

  if (trimmed.startsWith('ws:') && !trimmed.startsWith('ws://')) {
    const rest = trimmed.slice(3).replace(/^\/+/, '')
    return rest ? `ws://${rest}` : null
  }

  if (trimmed.startsWith('wss:') && !trimmed.startsWith('wss://')) {
    const rest = trimmed.slice(4).replace(/^\/+/, '')
    return rest ? `wss://${rest}` : null
  }

  return null
}

export function useWebSocketHeartbeat({
  url,
  onMessage,
  onOpen,
  onClose,
}: UseWebSocketHeartbeatOptions) {
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const heartbeatTimerRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)
  const onMessageRef = useRef<typeof onMessage>(onMessage)
  const onOpenRef = useRef<typeof onOpen>(onOpen)
  const onCloseRef = useRef<typeof onClose>(onClose)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    onOpenRef.current = onOpen
  }, [onOpen])

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const normalizedUrl = normalizeWebSocketUrl(url)
    if (!normalizedUrl) {
      if (socketRef.current) {
        socketRef.current.close(1000, 'Đã tắt WebSocket')
        socketRef.current = null
      }
      return
    }

    let disposed = false

    const clearTimers = () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (heartbeatTimerRef.current) {
        window.clearInterval(heartbeatTimerRef.current)
        heartbeatTimerRef.current = null
      }
    }

    const scheduleReconnect = () => {
      if (disposed) return
      const attempt = reconnectAttemptRef.current + 1
      reconnectAttemptRef.current = attempt
      const backoffMs = Math.min(8000, 500 * 2 ** (attempt - 1))
      reconnectTimerRef.current = window.setTimeout(connect, backoffMs)
    }

    const connect = () => {
      if (disposed) return

      const socket = new WebSocket(normalizedUrl)
      socketRef.current = socket

      socket.onopen = () => {
        reconnectAttemptRef.current = 0
        onOpenRef.current?.()
      }

      socket.onmessage = (event) => {
        onMessageRef.current?.(event)
      }

      socket.onclose = () => {
        onCloseRef.current?.()
        scheduleReconnect()
      }

      socket.onerror = () => {
        // Giữ console trình duyệt gọn hơn; luồng khôi phục được xử lý ở onclose và reconnect.
      }
    }

    // Trì hoãn kết nối ngắn để tránh vòng đóng trước khi mở khi StrictMode mount lại trong môi trường phát triển.
    reconnectTimerRef.current = window.setTimeout(connect, 120)

    heartbeatTimerRef.current = window.setInterval(() => {
      const socket = socketRef.current
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send('ping')
      }
    }, 10000)

    return () => {
      disposed = true
      clearTimers()
      if (socketRef.current?.readyState === WebSocket.OPEN || socketRef.current?.readyState === WebSocket.CONNECTING) {
        socketRef.current.close(1000, 'Component đã unmount')
      }
      socketRef.current = null
    }
  }, [url])

  return socketRef
}
