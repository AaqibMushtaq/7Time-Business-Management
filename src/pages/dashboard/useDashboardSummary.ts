import { useState, useMemo, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { getDashboardStats } from "@/services/dashboard"
import { useRealtimeSync } from "@/hooks/useRealtimeSync"
import type { ViewMode } from "./types"

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

export function useDashboardSummary() {
  const [viewMode, setViewMode] = useState<ViewMode>("MONTHLY")
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1) // 1 - 12

  // Live Supabase Realtime synchronization with debounced invalidation
  const { isConnected } = useRealtimeSync()

  // Generate date parameters for selected month
  const { startDateStr, endDateStr, monthLabel } = useMemo(() => {
    const paddedMonth = String(selectedMonth).padStart(2, "0")
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate()

    return {
      startDateStr: `${selectedYear}-${paddedMonth}-01`,
      endDateStr: `${selectedYear}-${paddedMonth}-${String(lastDay).padStart(2, "0")}`,
      monthLabel: `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`,
    }
  }, [selectedYear, selectedMonth])

  // Fetch data dynamically based on viewMode
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["dashboardStats", viewMode, selectedYear, selectedMonth],
    queryFn: () => {
      if (viewMode === "ALL_TIME") {
        return getDashboardStats("ALL")
      }
      return getDashboardStats("CUSTOM", startDateStr, endDateStr)
    },
  })

  const handlePrevMonth = useCallback(() => {
    if (selectedMonth === 1) {
      setSelectedYear((y) => y - 1)
      setSelectedMonth(12)
    } else {
      setSelectedMonth((m) => m - 1)
    }
  }, [selectedMonth])

  const handleNextMonth = useCallback(() => {
    if (selectedMonth === 12) {
      setSelectedYear((y) => y + 1)
      setSelectedMonth(1)
    } else {
      setSelectedMonth((m) => m + 1)
    }
  }, [selectedMonth])

  return {
    viewMode,
    setViewMode,
    selectedYear,
    selectedMonth,
    monthLabel,
    data,
    isLoading,
    isError,
    error,
    isFetching,
    isConnected,
    refetch,
    handlePrevMonth,
    handleNextMonth,
  }
}
