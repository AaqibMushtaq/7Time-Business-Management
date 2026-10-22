import { memo } from "react"
import { ChevronLeft, ChevronRight, Calendar, RefreshCw } from "lucide-react"
import type { ViewMode } from "./types"

interface DashboardFiltersProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  monthLabel: string
  onPrevMonth: () => void
  onNextMonth: () => void
  onRefresh: () => void
  isFetching: boolean
}

export const DashboardFilters = memo(function DashboardFilters({
  viewMode,
  onViewModeChange,
  monthLabel,
  onPrevMonth,
  onNextMonth,
  onRefresh,
  isFetching,
}: DashboardFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
      {/* Monthly vs All-Time Toggle */}
      <div
        role="group"
        aria-label="Period filter scope"
        className="inline-flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 shadow-2xs"
      >
        <button
          type="button"
          onClick={() => onViewModeChange("MONTHLY")}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer min-h-[36px] sm:min-h-[32px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-hidden ${
            viewMode === "MONTHLY"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange("ALL_TIME")}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer min-h-[36px] sm:min-h-[32px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-hidden ${
            viewMode === "ALL_TIME"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
          }`}
        >
          All Time
        </button>
      </div>

      {/* Month Navigator (visible when in MONTHLY mode) */}
      {viewMode === "MONTHLY" && (
        <div className="flex items-center gap-1 bg-white border border-slate-200/80 rounded-xl px-1.5 py-0.5 shadow-2xs">
          <button
            type="button"
            onClick={onPrevMonth}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer min-h-[36px] min-w-[36px] sm:min-h-[32px] sm:min-w-[32px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-hidden active:bg-slate-200"
            title="Previous month"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 px-2 text-xs font-bold text-slate-900 min-w-[105px] justify-center select-none">
            <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="truncate">{monthLabel}</span>
          </div>
          <button
            type="button"
            onClick={onNextMonth}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer min-h-[36px] min-w-[36px] sm:min-h-[32px] sm:min-w-[32px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-hidden active:bg-slate-200"
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
        onClick={onRefresh}
        disabled={isFetching}
        className="p-2 sm:p-1.5 bg-white border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50 rounded-xl text-slate-600 hover:text-slate-900 transition-all cursor-pointer shadow-2xs disabled:opacity-50 min-h-[36px] min-w-[36px] sm:min-h-[32px] sm:min-w-[32px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-hidden active:scale-95"
        title="Refresh dashboard data"
        aria-label="Refresh dashboard data"
      >
        <RefreshCw
          className={`w-4 h-4 sm:w-3.5 sm:h-3.5 ${isFetching ? "animate-spin text-blue-600" : ""}`}
        />
      </button>
    </div>
  )
})
