import { AlertCircle, Lock } from "lucide-react"
import { Navigate } from "react-router-dom"
import { useDashboardSummary } from "./useDashboardSummary"
import { DashboardHeader } from "./DashboardHeader"
import { DashboardFilters } from "./DashboardFilters"
import { BusinessSummaryGrid } from "./BusinessSummaryGrid"
import { DashboardSkeleton } from "./DashboardSkeleton"
import { useModuleAccess } from "@/hooks/useModuleAccess"

export default function DashboardPage() {
  const { user, isAdmin, hasModule, hasAnyModule, getDefaultRoute, profile, loading } = useModuleAccess()

  const hasBusinessModules =
    isAdmin ||
    hasModule("purchases") ||
    hasModule("wholesale_sales") ||
    hasModule("dealers") ||
    hasModule("products") ||
    hasModule("inventory") ||
    hasModule("deliveries")

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

  // When loading in an authenticated session, show skeleton
  if (loading) {
    return <DashboardSkeleton />
  }

  // If authenticated user has zero modules assigned
  if (user && !hasAnyModule) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 bg-white border border-slate-200 rounded-2xl text-center space-y-5 shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 mx-auto flex items-center justify-center">
          <Lock className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Account Pending Activation</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Your account is registered, but no functional modules have been assigned by the administrator yet.
            Please reach out to your administrator to configure your access.
          </p>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 font-mono">
          Account: {profile?.email || user?.email || "Unknown User"}
        </div>
      </div>
    )
  }

  // If authenticated user only has personal modules (e.g. personal ledger or zakat tracker)
  if (user && !hasBusinessModules) {
    const defaultRoute = getDefaultRoute()
    if (defaultRoute && defaultRoute !== "/") {
      return <Navigate to={defaultRoute} replace />
    }
  }

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
