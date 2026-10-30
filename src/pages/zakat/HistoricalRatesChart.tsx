import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { fetchHistoricalMetalRates } from "@/services/zakatService"
import type { HistoricalMetalRatePoint } from "@/types/zakat"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"
import { Button } from "@/components/ui/button"
import {
  LineChart as ChartIcon,
  Calendar,
  Info,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Activity,
} from "lucide-react"

interface HistoricalRatesChartProps {
  className?: string
}

export function HistoricalRatesChart({ className = "" }: HistoricalRatesChartProps) {
  const [timeframe, setTimeframe] = useState<7 | 30>(30)
  const [selectedMetal, setSelectedMetal] = useState<"BOTH" | "GOLD" | "SILVER">("BOTH")
  const [sessionMode, setSessionMode] = useState<"close" | "both">("close")
  const [includeLiveSpot, setIncludeLiveSpot] = useState<boolean>(true)

  const {
    data: rawData = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["zakat-historical-rates", timeframe, sessionMode],
    queryFn: () => fetchHistoricalMetalRates(timeframe, sessionMode),
    staleTime: 5 * 60 * 1000,
  })

  // Filter live spot observation in or out based on toggle
  const chartData = useMemo(() => {
    if (!rawData || rawData.length === 0) return []
    if (includeLiveSpot) return rawData
    return rawData.filter((p) => !p.isLive && p.status !== "LIVE_SPOT")
  }, [rawData, includeLiveSpot])

  const hasData = chartData.length > 0
  const singlePoint = chartData.length === 1 ? chartData[0] : null
  const latestPoint = chartData.length > 0 ? chartData[chartData.length - 1] : null

  // Performance Insights Calculations
  const insights = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return {
        goldChange: null,
        silverChange: null,
        goldHigh: null,
        goldLow: null,
        silverHigh: null,
        silverLow: null,
      }
    }

    const goldPoints = chartData.filter((p) => typeof p.goldRate === "number" && p.goldRate > 0)
    const silverPoints = chartData.filter((p) => typeof p.silverRate === "number" && p.silverRate > 0)

    // 1. Gold Period Change
    let goldChange = null
    if (goldPoints.length >= 2) {
      const first = goldPoints[0].goldRate as number
      const last = goldPoints[goldPoints.length - 1].goldRate as number
      const diff = last - first
      const pct = (diff / first) * 100
      goldChange = { diff, pct, first, last }
    }

    // 2. Silver Period Change
    let silverChange = null
    if (silverPoints.length >= 2) {
      const first = silverPoints[0].silverRate as number
      const last = silverPoints[silverPoints.length - 1].silverRate as number
      const diff = last - first
      const pct = (diff / first) * 100
      silverChange = { diff, pct, first, last }
    }

    // 3. Highs and Lows
    let goldHigh = null
    let goldLow = null
    if (goldPoints.length > 0) {
      const sorted = [...goldPoints].sort((a, b) => (b.goldRate as number) - (a.goldRate as number))
      goldHigh = sorted[0]
      goldLow = sorted[sorted.length - 1]
    }

    let silverHigh = null
    let silverLow = null
    if (silverPoints.length > 0) {
      const sorted = [...silverPoints].sort((a, b) => (b.silverRate as number) - (a.silverRate as number))
      silverHigh = sorted[0]
      silverLow = sorted[sorted.length - 1]
    }

    return {
      goldChange,
      silverChange,
      goldHigh,
      goldLow,
      silverHigh,
      silverLow,
    }
  }, [chartData])

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-5 ${className}`}
      data-testid="historical-rates-chart-section"
    >
      {/* 1. Header & Controls Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-1">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 shrink-0">
            <ChartIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Precious Metal Rate History
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Indian domestic benchmark rates (INR per gram) • IBJA via TrackLivePrice
            </p>
          </div>
        </div>

        {/* Responsive Controls Bar */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Timeframe Selector */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50/70 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setTimeframe(7)}
              className={`px-3 py-1.5 font-medium rounded-md transition-all cursor-pointer ${
                timeframe === 7
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              data-testid="filter-7-days"
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => setTimeframe(30)}
              className={`px-3 py-1.5 font-medium rounded-md transition-all cursor-pointer ${
                timeframe === 30
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              data-testid="filter-30-days"
            >
              30 Days
            </button>
          </div>

          {/* Metal Filter Selector */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50/70 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setSelectedMetal("BOTH")}
              className={`px-3 py-1.5 font-medium rounded-md transition-all cursor-pointer ${
                selectedMetal === "BOTH"
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              data-testid="filter-both-metals"
            >
              Both Metals
            </button>
            <button
              type="button"
              onClick={() => setSelectedMetal("GOLD")}
              className={`px-3 py-1.5 font-medium rounded-md transition-all cursor-pointer ${
                selectedMetal === "GOLD"
                  ? "bg-blue-50 text-blue-700 shadow-2xs font-semibold border border-blue-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              data-testid="filter-gold-only"
            >
              Gold Only
            </button>
            <button
              type="button"
              onClick={() => setSelectedMetal("SILVER")}
              className={`px-3 py-1.5 font-medium rounded-md transition-all cursor-pointer ${
                selectedMetal === "SILVER"
                  ? "bg-amber-50 text-amber-800 shadow-2xs font-semibold border border-amber-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              data-testid="filter-silver-only"
            >
              Silver Only
            </button>
          </div>

          {/* Live Spot Toggle */}
          <button
            type="button"
            onClick={() => setIncludeLiveSpot((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
              includeLiveSpot
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs font-semibold"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:text-slate-900"
            }`}
            data-testid="toggle-live-prices"
            aria-pressed={includeLiveSpot}
            title={includeLiveSpot ? "Hide live spot quote" : "Show live spot quote"}
          >
            <Activity className="h-3.5 w-3.5 text-emerald-600" />
            {includeLiveSpot ? "Live Spot: On" : "Live Spot: Off"}
          </button>

          {/* AM / PM Session Toggle */}
          <button
            type="button"
            onClick={() => setSessionMode((prev) => (prev === "close" ? "both" : "close"))}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
              sessionMode === "both"
                ? "bg-indigo-50 text-indigo-800 border-indigo-300 shadow-2xs font-semibold"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:text-slate-900"
            }`}
            data-testid="toggle-session-mode"
            aria-pressed={sessionMode === "both"}
            title={sessionMode === "both" ? "Switch to daily close" : "Switch to show both AM & PM sessions"}
          >
            <Clock className="h-3.5 w-3.5 text-indigo-600" />
            {sessionMode === "both" ? "AM & PM Sessions" : "Daily Close (PM)"}
          </button>

          {/* Refresh Action */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800 cursor-pointer"
            title="Refresh history"
            aria-label="Refresh history"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* 2. Chart Body States */}
      {isLoading ? (
        <div
          className="h-72 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 gap-2"
          data-testid="chart-loading-state"
        >
          <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
          <span className="text-xs font-medium">Loading historical precious metal rates from IBJA domestic benchmark...</span>
        </div>
      ) : isError ? (
        <div
          className="h-72 flex flex-col items-center justify-center text-center p-4 bg-rose-50/50 rounded-xl border border-rose-200 gap-2"
          data-testid="chart-error-state"
        >
          <AlertCircle className="h-6 w-6 text-rose-500" />
          <h4 className="text-xs font-bold text-rose-900">Failed to load historical rate data</h4>
          <p className="text-[11px] text-rose-600 max-w-xs">
            Could not retrieve historical precious metal records from market feed.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="mt-1 h-7 text-xs border-rose-200 text-rose-800 hover:bg-rose-100 cursor-pointer"
          >
            Retry
          </Button>
        </div>
      ) : !hasData ? (
        <div
          className="p-8 bg-slate-50/60 rounded-xl border border-slate-200 text-center space-y-3"
          data-testid="chart-empty-state"
        >
          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mx-auto border border-amber-200">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">No Historical Rates Recorded</h4>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto mt-0.5 leading-relaxed">
              No precious metal price records were found in the selected timeframe ({timeframe} days).
              Daily rates will appear automatically once ingested from market feeds.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {singlePoint && (
            <div
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-blue-50/80 border border-blue-200 text-xs text-blue-900"
              data-testid="single-day-info-banner"
            >
              <Info className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="font-medium">
                Historical tracking has started. Only one day&apos;s rates are available; trend lines will develop as additional daily rates are collected.
              </span>
            </div>
          )}

          <div className="h-72 w-full" data-testid="chart-active-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: selectedMetal === "BOTH" ? 15 : 10, left: 5, bottom: 0 }}
              >
                <defs>
                  {/* Subtle Gold Area Gradient */}
                  <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                  </linearGradient>
                  {/* Subtle Silver Area Gradient */}
                  <linearGradient id="silverGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D97706" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#D97706" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />

                <XAxis
                  dataKey="date"
                  padding={{ left: 24, right: 24 }}
                  tick={{ fontSize: 10, fill: "#64748B" }}
                  tickMargin={8}
                  stroke="#CBD5E1"
                  tickFormatter={formatChartDate}
                />

                {/* Left Y-Axis: Gold (or Silver when Silver Only) */}
                {selectedMetal !== "SILVER" ? (
                  <YAxis
                    yAxisId="gold"
                    orientation="left"
                    tick={{ fontSize: 10, fill: "#2563EB" }}
                    stroke="#2563EB"
                    tickFormatter={(val) => `₹${Math.round(val).toLocaleString("en-IN")}`}
                    domain={[
                      (min: number) => (isNaN(min) ? 0 : Math.floor(min * 0.95)),
                      (max: number) => (isNaN(max) ? 100 : Math.ceil(max * 1.05)),
                    ]}
                    label={{
                      value: "Gold (INR/g)",
                      angle: -90,
                      position: "insideLeft",
                      offset: 12,
                      style: { fontSize: 10, fill: "#2563EB", fontWeight: 600 },
                    }}
                  />
                ) : (
                  <YAxis
                    yAxisId="silver"
                    orientation="left"
                    tick={{ fontSize: 10, fill: "#D97706" }}
                    stroke="#D97706"
                    tickFormatter={(val) => `₹${Number(val).toFixed(1)}`}
                    domain={[
                      (min: number) => (isNaN(min) ? 0 : Math.floor(min * 0.95)),
                      (max: number) => (isNaN(max) ? 100 : Math.ceil(max * 1.05)),
                    ]}
                    label={{
                      value: "Silver (INR/g)",
                      angle: -90,
                      position: "insideLeft",
                      offset: 12,
                      style: { fontSize: 10, fill: "#D97706", fontWeight: 600 },
                    }}
                  />
                )}

                {/* Right Y-Axis: Silver (when Both Metals selected) */}
                {selectedMetal === "BOTH" && (
                  <YAxis
                    yAxisId="silver"
                    orientation="right"
                    tick={{ fontSize: 10, fill: "#D97706" }}
                    stroke="#D97706"
                    tickFormatter={(val) => `₹${Number(val).toFixed(1)}`}
                    domain={[
                      (min: number) => (isNaN(min) ? 0 : Math.floor(min * 0.95)),
                      (max: number) => (isNaN(max) ? 100 : Math.ceil(max * 1.05)),
                    ]}
                    label={{
                      value: "Silver (INR/g)",
                      angle: 90,
                      position: "insideRight",
                      offset: 12,
                      style: { fontSize: 10, fill: "#D97706", fontWeight: 600 },
                    }}
                  />
                )}

                <Tooltip
                  content={<CustomTooltip fullData={chartData} />}
                  wrapperStyle={{ outline: "none" }}
                />

                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: 10, fontSize: 11 }}
                />

                {/* Gold Series: Blue */}
                {(selectedMetal === "BOTH" || selectedMetal === "GOLD") && (
                  <Area
                    yAxisId="gold"
                    type="monotone"
                    dataKey="goldRate"
                    name="Gold (24k INR/g)"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    fill="url(#goldGradient)"
                    dot={{ r: 4, fill: "#2563EB", stroke: "#FFFFFF", strokeWidth: 1.5 }}
                    activeDot={{ r: 6, stroke: "#2563EB", strokeWidth: 2 }}
                    connectNulls={false}
                  />
                )}

                {/* Silver Series: Amber */}
                {(selectedMetal === "BOTH" || selectedMetal === "SILVER") && (
                  <Area
                    yAxisId="silver"
                    type="monotone"
                    dataKey="silverRate"
                    name="Silver (Pure INR/g)"
                    stroke="#D97706"
                    strokeWidth={2.5}
                    fill="url(#silverGradient)"
                    dot={{ r: 4, fill: "#D97706", stroke: "#FFFFFF", strokeWidth: 1.5 }}
                    activeDot={{ r: 6, stroke: "#D97706", strokeWidth: 2 }}
                    connectNulls={false}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* 3. Performance Insight Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2" data-testid="performance-insights-grid">
            {/* Insight 1: Gold Period Change */}
            <div className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/50 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Gold Period Change</span>
                <span className="text-[10px] text-slate-400">{timeframe}D</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                {insights.goldChange ? (
                  <>
                    <span className="text-base font-bold text-slate-900">
                      {insights.goldChange.diff >= 0 ? "+" : ""}
                      ₹{insights.goldChange.diff.toLocaleString("en-IN", { maximumFractionDigits: 1 })}/g
                    </span>
                    <span
                      className={`inline-flex items-center text-xs font-semibold ${
                        insights.goldChange.pct >= 0 ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {insights.goldChange.pct >= 0 ? (
                        <ArrowUpRight className="h-3.5 w-3.5 mr-0.5" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5 mr-0.5" />
                      )}
                      {insights.goldChange.pct >= 0 ? "+" : ""}
                      {insights.goldChange.pct.toFixed(2)}%
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-slate-400 italic">Insufficient trend data</span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {insights.goldChange ? `Net movement over ${timeframe} days` : "Requires at least 2 observations"}
              </div>
            </div>

            {/* Insight 2: Silver Period Change */}
            <div className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/50 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Silver Period Change</span>
                <span className="text-[10px] text-slate-400">{timeframe}D</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                {insights.silverChange ? (
                  <>
                    <span className="text-base font-bold text-slate-900">
                      {insights.silverChange.diff >= 0 ? "+" : ""}
                      ₹{insights.silverChange.diff.toLocaleString("en-IN", { maximumFractionDigits: 2 })}/g
                    </span>
                    <span
                      className={`inline-flex items-center text-xs font-semibold ${
                        insights.silverChange.pct >= 0 ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {insights.silverChange.pct >= 0 ? (
                        <ArrowUpRight className="h-3.5 w-3.5 mr-0.5" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5 mr-0.5" />
                      )}
                      {insights.silverChange.pct >= 0 ? "+" : ""}
                      {insights.silverChange.pct.toFixed(2)}%
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-slate-400 italic">Insufficient trend data</span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {insights.silverChange ? `Net movement over ${timeframe} days` : "Requires at least 2 observations"}
              </div>
            </div>

            {/* Insight 3: Period High */}
            <div className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/50 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Period High</span>
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div className="mt-2 space-y-0.5">
                {selectedMetal !== "SILVER" && insights.goldHigh && (
                  <div className="text-xs font-semibold text-blue-900">
                    Gold:{" "}
                    <span className="font-bold text-slate-900">
                      ₹{Number(insights.goldHigh.goldRate).toLocaleString("en-IN", { maximumFractionDigits: 1 })}/g
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal ml-1">({formatChartDate(insights.goldHigh.date)})</span>
                  </div>
                )}
                {selectedMetal !== "GOLD" && insights.silverHigh && (
                  <div className="text-xs font-semibold text-amber-900">
                    Silver:{" "}
                    <span className="font-bold text-slate-900">
                      ₹{Number(insights.silverHigh.silverRate).toLocaleString("en-IN", { maximumFractionDigits: 2 })}/g
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal ml-1">({formatChartDate(insights.silverHigh.date)})</span>
                  </div>
                )}
                {!insights.goldHigh && !insights.silverHigh && (
                  <span className="text-xs text-slate-400 italic">No price data</span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Highest recorded rate in period</div>
            </div>

            {/* Insight 4: Period Low */}
            <div className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/50 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Period Low</span>
                <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
              </div>
              <div className="mt-2 space-y-0.5">
                {selectedMetal !== "SILVER" && insights.goldLow && (
                  <div className="text-xs font-semibold text-blue-900">
                    Gold:{" "}
                    <span className="font-bold text-slate-900">
                      ₹{Number(insights.goldLow.goldRate).toLocaleString("en-IN", { maximumFractionDigits: 1 })}/g
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal ml-1">({formatChartDate(insights.goldLow.date)})</span>
                  </div>
                )}
                {selectedMetal !== "GOLD" && insights.silverLow && (
                  <div className="text-xs font-semibold text-amber-900">
                    Silver:{" "}
                    <span className="font-bold text-slate-900">
                      ₹{Number(insights.silverLow.silverRate).toLocaleString("en-IN", { maximumFractionDigits: 2 })}/g
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal ml-1">({formatChartDate(insights.silverLow.date)})</span>
                  </div>
                )}
                {!insights.goldLow && !insights.silverLow && (
                  <span className="text-xs text-slate-400 italic">No price data</span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Lowest recorded rate in period</div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Valuation Source, Provenance & Disclaimer Footer */}
      <div className="pt-3 border-t border-slate-100 space-y-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-700">Valuation Source:</span>
            <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1 text-[11px]">
              <Info className="h-3 w-3 text-amber-600" />
              IBJA Domestic Bullion Benchmark (via TrackLivePrice)
            </span>
            {latestPoint && (
              <span className="text-slate-400 text-[11px]">
                • Latest observation: <strong className="text-slate-600">{latestPoint.date}</strong>{" "}
                {latestPoint.session ? (
                  <span className="text-blue-600 font-semibold">({latestPoint.session} Session)</span>
                ) : (
                  <span className="text-slate-500 font-medium">(Market Close)</span>
                )}
              </span>
            )}
          </div>
        </div>

        <p className="text-[10px] text-slate-500 leading-relaxed">
          Authentic Indian domestic benchmark rates published by the <strong>India Bullion and Jewellers Association (IBJA)</strong> in INR per gram (exclusive of 3% GST and making charges). Open dataset provided by{" "}
          <a
            href="https://trackliveprice.com/methodology/#data"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline font-medium"
          >
            TrackLivePrice
          </a>{" "}
          under free reuse attribution licence. Secondary verification via official{" "}
          <a
            href="https://ibjarates.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline font-medium"
          >
            ibjarates.com
          </a>.
        </p>
      </div>
    </div>
  )
}

function formatChartDate(dateStr: string): string {
  if (!dateStr) return ""
  const parts = dateStr.split(" ")
  const rawDate = parts[0]
  const sessionTag = parts[1] ? ` ${parts[1]}` : ""
  if (!rawDate.includes("-")) return dateStr
  const [year, month, day] = rawDate.split("-").map(Number)
  const d = new Date(year, month - 1, day)
  return `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}${sessionTag}`
}

function formatTooltipDate(dateStr: string): string {
  if (!dateStr) return ""
  const parts = dateStr.split(" ")
  const rawDate = parts[0]
  const sessionTag = parts[1] ? ` (${parts[1]} Session)` : ""
  if (!rawDate.includes("-")) return dateStr
  const [year, month, day] = rawDate.split("-").map(Number)
  const d = new Date(year, month - 1, day)
  return `${d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })}${sessionTag}`
}

interface CustomTooltipProps {
  active?: boolean
  payload?: any[]
  label?: string
  fullData?: HistoricalMetalRatePoint[]
}

export function CustomTooltip({ active, payload, label, fullData = [] }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null

  const point = payload[0]?.payload as HistoricalMetalRatePoint | undefined
  const isLive = Boolean(point?.isLive || point?.status === "LIVE_SPOT")
  const session = point?.session || (label?.includes("AM") ? "AM" : label?.includes("PM") ? "PM" : "CLOSE")

  // Calculate day-over-day change against previous day in fullData
  let dailyGoldChange = null
  let dailySilverChange = null

  if (fullData && fullData.length > 0 && label) {
    const idx = fullData.findIndex((p) => p.date === label)
    if (idx > 0) {
      const prev = fullData[idx - 1]
      if (point?.goldRate && prev.goldRate) {
        const diff = point.goldRate - prev.goldRate
        const pct = (diff / prev.goldRate) * 100
        dailyGoldChange = { diff, pct }
      }
      if (point?.silverRate && prev.silverRate) {
        const diff = point.silverRate - prev.silverRate
        const pct = (diff / prev.silverRate) * 100
        dailySilverChange = { diff, pct }
      }
    }
  }

  const badgeText = isLive
    ? "Live Spot Quote"
    : session === "AM"
    ? "IBJA Opening (AM)"
    : session === "PM"
    ? "IBJA Closing (PM)"
    : "Market Close"

  const badgeClass = isLive
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : session === "AM"
    ? "bg-amber-50 text-amber-700 border-amber-200"
    : session === "PM"
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-slate-100 text-slate-600 border-slate-200"

  const sourceText = point?.source || (isLive ? "IBJA Domestic (Live Quote)" : "IBJA via TrackLivePrice")

  return (
    <div
      className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-lg text-xs space-y-2 animate-in fade-in-50 duration-100 min-w-56"
      data-testid="chart-custom-tooltip"
    >
      <div className="font-bold text-slate-800 border-b border-slate-100 pb-1.5 flex items-center justify-between gap-3">
        <span>{formatTooltipDate(label || "")}</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${badgeClass}`}>
          {badgeText}
        </span>
      </div>

      <div className="space-y-1.5">
        {payload.map((item: any) => {
          const isGold = item.name.includes("Gold")
          const change = isGold ? dailyGoldChange : dailySilverChange

          return (
            <div key={item.name} className="flex items-center justify-between gap-4">
              <span style={{ color: item.color }} className="font-medium flex items-center gap-1.5">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {item.name}:
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-900">
                  {typeof item.value === "number"
                    ? `₹${item.value.toLocaleString("en-IN", {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 4,
                      })}/g`
                    : "Unavailable"}
                </span>
                {change && (
                  <span
                    className={`text-[10px] font-semibold px-1 py-0.2 rounded flex items-center ${
                      change.pct >= 0 ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"
                    }`}
                  >
                    {change.pct >= 0 ? "+" : ""}
                    {change.pct.toFixed(2)}%
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="text-[10px] text-slate-400 pt-1.5 border-t border-slate-100 flex items-center justify-between">
        <span>Source: {sourceText}</span>
        <span className="text-[10px] text-slate-500 font-medium">
          {isLive ? "Real-time" : "Domestic Benchmark"}
        </span>
      </div>
    </div>
  )
}
