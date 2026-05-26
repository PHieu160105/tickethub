import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import type { EventCard, EventDetail, SeatMatrixResponse } from '../../../types'
import { eventsApi } from '../api/eventsApi'

interface UseEventsState {
  events: EventCard[]
  isLoading: boolean
  error: string | null
}

export function useEvents(params?: { search?: string; category?: string }) {
  const [state, setState] = useState<UseEventsState>({
    events: [],
    isLoading: false,
    error: null,
  })
  const normalizedSearch = params?.search?.trim() || undefined
  const normalizedCategory = params?.category?.trim() || undefined
  const autoRequestKeyRef = useRef<string | null>(null)

  const fetchEvents = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const events = await eventsApi.list({
        search: normalizedSearch,
        category: normalizedCategory,
      })
      setState({ events, isLoading: false, error: null })
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Không tải được danh sách sự kiện',
      }))
    }
  }, [normalizedCategory, normalizedSearch])

  useEffect(() => {
    const nextRequestKey = JSON.stringify({
      search: normalizedSearch ?? null,
      category: normalizedCategory ?? null,
    })

    if (autoRequestKeyRef.current === nextRequestKey) {
      return
    }

    autoRequestKeyRef.current = nextRequestKey
    void fetchEvents()
  }, [fetchEvents, normalizedCategory, normalizedSearch])

  return { ...state, refetch: fetchEvents }
}

interface UseEventDetailState {
  event: EventDetail | null
  isLoading: boolean
  error: string | null
}

export function useEventDetail(eventKey?: string) {
  const [state, setState] = useState<UseEventDetailState>({
    event: null,
    isLoading: false,
    error: null,
  })

  const fetchEvent = useCallback(async () => {
    if (!eventKey) return

    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const event = await eventsApi.detail(eventKey)
      setState({ event, isLoading: false, error: null })
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Không tải được chi tiết sự kiện',
      }))
    }
  }, [eventKey])

  useEffect(() => {
    fetchEvent()
  }, [fetchEvent])

  return { ...state, refetch: fetchEvent }
}

interface UseShowSeatsState {
  seats: SeatMatrixResponse | null
  isLoading: boolean
  error: string | null
  rawError: unknown | null
}

export function useShowSeats(showId?: number, options?: { pollIntervalMs?: number; queueToken?: string | null; enabled?: boolean }) {
  const [state, setState] = useState<UseShowSeatsState>({
    seats: null,
    isLoading: false,
    error: null,
    rawError: null,
  })
  const hasLoadedRef = useRef(false)
  const pollIntervalMs = options?.pollIntervalMs ?? 0
  const enabled = options?.enabled ?? true
  const queueToken = options?.queueToken ?? undefined

  const fetchSeats = useCallback(async (showLoading = true) => {
    if (!showId || !enabled) return

    if (showLoading) {
      setState((prev) => ({ ...prev, isLoading: true, error: null, rawError: null }))
    }
    try {
      const seats = await eventsApi.seats(showId, queueToken ?? undefined)
      hasLoadedRef.current = true
      setState({ seats, isLoading: false, error: null, rawError: null })
    } catch (error) {
      const statusCode = axios.isAxiosError(error) ? error.response?.status : null
      setState((prev) => ({
        ...prev,
        isLoading: false,
        rawError: error,
        error: !hasLoadedRef.current || statusCode === 404 || statusCode === 410
          ? error instanceof Error ? error.message : 'Không tải được sơ đồ ghế'
          : prev.error,
      }))
    }
  }, [enabled, queueToken, showId])

  useEffect(() => {
    hasLoadedRef.current = false
    if (enabled) {
      void fetchSeats(true)
    }
  }, [enabled, fetchSeats])

  useEffect(() => {
    if (!showId || !enabled || pollIntervalMs <= 0) return

    const intervalId = window.setInterval(() => {
      void fetchSeats(false)
    }, pollIntervalMs)

    return () => window.clearInterval(intervalId)
  }, [enabled, showId, fetchSeats, pollIntervalMs])

  return { ...state, refetch: fetchSeats }
}
