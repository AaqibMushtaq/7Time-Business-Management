import { memo } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Layers, Users, Wallet } from "lucide-react"

export const DashboardSkeleton = memo(function DashboardSkeleton() {
  return (
    <div className="space-y-5 animate-pulse" aria-label="Loading dashboard metrics">
      {/* LAYER 1: SKELETON EXECUTIVE KPI CARDS (6 CARDS) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="h-3 w-36 bg-slate-200 rounded" />
          <div className="h-3 w-24 bg-slate-200 rounded" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-[#E5E7EB] p-3 shadow-xs min-h-[108px] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-slate-100" />
                  <div className="w-8 h-3 rounded bg-slate-100" />
                </div>
                <div className="w-16 h-3 rounded bg-slate-200 mt-1" />
                <div className="w-24 h-5 rounded bg-slate-200 mt-2" />
              </div>
              <div className="w-full h-2.5 rounded bg-slate-100 mt-2 pt-1.5 border-t border-slate-100" />
            </div>
          ))}
        </div>
      </div>

      {/* LAYER 2: SKELETON PERFORMANCE CONTAINER */}
      <Card className="border-[#E5E7EB] shadow-xs overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-slate-300" />
                <div className="h-5 w-48 bg-slate-200 rounded" />
              </div>
              <div className="h-3 w-56 bg-slate-100 rounded mt-1.5" />
            </div>
            <div className="h-8 w-44 bg-slate-200 rounded-lg" />
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="h-68 sm:h-76 w-full bg-slate-100/70 rounded-lg flex items-center justify-center border border-slate-100">
            <div className="text-center space-y-1">
              <div className="w-10 h-10 rounded-full bg-slate-200 mx-auto" />
              <div className="h-3 w-32 bg-slate-200 rounded mx-auto" />
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 pt-3 border-t border-slate-100">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-200/60 text-xs space-y-2">
                <div className="h-3 w-24 bg-slate-200 rounded" />
                <div className="h-3 w-full bg-slate-100 rounded" />
                <div className="h-3 w-2/3 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* LAYER 3: SKELETON RECEIVABLES & PAYABLES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-[#E5E7EB] shadow-xs">
          <CardHeader className="p-4 border-b border-slate-100 bg-emerald-50/30 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-slate-300" />
                  <div className="h-4 w-36 bg-slate-200 rounded" />
                </div>
                <div className="h-3 w-28 bg-slate-100 rounded" />
              </div>
              <div className="h-7 w-28 bg-slate-200 rounded-lg" />
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-emerald-100/60">
              <div className="h-8 bg-slate-100 rounded" />
              <div className="h-8 bg-slate-100 rounded" />
              <div className="h-8 bg-slate-100 rounded" />
            </div>
          </CardHeader>
          <CardContent className="p-3 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between items-center py-1">
                <div className="space-y-1">
                  <div className="h-3.5 w-32 bg-slate-200 rounded" />
                  <div className="h-2.5 w-20 bg-slate-100 rounded" />
                </div>
                <div className="h-4 w-16 bg-slate-200 rounded" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-[#E5E7EB] shadow-xs">
          <CardHeader className="p-4 border-b border-slate-100 bg-red-50/30 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-slate-300" />
                <div className="h-4 w-32 bg-slate-200 rounded" />
              </div>
              <div className="h-3 w-24 bg-slate-100 rounded" />
            </div>
            <div className="h-4 w-20 bg-slate-100 rounded" />
          </CardHeader>
          <CardContent className="p-3 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between items-center py-1">
                <div className="space-y-1">
                  <div className="h-3.5 w-28 bg-slate-200 rounded" />
                  <div className="h-2.5 w-16 bg-slate-100 rounded" />
                </div>
                <div className="h-4 w-16 bg-slate-200 rounded" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* LAYER 4: SKELETON QUICK ACTIONS */}
      <div>
        <div className="h-3 w-24 bg-slate-200 rounded mb-2" />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center p-2.5 sm:p-3 bg-white border border-[#E5E7EB] rounded-xl h-20"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 mb-1.5" />
              <div className="h-2.5 w-16 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})
