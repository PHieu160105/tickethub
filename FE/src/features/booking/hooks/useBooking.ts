import { useCallback, useState } from 'react'
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
        error: error instanceof Error ? error.message : 'Khong the giu ghe',
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
        error: error instanceof Error ? error.message : 'Khong the tra ghe',
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
        error: error instanceof Error ? error.message : 'Khong the thanh toan',
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
  const normalizedSearch = params?.search?.trim() || undefined
  const normalizedStartFrom = params?.start_from?.trim() || undefined
  const normalizedEndTo = params?.end_to?.trim() || undefined

  const fetchTickets = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const response = await bookingApi.myTickets({
        search: normalizedSearch,
        start_from: normalizedStartFrom,
        end_to: normalizedEndTo,
      })
      setState({ tickets: response, isLoading: false, error: null })
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Khong the tai danh sach ve',
      }))
    }
  }, [normalizedEndTo, normalizedSearch, normalizedStartFrom])

  return { ...state, refetch: fetchTickets }
}
