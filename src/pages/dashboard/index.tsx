import { useState, lazy, Suspense, useMemo, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { getDashboardStats } from "@/services/dashboard"
import {
  ChevronLeft, ChevronRight, Calendar,
  AlertCircle, RefreshCw, Home
} from "lucide-react"
import type { UnifiedDebtor } from "@/services/receivables"
import { useRealtimeSync } from "@/hooks/useRealtimeSync"
import { LiveSyncBadge } from "./LiveSyncBadge"
import { DashboardSkeleton } from "./DashboardSkeleton"
import { Section1PurchasesDealers } from "./Section1PurchasesDealers"
import { Section2Wholesale } from "./Section2Wholesale"
import { Section3GeneralDelivery } from "./Section3GeneralDelivery"
import { Section4NaeemLedger } from "./Section4NaeemLedger"
import { Section5PersonalLedger } from "./Section5PersonalLedger"
import { DashboardQuickActions } from "./DashboardQuickActions"

const UnifiedReceivePaymentModal = lazy(() => import("@/components/common/UnifiedReceivePaymentModal"))

export type ViewMode = "MONTHLY" | "ALL_TIME"

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("MONTHLY")
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1) // 1 - 12
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [selectedPaymentDebtor, setSelectedPaymentDebtor] = useState<UnifiedDebtor | null>(null)

  // Live Supabase Realtime synchronization with debounced invalidation
  const { isConnected } = useRealtimeSync()

  // Generate date parameters for selected month
  const { startDateStr, endDateStr, monthLabel } = useMemo(() => {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ]
    const paddedMonth = String(selectedMonth).padStart(2, "0")
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate()
    
    return {
      startDateStr: `${selectedYear}-${paddedMonth}-01`,
      endDateStr: `${selectedYear}-${paddedMonth}-${String(lastDay).padStart(2, "0")}`,
      monthLabel: `${monthNames[selectedMonth - 1]} ${selectedYear}`
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
      setSelectedYear(y => y - 1)
      setSelectedMonth(12)
    } else {
      setSelectedMonth(m => m - 1)
    }
  }, [selectedMonth])

  const handleNextMonth = useCallback(() => {
    if (selectedMonth === 12) {
      setSelectedYear(y => y + 1)
      setSelectedMonth(1)
    } else {
      setSelectedMonth(m => m + 1)
    }
  }, [selectedMonth])

  const handleOpenPaymentModal = useCallback((debtor: UnifiedDebtor | null) => {
    setSelectedPaymentDebtor(debtor)
    setIsPaymentModalOpen(true)
  }, [])

  const handleClosePaymentModal = useCallback(() => {
    setIsPaymentModalOpen(false)
    setSelectedPaymentDebtor(null)
  }, [])

  return (
    <div className="w-full space-y-6 pb-12">
      {/* BREADCRUMB TRAIL */}
      <div className="flex items-center gap-2 text-xs text-[#52627A] font-medium">
        <Home className="w-3.5 h-3.5 text-slate-400" />
        <span className="hover:text-[#172B4D] transition-colors">Home</span>
        <span className="text-slate-400">&gt;</span>
        <span className="text-[#172B4D] font-semibold">Dashboard</span>
      </div>

      {/* EXECUTIVE HEADER & CONTROLS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#D9E0E8]">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="7TIME Logo" className="w-8 h-8 shrink-0 object-contain drop-shadow-xs" />
            <h1 className="text-xl sm:text-2xl font-black text-[#172B4D] tracking-tight">
              7TIME Business Management
            </h1>
            <LiveSyncBadge isConnected={isConnected} isFetching={isFetching} />
          </div>
          <p className="text-xs sm:text-sm text-[#52627A] mt-0.5 font-medium">
            Five clear business sections: Purchases, Wholesale, General Delivery, NAEEM, and Personal Ledger
          </p>
        </div>

        {/* View Mode & Date Scope Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Monthly vs All-Time Toggle */}
          <div className="inline-flex bg-[#F1F4F8] p-1 rounded-xl border border-[#D9E0E8]">
            <button
              type="button"
              onClick={() => setViewMode("MONTHLY")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                viewMode === "MONTHLY"
                  ? "bg-[#2563EB] text-white shadow-xs"
                  : "text-[#52627A] hover:text-[#172B4D]"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setViewMode("ALL_TIME")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                viewMode === "ALL_TIME"
                  ? "bg-[#2563EB] text-white shadow-xs"
                  : "text-[#52627A] hover:text-[#172B4D]"
              }`}
            >
              All Time
            </button>
          </div>

          {/* Month Navigator (visible when MONTHLY mode) */}
          {viewMode === "MONTHLY" && (
            <div className="flex items-center gap-1 bg-white border border-[#D9E0E8] rounded-xl px-2 py-1 shadow-xs">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 text-[#52627A] hover:text-[#172B4D] hover:bg-[#F1F4F8] rounded-lg transition-colors cursor-pointer"
                title="Previous month"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5 px-2 text-xs font-bold text-[#172B4D] min-w-[130px] justify-center">
                <Calendar className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>{monthLabel}</span>
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 text-[#52627A] hover:text-[#172B4D] hover:bg-[#F1F4F8] rounded-lg transition-colors cursor-pointer"
                title="Next month"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 bg-white border border-[#D9E0E8] hover:border-slate-300 hover:bg-[#F1F4F8] rounded-xl text-[#52627A] hover:text-[#172B4D] transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Refresh dashboard data"
            aria-label="Refresh dashboard data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-[#2563EB]" : ""}`} />
          </button>
        </div>
      </div>

      {/* ERROR STATE */}
      {isError && (
        <div className="max-w-2xl mx-auto my-12 p-6 bg-[#FDECEC] border border-red-200 rounded-xl text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-red-100 text-[#B42318] mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-[#B42318]">Failed to Load Dashboard Data</h2>
          <p className="text-xs sm:text-sm text-[#B42318]/90">
            {(error as Error)?.message || "A database connectivity issue prevented data consolidation."}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#B42318] text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors shadow-xs cursor-pointer"
          >
            Try Again
          </button>
        </div>
      )}

      {/* LOADING STATE */}
      {!isError && (isLoading || !data) && (
        <DashboardSkeleton />
      )}

      {/* 5 CONSOLIDATED BUSINESS SECTIONS */}
      {!isError && data && (
        <div className="space-y-6">
          {/* ROW 1: Exactly Three Primary Business Cards in ONE Row on Desktop */}
          <div className="dashboard-core-grid">
            {/* SECTION 1: Total Purchases & Dealer Payments */}
            <section id="section-purchases-dealers" aria-label="Section 1: Total Purchases & Dealer Payments" className="dashboard-domain-card">
              <Section1PurchasesDealers data={data.purchases} monthlyTrends={data.monthlyTrends} />
            </section>

            {/* SECTION 2: Wholesale Business */}
            <section id="section-wholesale" aria-label="Section 2: Wholesale Business" className="dashboard-domain-card">
              <Section2Wholesale
                data={data.wholesale}
                monthlyTrends={data.monthlyTrends}
                onReceivePayment={handleOpenPaymentModal}
              />
            </section>

            {/* SECTION 3: General Delivery (including NAEEM) */}
            <section id="section-general-delivery" aria-label="Section 3: General Delivery" className="dashboard-domain-card">
              <Section3GeneralDelivery data={data.generalDelivery} />
            </section>
          </div>

          {/* ROW 2: Exactly Two Operational Ledger Cards in ONE Row on Desktop */}
          <div className="dashboard-secondary-grid">
            {/* SECTION 4: NAEEM Delivery Ledger */}
            <section id="section-naeem-ledger" aria-label="Section 4: NAEEM Delivery Ledger" className="dashboard-domain-card">
              <Section4NaeemLedger
                data={data.naeem}
                onReceivePayment={() => {
                  if (data.naeem.outstanding > 0) {
                    handleOpenPaymentModal({
                      id: "naeem-dedicated-route",
                      name: "NAEEM Dedicated Route",
                      source: "NAEEM",
                      sourceLabel: "NAEEM Contract",
                      outstanding: data.naeem.outstanding,
                      lastPaymentDate: null,
                      routePath: "/naeem?action=payment"
                    })
                  }
                }}
              />
            </section>

            {/* SECTION 5: Personal Ledger (Strictly Isolated) */}
            <section id="section-personal-ledger" aria-label="Section 5: Personal Ledger" className="dashboard-domain-card">
              <Section5PersonalLedger
                data={data.personalLedger}
                onReceivePayment={handleOpenPaymentModal}
              />
            </section>
          </div>

          {/* QUICK OPERATIONAL ACTIONS */}
          <div className="pt-2">
            <DashboardQuickActions />
          </div>
        </div>
      )}

      {/* REUSABLE UNIFIED RECEIVE PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <Suspense fallback={null}>
          <UnifiedReceivePaymentModal
            isOpen={isPaymentModalOpen}
            onClose={handleClosePaymentModal}
            debtor={selectedPaymentDebtor}
            debtors={data?.receivables?.debtors || []}
            onSuccess={() => {
              refetch()
            }}
          />
        </Suspense>
      )}
    </div>
  )
}
