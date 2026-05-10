export type UserRole = 'customer' | 'admin'
export type Gender = 'male' | 'female' | 'other'
export type EventStatus = 'draft' | 'live' | 'closed'
export type SeatStatus = 'available' | 'locked' | 'sold'
export type QueueStatus = 'waiting' | 'admitted' | 'expired' | 'completed'

export interface User {
  id: number
  full_name: string
  email: string
  role: UserRole
  gender: Gender
  age: number
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export interface EventCard {
  id: number
  slug: string
  title: string
  description: string
  category: string
  venue: string
  start_at: string
  end_at: string
  cover_image_url: string
  status: EventStatus
  created_at: string
  queue_enabled: boolean
  venue_id?: number | null
  venue_layout_id?: number | null
}

export interface VenueSummary {
  id: number
  name: string
  city: string | null
  venue_type: string
  capacity: number | null
  is_active: boolean
  created_at: string
}

export interface VenueDetail extends VenueSummary {
  address: string | null
  width: number
  height: number
  background_source: string | null
  background_processed: string | null
  background_type: 'svg' | 'raster' | 'unknown' | null
  can_parse_background: boolean
  svg_source: string | null
  svg_processed: string | null
  created_by_user_id: number
  updated_at: string
}

export interface VenueLayoutItem {
  id: number
  venue_id: number
  name: string
  description: string | null
  svg_data: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface VenueSectionItem {
  id: number
  venue_layout_id: number
  name: string
  code: string
  color: string
  price_base: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface VenueSeatItem {
  id: number
  venue_layout_id: number | null
  section_id: number | null
  section_name: string | null
  label: string
  x: number | null
  y: number | null
  rotation: number
  is_admin_locked: boolean
}

export interface VenuePolygonPoint {
  x: number
  y: number
}

export interface VenuePolygonItem {
  id: number
  venue_id: number
  venue_layout_id: number
  section_id: number | null
  section_name: string | null
  label: string | null
  points: VenuePolygonPoint[]
  created_at: string
  updated_at: string
}

export interface SeatZone {
  id: number
  code: string
  name: string
  row_count: number
  seats_per_row: number
  price: number
  color: string
}

export interface EventDetail extends EventCard {
  hold_minutes: number
  queue_release_batch: number
  max_active_queue_tokens: number
  zones: SeatZone[]
}

export interface Seat {
  id: number
  zone_id: number
  row_index: number
  row_label: string
  seat_number: number
  seat_label: string
  price: number
  status: SeatStatus
  lock_expires_at: string | null
  is_locked_by_me: boolean
  is_admin_locked: boolean
  locked_by_user?: SeatUserInfo | null
  sold_to_user?: SeatPurchaseInfo | null
}

export interface SeatUserInfo {
  user_id: number
  full_name: string
  email: string
  gender: Gender
  age: number
}

export interface SeatPurchaseInfo {
  user: SeatUserInfo
  order_id: number
  ticket_code: string | null
  issued_at: string | null
}

export interface SeatMatrixResponse {
  event_id: number
  event_slug: string
  queue_enabled: boolean
  zones: SeatZone[]
  seats: Seat[]
}

export interface SeatMapSection {
  id: number
  name: string
  code: string
  color: string
  price_base: number
}

export interface SeatMapBackground {
  source: string | null
  type: 'svg' | 'raster' | 'unknown' | null
  width: number | null
  height: number | null
}

export interface SeatMapPolygonPoint {
  x: number
  y: number
}

export interface SeatMapPolygon {
  id: number
  section_id: number | null
  section_name: string | null
  label: string | null
  points: SeatMapPolygonPoint[]
}

export interface SeatMapSeat {
  id: number
  label: string
  x: number | null
  y: number | null
  rotation: number
  section_id: number | null
  section_name: string | null
  price: number
  status: SeatStatus
  lock_expires_at: string | null
  is_locked_by_me: boolean
  is_admin_locked: boolean
}

export interface SeatMapResponse {
  event_id: number
  event_slug: string
  event_title: string
  venue_name: string
  queue_enabled: boolean
  background: SeatMapBackground | null
  sections: SeatMapSection[]
  polygons: SeatMapPolygon[]
  seats: SeatMapSeat[]
  seat_count: number
}

export interface EventReview {
  id: number
  event_id: number
  user_id: number
  reviewer_name: string
  rating: number
  content: string
  image_url: string | null
  created_at: string
}

export interface EventReviewCreatePayload {
  rating: number
  content: string
  image_url?: string | null
}

export interface QueueJoinResponse {
  token: string
  status: QueueStatus
  position: number
  message: string
  admitted_until: string | null
}

export interface QueueStatusResponse {
  token: string
  status: QueueStatus
  position?: number | null
  admitted_until?: string | null
  message: string
}

export interface LockSeatResponse {
  locked_seat_ids: number[]
  failed_seat_ids: number[]
  message: string
}

export interface CheckoutItem {
  seat_id: number
  seat_label: string
  zone_name: string
  price: number
  ticket_code: string
  qr_payload: string
}

export interface CheckoutResponse {
  order_id: number
  order_status: 'pending' | 'paid' | 'cancelled'
  total_amount: number
  discount_amount?: number
  discount_code?: string | null
  paid_at: string
  items: CheckoutItem[]
}

export interface TicketItem {
  ticket_id?: number
  cancellation_id?: number
  ticket_code: string
  qr_payload?: string
  event_id: number
  event_slug: string
  event_title: string
  event_date: string
  event_cover_image_url: string
  venue: string
  seat_label: string
  zone_name: string
  price: number
  order_id?: number
  seat_status: SeatStatus
  ticket_status: 'active' | 'cancelled'
  issued_at?: string
  canceled_at?: string
}

export interface DashboardSummary {
  total_revenue: number
  tickets_sold: number
  cancelled_tickets: number
  active_events: number
  waiting_queue_users: number
}

export interface RevenuePoint {
  date: string
  revenue: number
}

export interface AudienceDistribution {
  age_groups: Record<string, number>
  gender_groups: Record<string, number>
}

export interface OccupancyItem {
  event_id: number
  event_title: string
  total_seats: number
  sold_seats: number
  locked_seats: number
  occupancy_rate: number
}

export interface AdminEventUpdatePayload {
  title?: string
  description?: string
  category?: string
  venue?: string
  start_at?: string
  end_at?: string
  cover_image_url?: string
  status?: EventStatus
  hold_minutes?: number
  queue_enabled?: boolean
  queue_release_batch?: number
  max_active_queue_tokens?: number
}

export interface EventZoneStats {
  zone_id: number
  zone_code: string
  zone_name: string
  color: string
  total_seats: number
  sold_seats: number
  locked_seats: number
  available_seats: number
  occupancy_rate: number
  min_price: number
  max_price: number
}

export interface EventDetailStats {
  event_id: number
  event_title: string
  total_seats: number
  sold_seats: number
  locked_seats: number
  available_seats: number
  occupancy_rate: number
  tickets_issued: number
  canceled_tickets: number
  total_revenue: number
  zone_stats: EventZoneStats[]
}

export interface ApiMessage {
  detail: string
}

export interface HelpThread {
  id: number
  customer_id: number
  customer_name: string
  customer_email: string
  last_message_at: string
  last_message_preview: string
  status: string
  unread_admin: number
  unread_customer: number
  created_at: string
  updated_at: string
}

export interface HelpMessage {
  id: number
  thread_id: number
  sender_id: number
  sender_role: string
  content: string
  message_type: string
  read_at: string | null
  created_at: string
}

export interface SearchSuggestionItem {
  label: string
  value: string
  item_type: string
  meta: Record<string, string | number | null>
}

export interface AdminUserItem {
  id: number
  full_name: string
  email: string
  role: string
  gender: string
  age: number
  total_tickets: number
  registered_at: string
}

export interface AdminTicketSaleItem {
  id: number
  event_title: string
  customer_name: string
  seat_label: string
  zone_name: string
  price: number
  purchased_at: string
  order_status: string
}

export interface AdminEventRevenueItem {
  event_id: number
  event_title: string
  tickets_sold: number
  revenue: number
}

export interface PaginatedAdminUsersResponse {
  items: AdminUserItem[]
  total: number
  limit: number
  offset: number
}

export interface PaginatedAdminTicketSalesResponse {
  items: AdminTicketSaleItem[]
  total: number
  limit: number
  offset: number
}
