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
      <div className="flex flex-wrap items-center gap-2">
        {/* Monthly vs All-Time Toggle */}
        <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 shadow-2xs">
          <button
            type="button"
            onClick={() => onViewModeChange("MONTHLY")}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
              viewMode === "MONTHLY"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("ALL_TIME")}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
              viewMode === "ALL_TIME"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All Time
          </button>
        </div>

        {/* Month Navigator (visible when in MONTHLY mode) */}
        {viewMode === "MONTHLY" && (
          <div className="flex items-center gap-1 bg-white border border-slate-200/80 rounded-lg px-1.5 py-0.5 shadow-2xs">
            <button
              type="button"
              onClick={onPrevMonth}
              className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
              title="Previous month"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center gap-1.5 px-1.5 text-xs font-bold text-slate-900 min-w-[120px] justify-center">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>{monthLabel}</span>
            </div>
            <button
              type="button"
              onClick={onNextMonth}
              className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
              title="Next month"
              aria-label="Next month"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Refresh Button */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isFetching}
          className="p-1.5 bg-white border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50 rounded-lg text-slate-600 hover:text-slate-900 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
          title="Refresh dashboard data"
          aria-label="Refresh dashboard data"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-blue-600" : ""}`}
          />
        </button>
      </div>
    )
  }
)
