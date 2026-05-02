import axios from 'axios'
import type { AxiosError } from 'axios'

import { API_BASE_URL, API_TIMEOUT, API_RETRY_ATTEMPTS, API_RETRY_DELAY } from '../constants'
import { authStorage } from './storage'
import type {
  ApiMessage,
  AdminEventUpdatePayload,
  AdminEventRevenueItem,
  AudienceDistribution,
  AuthResponse,
  CheckoutResponse,
  DashboardSummary,
  EventCard,
  EventDetailStats,
  EventDetail,
  LockSeatResponse,
  OccupancyItem,
  GamePlayRequest,
  GamePlayResponse,
  GameSignedPayload,
  GameStatusResponse,
  MyDiscount,
  AdminGameConfig,
  AdminPrizePool,
  AdminGameMonitor,
  PaginatedAdminTicketSalesResponse,
  PaginatedAdminUsersResponse,
  QueueJoinResponse,
  QueueStatusResponse,
  RevenuePoint,
  SeatMatrixResponse,
  TicketItem,
  VenuePolygonItem,
  VenueDetail,
  VenueLayoutItem,
  VenueSeatItem,
  VenueSectionItem,
  VenueSummary,
  SeatMapResponse,
  SeatZone,
  HelpMessage,
  HelpThread,
  SearchSuggestionItem,
} from '../types'

const apiBaseURL = API_BASE_URL

export const api = axios.create({
  baseURL: apiBaseURL,
  timeout: API_TIMEOUT,
})

type RetryableRequest<T> = () => Promise<{ data: T }>

function isRetryableError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false
  const statusCode = error.response?.status
  return !statusCode || statusCode >= 500 || error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK'
}

async function withRetry<T>(request: RetryableRequest<T>, attempts = API_RETRY_ATTEMPTS): Promise<T> {
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
      await new Promise((resolve) => window.setTimeout(resolve, API_RETRY_DELAY * attempt))
    }
  }

  throw previousError
}

export { withRetry }

export function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback

  const typedError = error as AxiosError<{ detail?: string; message?: string }>
  const detailMessage = typedError.response?.data?.detail || typedError.response?.data?.message

  if (detailMessage) return detailMessage
  if (typedError.code === 'ECONNABORTED') return 'Request timed out. Please retry.'
  if (typedError.code === 'ERR_NETWORK') return 'Network issue detected. Please check your connection and retry.'

  return fallback
}

api.interceptors.request.use((config: any) => {
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

export const seatmapApi = {
  async get(eventKey: string) {
    return withRetry(() => api.get<SeatMapResponse>(`/events/${eventKey}/seatmap`))
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
  async checkoutWithDiscount(eventId: number, queueToken: string | undefined, discountCode: string | undefined) {
    const response = await api.post<CheckoutResponse>('/bookings/checkout', {
      event_id: eventId,
      queue_token: queueToken,
      discount_code: discountCode,
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

export const gameApi = {
  async play(payload: GamePlayRequest) {
    const response = await api.post<GamePlayResponse>('/game/play', payload)
    return response.data
  },
  async sign(eventId: number, gameType: 'wheel' | 'scratch') {
    return withRetry(() => api.get<GameSignedPayload>('/game/sign', { params: { event_id: eventId, game_type: gameType } }))
  },
  async status(eventId: number) {
    return withRetry(() => api.get<GameStatusResponse>('/game/status', { params: { event_id: eventId } }))
  },
  async myDiscounts() {
    return withRetry(() => api.get<MyDiscount[]>('/discounts/me'))
  },
}

export const adminApi = {
  async listEvents(params?: { search?: string; category?: string; start_from?: string; end_to?: string }) {
    return withRetry(() => api.get<EventCard[]>('/admin/events', { params }))
  },
  async getEvent(eventKey: string | number) {
    return withRetry(() => api.get<EventDetail>(`/admin/events/${eventKey}`))
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
  async users(params?: { search?: string; role?: string; limit?: number; offset?: number }) {
    return withRetry(() => api.get<PaginatedAdminUsersResponse>('/admin/users', { params }))
  },
  async ticketSales(params?: { event_id?: number; status_filter?: string; limit?: number; offset?: number }) {
    return withRetry(() => api.get<PaginatedAdminTicketSalesResponse>('/admin/tickets/sales', { params }))
  },
  async revenueByEvent() {
    return withRetry(() => api.get<AdminEventRevenueItem[]>('/admin/tickets/revenue-by-event'))
  },
  async listVenues(params?: { search?: string; limit?: number; offset?: number }) {
    return withRetry(() => api.get<VenueSummary[]>('/admin/venues', { params }))
  },
  async getVenue(venueId: number) {
    return withRetry(() => api.get<VenueDetail>(`/admin/venues/${venueId}`))
  },
  async createVenue(payload: {
    name: string
    address?: string | null
    city?: string | null
    venue_type?: string
    capacity?: number | null
    width?: number
    height?: number
  }) {
    const response = await api.post<VenueDetail>('/admin/venues', payload)
    return response.data
  },
  async updateVenue(
    venueId: number,
    payload: Partial<{
      name: string
      address: string | null
      city: string | null
      venue_type: string
      capacity: number | null
      width: number
      height: number
      is_active: boolean
    }>,
  ) {
    const response = await api.patch<VenueDetail>(`/admin/venues/${venueId}`, payload)
    return response.data
  },
  async deleteVenue(venueId: number) {
    const response = await api.delete(`/admin/venues/${venueId}`)
    return response.data
  },
  async uploadVenueBackground(venueId: number, file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post<{ detail: string; venue_id: number; background_type: string; content_type: string }>(
      `/admin/venues/${venueId}/upload-background`,
      formData,
    )
    return response.data
  },
  async uploadVenueSvg(venueId: number, file: File) {
    return this.uploadVenueBackground(venueId, file)
  },
  async processVenueSvg(venueId: number) {
    const response = await api.post<{ venue_id: number; seat_count: number; sections_detected: number; width: number; height: number; seats: unknown[]; sections: unknown[] }>(`/admin/venues/${venueId}/process`)
    return response.data
  },
  async listLayouts(venueId: number) {
    return withRetry(() => api.get<VenueLayoutItem[]>(`/admin/venues/${venueId}/layouts`))
  },
  async createLayout(
    venueId: number,
    payload: { name: string; description?: string | null; svg_data?: string | null; sort_order?: number },
  ) {
    const response = await api.post<VenueLayoutItem>(`/admin/venues/${venueId}/layouts`, payload)
    return response.data
  },
  async updateLayout(
    layoutId: number,
    payload: { name?: string; description?: string | null; svg_data?: string | null; sort_order?: number },
  ) {
    const response = await api.patch<VenueLayoutItem>(`/admin/layouts/${layoutId}`, payload)
    return response.data
  },
  async deleteLayout(layoutId: number) {
    const response = await api.delete(`/admin/layouts/${layoutId}`)
    return response.data
  },
  async listLayoutSections(layoutId: number) {
    return withRetry(() => api.get<VenueSectionItem[]>(`/admin/layouts/${layoutId}/sections`))
  },
  async createLayoutSection(
    layoutId: number,
    payload: { name: string; code: string; color?: string; price_base: number; sort_order?: number },
  ) {
    const response = await api.post<VenueSectionItem>(`/admin/layouts/${layoutId}/sections`, payload)
    return response.data
  },
  async updateSection(
    sectionId: number,
    payload: Partial<{ name: string; code: string; color: string; price_base: number; sort_order: number }>,
  ) {
    const response = await api.patch<VenueSectionItem>(`/admin/sections/${sectionId}`, payload)
    return response.data
  },
  async deleteSection(sectionId: number) {
    const response = await api.delete(`/admin/sections/${sectionId}`)
    return response.data
  },
  async listVenueSeats(venueId: number, layoutId?: number | null) {
    return withRetry(() =>
      api.get<VenueSeatItem[]>(`/admin/venues/${venueId}/seats`, {
        params: { layout_id: layoutId ?? undefined },
      }),
    )
  },
  async createVenueSeatSingle(
    venueId: number,
    payload: { layout_id?: number | null; label: string; x: number; y: number; rotation?: number; section_id?: number | null; is_admin_locked?: boolean },
  ) {
    const response = await api.post<VenueSeatItem>(`/admin/venues/${venueId}/seats/single`, payload)
    return response.data
  },
  async createVenueSeatBulk(
    venueId: number,
    payload: {
      layout_id?: number | null
      section_id?: number | null
      pattern: 'straight' | 'arc' | 'zigzag'
      rows: number
      cols: number
      gap_x: number
      gap_y: number
      start_x: number
      start_y: number
      label_prefix: string
      arc_config?: { center_x: number; center_y: number; radius: number; start_angle: number; end_angle: number } | null
    },
  ) {
    const response = await api.post<{ created_count: number; seats: VenueSeatItem[] }>(`/admin/venues/${venueId}/seats/bulk`, payload)
    return response.data
  },
  async updateVenueSeat(
    seatId: number,
    payload: Partial<{ label: string; x: number; y: number; rotation: number; section_id: number | null; is_admin_locked: boolean }>,
  ) {
    const response = await api.patch<VenueSeatItem>(`/admin/seats/${seatId}`, payload)
    return response.data
  },
  async deleteVenueSeat(seatId: number) {
    const response = await api.delete<ApiMessage>(`/admin/seats/${seatId}`)
    return response.data
  },
  async listVenuePolygons(venueId: number, layoutId?: number | null) {
    return withRetry(() =>
      api.get<VenuePolygonItem[]>(`/admin/venues/${venueId}/polygons`, {
        params: { layout_id: layoutId ?? undefined },
      }),
    )
  },
  async createVenuePolygon(
    venueId: number,
    payload: { layout_id?: number | null; section_id?: number | null; label?: string | null; points: Array<{ x: number; y: number }> },
  ) {
    const response = await api.post<VenuePolygonItem>(`/admin/venues/${venueId}/polygons`, payload)
    return response.data
  },
  async updateVenuePolygon(
    polygonId: number,
    payload: Partial<{ section_id: number | null; label: string | null; points: Array<{ x: number; y: number }> }>,
  ) {
    const response = await api.patch<VenuePolygonItem>(`/admin/polygons/${polygonId}`, payload)
    return response.data
  },
  async deleteVenuePolygon(polygonId: number) {
    const response = await api.delete<ApiMessage>(`/admin/polygons/${polygonId}`)
    return response.data
  },
  async gameConfigs(eventKey: string | number) {
    return withRetry(() => api.get<AdminGameConfig[]>(`/admin/games/${eventKey}/configs`))
  },
  async upsertGameConfig(
    eventKey: string | number,
    payload: { game_type: 'wheel' | 'scratch'; is_active: boolean; daily_reset_cron: string; max_plays_per_user_per_day: number },
  ) {
    const response = await api.put<AdminGameConfig>(`/admin/games/${eventKey}/configs`, payload)
    return response.data
  },
  async gamePools(eventKey: string | number) {
    return withRetry(() => api.get<AdminPrizePool[]>(`/admin/games/${eventKey}/pools`))
  },
  async createGamePool(eventKey: string | number, payload: { tier_name: string; discount_percent: number; initial_qty: number; weight: number }) {
    const response = await api.post<AdminPrizePool>(`/admin/games/${eventKey}/pools`, payload)
    return response.data
  },
  async updateGamePool(
    poolId: number,
    payload: { tier_name: string; discount_percent: number; initial_qty: number; remaining_qty: number; weight: number },
  ) {
    const response = await api.patch<AdminPrizePool>(`/admin/games/pools/${poolId}`, payload)
    return response.data
  },
  async deleteGamePool(poolId: number) {
    const response = await api.delete<ApiMessage>(`/admin/games/pools/${poolId}`)
    return response.data
  },
  async gameMonitor() {
    return withRetry(() => api.get<AdminGameMonitor>('/admin/games/monitor'))
  },
  async gameReset() {
    const response = await api.post<ApiMessage>('/admin/games/reset')
    return response.data
  },
  async gameRefill(eventKey: string | number) {
    const response = await api.post<ApiMessage>(`/admin/games/refill/${eventKey}`)
    return response.data
  },
  async getZones(eventKey: string | number) {
    return withRetry(() => api.get<SeatZone[]>(`/admin/events/${eventKey}/zones`))
  },
  async createZone(eventKey: string | number, payload: Omit<SeatZone, 'id'>) {
    const response = await api.post<SeatZone>(`/admin/events/${eventKey}/zones`, payload)
    return response.data
  },
  async updateZone(eventKey: string | number, zoneId: number, payload: Omit<SeatZone, 'id'>) {
    const response = await api.patch<SeatZone>(`/admin/events/${eventKey}/zones/${zoneId}`, payload)
    return response.data
  },
  async deleteZone(eventKey: string | number, zoneId: number) {
    const response = await api.delete(`/admin/events/${eventKey}/zones/${zoneId}`)
    return response.data
  },
  async createEventSeatSingle(
    eventKey: string | number,
    payload: { seat_label: string; x: number; y: number; rotation?: number; zone_id?: number | null; section_id?: number | null; price?: number | null; is_admin_locked?: boolean },
  ) {
    const response = await api.post(`/admin/events/${eventKey}/seats/single`, payload)
    return response.data
  },
  async createEventSeatBulk(
    eventKey: string | number,
    payload: {
      zone_id?: number | null
      section_id?: number | null
      pattern: 'straight' | 'arc'
      rows: number
      cols: number
      gap_x: number
      gap_y: number
      start_x: number
      start_y: number
      label_prefix: string
      arc_config?: { center_x: number; center_y: number; radius: number; start_angle: number; end_angle: number } | null
    },
  ) {
    const response = await api.post(`/admin/events/${eventKey}/seats/bulk`, payload)
    return response.data
  },
  async updateEventSeat(
    eventKey: string | number,
    seatId: number,
    payload: Partial<{ seat_label: string; x: number; y: number; rotation: number; zone_id: number | null; section_id: number | null; price: number | null; is_admin_locked: boolean }>,
  ) {
    const response = await api.patch(`/admin/events/${eventKey}/seats/${seatId}`, payload)
    return response.data
  },
  async deleteEventSeat(eventKey: string | number, seatId: number) {
    const response = await api.delete<ApiMessage>(`/admin/events/${eventKey}/seats/${seatId}`)
    return response.data
  },
}

export const helpApi = {
  async createOrGetMyThread() {
    return withRetry(() => api.post<HelpThread>('/help/threads/me'))
  },
  async myMessages() {
    return withRetry(() => api.get<HelpMessage[]>('/help/threads/me/messages'))
  },
  async sendMyMessage(content: string) {
    const response = await api.post<HelpMessage>('/help/threads/me/messages', { content })
    return response.data
  },
  async adminThreads() {
    return withRetry(() => api.get<HelpThread[]>('/help/admin/threads'))
  },
  async adminMessages(threadId: number) {
    return withRetry(() => api.get<HelpMessage[]>(`/help/admin/threads/${threadId}/messages`))
  },
  async adminSendMessage(threadId: number, content: string) {
    const response = await api.post<HelpMessage>(`/help/admin/threads/${threadId}/messages`, { content })
    return response.data
  },
}

export const searchApi = {
  async suggest(q: string, scope = 'global') {
    return withRetry(() => api.get<SearchSuggestionItem[]>('/search/suggest', { params: { q, scope } }))
  },
}
