import { memo } from "react"

export const DashboardSkeleton = memo(function DashboardSkeleton() {
  return (
    <div className="space-y-3 animate-pulse" aria-label="Loading dashboard metrics">
      {/* 5 Compact Executive Business Card Skeletons */}
      <div className="dashboard-kpi-grid">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-slate-200/80 p-3 sm:p-3.5 shadow-card flex flex-col justify-between min-w-0"
          >
            <div>
              {/* Header Skeleton */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-lg bg-slate-200" />
                  <div className="h-3 w-24 bg-slate-200 rounded" />
                </div>
                <div className="h-2.5 w-14 bg-slate-100 rounded" />
              </div>

              {/* Primary Amount Skeleton */}
              <div className="space-y-1">
                <div className="h-2 w-16 bg-slate-200 rounded" />
                <div className="h-6 w-28 bg-slate-300 rounded" />
              </div>
            </div>

            {/* Secondary Metrics Skeleton */}
            <div className="grid grid-cols-2 gap-2 pt-2 mt-2.5 border-t border-slate-100">
              <div className="space-y-1">
                <div className="h-2 w-14 bg-slate-100 rounded" />
                <div className="h-3.5 w-18 bg-slate-200 rounded" />
              </div>
              <div className="space-y-1">
                <div className="h-2 w-14 bg-slate-100 rounded" />
                <div className="h-3.5 w-18 bg-slate-200 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})
