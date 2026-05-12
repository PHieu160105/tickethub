/**
 * API Configuration Constants
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'

export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? 'ws://localhost:8000/ws'

export const API_TIMEOUT = 15000

export const API_RETRY_ATTEMPTS = 2

export const API_RETRY_DELAY = 280

/**
 * Pagination Constants
 */
export const PAGINATION = {
  DEFAULT_LIMIT: 30,
  MIN_LIMIT: 1,
  MAX_LIMIT: 100,
  DEFAULT_OFFSET: 0,
} as const

/**
 * Queue Constants
 */
export const QUEUE = {
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
  STATUS_POLL_INTERVAL: 5000, // 5 seconds
} as const

/**
 * Booking Constants
 */
export const BOOKING = {
  LOCK_DURATION_MINUTES: 10,
  CHECKOUT_TIMEOUT: 10000,
} as const

/**
 * Auth Constants
 */
export const AUTH = {
  TOKEN_KEY: 'ticketrush_token',
  USER_KEY: 'ticketrush_user',
  STORAGE_PREFIX: 'ticketrush_',
} as const

/**
 * API Endpoints
 */
export const ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    ME: '/auth/me',
    UPDATE_ME: '/auth/me',
  },
  // Event endpoints
  EVENTS: {
    LIST: '/events',
    DETAIL: (eventKey: string) => `/events/${eventKey}`,
    SEATS: (showId: string | number) => `/shows/${showId}/seats`,
  },
  // Queue endpoints
  QUEUE: {
    JOIN: (showId: string | number) => `/shows/${showId}/queue/join`,
    STATUS: (showId: string | number, token: string) => `/shows/${showId}/queue/status/${token}`,
    HEARTBEAT: (showId: string | number, token: string) => `/shows/${showId}/queue/heartbeat/${token}`,
  },
  // Booking endpoints
  BOOKINGS: {
    LOCK: '/bookings/lock',
    RELEASE: '/bookings/release',
    CHECKOUT: '/bookings/checkout',
    MY_TICKETS: '/bookings/my-tickets',
    CANCEL_TICKET: (ticketId: number) => `/bookings/my-tickets/${ticketId}`,
  },
  // Admin endpoints
  ADMIN: {
    EVENTS: '/admin/events',
    EVENT_DETAIL: (eventKey: string | number) => `/admin/events/${eventKey}`,
    EVENT_STATS: (eventKey: string | number) => `/admin/events/${eventKey}/stats`,
    UPLOAD_IMAGE: '/admin/events/upload-image',
    DASHBOARD_SUMMARY: '/admin/dashboard/summary',
    DASHBOARD_REVENUE: '/admin/dashboard/revenue',
    DASHBOARD_AUDIENCE: '/admin/dashboard/audience',
    DASHBOARD_OCCUPANCY: '/admin/dashboard/occupancy',
  },
} as const
