import { useState, lazy, Suspense, useMemo, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { getDashboardStats } from "@/services/dashboard"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { formatMoney } from "@/lib/utils"
import { 
  ShoppingCart, TrendingUp, Wallet, ArrowDownRight, 
  ArrowUpRight, ChevronLeft, ChevronRight, Calendar, 
  FileText, Users, Truck, AlertCircle, Layers, DollarSign,
  Loader2
} from "lucide-react"
import { Link } from "react-router-dom"
import type { MetricType, ViewMode } from "./UnifiedBusinessPerformanceChart"
import type { UnifiedDebtor } from "@/services/receivables"
import { useRealtimeSync } from "@/hooks/useRealtimeSync"
import { LiveSyncBadge } from "./LiveSyncBadge"
import { DashboardSkeleton } from "./DashboardSkeleton"
import { ExecutiveKpiGrid, type ExecutiveKpiItem } from "./ExecutiveKpiGrid"
import { ReceivablesDebtorsCard } from "./ReceivablesDebtorsCard"
import { DealersToPayCard } from "./DealersToPayCard"

const UnifiedBusinessPerformanceChart = lazy(() => import("./UnifiedBusinessPerformanceChart"))
const UnifiedReceivePaymentModal = lazy(() => import("@/components/common/UnifiedReceivePaymentModal"))

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("MONTHLY")
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1) // 1 - 12
  const [metricType, setMetricType] = useState<MetricType>("REVENUE")
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

  // Memoized consolidated metrics and section view models
  const {
    totalReceivables,
    totalPayables,
    executiveKpis,
    receivablesSummary,
    topReceivablesDebtors,
    topDealersToPay,
  } = useMemo(() => {
    if (!data) {
      return {
        totalPurchases: 0,
        totalRevenue: 0,
        cashIn: 0,
        cashOut: 0,
        totalReceivables: 0,
        totalPayables: 0,
        executiveKpis: [] as ExecutiveKpiItem[],
        receivablesSummary: {
          totalOutstanding: 0,
          wholesaleOutstanding: 0,
          naeemOutstanding: 0,
          otherOutstanding: 0,
          debtorsCount: 0,
          debtors: [] as UnifiedDebtor[],
        },
        topReceivablesDebtors: [] as UnifiedDebtor[],
        topDealersToPay: [],
      }
    }

    const totalPurchasesVal = data.purchases.total
    const totalRevenueVal = data.sales.total + data.generalDelivery.total + data.naeem.total
    const cashInVal = data.sales.received + data.sales.resellerPayments + data.generalDelivery.total + data.naeem.received
    const cashOutVal = data.purchases.paymentsMade + data.purchases.amountPaidAtPurchase + data.generalDelivery.fuel
    const totalReceivablesVal = data.sales.totalReceivable + Math.max(0, data.naeem.pending)
    const totalPayablesVal = data.purchases.totalPayable

    const kpis: ExecutiveKpiItem[] = [
      {
        id: "purchases",
        label: "Total Purchases",
        value: formatMoney(totalPurchasesVal),
        subtitle: "Gross supplier purchases",
        scope: viewMode === "MONTHLY" ? "Month" : "All Time",
        icon: ShoppingCart,
        iconColor: "text-[#2D7FF9]",
        iconBg: "bg-blue-50",
        accent: "border-l-4 border-l-[#2D7FF9]",
        href: "/purchases",
      },
      {
        id: "revenue",
        label: "Sales / Delivery Revenue",
        value: formatMoney(totalRevenueVal),
        subtitle: `Wholesale ${formatMoney(data.sales.total)} • Deliv ${formatMoney(data.generalDelivery.total + data.naeem.total)}`,
        scope: viewMode === "MONTHLY" ? "Month" : "All Time",
        icon: TrendingUp,
        iconColor: "text-[#4A39D6]",
        iconBg: "bg-purple-50",
        accent: "border-l-4 border-l-[#4A39D6]",
        href: "/wholesale",
      },
      {
        id: "cash-in",
        label: "Cash In",
        value: formatMoney(cashInVal),
        subtitle: "Actual collections received",
        scope: viewMode === "MONTHLY" ? "Month" : "All Time",
        icon: ArrowDownRight,
        iconColor: "text-[#22C55E]",
        iconBg: "bg-emerald-50",
        accent: "border-l-4 border-l-[#22C55E]",
        href: "/reports",
        valueColor: "text-emerald-700",
      },
      {
        id: "cash-out",
        label: "Cash Out",
        value: formatMoney(cashOutVal),
        subtitle: "Supplier payments & fuel",
        scope: viewMode === "MONTHLY" ? "Month" : "All Time",
        icon: ArrowUpRight,
        iconColor: "text-[#EF4444]",
        iconBg: "bg-red-50",
        accent: "border-l-4 border-l-[#EF4444]",
        href: "/reports",
        valueColor: "text-red-600",
      },
      {
        id: "receivables",
        label: "Receivables",
        value: formatMoney(totalReceivablesVal),
        subtitle: "Owed to the business",
        scope: "All-time",
        icon: Wallet,
        iconColor: "text-emerald-600",
        iconBg: "bg-emerald-50",
        accent: "border-l-4 border-l-emerald-500",
        href: "/resellers",
        valueColor: totalReceivablesVal > 0 ? "text-emerald-700" : "text-[#0E2A47]",
      },
      {
        id: "payables",
        label: "Payables",
        value: formatMoney(totalPayablesVal),
        subtitle: "Owed to suppliers",
        scope: "All-time",
        icon: DollarSign,
        iconColor: "text-red-600",
        iconBg: "bg-red-50",
        accent: "border-l-4 border-l-red-500",
        href: "/dealers",
        valueColor: totalPayablesVal > 0 ? "text-red-600" : "text-[#0E2A47]",
      },
    ]

    const recSummary = data.receivables || {
      totalOutstanding: data.sales.totalReceivable + Math.max(0, data.naeem.pending),
      wholesaleOutstanding: data.sales.totalReceivable,
      naeemOutstanding: Math.max(0, data.naeem.pending),
      otherOutstanding: 0,
      debtorsCount: data.resellers.filter(r => r.outstanding > 0).length + (data.naeem.pending > 0 ? 1 : 0),
      debtors: [
        ...data.resellers.filter(r => r.outstanding > 0).map(r => ({
          id: r.id,
          name: r.name,
          source: "WHOLESALE_RESELLER" as const,
          sourceLabel: "Wholesale Reseller",
          outstanding: r.outstanding,
          lastPaymentDate: null,
          routePath: `/resellers/${r.id}`
        })),
        ...(data.naeem.pending > 0 ? [{
          id: "naeem-dedicated-route",
          name: "NAEEM Dedicated Route",
          source: "NAEEM" as const,
          sourceLabel: "NAEEM Contract",
          outstanding: data.naeem.pending,
          lastPaymentDate: null,
          routePath: "/naeem?action=payment"
        }] : [])
      ]
    }

    const topDebtors: UnifiedDebtor[] = recSummary.debtors && recSummary.debtors.length > 0
      ? recSummary.debtors.slice(0, 5)
      : [
          ...data.resellers.filter(r => r.outstanding > 0).map(r => ({
            id: r.id,
            name: r.name,
            source: "WHOLESALE_RESELLER" as const,
            sourceLabel: "Wholesale Reseller",
            outstanding: r.outstanding,
            lastPaymentDate: null,
            routePath: `/resellers/${r.id}`
          })),
          ...(data.naeem.pending > 0 ? [{
            id: "naeem-dedicated-route",
            name: "NAEEM Dedicated Route",
            source: "NAEEM" as const,
            sourceLabel: "NAEEM Contract",
            outstanding: data.naeem.pending,
            lastPaymentDate: null,
            routePath: "/naeem?action=payment"
          }] : [])
        ].sort((a, b) => b.outstanding - a.outstanding).slice(0, 5)

    const topDealers = data.dealers
      .filter(d => d.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 3)

    return {
      totalPurchases: totalPurchasesVal,
      totalRevenue: totalRevenueVal,
      cashIn: cashInVal,
      cashOut: cashOutVal,
      totalReceivables: totalReceivablesVal,
      totalPayables: totalPayablesVal,
      executiveKpis: kpis,
      receivablesSummary: recSummary,
      topReceivablesDebtors: topDebtors,
      topDealersToPay: topDealers,
    }
  }, [data, viewMode])

  // Quick Action navigation links
  const quickActions = [
    { label: "Record Purchase", href: "/purchases", icon: ShoppingCart, color: "text-[#2D7FF9]", bg: "bg-blue-50" },
    { label: "Record Wholesale Sale", href: "/wholesale", icon: TrendingUp, color: "text-[#4A39D6]", bg: "bg-purple-50" },
    { label: "Record Dealer Payment", href: "/dealers", icon: Users, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Open General Delivery", href: "/general-deliveries", icon: Truck, color: "text-[#33C5F3]", bg: "bg-sky-50" },
    { label: "Open NAEEM Delivery", href: "/naeem", icon: Truck, color: "text-[#4A39D6]", bg: "bg-indigo-50" },
    { label: "View Reports", href: "/reports", icon: FileText, color: "text-[#0E2A47]", bg: "bg-slate-100" },
  ]

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-10">
      {/* HEADER WITH EXECUTIVE PERIOD SELECTOR & LIVE SYNC BADGE (RENDERS IMMEDIATELY) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 sm:p-5 rounded-xl border border-[#E5E7EB] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#0E2A47]">
              7TIME Business Management
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-[#2D7FF9] border border-blue-200">
              EXECUTIVE DASHBOARD
            </span>
            <LiveSyncBadge
              isConnected={isConnected}
              isFetching={isFetching}
              onManualRefresh={() => refetch()}
            />
          </div>
          <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
            Consolidated overview across Dealer, Wholesale, General Delivery, and NAEEM operations
          </p>
        </div>

        {/* View Mode & Month Navigation */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setViewMode("MONTHLY")}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                viewMode === "MONTHLY"
                  ? "bg-white text-[#0E2A47] shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setViewMode("ALL_TIME")}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                viewMode === "ALL_TIME"
                  ? "bg-white text-[#0E2A47] shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Time
            </button>
          </div>

          {/* Month Navigator (visible when in Monthly mode) */}
          {viewMode === "MONTHLY" && (
            <div className="flex items-center gap-1 bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg px-2 py-1 shadow-xs">
              <button
                onClick={handlePrevMonth}
                className="p-1 text-slate-500 hover:text-[#0E2A47] hover:bg-slate-200/60 rounded transition-colors cursor-pointer"
                title="Previous month"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5 px-2 text-xs font-bold text-[#0E2A47]">
                <Calendar className="w-3.5 h-3.5 text-[#2D7FF9]" />
                <span>{monthLabel}</span>
              </div>
              <button
                onClick={handleNextMonth}
                className="p-1 text-slate-500 hover:text-[#0E2A47] hover:bg-slate-200/60 rounded transition-colors cursor-pointer"
                title="Next month"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ERROR STATE */}
      {isError && (
        <div className="max-w-2xl mx-auto my-12 p-6 bg-red-50 border border-red-200 rounded-xl text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-red-900">Failed to Load Dashboard Data</h2>
          <p className="text-xs sm:text-sm text-red-700">
            {(error as Error)?.message || "A database connectivity issue prevented data consolidation."}
          </p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors shadow-xs cursor-pointer"
          >
            Try Again
          </button>
        </div>
      )}

      {/* SKELETON PLACEHOLDER WHILE DATA LOADS (PREVENTS CLS & BLANK SCREEN) */}
      {!isError && (isLoading || !data) && (
        <DashboardSkeleton />
      )}

      {/* LOADED DASHBOARD CONTENT */}
      {!isError && data && (
        <>
          {/* LAYER 1: COMPACT EXECUTIVE KPI CARDS (6 CARDS) */}
          <ExecutiveKpiGrid
            kpis={executiveKpis}
            scopeLabel={viewMode === "MONTHLY" ? monthLabel : "All Time"}
          />

          {/* LAYER 2: ONE UNIFIED BUSINESS PERFORMANCE CONTAINER */}
          <Card className="border-[#E5E7EB] shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold text-[#0E2A47] flex items-center gap-2">
                    <Layers className="h-5 w-5 text-[#2D7FF9]" /> Unified Business Performance
                  </CardTitle>
                  <CardDescription className="text-xs text-[#64748B]">
                    Dealer · Wholesale · General Delivery · NAEEM
                  </CardDescription>
                </div>

                {/* Container Controls: Metric Selector & Reports Link */}
                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-between lg:justify-end">
                  <div className="flex items-center gap-1.5 bg-white border border-[#E5E7EB] rounded-lg px-2.5 py-1 shadow-xs">
                    <span className="text-[11px] font-semibold text-slate-500">Metric:</span>
                    <select
                      value={metricType}
                      onChange={e => setMetricType(e.target.value as MetricType)}
                      className="text-xs font-bold text-[#0E2A47] bg-transparent outline-none cursor-pointer"
                      aria-label="Select performance metric"
                    >
                      <option value="REVENUE">Revenue & Billings</option>
                      <option value="CASH_FLOW">Cash In vs Cash Out</option>
                      <option value="OUTSTANDING">Outstanding Balances</option>
                      <option value="PROFIT">Operating Margins</option>
                    </select>
                  </div>

                  <Link
                    to="/reports"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E5E7EB] hover:border-blue-300 text-xs font-semibold text-[#0E2A47] hover:text-[#2D7FF9] rounded-lg shadow-xs transition-all"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#2D7FF9]" /> View Reports
                  </Link>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 space-y-4">
              {/* Central Bar Chart */}
              <div className="h-68 sm:h-76 w-full">
                <Suspense fallback={
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin text-[#2D7FF9]" />
                    <span className="text-xs font-medium">Loading unified performance visualization...</span>
                  </div>
                }>
                  <UnifiedBusinessPerformanceChart
                    data={data}
                    metricType={metricType}
                    viewMode={viewMode}
                  />
                </Suspense>
              </div>

              {/* 4-Area Summary Breakdown Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 pt-3 border-t border-slate-100">
                {/* Dealer Ops */}
                <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-200/60 text-xs">
                  <div className="flex items-center justify-between font-bold text-[#0E2A47] mb-1">
                    <span>Dealer Operations</span>
                    <Link to="/dealers" className="text-[11px] text-[#2D7FF9] hover:underline">Ledger</Link>
                  </div>
                  <div className="text-[11px] text-slate-600 flex justify-between">
                    <span>Purchases:</span>
                    <span className="font-semibold text-slate-800">{formatMoney(data.purchases.total)}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 flex justify-between">
                    <span>Payables:</span>
                    <span className={`font-semibold ${data.purchases.totalPayable > 0 ? "text-red-600" : "text-slate-700"}`}>
                      {formatMoney(data.purchases.totalPayable)}
                    </span>
                  </div>
                </div>

                {/* Wholesale Ops */}
                <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-200/60 text-xs">
                  <div className="flex items-center justify-between font-bold text-[#0E2A47] mb-1">
                    <span>Wholesale & Resellers</span>
                    <Link to="/wholesale" className="text-[11px] text-[#2D7FF9] hover:underline">Sales</Link>
                  </div>
                  <div className="text-[11px] text-slate-600 flex justify-between">
                    <span>Sales:</span>
                    <span className="font-semibold text-blue-700">{formatMoney(data.sales.total)}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 flex justify-between">
                    <span>Profit Margin:</span>
                    <span className="font-semibold text-purple-700">{formatMoney(data.sales.profit)}</span>
                  </div>
                </div>

                {/* General Delivery */}
                <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-200/60 text-xs">
                  <div className="flex items-center justify-between font-bold text-[#0E2A47] mb-1">
                    <span>General Delivery</span>
                    <Link to="/general-deliveries" className="text-[11px] text-[#2D7FF9] hover:underline">Fleet</Link>
                  </div>
                  <div className="text-[11px] text-slate-600 flex justify-between">
                    <span>Deliveries:</span>
                    <span className="font-semibold text-slate-800">{formatMoney(data.generalDelivery.total)}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 flex justify-between">
                    <span>Net Total:</span>
                    <span className="font-semibold text-emerald-700">{formatMoney(data.generalDelivery.net)}</span>
                  </div>
                </div>

                {/* NAEEM Dedicated */}
                <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-200/60 text-xs">
                  <div className="flex items-center justify-between font-bold text-[#0E2A47] mb-1">
                    <span>NAEEM Dedicated</span>
                    <Link to="/naeem" className="text-[11px] text-[#2D7FF9] hover:underline">Route</Link>
                  </div>
                  <div className="text-[11px] text-slate-600 flex justify-between">
                    <span>Current Billed:</span>
                    <span className="font-semibold text-purple-700">{formatMoney(data.naeem.total)}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 flex justify-between">
                    <span>Outstanding:</span>
                    <span className={`font-semibold ${data.naeem.pending > 0 ? "text-red-600" : "text-slate-700"}`}>
                      {formatMoney(data.naeem.pending)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* LAYER 3: UNIFIED RECEIVABLES (ACCOUNTS TO COLLECT) / PAYMENTS TO MAKE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* UNIFIED OUTSTANDING RECEIVABLES / ACCOUNTS TO COLLECT */}
            <ReceivablesDebtorsCard
              totalReceivables={totalReceivables}
              receivablesSummary={receivablesSummary}
              topReceivablesDebtors={topReceivablesDebtors}
              onOpenPaymentModal={handleOpenPaymentModal}
            />

            {/* PAYMENTS TO MAKE */}
            <DealersToPayCard
              totalPayables={totalPayables}
              topDealersToPay={topDealersToPay}
            />
          </div>

          {/* LAYER 4: COMPACT QUICK ACTIONS */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                Quick Actions
              </h2>
              <span className="text-[11px] text-slate-400">Direct module access</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
              {quickActions.map(action => (
                <Link
                  key={action.label}
                  to={action.href}
                  className="flex flex-col items-center justify-center p-2.5 sm:p-3 bg-white border border-[#E5E7EB] rounded-xl hover:border-[#2D7FF9]/50 hover:shadow-xs transition-all text-center group"
                >
                  <div className={`w-8 h-8 rounded-lg ${action.bg} flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform`}>
                    <action.icon className={`w-4 h-4 ${action.color}`} />
                  </div>
                  <span className="text-xs font-semibold text-[#0E2A47] group-hover:text-[#2D7FF9] truncate max-w-full">
                    {action.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {/* REUSABLE UNIFIED RECEIVE PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <Suspense fallback={null}>
          <UnifiedReceivePaymentModal
            isOpen={isPaymentModalOpen}
            onClose={handleClosePaymentModal}
            debtor={selectedPaymentDebtor}
            debtors={receivablesSummary.debtors}
            onSuccess={() => {
              refetch()
            }}
          />
        </Suspense>
      )}
    </div>
  )
}
