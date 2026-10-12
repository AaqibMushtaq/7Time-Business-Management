import { useState, lazy, Suspense } from "react"
import { useQuery } from "@tanstack/react-query"
import { getDashboardStats, type DateRange } from "@/services/dashboard"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { formatMoney, formatDate } from "@/lib/utils"
import { 
  Loader2, Package, ShoppingCart, Truck, Users, 
  ArrowUpRight, ArrowDownRight, AlertTriangle, ListOrdered, 
  Calendar, TrendingUp, TrendingDown, Minus, Wallet, 
  FileText, CircleDollarSign, ArrowRight, RefreshCw, AlertCircle
} from "lucide-react"
import { Link } from "react-router-dom"

const SalesTrendChart = lazy(() => import("./SalesTrendChart"))
const CashFlowChart = lazy(() => import("./CashFlowChart"))

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange>("THIS_MONTH")

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["dashboardStats", dateRange],
    queryFn: () => getDashboardStats(dateRange),
  })

  const getPrevRange = (r: DateRange): DateRange => {
    const map: Record<DateRange, DateRange> = {
      TODAY: "TODAY",
      THIS_WEEK: "THIS_WEEK",
      THIS_MONTH: "LAST_MONTH",
      LAST_MONTH: "LAST_MONTH",
      THIS_YEAR: "THIS_YEAR",
      ALL: "ALL",
      CUSTOM: "CUSTOM"
    }
    return map[r]
  }

  const prevRange = getPrevRange(dateRange)
  const { data: prevData, isLoading: prevLoading } = useQuery({
    queryKey: ["dashboardStats", prevRange],
    queryFn: () => getDashboardStats(prevRange),
    enabled: Boolean(data) && prevRange !== dateRange,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-[55vh] gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-[#2D7FF9]" />
        <p className="text-sm font-semibold text-slate-600">Loading business metrics...</p>
        <p className="text-xs text-slate-400">Reconciling purchases, wholesale sales, inventory, and ledgers</p>
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
          {(error as Error)?.message || "A database connectivity issue prevented metrics calculation."}
        </p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors shadow-xs"
        >
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>
      </div>
    )
  }

  if (!data) return null

  const calculateChange = (current: number, previous: number) => {
    if (prevRange === dateRange || prevLoading || !prevData) return null
    if (previous === 0) return current > 0 ? { val: 100, trend: 'up' as const } : { val: 0, trend: 'flat' as const }
    const percent = ((current - previous) / previous) * 100
    return {
      val: Math.abs(percent),
      trend: percent > 0 ? ('up' as const) : percent < 0 ? ('down' as const) : ('flat' as const)
    }
  }

  const renderTrend = (current: number, previous: number | undefined) => {
    if (previous === undefined) return null
    const change = calculateChange(current, previous)
    if (!change) return null

    if (change.trend === 'up') {
      return (
        <span className="text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded text-[10px] font-bold inline-flex items-center shrink-0">
          <TrendingUp className="w-3 h-3 mr-0.5 shrink-0" /> +{change.val.toFixed(1)}%
        </span>
      )
    } else if (change.trend === 'down') {
      return (
        <span className="text-red-700 bg-red-50 border border-red-200/60 px-1.5 py-0.5 rounded text-[10px] font-bold inline-flex items-center shrink-0">
          <TrendingDown className="w-3 h-3 mr-0.5 shrink-0" /> -{change.val.toFixed(1)}%
        </span>
      )
    }
    return (
      <span className="text-slate-500 bg-slate-50 border border-slate-200/60 px-1.5 py-0.5 rounded text-[10px] font-medium inline-flex items-center shrink-0">
        <Minus className="w-3 h-3 mr-0.5 shrink-0" /> 0%
      </span>
    )
  }

  const netCashFlow = data.cashFlow?.net ?? ((data.sales.received + data.sales.resellerPayments) - (data.purchases.paymentsMade + data.purchases.amountPaidAtPurchase + data.generalDelivery.fuel))

  const quickActions = [
    { label: "Purchases", href: "/purchases", icon: ShoppingCart, color: "text-[#2D7FF9]", bg: "bg-blue-50" },
    { label: "Wholesale", href: "/wholesale", icon: TrendingUp, color: "text-[#4A39D6]", bg: "bg-purple-50" },
    { label: "Dealers", href: "/dealers", icon: Users, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Products", href: "/products", icon: Package, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Deliveries", href: "/general-deliveries", icon: Truck, color: "text-[#33C5F3]", bg: "bg-sky-50" },
    { label: "Reports", href: "/reports", icon: FileText, color: "text-[#0E2A47]", bg: "bg-slate-100" },
  ]

  // Primary 8 key financial metrics
  const summaryMetrics = [
    {
      id: "purchases",
      label: "Total Purchases",
      value: formatMoney(data.purchases.total),
      trend: renderTrend(data.purchases.total, prevData?.purchases.total),
      subtitle: "Gross supplier purchases",
      scopeBadge: "Period",
      href: "/purchases",
      icon: ShoppingCart,
      iconColor: "text-[#2D7FF9]",
      iconBg: "bg-blue-50",
      accentBorder: "hover:border-[#2D7FF9]/40",
    },
    {
      id: "sales",
      label: "Wholesale Sales",
      value: formatMoney(data.sales.total),
      trend: renderTrend(data.sales.total, prevData?.sales.total),
      subtitle: `${data.sales.transactions} recorded orders`,
      scopeBadge: "Period",
      href: "/wholesale",
      icon: TrendingUp,
      iconColor: "text-[#2D7FF9]",
      iconBg: "bg-blue-50",
      accentBorder: "hover:border-[#2D7FF9]/40",
    },
    {
      id: "profit",
      label: "Realized Profit",
      value: formatMoney(data.sales.profit),
      trend: renderTrend(data.sales.profit, prevData?.sales.profit),
      subtitle: "Sales gross margin",
      scopeBadge: "Period",
      href: "/wholesale",
      icon: CircleDollarSign,
      iconColor: "text-[#4A39D6]",
      iconBg: "bg-purple-50",
      accentBorder: "hover:border-[#4A39D6]/40",
    },
    {
      id: "inventory",
      label: "Current Inventory",
      value: formatMoney(data.inventory.totalValue),
      subtitle: `${data.inventory.totalItems} items in stock`,
      scopeBadge: "Live Snapshot",
      href: "/products",
      icon: Package,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
      accentBorder: "hover:border-emerald-300",
    },
    {
      id: "we-owe",
      label: "We Owe Dealers",
      value: formatMoney(data.purchases.totalPayable),
      subtitle: `Paid: ${formatMoney(data.purchases.paymentsMade)}`,
      scopeBadge: "All-time",
      href: "/dealers",
      icon: ArrowUpRight,
      iconColor: "text-[#EF4444]",
      iconBg: "bg-red-50",
      accentBorder: "hover:border-red-300",
      valueColor: data.purchases.totalPayable > 0 ? "text-[#EF4444]" : "text-[#0E2A47]",
    },
    {
      id: "they-owe",
      label: "Resellers Owe Us",
      value: formatMoney(data.sales.totalReceivable),
      subtitle: `Recv: ${formatMoney(data.sales.received + data.sales.resellerPayments)}`,
      scopeBadge: "All-time",
      href: "/resellers",
      icon: ArrowDownRight,
      iconColor: "text-[#22C55E]",
      iconBg: "bg-green-50",
      accentBorder: "hover:border-green-300",
      valueColor: data.sales.totalReceivable > 0 ? "text-emerald-700" : "text-[#0E2A47]",
    },
    {
      id: "cash-flow",
      label: "Net Cash Flow",
      value: formatMoney(netCashFlow),
      subtitle: "Inflows − Outflows",
      scopeBadge: "Period",
      icon: Wallet,
      iconColor: "text-[#33C5F3]",
      iconBg: "bg-sky-50",
      accentBorder: "hover:border-sky-300",
      valueColor: netCashFlow >= 0 ? "text-emerald-700" : "text-[#EF4444]",
    },
    {
      id: "delivery-net",
      label: "General Delivery",
      value: formatMoney(data.generalDelivery.net),
      subtitle: `${data.generalDelivery.activeDays} days • Fuel ${formatMoney(data.generalDelivery.fuel)}`,
      scopeBadge: "Period",
      href: "/general-deliveries",
      icon: Truck,
      iconColor: "text-[#2D7FF9]",
      iconBg: "bg-blue-50",
      accentBorder: "hover:border-blue-300",
      valueColor: "text-[#0E2A47]",
    },
  ]

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* 1. PROFESSIONAL PAGE HEADER & ACCESSIBLE PERIOD SELECTOR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 sm:p-5 rounded-xl border border-[#E5E7EB] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#0E2A47]">
              7TIME Business Management
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-[#2D7FF9] border border-blue-200">
              DASHBOARD
            </span>
            {isFetching && (
              <span title="Refreshing data...">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2D7FF9]" />
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
            Real-time business performance, inventory valuation, and operations overview
          </p>
        </div>

        {/* Accessible Period Selector */}
        <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 shadow-xs w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-1.5 text-[#64748B]">
            <Calendar className="h-4 w-4 text-[#2D7FF9]" />
            <span className="text-xs font-semibold text-slate-700">Period:</span>
          </div>
          <select 
            className="h-8 border-none bg-transparent outline-none pr-2 text-xs sm:text-sm font-semibold text-[#0E2A47] cursor-pointer"
            value={dateRange}
            onChange={e => setDateRange(e.target.value as DateRange)}
            aria-label="Select reporting period"
          >
            <option value="TODAY">Today</option>
            <option value="THIS_WEEK">This Week</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="LAST_MONTH">Last Month</option>
            <option value="THIS_YEAR">This Year</option>
            <option value="ALL">All Time</option>
          </select>
        </div>
      </div>

      {/* 2. COMPACT QUICK-ACTION TILES */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
            Quick Actions
          </h2>
          <span className="text-[11px] text-slate-400">Direct navigation</span>
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

      {/* 3. RESPONSIVE METRICS GRID (2 COLS ON MOBILE, 4 ON DESKTOP) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
            Key Financial Metrics
          </h2>
          <span className="text-[11px] text-slate-500 font-medium">
            Reporting: <span className="text-[#0E2A47] font-bold">{dateRange.replace('_', ' ')}</span>
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          {summaryMetrics.map(metric => {
            const Content = (
              <div className={`bg-white rounded-xl border border-[#E5E7EB] p-3 sm:p-4 shadow-xs transition-all flex flex-col justify-between h-full ${metric.accentBorder} ${metric.href ? 'hover:shadow-sm' : ''}`}>
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${metric.iconBg} flex items-center justify-center shrink-0`}>
                      <metric.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${metric.iconColor}`} />
                    </div>
                    <div className="flex items-center gap-1">
                      {metric.trend}
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.2 rounded bg-slate-100 text-slate-500 hidden sm:inline-block">
                        {metric.scopeBadge}
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] sm:text-xs font-semibold text-[#64748B] uppercase tracking-wider block truncate">
                    {metric.label}
                  </span>
                  
                  <div className={`text-base sm:text-xl lg:text-2xl font-extrabold tracking-tight mt-0.5 truncate ${metric.valueColor || 'text-[#0E2A47]'}`}>
                    {metric.value}
                  </div>
                </div>

                {metric.subtitle && (
                  <p className="text-[10px] sm:text-[11px] text-[#64748B] mt-2 pt-1.5 border-t border-slate-100 truncate font-medium">
                    {metric.subtitle}
                  </p>
                )}
              </div>
            )

            if (metric.href) {
              return (
                <Link key={metric.id} to={metric.href} className="block h-full group">
                  {Content}
                </Link>
              )
            }

            return (
              <div key={metric.id} className="h-full">
                {Content}
              </div>
            )
          })}
        </div>
      </div>

      {/* 4. TWO DISTINCT INTERACTIVE CHARTS (SIDE-BY-SIDE ON DESKTOP, STACKED ON MOBILE/TABLET) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* CHART 1: BUSINESS PERFORMANCE TRENDS */}
        <Card className="border-[#E5E7EB] shadow-xs overflow-hidden flex flex-col justify-between">
          <CardHeader className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <CardTitle className="text-base sm:text-lg font-bold text-[#0E2A47] flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#2D7FF9]" /> Business Performance Trends
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  Revenue, cost and profit over time
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded border border-blue-100 text-[11px]">
                  Rev: {formatMoney(data.sales.total)}
                </span>
                <span className="bg-purple-50 text-purple-700 font-semibold px-2 py-0.5 rounded border border-purple-100 text-[11px]">
                  Profit: {formatMoney(data.sales.profit)}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-4 sm:pt-5">
            <div className="h-64 sm:h-72 w-full">
              <Suspense fallback={
                <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin text-[#2D7FF9]" />
                  <span className="text-xs font-medium">Loading sales trend...</span>
                </div>
              }>
                <SalesTrendChart data={data.sales.chartData} />
              </Suspense>
            </div>
          </CardContent>
        </Card>

        {/* CHART 2: CASH FLOW & COLLECTIONS */}
        <Card className="border-[#E5E7EB] shadow-xs overflow-hidden flex flex-col justify-between">
          <CardHeader className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <CardTitle className="text-base sm:text-lg font-bold text-[#0E2A47] flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-emerald-600" /> Cash Flow & Collections
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  Actual money received and paid over time
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded border border-emerald-100 text-[11px]">
                  In: {formatMoney(data.cashFlow?.totalInflows ?? (data.sales.received + data.sales.resellerPayments))}
                </span>
                <span className="bg-red-50 text-red-700 font-semibold px-2 py-0.5 rounded border border-red-100 text-[11px]">
                  Out: {formatMoney(data.cashFlow?.totalOutflows ?? (data.purchases.paymentsMade + data.purchases.amountPaidAtPurchase + data.generalDelivery.fuel))}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-4 sm:pt-5">
            <div className="h-64 sm:h-72 w-full">
              <Suspense fallback={
                <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                  <span className="text-xs font-medium">Loading cash flow...</span>
                </div>
              }>
                <CashFlowChart data={data.cashFlow?.chartData || []} />
              </Suspense>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 5. TOP DEALER PAYABLES & TOP RESELLER RECEIVABLES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* WE OWE DEALERS */}
        <Card className="border-[#E5E7EB] shadow-xs">
          <CardHeader className="p-4 border-b border-slate-100 bg-red-50/40 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm sm:text-base font-bold text-red-950 flex items-center gap-1.5">
                <ArrowUpRight className="h-4 w-4 text-red-600" /> Top Dealer Payables
              </CardTitle>
              <CardDescription className="text-xs text-red-700">
                Total Outstanding: <span className="font-bold text-red-800">{formatMoney(data.purchases.totalPayable)}</span>
              </CardDescription>
            </div>
            <Link to="/dealers" className="text-xs font-semibold text-[#2D7FF9] hover:text-blue-800 flex items-center gap-0.5">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0 max-h-[260px] overflow-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-[#0E2A47] text-white sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-[11px]">Dealer</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider text-[11px]">Balance Owed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.dealers.filter(d => d.outstanding > 0).sort((a,b) => b.outstanding - a.outstanding).slice(0, 6).map(d => (
                  <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2.5 font-medium text-slate-900 truncate max-w-[180px]">
                      <Link to={`/dealers/${d.id}`} className="hover:text-[#2D7FF9] transition-colors">{d.name}</Link>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-red-600 whitespace-nowrap">
                      {formatMoney(d.outstanding)}
                    </td>
                  </tr>
                ))}
                {data.dealers.filter(d => d.outstanding > 0).length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-3 py-6 text-center text-slate-400 text-xs font-medium">
                      All dealer accounts are settled.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* RESELLERS OWE US */}
        <Card className="border-[#E5E7EB] shadow-xs">
          <CardHeader className="p-4 border-b border-slate-100 bg-green-50/40 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm sm:text-base font-bold text-green-950 flex items-center gap-1.5">
                <ArrowDownRight className="h-4 w-4 text-green-600" /> Top Reseller Receivables
              </CardTitle>
              <CardDescription className="text-xs text-green-700">
                Total Outstanding: <span className="font-bold text-green-800">{formatMoney(data.sales.totalReceivable)}</span>
              </CardDescription>
            </div>
            <Link to="/resellers" className="text-xs font-semibold text-[#2D7FF9] hover:text-blue-800 flex items-center gap-0.5">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0 max-h-[260px] overflow-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-[#0E2A47] text-white sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-[11px]">Reseller</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider text-[11px]">Due to Us</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.resellers.filter(r => r.outstanding > 0).sort((a,b) => b.outstanding - a.outstanding).slice(0, 6).map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2.5 font-medium text-slate-900 truncate max-w-[180px]">
                      <Link to={`/resellers/${r.id}`} className="hover:text-[#2D7FF9] transition-colors">{r.name}</Link>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-emerald-700 whitespace-nowrap">
                      {formatMoney(r.outstanding)}
                    </td>
                  </tr>
                ))}
                {data.resellers.filter(r => r.outstanding > 0).length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-3 py-6 text-center text-slate-400 text-xs font-medium">
                      No outstanding reseller receivables.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* 6. SECONDARY PANELS: INVENTORY, DELIVERY, AND NAEEM DEDICATED */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* INVENTORY OVERVIEW */}
        <Card className="border-[#E5E7EB] shadow-xs">
          <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-[#0E2A47] flex items-center gap-1.5">
              <Package className="h-4 w-4 text-emerald-600" /> Inventory Overview
            </CardTitle>
            <Link to="/products" className="text-xs font-semibold text-[#2D7FF9] hover:text-blue-800">
              Manage
            </Link>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5 text-xs sm:text-sm">
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-500">Total Items in Stock</span>
              <span className="font-bold text-slate-900">{data.inventory.totalItems}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-500">Current Valuation</span>
              <span className="font-bold text-slate-900">{formatMoney(data.inventory.totalValue)}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-500">Potential Revenue</span>
              <span className="font-bold text-blue-700">{formatMoney(data.inventory.potentialRevenue)}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Potential Profit</span>
              <span className="font-bold text-purple-700">{formatMoney(data.inventory.potentialProfit)}</span>
            </div>

            {(data.inventory.outOfStock > 0 || data.inventory.lowStock > 0) && (
              <div className="pt-2 flex flex-wrap gap-2 border-t border-slate-100">
                {data.inventory.outOfStock > 0 && (
                  <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] px-2 py-0.5 rounded-md flex items-center font-bold">
                    <AlertTriangle className="w-3 h-3 mr-1" /> {data.inventory.outOfStock} OUT OF STOCK
                  </span>
                )}
                {data.inventory.lowStock > 0 && (
                  <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] px-2 py-0.5 rounded-md flex items-center font-bold">
                    <AlertTriangle className="w-3 h-3 mr-1" /> {data.inventory.lowStock} LOW STOCK
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* GENERAL DAILY DELIVERY */}
        <Card className="border-[#E5E7EB] shadow-xs">
          <CardHeader className="p-4 border-b border-slate-100 bg-blue-50/40 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-[#0E2A47] flex items-center gap-1.5">
              <Truck className="h-4 w-4 text-[#2D7FF9]" /> General Delivery
            </CardTitle>
            <Link to="/general-deliveries" className="text-xs font-semibold text-[#2D7FF9] hover:text-blue-800">
              Ledger
            </Link>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5 text-xs sm:text-sm">
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-500">Active Delivery Days</span>
              <span className="font-bold text-slate-900">{data.generalDelivery.activeDays} days</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-500">Total Deliveries</span>
              <span className="font-bold text-blue-700">{formatMoney(data.generalDelivery.total)}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-500">Fuel Expenses</span>
              <span className="font-bold text-amber-600">{formatMoney(data.generalDelivery.fuel)}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Net Delivery Total</span>
              <span className="font-bold text-emerald-700">{formatMoney(data.generalDelivery.net)}</span>
            </div>
          </CardContent>
        </Card>

        {/* NAEEM DEDICATED */}
        <Card className="border-[#E5E7EB] shadow-xs">
          <CardHeader className="p-4 border-b border-slate-100 bg-purple-50/40 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-[#0E2A47] flex items-center gap-1.5">
              <Truck className="h-4 w-4 text-[#4A39D6]" /> NAEEM Dedicated
            </CardTitle>
            <Link to="/naeem" className="text-xs font-semibold text-[#4A39D6] hover:text-purple-800">
              Ledger
            </Link>
          </CardHeader>
          <CardContent className="p-4 space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-500">Route Trips</span>
              <span className="font-bold text-slate-900">{data.naeem.trips} trips</span>
            </div>
            {data.naeem.openingBalance !== undefined && data.naeem.openingBalance !== 0 && (
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Opening Balance</span>
                <span className="font-bold text-slate-700">{formatMoney(data.naeem.openingBalance)}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-500">Current Billed</span>
              <span className="font-bold text-purple-700">{formatMoney(data.naeem.total)}</span>
            </div>
            {data.naeem.totalDue !== undefined && (
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Total Due</span>
                <span className="font-bold text-[#0E2A47]">{formatMoney(data.naeem.totalDue)}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-500">Total Received</span>
              <span className="font-bold text-emerald-700">{formatMoney(data.naeem.received)}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Outstanding</span>
              <span className={`font-bold ${data.naeem.pending > 0 ? 'text-[#EF4444]' : 'text-slate-700'}`}>
                {formatMoney(data.naeem.pending)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 7. RECENT BUSINESS ACTIVITY TABLE */}
      <Card className="border-[#E5E7EB] shadow-xs overflow-hidden">
        <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold text-[#0E2A47] flex items-center gap-2">
            <ListOrdered className="h-4 w-4 text-[#2D7FF9]" /> Recent Business Activity
          </CardTitle>
          <span className="text-xs text-[#64748B]">Last recorded transactions</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-xs sm:text-sm text-left min-w-[500px]">
              <thead className="bg-[#0E2A47] text-white">
                <tr>
                  <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-[11px]">Date</th>
                  <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-[11px]">Type</th>
                  <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-[11px]">Entity / Partner</th>
                  <th className="px-4 py-2.5 text-right font-semibold uppercase tracking-wider text-[11px]">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recentActivity.map(act => (
                  <tr key={`${act.type}-${act.id}`} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-600 font-medium">{formatDate(act.date)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider inline-block ${
                        act.type === 'PURCHASE' ? 'bg-red-50 text-red-700 border border-red-200' :
                        act.type === 'WHOLESALE SALE' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        act.type === 'DEALER PAYMENT' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {act.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-[#0E2A47] truncate max-w-[200px]">{act.name}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-[#0E2A47]">{formatMoney(act.amount)}</td>
                  </tr>
                ))}
                {data.recentActivity.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-xs font-medium">
                      No recent activity recorded for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
