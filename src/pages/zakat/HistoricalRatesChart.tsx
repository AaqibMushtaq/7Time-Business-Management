import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { fetchHistoricalMetalRates } from "@/services/zakatService"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"
import { Button } from "@/components/ui/button"
import { LineChart as ChartIcon, Calendar, Info, RefreshCw, AlertCircle } from "lucide-react"

interface HistoricalRatesChartProps {
  className?: string
}

export function HistoricalRatesChart({ className = "" }: HistoricalRatesChartProps) {
  const [timeframe, setTimeframe] = useState<7 | 30>(30)
  const [selectedMetal, setSelectedMetal] = useState<"BOTH" | "GOLD" | "SILVER">("BOTH")

  const {
    data: chartData = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["zakat-historical-rates", timeframe],
    queryFn: () => fetchHistoricalMetalRates(timeframe),
    staleTime: 5 * 60 * 1000,
  })

  const hasData = chartData.length > 0
  const singlePoint = chartData.length === 1 ? chartData[0] : null
  const latestPoint = chartData.length > 0 ? chartData[chartData.length - 1] : null

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4 ${className}`}
      data-testid="historical-rates-chart-section"
    >
      {/* 1. Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 shrink-0">
            <ChartIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Precious Metal Rate History
            </h3>
            <p className="text-[11px] text-slate-500">
              Historical spot price progression (INR per gram) from verified market feeds
            </p>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Timeframe Selector */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50/70 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setTimeframe(7)}
              className={`px-2.5 py-1 font-medium rounded-md transition-all cursor-pointer ${
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
              className={`px-2.5 py-1 font-medium rounded-md transition-all cursor-pointer ${
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
              className={`px-2.5 py-1 font-medium rounded-md transition-all cursor-pointer ${
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
              className={`px-2.5 py-1 font-medium rounded-md transition-all cursor-pointer ${
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
              className={`px-2.5 py-1 font-medium rounded-md transition-all cursor-pointer ${
                selectedMetal === "SILVER"
                  ? "bg-amber-50 text-amber-800 shadow-2xs font-semibold border border-amber-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              data-testid="filter-silver-only"
            >
              Silver Only
            </button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800"
            title="Refresh history"
            aria-label="Refresh history"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* 2. Chart Body States */}
      {isLoading ? (
        <div
          className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 gap-2"
          data-testid="chart-loading-state"
        >
          <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
          <span className="text-xs font-medium">Loading historical rate trend...</span>
        </div>
      ) : isError ? (
        <div
          className="h-64 flex flex-col items-center justify-center text-center p-4 bg-rose-50/50 rounded-xl border border-rose-200 gap-2"
          data-testid="chart-error-state"
        >
          <AlertCircle className="h-6 w-6 text-rose-500" />
          <h4 className="text-xs font-bold text-rose-900">Failed to load historical rate data</h4>
          <p className="text-[11px] text-rose-600 max-w-xs">
            Could not retrieve historical precious metal records from the database.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="mt-1 h-7 text-xs border-rose-200 text-rose-800 hover:bg-rose-100"
          >
            Retry
          </Button>
        </div>
      ) : !hasData ? (
        <div
          className="p-6 bg-slate-50/60 rounded-xl border border-slate-200 text-center space-y-3"
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
        <div className="space-y-3">
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

          <div className="h-64 w-full" data-testid="chart-active-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: selectedMetal === "BOTH" ? 15 : 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="date"
                  padding={{ left: 30, right: 30 }}
                  tick={{ fontSize: 10, fill: "#64748B" }}
                  tickMargin={6}
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
                  />
                )}

                <Tooltip
                  content={<CustomTooltip />}
                  wrapperStyle={{ outline: "none" }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: 8, fontSize: 11 }}
                />

                {/* Gold Series: Blue */}
                {(selectedMetal === "BOTH" || selectedMetal === "GOLD") && (
                  <Line
                    yAxisId="gold"
                    type="monotone"
                    dataKey="goldRate"
                    name="Gold (24k INR/g)"
                    stroke="#2563EB"
                    strokeWidth={2}
                    dot={{ r: 5, fill: "#2563EB", stroke: "#FFFFFF", strokeWidth: 1.5 }}
                    activeDot={{ r: 7, stroke: "#2563EB", strokeWidth: 2 }}
                    connectNulls={false}
                  />
                )}

                {/* Silver Series: Amber */}
                {(selectedMetal === "BOTH" || selectedMetal === "SILVER") && (
                  <Line
                    yAxisId="silver"
                    type="monotone"
                    dataKey="silverRate"
                    name="Silver (Pure INR/g)"
                    stroke="#D97706"
                    strokeWidth={2}
                    dot={{ r: 5, fill: "#D97706", stroke: "#FFFFFF", strokeWidth: 1.5 }}
                    activeDot={{ r: 7, stroke: "#D97706", strokeWidth: 2 }}
                    connectNulls={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 3. Valuation Source & Data Integrity Footer */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-slate-100 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-700">Valuation Source:</span>
          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
            <Info className="h-3 w-3 text-slate-400" />
            International Spot (INR) via GoldAPI.io
          </span>
          {latestPoint && (
            <span className="text-slate-400">
              • Latest rate date: <strong className="text-slate-600">{latestPoint.date}</strong>
            </span>
          )}
        </div>
        <div className="text-[10px] text-slate-400 italic">
          *Bullion spot prices converted to INR. Does not include local Kashmir/Indian retail jeweller making charges or GST.
        </div>
      </div>
    </div>
  )
}

function formatChartDate(dateStr: string): string {
  if (!dateStr || !dateStr.includes("-")) return dateStr
  const [year, month, day] = dateStr.split("-").map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

function formatTooltipDate(dateStr: string): string {
  if (!dateStr || !dateStr.includes("-")) return dateStr
  const [year, month, day] = dateStr.split("-").map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null

  return (
    <div
      className="bg-white p-3 rounded-xl border border-slate-200 shadow-md text-xs space-y-1.5 animate-in fade-in-50 duration-100"
      data-testid="chart-custom-tooltip"
    >
      <div className="font-bold text-slate-800 border-b border-slate-100 pb-1 flex items-center justify-between gap-4">
        <span>Date: {formatTooltipDate(label)}</span>
        <span className="text-[10px] text-slate-400 font-normal">INR / gram</span>
      </div>
      {payload.map((item: any) => (
        <div key={item.name} className="flex items-center justify-between gap-4">
          <span style={{ color: item.color }} className="font-medium flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.name}:
          </span>
          <span className="font-bold text-slate-900">
            {typeof item.value === "number"
              ? `₹${item.value.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 4,
                })}/g`
              : "Unavailable"}
          </span>
        </div>
      ))}
      <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">
        Source: International Spot via GoldAPI.io
      </div>
    </div>
  )
}

