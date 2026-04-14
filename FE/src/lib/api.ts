import axios from 'axios'
import type { AxiosError } from 'axios'

import { authStorage } from './storage'
import type {
  ApiMessage,
  AdminEventUpdatePayload,
  AudienceDistribution,
  AuthResponse,
  CheckoutResponse,
  DashboardSummary,
  EventCard,
  EventDetailStats,
  EventDetail,
  LockSeatResponse,
  OccupancyItem,
  QueueJoinResponse,
  QueueStatusResponse,
  RevenuePoint,
  SeatMatrixResponse,
  TicketItem,
} from '../types'

const apiBaseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'

export const api = axios.create({
  baseURL: apiBaseURL,
  timeout: 15000,
})

type RetryableRequest<T> = () => Promise<{ data: T }>

function isRetryableError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false
  const statusCode = error.response?.status
  return !statusCode || statusCode >= 500 || error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK'
}

async function withRetry<T>(request: RetryableRequest<T>, attempts = 2): Promise<T> {
  let previousError: unknown

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await request()
      return response.data
    } catch (error) {
      previousError = error
      if (attempt >= attempts || !isRetryableError(error)) {
        break
      }
      await new Promise((resolve) => window.setTimeout(resolve, 280 * attempt))
    }
  }

  throw previousError
}

export function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback

  const typedError = error as AxiosError<{ detail?: string; message?: string }>
  const detailMessage = typedError.response?.data?.detail || typedError.response?.data?.message

  if (detailMessage) return detailMessage
  if (typedError.code === 'ECONNABORTED') return 'Request timed out. Please retry.'
  if (typedError.code === 'ERR_NETWORK') return 'Network issue detected. Please check your connection and retry.'

  return fallback
}

api.interceptors.request.use((config) => {
  const token = authStorage.getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const authApi = {
  async login(email: string, password: string) {
    return withRetry(() => api.post<AuthResponse>('/auth/login', { email, password }, { timeout: 10000 }), 2)
  },
  async register(payload: {
    full_name: string
    email: string
    password: string
    gender: 'male' | 'female' | 'other'
    age: number
  }) {
    const response = await api.post<AuthResponse>('/auth/register', payload)
    return response.data
  },
  async me() {
    return withRetry(() => api.get<AuthResponse['user']>('/auth/me', { timeout: 8000 }), 2)
  },
  async updateMe(payload: { full_name: string; gender: 'male' | 'female' | 'other'; age: number }) {
    const response = await api.patch<AuthResponse['user']>('/auth/me', payload)
    return response.data
  },
}

export const eventApi = {
  async list(params?: { search?: string; category?: string; start_from?: string; end_to?: string }) {
    return withRetry(() => api.get<EventCard[]>('/events', { params }))
  },
  async detail(eventKey: string) {
    return withRetry(() => api.get<EventDetail>(`/events/${eventKey}`))
  },
  async seats(eventKey: string) {
    return withRetry(() => api.get<SeatMatrixResponse>(`/events/${eventKey}/seats`))
  },
}

export const queueApi = {
  async join(eventKey: string) {
    const response = await api.post<QueueJoinResponse>(`/events/${eventKey}/queue/join`)
    return response.data
  },
  async status(eventKey: string, token: string) {
    return withRetry(() => api.get<QueueStatusResponse>(`/events/${eventKey}/queue/status/${token}`))
  },
  async heartbeat(eventKey: string, token: string) {
    await api.post(`/events/${eventKey}/queue/heartbeat/${token}`)
  },
}

export const bookingApi = {
  async lock(eventId: number, seatIds: number[], queueToken?: string) {
    return withRetry(
      () =>
        api.post<LockSeatResponse>('/bookings/lock', {
          event_id: eventId,
          seat_ids: seatIds,
          queue_token: queueToken,
        }),
      2,
    )
  },
  async release(eventId: number, seatIds: number[]) {
    const response = await api.post<ApiMessage>('/bookings/release', {
      event_id: eventId,
      seat_ids: seatIds,
    })
    return response.data
  },
  async checkout(eventId: number, queueToken?: string) {
    const response = await api.post<CheckoutResponse>('/bookings/checkout', {
      event_id: eventId,
      queue_token: queueToken,
    })
    return response.data
  },
  async myTickets(params?: { search?: string; start_from?: string; end_to?: string }) {
    return withRetry(() => api.get<TicketItem[]>('/bookings/my-tickets', { params }))
  },
  async cancelTicket(ticketId: number) {
    const response = await api.delete<ApiMessage>(`/bookings/my-tickets/${ticketId}`)
    return response.data
  },
}

export const adminApi = {
  async listEvents(params?: { search?: string; category?: string; start_from?: string; end_to?: string }) {
    return withRetry(() => api.get<EventCard[]>('/admin/events', { params }))
  },
  async createEvent(payload: unknown) {
    const response = await api.post<EventDetail>('/admin/events', payload)
    return response.data
  },
  async updateEvent(eventKey: string | number, payload: AdminEventUpdatePayload) {
    const response = await api.patch<EventDetail>(`/admin/events/${eventKey}`, payload)
    return response.data
  },
  async deleteEvent(eventKey: string | number) {
    const response = await api.delete<ApiMessage>(`/admin/events/${eventKey}`)
    return response.data
  },
  async eventStats(eventKey: string | number) {
    return withRetry(() => api.get<EventDetailStats>(`/admin/events/${eventKey}/stats`))
  },
  async uploadEventImage(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post<{ image_url: string }>('/admin/events/upload-image', formData)
    return response.data
  },
  async summary() {
    return withRetry(() => api.get<DashboardSummary>('/admin/dashboard/summary'))
  },
  async revenue(days = 14) {
    return withRetry(() => api.get<RevenuePoint[]>('/admin/dashboard/revenue', { params: { days } }))
  },
  async audience() {
    return withRetry(() => api.get<AudienceDistribution>('/admin/dashboard/audience'))
  },
  async occupancy() {
    return withRetry(() => api.get<OccupancyItem[]>('/admin/dashboard/occupancy'))
  },
}
