import { useState, lazy, Suspense, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { getDashboardStats } from "@/services/dashboard"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { formatMoney } from "@/lib/utils"
import { 
  Loader2, ShoppingCart, TrendingUp, Wallet, ArrowDownRight, 
  ArrowUpRight, CheckCircle2, ChevronLeft, ChevronRight, Calendar, 
  FileText, Users, Truck, AlertCircle, ArrowRight, Layers, DollarSign,
  PlusCircle
} from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import type { MetricType, ViewMode } from "./UnifiedBusinessPerformanceChart"
import type { UnifiedDebtor } from "@/services/receivables"

const UnifiedBusinessPerformanceChart = lazy(() => import("./UnifiedBusinessPerformanceChart"))
const UnifiedReceivePaymentModal = lazy(() => import("@/components/common/UnifiedReceivePaymentModal"))

export default function DashboardPage() {
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<ViewMode>("MONTHLY")
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1) // 1 - 12
  const [metricType, setMetricType] = useState<MetricType>("REVENUE")
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [selectedPaymentDebtor, setSelectedPaymentDebtor] = useState<UnifiedDebtor | null>(null)

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

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear(y => y - 1)
      setSelectedMonth(12)
    } else {
      setSelectedMonth(m => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear(y => y + 1)
      setSelectedMonth(1)
    } else {
      setSelectedMonth(m => m + 1)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-[55vh] gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-[#2D7FF9]" />
        <p className="text-sm font-semibold text-slate-600">Loading executive dashboard...</p>
        <p className="text-xs text-slate-400">Consolidating Dealer, Wholesale, General Delivery & NAEEM metrics</p>
      </div>
    )
  }

  if (isError) {
    return (
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
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors shadow-xs"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (!data) return null

  // 1. EXECUTIVE CONSOLIDATED METRICS
  const totalPurchases = data.purchases.total
  const totalRevenue = data.sales.total + data.generalDelivery.total + data.naeem.total
  const cashIn = data.sales.received + data.sales.resellerPayments + data.generalDelivery.total + data.naeem.received
  const cashOut = data.purchases.paymentsMade + data.purchases.amountPaidAtPurchase + data.generalDelivery.fuel
  const totalReceivables = data.sales.totalReceivable + Math.max(0, data.naeem.pending)
  const totalPayables = data.purchases.totalPayable

  const executiveKpis = [
    {
      id: "purchases",
      label: "Total Purchases",
      value: formatMoney(totalPurchases),
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
      value: formatMoney(totalRevenue),
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
      value: formatMoney(cashIn),
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
      value: formatMoney(cashOut),
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
      value: formatMoney(totalReceivables),
      subtitle: "Owed to the business",
      scope: "All-time",
      icon: Wallet,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
      accent: "border-l-4 border-l-emerald-500",
      href: "/resellers",
      valueColor: totalReceivables > 0 ? "text-emerald-700" : "text-[#0E2A47]",
    },
    {
      id: "payables",
      label: "Payables",
      value: formatMoney(totalPayables),
      subtitle: "Owed to suppliers",
      scope: "All-time",
      icon: DollarSign,
      iconColor: "text-red-600",
      iconBg: "bg-red-50",
      accent: "border-l-4 border-l-red-500",
      href: "/dealers",
      valueColor: totalPayables > 0 ? "text-red-600" : "text-[#0E2A47]",
    },
  ]

  // Unified Receivables Aggregation across all modules
  const receivablesSummary = data.receivables || {
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

  // Unified top debtors list
  const topReceivablesDebtors = receivablesSummary.debtors && receivablesSummary.debtors.length > 0
    ? receivablesSummary.debtors.slice(0, 5)
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

  const topDealersToPay = data.dealers
    .filter(d => d.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 3)

  // 4. QUICK ACTIONS
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
      {/* HEADER WITH EXECUTIVE PERIOD SELECTOR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 sm:p-5 rounded-xl border border-[#E5E7EB] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#0E2A47]">
              7TIME Business Management
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-[#2D7FF9] border border-blue-200">
              EXECUTIVE DASHBOARD
            </span>
            {isFetching && (
              <span title="Refreshing data...">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2D7FF9]" />
              </span>
            )}
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

      {/* LAYER 1: COMPACT EXECUTIVE KPI CARDS (6 CARDS) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
            Executive Key Metrics
          </h2>
          <span className="text-[11px] text-slate-500 font-medium">
            Scope: <span className="text-[#0E2A47] font-bold">{viewMode === "MONTHLY" ? monthLabel : "All Time"}</span>
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          {executiveKpis.map(kpi => (
            <Link
              key={kpi.id}
              to={kpi.href}
              className={`bg-white rounded-xl border border-[#E5E7EB] p-3 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between ${kpi.accent} group`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <div className={`w-7 h-7 rounded-lg ${kpi.iconBg} flex items-center justify-center shrink-0`}>
                    <kpi.icon className={`w-3.5 h-3.5 ${kpi.iconColor}`} />
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">
                    {kpi.scope}
                  </span>
                </div>

                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block truncate">
                  {kpi.label}
                </span>

                <div className={`text-base sm:text-lg lg:text-xl font-extrabold tracking-tight mt-0.5 truncate ${kpi.valueColor || 'text-[#0E2A47]'}`}>
                  {kpi.value}
                </div>
              </div>

              <p className="text-[10px] text-slate-400 mt-2 pt-1.5 border-t border-slate-100 truncate font-medium">
                {kpi.subtitle}
              </p>
            </Link>
          ))}
        </div>
      </div>

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
        <Card className="border-[#E5E7EB] shadow-xs">
          <CardHeader className="p-4 border-b border-slate-100 bg-emerald-50/40 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-emerald-950 flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-emerald-600" /> Outstanding Receivables
                </CardTitle>
                <CardDescription className="text-xs text-emerald-800">
                  Total Due: <span className="font-bold">{formatMoney(totalReceivables)}</span>
                  {receivablesSummary.debtorsCount > 0 && (
                    <span className="ml-1.5 text-[11px] font-normal text-emerald-700">
                      across {receivablesSummary.debtorsCount} account{receivablesSummary.debtorsCount > 1 ? "s" : ""}
                    </span>
                  )}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPaymentDebtor(topReceivablesDebtors[0] || null)
                    setIsPaymentModalOpen(true)
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-2xs"
                  title="Receive payment from any debtor"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Receive Payment
                </button>
              </div>
            </div>

            {/* Source Breakdown Badges */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-emerald-100/60 text-[11px]">
              <div className="bg-white/80 rounded-md p-1.5 border border-emerald-100">
                <span className="text-slate-500 block text-[10px] leading-tight truncate">Wholesale/Resellers</span>
                <span className="font-bold text-slate-800">{formatMoney(receivablesSummary.wholesaleOutstanding)}</span>
              </div>
              <div className="bg-white/80 rounded-md p-1.5 border border-emerald-100">
                <span className="text-slate-500 block text-[10px] leading-tight truncate">NAEEM Dedicated</span>
                <span className="font-bold text-slate-800">{formatMoney(receivablesSummary.naeemOutstanding)}</span>
              </div>
              <div className="bg-white/80 rounded-md p-1.5 border border-emerald-100">
                <span className="text-slate-500 block text-[10px] leading-tight truncate">Other Receivables</span>
                <span className="font-bold text-slate-800">{formatMoney(receivablesSummary.otherOutstanding)}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            {topReceivablesDebtors.length > 0 ? (
              <div className="divide-y divide-slate-100 text-xs">
                {topReceivablesDebtors.map(debtor => (
                  <div 
                    key={debtor.id} 
                    className="py-2.5 px-2 -mx-1 rounded-lg hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3 group"
                  >
                    <div 
                      onClick={() => navigate(debtor.routePath)}
                      className="cursor-pointer min-w-0 flex-1"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#0E2A47] group-hover:text-[#2D7FF9] transition-colors truncate">
                          {debtor.name}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                          debtor.source === "NAEEM"
                            ? "bg-blue-100 text-blue-800"
                            : debtor.source === "WHOLESALE_RESELLER"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}>
                          {debtor.sourceLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                        {debtor.lastPaymentDate ? (
                          <span>Last paid: {debtor.lastPaymentDate}</span>
                        ) : (
                          <span>No payments recorded yet</span>
                        )}
                        <span>•</span>
                        <span className="text-[#2D7FF9] group-hover:underline">View Account</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-emerald-700 text-right">
                        {formatMoney(debtor.outstanding)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedPaymentDebtor(debtor)
                          setIsPaymentModalOpen(true)
                        }}
                        className="px-2 py-1 text-[11px] font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white transition-colors"
                        title={`Receive payment from ${debtor.name}`}
                      >
                        Receive
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-1">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span className="font-semibold text-slate-700">All customer accounts are settled.</span>
                <span className="text-[11px] text-slate-400">Zero outstanding receivables currently pending across all modules.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PAYMENTS TO MAKE */}
        <Card className="border-[#E5E7EB] shadow-xs">
          <CardHeader className="p-4 border-b border-slate-100 bg-red-50/40 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-red-950 flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-red-600" /> Payments to Make
              </CardTitle>
              <CardDescription className="text-xs text-red-800">
                Total Due: <span className="font-bold">{formatMoney(totalPayables)}</span>
              </CardDescription>
            </div>
            <Link to="/dealers" className="text-xs font-semibold text-[#2D7FF9] hover:text-blue-800 flex items-center gap-0.5">
              Manage Dealers <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-3">
            {topDealersToPay.length > 0 ? (
              <div className="divide-y divide-slate-100 text-xs">
                {topDealersToPay.map(d => (
                  <div key={d.id} className="py-2 flex items-center justify-between">
                    <div>
                      <Link to={`/dealers/${d.id}`} className="font-bold text-[#0E2A47] hover:text-[#2D7FF9] transition-colors">
                        {d.name}
                      </Link>
                      <p className="text-[10px] text-slate-500">Supplier Payable</p>
                    </div>
                    <span className="font-bold text-red-600">
                      {formatMoney(d.outstanding)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-1">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span className="font-semibold text-slate-700">All supplier accounts are settled.</span>
                <span className="text-[11px] text-slate-400">Zero outstanding payables currently due.</span>
              </div>
            )}
          </CardContent>
        </Card>
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

      {/* REUSABLE UNIFIED RECEIVE PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <Suspense fallback={null}>
          <UnifiedReceivePaymentModal
            isOpen={isPaymentModalOpen}
            onClose={() => {
              setIsPaymentModalOpen(false)
              setSelectedPaymentDebtor(null)
            }}
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
