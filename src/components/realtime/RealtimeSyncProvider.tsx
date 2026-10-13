import { useEffect, useState, useRef, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth/useAuth"
import { RealtimeSyncContext } from "./RealtimeSyncContext"

/**
 * RealtimeSyncProvider
 * Manages a single authoritative channel for Supabase Realtime synchronization.
 * Prevents duplicate channel subscriptions across route transitions.
 */
export function RealtimeSyncProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [isConnected, setIsConnected] = useState(false)
  const [lastEventTime, setLastEventTime] = useState<Date | null>(null)

  const pendingKeysRef = useRef<Set<string>>(new Set())
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleInvalidation = useCallback((keys: string[]) => {
    keys.forEach(k => pendingKeysRef.current.add(k))
    setLastEventTime(new Date())

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      const keysToInvalidate = Array.from(pendingKeysRef.current)
      pendingKeysRef.current.clear()

      keysToInvalidate.forEach(key => {
        queryClient.invalidateQueries({ queryKey: [key] })
      })
    }, 450)
  }, [queryClient])

  const refetchAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
    queryClient.invalidateQueries({ queryKey: ["dealers"] })
    queryClient.invalidateQueries({ queryKey: ["purchases"] })
    queryClient.invalidateQueries({ queryKey: ["dealerPayments"] })
    queryClient.invalidateQueries({ queryKey: ["wholesaleSales"] })
    queryClient.invalidateQueries({ queryKey: ["resellers"] })
    queryClient.invalidateQueries({ queryKey: ["generalDailyRecords"] })
    queryClient.invalidateQueries({ queryKey: ["naeemRecords"] })
    queryClient.invalidateQueries({ queryKey: ["naeemPayments"] })
    queryClient.invalidateQueries({ queryKey: ["naeemMonthlyBalance"] })
    queryClient.invalidateQueries({ queryKey: ["products"] })
  }, [queryClient])

  useEffect(() => {
    if (!user || !supabase || typeof supabase.channel !== "function") {
      return
    }

    const channelName = "realtime-7time-core-sync"
    const channel = supabase.channel(channelName)

    // Table mappings to query invalidation keys
    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "purchases" }, () => {
        scheduleInvalidation(["purchases", "dealers", "products", "inventory_page", "dashboardStats"])
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "dealers" }, () => {
        scheduleInvalidation(["dealers", "dashboardStats"])
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "dealer_payments" }, () => {
        scheduleInvalidation(["dealers", "dealerPayments", "dashboardStats"])
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        scheduleInvalidation(["products", "inventory_page", "dashboardStats"])
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "wholesale_sales" }, () => {
        scheduleInvalidation(["wholesaleSales", "resellers", "products", "inventory_page", "dashboardStats"])
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "reseller_customers" }, () => {
        scheduleInvalidation(["resellers", "dashboardStats"])
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "reseller_payments" }, () => {
        scheduleInvalidation(["resellers", "wholesaleSales", "dashboardStats"])
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "general_daily_records" }, () => {
        scheduleInvalidation(["generalDailyRecords", "dashboardStats"])
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "general_delivery_entries" }, () => {
        scheduleInvalidation(["generalDailyRecords", "dashboardStats"])
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "naeem_daily_records" }, () => {
        scheduleInvalidation(["naeemRecords", "naeemMonthlyBalance", "dashboardStats"])
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "naeem_payments" }, () => {
        scheduleInvalidation(["naeemPayments", "naeemMonthlyBalance", "dashboardStats"])
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "naeem_payment_allocations" }, () => {
        scheduleInvalidation(["naeemPayments", "naeemMonthlyBalance", "dashboardStats"])
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "naeem_monthly_balances" }, () => {
        scheduleInvalidation(["naeemMonthlyBalance", "dashboardStats"])
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "naeem_routes" }, () => {
        scheduleInvalidation(["naeemRoutes"])
      })

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setIsConnected(true)
      } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setIsConnected(false)
      }
    })

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      try {
        supabase.removeChannel(channel)
      } catch {
        // Safe disposal
      }
      setIsConnected(false)
    }
  }, [user, scheduleInvalidation])

  const value = {
    isConnected,
    lastEventTime,
    refetchAll,
  }

  return (
    <RealtimeSyncContext.Provider value={value}>
      {children}
    </RealtimeSyncContext.Provider>
  )
}
