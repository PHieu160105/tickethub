import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { queueApi } from '@/features/booking/api/queueApi'
import { queueStorage } from '@/lib/storage'
import type { QueueJoinResponse, QueueStatusResponse } from '@/types'
import { AlertTriangle, CheckCircle2, Clock3, Loader2, LogIn, Timer } from 'lucide-react'

function statusDescription(status: QueueJoinResponse['status']) {
  if (status === 'admitted') return 'Ban da duoc vao luot dat cho.'
  if (status === 'waiting') return 'He thong dang xep hang, vui long cho.'
  if (status === 'completed') return 'Phien queue da hoan tat.'
  return 'Queue token het han, vui long vao lai hang doi.'
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
  const [message, setMessage] = useState('Dang ket noi queue...')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const etaMinutes = useMemo(() => {
    if (!position || position <= 0) return 0
    return Math.max(1, Math.ceil(position / 25))
  }, [position])

  useEffect(() => {
    if (!showId || Number.isNaN(showId)) {
      setError('Thieu showId. Hay quay lai trang su kien va thu lai.')
      setIsLoading(false)
      return
    }

    if (!isAuthenticated) {
      navigate('/login', { replace: true })
      return
    }

    let disposed = false
    let statusTimer: number | null = null
    let heartbeatTimer: number | null = null

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
          setError('Queue token da het han. Bam Join Queue de vao lai hang doi.')
        }
      } catch (pollError) {
        if (disposed) return
        setError(pollError instanceof Error ? pollError.message : 'Khong the cap nhat trang thai queue.')
      } finally {
        if (!disposed) setIsLoading(false)
      }
    }

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
        setError(joinError instanceof Error ? joinError.message : 'Khong the tham gia queue.')
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

    heartbeatTimer = window.setInterval(() => {
      const token = queueStorage.getToken(showId)
      if (!token) return
      if (status === 'admitted') {
        void queueApi.heartbeat(showId, token)
      }
    }, 30000)

    return () => {
      disposed = true
      if (statusTimer) window.clearInterval(statusTimer)
      if (heartbeatTimer) window.clearInterval(heartbeatTimer)
    }
  }, [eventKey, isAuthenticated, navigate, showId, status])

  return (
    <div className="min-h-screen text-white">
      <main className="max-w-3xl mx-auto px-6 py-20">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-8 space-y-6">
          <div>
            <h1 className="text-3xl font-black">Virtual Queue</h1>
            <p className="text-slate-400 mt-2">Show: {showId || 'N/A'}</p>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Dang ket noi queue...
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
              <p className="text-xs text-slate-400 uppercase">Status</p>
              <p className="text-lg font-semibold mt-2 capitalize">{status}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-800/60 p-4">
              <p className="text-xs text-slate-400 uppercase">Position</p>
              <p className="text-lg font-semibold mt-2">{position ?? '-'}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-800/60 p-4">
              <p className="text-xs text-slate-400 uppercase">ETA</p>
              <p className="text-lg font-semibold mt-2">{etaMinutes > 0 ? `~${etaMinutes} min` : '-'}</p>
            </div>
          </div>

          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4 text-cyan-200 text-sm flex items-start gap-2">
            <Timer className="h-4 w-4 mt-0.5" />
            <span>{message || statusDescription(status)}</span>
          </div>

          {queueToken ? (
            <p className="text-xs text-slate-500 break-all">Queue token: {queueToken}</p>
          ) : null}

          {admittedUntil ? (
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              Admitted until: {new Date(admittedUntil).toLocaleString()}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-2">
            <Button variant="outline" onClick={() => navigate(eventKey ? `/event/${eventKey}` : '/search')}>
              Back To Event
            </Button>
            <Button variant="primary" onClick={() => navigate(`/shows/${showId}/seats`)}>
              <CheckCircle2 className="h-4 w-4" />
              Go To Seats
            </Button>
            {!isAuthenticated ? (
              <Link to="/login">
                <Button variant="outline">
                  <LogIn className="h-4 w-4" />
                  Login
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  )
}
