import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getDashboardStats, type DateRange } from "@/services/dashboard"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { formatMoney, formatDate } from "@/lib/utils"
import { 
  Loader2, Package, ShoppingCart, Truck, Users, 
  ArrowUpRight, ArrowDownRight, AlertTriangle, ListOrdered, 
  Calendar, TrendingUp, TrendingDown, Minus, Wallet, 
  FileText, CircleDollarSign, ArrowRight
} from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { Link } from "react-router-dom"

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange>("THIS_MONTH")

  const { data, isLoading } = useQuery({
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
    enabled: prevRange !== dateRange,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-[50vh] gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-[#2D7FF9]" />
        <p className="text-sm font-medium text-slate-500">Loading business metrics...</p>
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
        <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-bold inline-flex items-center">
          <TrendingUp className="w-3 h-3 mr-0.5 shrink-0" /> +{change.val.toFixed(1)}%
        </span>
      )
    } else if (change.trend === 'down') {
      return (
        <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-bold inline-flex items-center">
          <TrendingDown className="w-3 h-3 mr-0.5 shrink-0" /> -{change.val.toFixed(1)}%
        </span>
      )
    }
    return (
      <span className="text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-medium inline-flex items-center">
        <Minus className="w-3 h-3 mr-0.5 shrink-0" /> 0%
      </span>
    )
  }

  const netCashFlow = (data.sales.received + data.sales.resellerPayments) - (data.purchases.paymentsMade + data.purchases.amountPaidAtPurchase + data.generalDelivery.fuel)

  const quickActions = [
    { label: "Purchases", href: "/purchases", icon: ShoppingCart, color: "text-[#2D7FF9]", bg: "bg-blue-50" },
    { label: "Wholesale", href: "/wholesale", icon: TrendingUp, color: "text-[#4A39D6]", bg: "bg-purple-50" },
    { label: "Dealers", href: "/dealers", icon: Users, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Products", href: "/products", icon: Package, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Deliveries", href: "/general-deliveries", icon: Truck, color: "text-[#33C5F3]", bg: "bg-sky-50" },
    { label: "Reports", href: "/reports", icon: FileText, color: "text-slate-700", bg: "bg-slate-100" },
  ]

  // Primary 8 metrics arranged in compact 2-column tiles for mobile
  const summaryMetrics = [
    {
      id: "purchases",
      label: "Total Purchases",
      value: formatMoney(data.purchases.total),
      trend: renderTrend(data.purchases.total, prevData?.purchases.total),
      subtitle: "Gross supplier purchases",
      href: "/purchases",
      icon: ShoppingCart,
      iconColor: "text-[#2D7FF9]",
      iconBg: "bg-blue-50",
      accentBorder: "hover:border-blue-300",
    },
    {
      id: "sales",
      label: "Wholesale Sales",
      value: formatMoney(data.sales.total),
      trend: renderTrend(data.sales.total, prevData?.sales.total),
      subtitle: `${data.sales.transactions} recorded orders`,
      href: "/wholesale",
      icon: TrendingUp,
      iconColor: "text-[#2D7FF9]",
      iconBg: "bg-blue-50",
      accentBorder: "hover:border-blue-300",
    },
    {
      id: "profit",
      label: "Realized Profit",
      value: formatMoney(data.sales.profit),
      trend: renderTrend(data.sales.profit, prevData?.sales.profit),
      subtitle: "Sales gross margin",
      href: "/wholesale",
      icon: CircleDollarSign,
      iconColor: "text-[#4A39D6]",
      iconBg: "bg-purple-50",
      accentBorder: "hover:border-purple-300",
    },
    {
      id: "inventory",
      label: "Current Inventory",
      value: formatMoney(data.inventory.totalValue),
      subtitle: `${data.inventory.totalItems} items in stock`,
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
      href: "/resellers",
      icon: ArrowDownRight,
      iconColor: "text-[#22C55E]",
      iconBg: "bg-green-50",
      accentBorder: "hover:border-green-300",
      valueColor: data.sales.totalReceivable > 0 ? "text-green-700" : "text-[#0E2A47]",
    },
    {
      id: "cash-flow",
      label: "Net Cash Flow",
      value: formatMoney(netCashFlow),
      subtitle: "Inflows − Outflows",
      icon: Wallet,
      iconColor: "text-[#33C5F3]",
      iconBg: "bg-sky-50",
      accentBorder: "hover:border-sky-300",
      valueColor: netCashFlow >= 0 ? "text-emerald-700" : "text-red-600",
    },
    {
      id: "delivery-net",
      label: "General Delivery",
      value: formatMoney(data.generalDelivery.net),
      subtitle: `${data.generalDelivery.activeDays} days • Fuel ${formatMoney(data.generalDelivery.fuel)}`,
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
      {/* 1. PROFESSIONAL PAGE HEADER & PERIOD SELECTOR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 sm:p-5 rounded-xl border border-[#E5E7EB] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#0E2A47]">
              7TIME Business Management
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-[#2D7FF9] border border-blue-200">
              DASHBOARD
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
            Real-time business performance, inventory, and operations overview
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 shadow-xs w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2 text-slate-500">
            <Calendar className="h-4 w-4 text-[#2D7FF9]" />
            <span className="text-xs font-semibold text-slate-600">Period:</span>
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

      {/* 2. COMPACT QUICK-ACTION TILES (FACEBOOK-STYLE TILE BAR) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
            Quick Actions
          </h2>
          <span className="text-[11px] text-slate-400">Jump to module</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
          {quickActions.map(action => (
            <Link
              key={action.label}
              to={action.href}
              className="flex flex-col items-center justify-center p-2.5 sm:p-3 bg-white border border-[#E5E7EB] rounded-xl hover:border-blue-300 hover:shadow-xs transition-all text-center group"
            >
              <div className={`w-8 h-8 rounded-lg ${action.bg} flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform`}>
                <action.icon className={`w-4 h-4 ${action.color}`} />
              </div>
              <span className="text-xs font-semibold text-[#0E2A47] group-hover:text-[#2D7FF9] truncate max-w-full">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* 3. MOBILE-FIRST COMPACT METRICS GRID (2 COLUMNS ON MOBILE, 4 ON DESKTOP) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
            Key Financial Metrics
          </h2>
          <span className="text-[11px] text-slate-400">
            {dateRange.replace('_', ' ')}
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
                    {metric.trend}
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

      {/* 4. WHOLESALE REVENUE & PROFIT TREND CHART */}
      <Card className="border-[#E5E7EB] shadow-xs overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <CardTitle className="text-base sm:text-lg font-bold text-[#0E2A47] flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-[#2D7FF9]" /> Wholesale Performance Trends
              </CardTitle>
              <CardDescription className="text-xs text-[#64748B]">
                Daily revenue, costs, and profit progression
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded border border-blue-100">
                Revenue: {formatMoney(data.sales.total)}
              </span>
              <span className="bg-purple-50 text-purple-700 font-semibold px-2 py-0.5 rounded border border-purple-100">
                Profit: {formatMoney(data.sales.profit)}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-5">
          <div className="h-60 sm:h-72 w-full">
            {data.sales.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.sales.chartData} margin={{ top: 5, right: 10, bottom: 5, left: -15 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(t) => t.substring(5)} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(val) => `₹${val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}`} />
                  <Tooltip 
                    formatter={(value: any) => formatMoney(value as number)}
                    contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Line type="monotone" name="Revenue" dataKey="sales" stroke="#2D7FF9" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                  <Line type="monotone" name="Cost" dataKey="cost" stroke="#EF4444" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" name="Profit" dataKey="profit" stroke="#4A39D6" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                No wholesale transactions recorded for this period.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 5. DEALER & RESELLER OUTSTANDING POSITIONS (BALANCED 2-COLUMN ON TABLET/DESKTOP) */}
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
            <Link to="/dealers" className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-0.5">
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
                      <Link to={`/dealers/${d.id}`} className="hover:text-blue-600">{d.name}</Link>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-red-600 whitespace-nowrap">
                      {formatMoney(d.outstanding)}
                    </td>
                  </tr>
                ))}
                {data.dealers.filter(d => d.outstanding > 0).length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-3 py-6 text-center text-slate-400 text-xs">
                      No outstanding dealer balances.
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
            <Link to="/resellers" className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-0.5">
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
                      <Link to={`/resellers/${r.id}`} className="hover:text-blue-600">{r.name}</Link>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-green-700 whitespace-nowrap">
                      {formatMoney(r.outstanding)}
                    </td>
                  </tr>
                ))}
                {data.resellers.filter(r => r.outstanding > 0).length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-3 py-6 text-center text-slate-400 text-xs">
                      No outstanding reseller receivables.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* 6. OPERATIONS & DELIVERIES BREAKDOWN (3 CARDS ON DESKTOP) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* INVENTORY BREAKDOWN */}
        <Card className="border-[#E5E7EB] shadow-xs">
          <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-[#0E2A47] flex items-center gap-1.5">
              <Package className="h-4 w-4 text-emerald-600" /> Inventory Overview
            </CardTitle>
            <Link to="/inventory" className="text-xs font-semibold text-blue-600 hover:text-blue-800">
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
            <Link to="/general-deliveries" className="text-xs font-semibold text-blue-600 hover:text-blue-800">
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
              <span className="font-bold text-green-700">{formatMoney(data.generalDelivery.net)}</span>
            </div>
          </CardContent>
        </Card>

        {/* NAEEM UNCLE DEDICATED OPERATIONS */}
        <Card className="border-[#E5E7EB] shadow-xs">
          <CardHeader className="p-4 border-b border-slate-100 bg-purple-50/40 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-[#0E2A47] flex items-center gap-1.5">
              <Truck className="h-4 w-4 text-[#4A39D6]" /> NAEEM Dedicated
            </CardTitle>
            <Link to="/naeem" className="text-xs font-semibold text-purple-600 hover:text-purple-800">
              Ledger
            </Link>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5 text-xs sm:text-sm">
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-500">Total Route Trips</span>
              <span className="font-bold text-slate-900">{data.naeem.trips} trips</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-500">Total Billed</span>
              <span className="font-bold text-purple-700">{formatMoney(data.naeem.total)}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-500">Total Received</span>
              <span className="font-bold text-green-700">{formatMoney(data.naeem.received)}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Pending Balance</span>
              <span className={`font-bold ${data.naeem.pending > 0 ? 'text-red-600' : 'text-slate-700'}`}>
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
          <span className="text-xs text-[#64748B]">Last transactions</span>
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
                        'bg-green-50 text-green-700 border border-green-200'
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
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-xs">
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
