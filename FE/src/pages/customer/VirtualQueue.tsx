import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'

import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { queueApi } from '@/features/booking/api/queueApi'
import { extractApiErrorMessage } from '@/lib/api'
import { flashNoticeStorage, queueStorage } from '@/lib/storage'
import type { QueueJoinResponse, QueueStatusResponse } from '@/types'
import { AlertTriangle, CheckCircle2, Clock3, Loader2, LogIn, Timer } from 'lucide-react'

function statusDescription(status: QueueJoinResponse['status']) {
  if (status === 'admitted') return 'Bạn đã được vào lượt đặt chỗ.'
  if (status === 'waiting') return 'Hệ thống đang điều tiết truy cập, vui lòng chờ.'
  if (status === 'completed') return 'Phiên phòng chờ đã hoàn tất.'
  return 'Phiên phòng chờ đã hết hạn, vui lòng vào lại phòng chờ.'
}

function isRecoverableQueueTokenError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false
  }

  const statusCode = error.response?.status
  return statusCode === 403 || statusCode === 404 || statusCode === 410
}

function isShowUnavailableError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404
}

function isRequestTimeout(error: unknown): boolean {
  return axios.isAxiosError(error) && error.code === 'ECONNABORTED'
}

export default function VirtualQueue() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const showId = Number(searchParams.get('showId') ?? '')
  const eventKey = searchParams.get('eventKey')?.trim() ?? ''

  const [queueToken, setQueueToken] = useState<string | null>(null)
  const [status, setStatus] = useState<QueueJoinResponse['status']>('waiting')
  const [position, setPosition] = useState<number | null>(null)
  const [admittedUntil, setAdmittedUntil] = useState<string | null>(null)
  const [message, setMessage] = useState('Đang kết nối phòng chờ...')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const interruptionRedirectTimerRef = useRef<number | null>(null)
  const positionRef = useRef<number | null>(null)

  const etaMinutes = useMemo(() => {
    if (!position || position <= 0) return 0
    return Math.max(1, Math.ceil(position / 25))
  }, [position])

  const etaLabel = useMemo(() => {
    if (etaMinutes > 0) return `~${etaMinutes} phút`
    if (status === 'waiting') return 'Đang tính'
    return '-'
  }, [etaMinutes, status])

  const waitingRoomMessage = useMemo(() => {
    if (status !== 'waiting') return message || statusDescription(status)
    if (!position || position <= 0) return message || 'Bạn đang ở trong phòng chờ. Vui lòng không tải lại trang.'
    return `Bạn đang ở vị trí thứ ${position} trong hàng đợi. Vui lòng không tải lại trang.`
  }, [message, position, status])

  useEffect(() => {
    positionRef.current = position
  }, [position])

  useEffect(() => {
    return () => {
      if (interruptionRedirectTimerRef.current !== null) {
        window.clearTimeout(interruptionRedirectTimerRef.current)
      }
    }
  }, [])

  const handleShowUnavailable = useCallback(() => {
    if (showId && !Number.isNaN(showId)) {
      queueStorage.clearToken(showId)
    }
    flashNoticeStorage.set({
      variant: 'warning',
      title: 'Show đang được cập nhật',
      description: 'Phiên hàng đợi hiện tại đã kết thúc vì admin đang chỉnh sửa show. Vui lòng chọn show khác hoặc quay lại sau.',
    })
    setQueueToken(null)
    setStatus('expired')
    setPosition(null)
    setAdmittedUntil(null)
    setMessage('Show đang được cập nhật. Phiên hàng đợi hiện tại đã kết thúc.')
    setError('Show đang được cập nhật. Hệ thống sẽ đưa bạn về trang sự kiện.')
    setIsLoading(false)

    if (interruptionRedirectTimerRef.current !== null) {
      window.clearTimeout(interruptionRedirectTimerRef.current)
    }

    interruptionRedirectTimerRef.current = window.setTimeout(() => {
      navigate(eventKey ? `/event/${eventKey}` : '/search', { replace: true })
    }, 1500)
  }, [eventKey, navigate, showId])

  useEffect(() => {
    if (!showId || Number.isNaN(showId)) {
      setError('Thiếu showId. Hãy quay lại trang sự kiện và thử lại.')
      setIsLoading(false)
      return
    }

    if (!isAuthenticated) {
      navigate('/login', { replace: true })
      return
    }

    let disposed = false
    let statusTimer: number | null = null

    async function joinQueue() {
      if (!showId) return
      setError(null)
      setIsLoading(true)

      try {
        const response = await queueApi.join(showId)
        if (disposed) return

        queueStorage.setToken(showId, response.token)
        setQueueToken(response.token)
        setStatus(response.status)
        setPosition(response.position)
        setAdmittedUntil(response.admitted_until ?? null)
        setMessage(response.message || statusDescription(response.status))

        if (response.status === 'admitted') {
          navigate(`/shows/${showId}/seats`, { replace: true })
        }
      } catch (joinError) {
        if (disposed) return
        if (isShowUnavailableError(joinError)) {
          handleShowUnavailable()
          return
        }
        setError(
          isRequestTimeout(joinError)
            ? 'Phòng chờ đang tải cao. Hệ thống sẽ tự thử lại, vui lòng không tải lại trang.'
            : extractApiErrorMessage(joinError, 'Không thể tham gia hàng đợi.'),
        )
      } finally {
        if (!disposed) setIsLoading(false)
      }
    }

    async function pollQueueStatus(token: string) {
      try {
        const result: QueueStatusResponse = await queueApi.status(showId, token)
        if (disposed) return

        setStatus(result.status)
        setPosition(result.position ?? null)
        setAdmittedUntil(result.admitted_until ?? null)
        setMessage(result.message)

        if (result.status === 'admitted') {
          navigate(`/shows/${showId}/seats`, { replace: true })
          return
        }

        if (result.status === 'expired') {
          queueStorage.clearToken(showId)
          setQueueToken(null)
          setStatus('expired')
          setPosition(null)
          setAdmittedUntil(null)
          setMessage('Token hàng đợi đã hết hạn. Hệ thống đang tạo lại phiên hàng đợi mới cho bạn.')
          await joinQueue()
          return
        }
      } catch (pollError) {
        if (disposed) return

        if (isShowUnavailableError(pollError)) {
          handleShowUnavailable()
          return
        }

        if (isRecoverableQueueTokenError(pollError)) {
          queueStorage.clearToken(showId)
          setQueueToken(null)
          setStatus('expired')
          setPosition(null)
          setAdmittedUntil(null)
          setMessage('Token hàng đợi cũ không còn hợp lệ. Hệ thống sẽ tạo lại phiên hàng đợi mới cho bạn.')
          await joinQueue()
          return
        }

        if (isRequestTimeout(pollError) && positionRef.current !== null) {
          setMessage('Đang cập nhật lại vị trí của bạn. Vui lòng không tải lại trang.')
          return
        }

        setError(extractApiErrorMessage(pollError, 'Không thể cập nhật trạng thái hàng đợi.'))
      } finally {
        if (!disposed) setIsLoading(false)
      }
    }

    const existingToken = queueStorage.getToken(showId)
    if (existingToken) {
      setQueueToken(existingToken)
      void pollQueueStatus(existingToken)
    } else {
      void joinQueue()
    }

    statusTimer = window.setInterval(() => {
      const token = queueStorage.getToken(showId)
      if (token) {
        void pollQueueStatus(token)
      }
    }, 5000)

    return () => {
      disposed = true
      if (statusTimer) window.clearInterval(statusTimer)
    }
  }, [handleShowUnavailable, isAuthenticated, navigate, showId])

  useEffect(() => {
    if (!showId || Number.isNaN(showId) || status !== 'admitted' || !queueToken) {
      return
    }

    const heartbeatTimer = window.setInterval(() => {
      void queueApi.heartbeat(showId, queueToken).catch((heartbeatError) => {
        if (isShowUnavailableError(heartbeatError)) {
          handleShowUnavailable()
          return
        }

        if (!isRecoverableQueueTokenError(heartbeatError)) {
          return
        }

        queueStorage.clearToken(showId)
        setQueueToken(null)
        setStatus('expired')
        setPosition(null)
        setAdmittedUntil(null)
        setMessage('Phiên hàng đợi đã hết hạn. Vui lòng vào lại hàng đợi để nhận lượt mới.')
      })
    }, 30000)

    return () => window.clearInterval(heartbeatTimer)
  }, [handleShowUnavailable, queueToken, showId, status])

  return (
    <div className="min-h-screen text-white">
      <main className="max-w-3xl mx-auto px-6 py-20">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-8 space-y-6">
          <div>
          <h1 className="text-3xl font-black">Phòng chờ</h1>
            <p className="text-slate-400 mt-2">Buổi diễn: {showId || 'Không xác định'}</p>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang kết nối phòng chờ...
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-amber-300 text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-white/10 bg-slate-800/60 p-4">
              <p className="text-xs text-slate-400 uppercase">Trạng thái</p>
              <p className="text-lg font-semibold mt-2">{statusDescription(status)}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-800/60 p-4">
              <p className="text-xs text-slate-400 uppercase">Vị trí</p>
              <p className="text-lg font-semibold mt-2">{position ?? '-'}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-800/60 p-4">
              <p className="text-xs text-slate-400 uppercase">ETA</p>
              <p className="text-lg font-semibold mt-2">{etaLabel}</p>
            </div>
          </div>

          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4 text-cyan-200 text-sm flex items-start gap-2">
            <Timer className="h-4 w-4 mt-0.5" />
            <span>{waitingRoomMessage}</span>
          </div>

          {admittedUntil ? (
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              Được giữ lượt đến: {new Date(admittedUntil).toLocaleString('vi-VN')}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-2">
            <Button variant="outline" onClick={() => navigate(eventKey ? `/event/${eventKey}` : '/search')}>
              Quay lại sự kiện
            </Button>
            {/* <Button
              variant="outline"
              onClick={() => {
                if (showId && !Number.isNaN(showId)) {
                  queueStorage.clearToken(showId)
                }
                setQueueToken(null)
                setStatus('waiting')
                setPosition(null)
                setAdmittedUntil(null)
                setMessage('Đang tạo lại phiên hàng đợi...')
                setError(null)
                setIsLoading(true)
                setRetryNonce((value) => value + 1)
              }}
            >
              Vào hàng đợi lại
            </Button> */}
            {status === 'admitted' ? (
              <Button variant="primary" onClick={() => navigate(`/shows/${showId}/seats`)}>
                <CheckCircle2 className="h-4 w-4" />
                Đi tới chọn ghế
              </Button>
            ) : null}
            {!isAuthenticated ? (
              <Link to="/login">
                <Button variant="outline">
                  <LogIn className="h-4 w-4" />
                  Đăng nhập
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  )
}
