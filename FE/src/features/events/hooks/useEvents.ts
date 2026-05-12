/**
 * Custom hook for events data fetching
 */

import { useState, useEffect, useCallback, useRef } from 'react'
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

  const fetchEvents = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const events = await eventsApi.list(params)
      setState({ events, isLoading: false, error: null })
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch events',
      }))
    }
  }, [params?.search, params?.category])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

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
        error: error instanceof Error ? error.message : 'Failed to fetch event details',
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
}

export function useShowSeats(showId?: number, options?: { pollIntervalMs?: number }) {
  const [state, setState] = useState<UseShowSeatsState>({
    seats: null,
    isLoading: false,
    error: null,
  })
  const hasLoadedRef = useRef(false)
  const pollIntervalMs = options?.pollIntervalMs ?? 0

  const fetchSeats = useCallback(async (showLoading = true) => {
    if (!showId) return

    if (showLoading) {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))
    }
    try {
      const seats = await eventsApi.seats(showId)
      hasLoadedRef.current = true
      setState({ seats, isLoading: false, error: null })
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: hasLoadedRef.current ? prev.error : error instanceof Error ? error.message : 'Failed to fetch seats',
      }))
    }
  }, [showId])

  useEffect(() => {
    hasLoadedRef.current = false
    void fetchSeats(true)
  }, [fetchSeats])

  useEffect(() => {
    if (!showId || pollIntervalMs <= 0) return

    const intervalId = window.setInterval(() => {
      void fetchSeats(false)
    }, pollIntervalMs)

    return () => window.clearInterval(intervalId)
  }, [showId, fetchSeats, pollIntervalMs])

  return { ...state, refetch: fetchSeats }
}
