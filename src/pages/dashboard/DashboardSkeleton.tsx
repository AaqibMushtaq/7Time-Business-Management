import { memo } from "react"

export const DashboardSkeleton = memo(function DashboardSkeleton() {
  return (
    <div className="space-y-3 animate-pulse" aria-label="Loading dashboard metrics">
      {/* 5 Compact Executive Business Card Skeletons */}
      <div className="dashboard-kpi-grid">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-card flex flex-col justify-between min-w-0"
          >
            <div>
              {/* Header Skeleton */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-slate-200 shrink-0" />
                  <div className="h-4 w-28 bg-slate-200 rounded-md" />
                </div>
                <div className="h-3.5 w-16 bg-slate-100 rounded-md" />
              </div>

              {/* Primary Amount Skeleton */}
              <div className="space-y-1.5 mt-2">
                <div className="h-2.5 w-20 bg-slate-200 rounded" />
                <div className="h-7 w-36 bg-slate-300 rounded-lg" />
              </div>
            </div>

            {/* Secondary Metrics Skeleton */}
            <div className="grid grid-cols-2 gap-3 pt-3 mt-3 border-t border-slate-100">
              <div className="space-y-1.5">
                <div className="h-2.5 w-16 bg-slate-100 rounded" />
                <div className="h-4 w-20 bg-slate-200 rounded-md" />
              </div>
              <div className="space-y-1.5">
                <div className="h-2.5 w-16 bg-slate-100 rounded" />
                <div className="h-4 w-20 bg-slate-200 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})
