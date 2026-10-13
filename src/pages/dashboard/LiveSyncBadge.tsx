import { memo } from "react"
import { Loader2 } from "lucide-react"

interface LiveSyncBadgeProps {
  isConnected: boolean
  isFetching: boolean
  onManualRefresh?: () => void
}

export const LiveSyncBadge = memo(function LiveSyncBadge({
  isConnected,
  isFetching,
  onManualRefresh,
}: LiveSyncBadgeProps) {
  if (isFetching) {
    return (
      <span
        title="Syncing live business data..."
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-[#2D7FF9] border border-blue-200"
      >
        <Loader2 className="w-3 h-3 animate-spin text-[#2D7FF9]" />
        <span>SYNCING</span>
      </span>
    )
  }

  if (isConnected) {
    return (
      <button
        type="button"
        onClick={onManualRefresh}
        title="Supabase Realtime active. Click to refresh."
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span>LIVE</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onManualRefresh}
      title="Cached snapshot. Click to reconnect / refresh."
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 transition-colors cursor-pointer"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      <span>SYNC READY</span>
    </button>
  )
})
