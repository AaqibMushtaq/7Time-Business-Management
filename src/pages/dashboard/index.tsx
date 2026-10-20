import { AlertCircle } from "lucide-react"
import { useDashboardSummary } from "./useDashboardSummary"
import { DashboardHeader } from "./DashboardHeader"
import { DashboardFilters } from "./DashboardFilters"
import { BusinessSummaryGrid } from "./BusinessSummaryGrid"
import { DashboardSkeleton } from "./DashboardSkeleton"

export default function DashboardPage() {
  const {
    viewMode,
    setViewMode,
    monthLabel,
    data,
    isLoading,
    isError,
    error,
    isFetching,
    isConnected,
    refetch,
    handlePrevMonth,
    handleNextMonth,
  } = useDashboardSummary()

  return (
    <div className="w-full min-w-0 max-w-full space-y-3 pb-4">
      {/* COMPACT EXECUTIVE HEADER & CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
        <DashboardHeader
          isConnected={isConnected}
          isFetching={isFetching}
          onRefresh={refetch}
        />
        <DashboardFilters
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          monthLabel={monthLabel}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onRefresh={refetch}
          isFetching={isFetching}
        />
      </div>

      {/* ERROR STATE */}
      {isError && (
        <div className="max-w-2xl mx-auto my-12 p-6 bg-rose-50/70 border border-rose-200 rounded-2xl text-center space-y-3.5 shadow-card">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-rose-800">Failed to Load Dashboard Data</h2>
          <p className="text-xs sm:text-sm text-rose-700/90 font-medium">
            {(error as Error)?.message || "A database connectivity issue prevented data consolidation."}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-rose-700 transition-colors shadow-xs cursor-pointer"
          >
            Try Again
          </button>
        </div>
      )}

      {/* LOADING STATE */}
      {!isError && (isLoading || !data) && (
        <DashboardSkeleton />
      )}

      {/* PRIMARY OVERVIEW: Five Compact Business Summary Cards */}
      {!isError && data && (
        <section id="executive-summary-cards" aria-label="Executive Financial Overview">
          <BusinessSummaryGrid data={data} />
        </section>
      )}
    </div>
  )
}
