import { useState, useMemo } from "react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { formatMoney } from "@/lib/utils"
import { TrendingUp, Calendar, Filter } from "lucide-react"
import type { MonthlyFinancialTrend } from "@/services/dashboard"

interface MonthlyFinancialTrendsChartProps {
  data?: MonthlyFinancialTrend[]
}

type TrendSeriesFilter = "ALL" | "COMMERCIAL" | "CASH_FLOW" | "PROFIT"
type TimeHorizon = 6 | 12

export default function MonthlyFinancialTrendsChart({ data = [] }: MonthlyFinancialTrendsChartProps) {
  const [horizon, setHorizon] = useState<TimeHorizon>(6)
  const [seriesFilter, setSeriesFilter] = useState<TrendSeriesFilter>("ALL")

  // Filter chronologically for selected horizon (last 6 or 12 months)
  const visibleData = useMemo(() => {
    if (!data || data.length === 0) return []
    return data.slice(-horizon)
  }, [data, horizon])

  // Check if all series in visible data are 0 (empty period)
  const isAllZero = useMemo(() => {
    if (visibleData.length === 0) return true
    return visibleData.every(
      m => m.purchases === 0 && m.sales === 0 && m.profit === 0 && m.cashReceived === 0 && m.cashPaid === 0
    )
  }, [visibleData])

  return (
    <Card className="border-[#E5E7EB] shadow-xs">
      <CardHeader className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm sm:text-base font-bold text-[#0E2A47] flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#2D7FF9]" />
              Historical Monthly Financial Trends
            </CardTitle>
            <CardDescription className="text-xs text-[#64748B] mt-0.5">
              Chronological trajectory of purchases, sales, profit, and actual liquid cash movements
            </CardDescription>
          </div>

          {/* Controls: Horizon & Series Selector */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 6M vs 12M Horizon Toggle */}
            <div className="flex items-center bg-white border border-[#E5E7EB] p-0.5 rounded-lg shadow-2xs text-xs font-semibold">
              <button
                type="button"
                onClick={() => setHorizon(6)}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  horizon === 6
                    ? "bg-[#2D7FF9] text-white shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                6 Months
              </button>
              <button
                type="button"
                onClick={() => setHorizon(12)}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  horizon === 12
                    ? "bg-[#2D7FF9] text-white shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                12 Months
              </button>
            </div>

            {/* Series Filter Dropdown */}
            <div className="flex items-center gap-1.5 bg-white border border-[#E5E7EB] rounded-lg px-2.5 py-1 shadow-2xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={seriesFilter}
                onChange={e => setSeriesFilter(e.target.value as TrendSeriesFilter)}
                className="text-xs font-bold text-[#0E2A47] bg-transparent outline-none cursor-pointer"
                aria-label="Filter trend series"
              >
                <option value="ALL">All Financial Series</option>
                <option value="COMMERCIAL">Sales vs Purchases</option>
                <option value="CASH_FLOW">Cash In vs Cash Out</option>
                <option value="PROFIT">Gross Profit & COGS (Expense)</option>
              </select>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        {isAllZero ? (
          <div className="h-64 sm:h-72 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <div className="w-10 h-10 rounded-full bg-blue-50 text-[#2D7FF9] flex items-center justify-center mb-2">
              <Calendar className="w-5 h-5" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-700">No Historical Financial Activity Recorded</p>
            <p className="text-[11px] text-slate-500 max-w-sm mt-1">
              Monthly trend lines will automatically render chronologically as wholesale sales, supplier purchases, and cash transactions are logged across months.
            </p>
          </div>
        ) : (
          <div className="h-68 sm:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%" minHeight={260} debounce={100}>
              <LineChart data={visibleData} margin={{ top: 15, right: 15, bottom: 5, left: -5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis
                  dataKey="shortLabel"
                  tick={{ fontSize: 10, fill: "#64748B", fontWeight: 600 }}
                  axisLine={{ stroke: "#E2E8F0" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#64748B" }}
                  tickFormatter={(val: number) => `₹${Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  axisLine={{ stroke: "#E2E8F0" }}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const item: MonthlyFinancialTrend = payload[0]?.payload
                      return (
                        <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-lg p-3 text-xs space-y-1.5 min-w-[200px]">
                          <p className="font-bold text-[#0E2A47] pb-1 border-b border-slate-100 flex items-center justify-between">
                            <span>{item?.monthLabel || String(label)}</span>
                            <span className="text-[10px] text-slate-400 font-normal">Monthly Flow</span>
                          </p>

                          <div className="space-y-1 pt-0.5">
                            {(seriesFilter === "ALL" || seriesFilter === "COMMERCIAL") && (
                              <>
                                <div className="flex justify-between gap-4">
                                  <span className="flex items-center gap-1.5 text-slate-600">
                                    <span className="w-2 h-2 rounded-full bg-[#2D7FF9]" />
                                    Wholesale Sales:
                                  </span>
                                  <span className="font-bold text-[#2D7FF9]">{formatMoney(item?.sales || 0)}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="flex items-center gap-1.5 text-slate-600">
                                    <span className="w-2 h-2 rounded-full bg-[#64748B]" />
                                    Total Purchases:
                                  </span>
                                  <span className="font-bold text-slate-700">{formatMoney(item?.purchases || 0)}</span>
                                </div>
                              </>
                            )}

                            {(seriesFilter === "ALL" || seriesFilter === "PROFIT") && (
                              <>
                                <div className="flex justify-between gap-4">
                                  <span className="flex items-center gap-1.5 text-slate-600">
                                    <span className="w-2 h-2 rounded-full bg-[#4A39D6]" />
                                    Wholesale Gross Profit:
                                  </span>
                                  <span className="font-bold text-[#4A39D6]">{formatMoney(item?.profit || 0)}</span>
                                </div>
                                {seriesFilter === "PROFIT" && (
                                  <div className="flex justify-between gap-4">
                                    <span className="flex items-center gap-1.5 text-slate-600">
                                      <span className="w-2 h-2 rounded-full bg-slate-400" />
                                      Cost of Goods Sold (Expense):
                                    </span>
                                    <span className="font-bold text-slate-600">{formatMoney(item?.cogs || 0)}</span>
                                  </div>
                                )}
                              </>
                            )}

                            {(seriesFilter === "ALL" || seriesFilter === "CASH_FLOW") && (
                              <>
                                <div className="flex justify-between gap-4">
                                  <span className="flex items-center gap-1.5 text-slate-600">
                                    <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
                                    Cash Received:
                                  </span>
                                  <span className="font-bold text-emerald-600">{formatMoney(item?.cashReceived || 0)}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="flex items-center gap-1.5 text-slate-600">
                                    <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
                                    Cash Paid:
                                  </span>
                                  <span className="font-bold text-red-600">{formatMoney(item?.cashPaid || 0)}</span>
                                </div>
                                <div className="flex justify-between gap-4 pt-1 border-t border-slate-100 font-bold">
                                  <span className="text-[#0E2A47]">Net Cash Flow:</span>
                                  <span className={(item?.netCash || 0) >= 0 ? "text-emerald-700" : "text-red-700"}>
                                    {formatMoney(item?.netCash || 0)}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }}
                  iconType="circle"
                  iconSize={8}
                />

                {/* Series Lines with Smooth Monotone Curve & Brand Colors */}
                {(seriesFilter === "ALL" || seriesFilter === "COMMERCIAL") && (
                  <Line
                    name="Wholesale Sales"
                    type="monotone"
                    dataKey="sales"
                    stroke="#2D7FF9"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#2D7FF9" }}
                    activeDot={{ r: 5 }}
                  />
                )}
                {(seriesFilter === "ALL" || seriesFilter === "COMMERCIAL") && (
                  <Line
                    name="Total Purchases"
                    type="monotone"
                    dataKey="purchases"
                    stroke="#64748B"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#64748B" }}
                    activeDot={{ r: 5 }}
                  />
                )}
                {(seriesFilter === "ALL" || seriesFilter === "PROFIT") && (
                  <Line
                    name="Wholesale Gross Profit"
                    type="monotone"
                    dataKey="profit"
                    stroke="#4A39D6"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#4A39D6" }}
                    activeDot={{ r: 5 }}
                  />
                )}
                {seriesFilter === "PROFIT" && (
                  <Line
                    name="Cost of Goods (COGS)"
                    type="monotone"
                    dataKey="cogs"
                    stroke="#94A3B8"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={{ r: 2.5, fill: "#94A3B8" }}
                    activeDot={{ r: 4 }}
                  />
                )}
                {(seriesFilter === "ALL" || seriesFilter === "CASH_FLOW") && (
                  <Line
                    name="Cash Received"
                    type="monotone"
                    dataKey="cashReceived"
                    stroke="#22C55E"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#22C55E" }}
                    activeDot={{ r: 5 }}
                  />
                )}
                {(seriesFilter === "ALL" || seriesFilter === "CASH_FLOW") && (
                  <Line
                    name="Cash Paid"
                    type="monotone"
                    dataKey="cashPaid"
                    stroke="#EF4444"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#EF4444" }}
                    activeDot={{ r: 5 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Disclaimer / Accounting Note */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] text-slate-400 gap-1">
          <span>* Purchases, sales, and gross profit are mapped by transaction/invoice date; Cash In and Cash Out are mapped by actual payment date. Cumulative balances (Receivables & Payables) are displayed separately.</span>
          <span className="font-semibold text-slate-500">Source: Realtime Verified Financial Records</span>
        </div>
      </CardContent>
    </Card>
  )
}
