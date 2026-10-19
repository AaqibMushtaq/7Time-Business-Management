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
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-[#2563EB] border border-blue-200"
      >
        <Loader2 className="w-3 h-3 animate-spin text-[#2563EB]" />
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
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EAF7EF] text-[#087443] border border-emerald-200 hover:bg-[#EAF7EF]/80 transition-colors cursor-pointer"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#087443] animate-pulse" />
        <span>LIVE</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onManualRefresh}
      title="Cached snapshot. Click to reconnect / refresh."
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F1F4F8] text-[#52627A] border border-[#D9E0E8] hover:bg-slate-200 transition-colors cursor-pointer"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      <span>SYNC READY</span>
    </button>
  )
})
