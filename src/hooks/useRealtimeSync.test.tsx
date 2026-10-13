import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useRealtimeSync } from "./useRealtimeSync"
import { RealtimeSyncProvider } from "@/components/realtime/RealtimeSyncProvider"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import { supabase } from "@/lib/supabase"
import * as AuthHook from "@/components/auth/useAuth"

vi.mock("@/lib/supabase", () => {
  const listeners: Record<string, Function> = {}
  let subscribeCallback: Function | null = null

  const mockChannel = {
    on: vi.fn((_type: string, filter: any, callback: Function) => {
      listeners[filter.table] = callback
      return mockChannel
    }),
    subscribe: vi.fn((cb: Function) => {
      subscribeCallback = cb
      // Immediately invoke with SUBSCRIBED
      cb("SUBSCRIBED")
      return mockChannel
    }),
  }

  return {
    supabase: {
      channel: vi.fn(() => mockChannel),
      removeChannel: vi.fn(),
      _triggerTableEvent: (table: string, payload: any) => {
        if (listeners[table]) listeners[table](payload)
      },
      _triggerStatus: (status: string) => {
        if (subscribeCallback) subscribeCallback(status)
      },
    },
  }
})

describe("useRealtimeSync hook", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    queryClient = new QueryClient()
    vi.spyOn(AuthHook, "useAuth").mockReturnValue({
      user: { id: "test-user-id", email: "admin@7time.test" } as any,
      session: null,
      loading: false,
      signOut: vi.fn(),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <RealtimeSyncProvider>{children}</RealtimeSyncProvider>
    </QueryClientProvider>
  )

  it("subscribes to core business tables and reports connected status", () => {
    const { result } = renderHook(() => useRealtimeSync(), { wrapper })

    expect(supabase.channel).toHaveBeenCalledWith("realtime-7time-core-sync")
    expect(result.current.isConnected).toBe(true)
  })

  it("debounces query invalidation when table change events fire", async () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(() => useRealtimeSync(), { wrapper })

    expect(result.current.isConnected).toBe(true)

    // Trigger purchase event
    act(() => {
      ;(supabase as any)._triggerTableEvent("purchases", { eventType: "INSERT" })
    })

    // Before debounce timer fires (450ms)
    expect(invalidateSpy).not.toHaveBeenCalled()

    // Advance timers past debounce duration
    act(() => {
      vi.advanceTimersByTime(500)
    })

    // Should invalidate core purchase query keys including dashboardStats
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["purchases"] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["dashboardStats"] })
  })

  it("unsubscribes and cleans up channel on unmount", () => {
    const { unmount } = renderHook(() => useRealtimeSync(), { wrapper })

    unmount()

    expect(supabase.removeChannel).toHaveBeenCalled()
  })

  it("handles offline or disconnect status changes safely", () => {
    const { result } = renderHook(() => useRealtimeSync(), { wrapper })

    expect(result.current.isConnected).toBe(true)

    act(() => {
      ;(supabase as any)._triggerStatus("CHANNEL_ERROR")
    })

    expect(result.current.isConnected).toBe(false)
  })
})
