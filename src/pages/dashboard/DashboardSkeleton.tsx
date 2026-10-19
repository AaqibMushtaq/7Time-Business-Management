import { memo } from "react"

export const DashboardSkeleton = memo(function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-label="Loading dashboard metrics">
      {/* ROW 1: Three Primary Business Card Skeletons */}
      <div className="dashboard-core-grid">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="dashboard-domain-card bg-white rounded-2xl border border-[#D9E0E8] overflow-hidden shadow-xs"
          >
            <div className="px-4 py-3 border-b border-[#D9E0E8] bg-[#F8F7F2]/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-200" />
                <div className="space-y-1">
                  <div className="h-4 w-32 bg-slate-200 rounded" />
                  <div className="h-2.5 w-24 bg-slate-200/60 rounded" />
                </div>
              </div>
              <div className="h-3 w-14 bg-slate-200 rounded" />
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="p-3 rounded-xl bg-[#F8F7F2] border border-[#D9E0E8]">
                    <div className="h-2.5 w-20 bg-slate-200 rounded mb-2" />
                    <div className="h-6 w-24 bg-slate-300 rounded" />
                    <div className="h-2 w-16 bg-slate-200 rounded mt-1.5" />
                  </div>
                ))}
              </div>
              <div className="h-10 bg-[#F8F7F2] rounded-xl border border-[#D9E0E8]" />
            </div>
          </div>
        ))}
      </div>

      {/* ROW 2: Two Operational Ledger Card Skeletons */}
      <div className="dashboard-secondary-grid">
        {[4, 5].map((i) => (
          <div
            key={i}
            className="dashboard-domain-card bg-white rounded-2xl border border-[#D9E0E8] overflow-hidden shadow-xs"
          >
            <div className="px-4 py-3 border-b border-[#D9E0E8] bg-[#F8F7F2]/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl ${i === 5 ? "bg-purple-100" : "bg-slate-200"}`} />
                <div className="space-y-1">
                  <div className="h-4 w-36 bg-slate-200 rounded" />
                  <div className="h-2.5 w-28 bg-slate-200/60 rounded" />
                </div>
              </div>
              <div className="h-3 w-20 bg-slate-200 rounded" />
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="p-3 rounded-xl bg-[#F8F7F2] border border-[#D9E0E8]">
                    <div className="h-2.5 w-20 bg-slate-200 rounded mb-2" />
                    <div className="h-6 w-24 bg-slate-300 rounded" />
                    <div className="h-2 w-16 bg-slate-200 rounded mt-1.5" />
                  </div>
                ))}
              </div>
              <div className="h-8 bg-[#F8F7F2] rounded-xl border border-[#D9E0E8]" />
            </div>
          </div>
        ))}
      </div>

      {/* QUICK ACTIONS SKELETON */}
      <div>
        <div className="h-3 w-24 bg-slate-200 rounded mb-2.5" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center p-3 bg-white border border-[#D9E0E8] rounded-xl h-24 shadow-xs"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-100 mb-2" />
              <div className="h-2.5 w-16 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})
