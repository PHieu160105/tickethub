/**
 * Custom hook for booking operations
 */

import { useState, useCallback } from 'react'
import type { TicketItem } from '../../../types'
import { bookingApi } from '../api/bookingApi'

interface UseBookingState {
  isLoading: boolean
  error: string | null
}

export function useLockSeats() {
  const [state, setState] = useState<UseBookingState>({
    isLoading: false,
    error: null,
  })

  const lockSeats = useCallback(async (showId: number, seatIds: number[], queueToken?: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const response = await bookingApi.lock({ show_id: showId, seat_ids: seatIds, queue_token: queueToken })
      setState({ isLoading: false, error: null })
      return response
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to lock seats',
      }))
      throw error
    }
  }, [])

  return { ...state, lockSeats }
}

export function useReleaseSeats() {
  const [state, setState] = useState<UseBookingState>({
    isLoading: false,
    error: null,
  })

  const releaseSeats = useCallback(async (showId: number, seatIds: number[]) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const response = await bookingApi.release({ show_id: showId, seat_ids: seatIds })
      setState({ isLoading: false, error: null })
      return response.detail
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to release seats',
      }))
      throw error
    }
  }, [])

  return { ...state, releaseSeats }
}

export function useCheckout() {
  const [state, setState] = useState<UseBookingState>({
    isLoading: false,
    error: null,
  })

  const checkout = useCallback(async (showId: number, queueToken?: string, discountCode?: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const response = await bookingApi.checkout({ show_id: showId, queue_token: queueToken, discount_code: discountCode })
      setState({ isLoading: false, error: null })
      return response
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to checkout',
      }))
      throw error
    }
  }, [])

  return { ...state, checkout }
}

interface UseMyTicketsState extends UseBookingState {
  tickets: TicketItem[]
}

export function useMyTickets(params?: { search?: string; start_from?: string; end_to?: string }) {
  const [state, setState] = useState<UseMyTicketsState>({
    tickets: [],
    isLoading: false,
    error: null,
  })

  const fetchTickets = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const response = await bookingApi.myTickets(params)
      setState({ tickets: response, isLoading: false, error: null })
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch tickets',
      }))
    }
  }, [params?.search, params?.start_from, params?.end_to])

  return { ...state, refetch: fetchTickets }
}

export function useCancelTicket() {
  const [state, setState] = useState<UseBookingState>({
    isLoading: false,
    error: null,
  })

  const cancelTicket = useCallback(async (ticketId: number) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const response = await bookingApi.cancelTicket(ticketId)
      setState({ isLoading: false, error: null })
      return response
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to cancel ticket',
      }))
      throw error
    }
  }, [])

  return { ...state, cancelTicket }
}
