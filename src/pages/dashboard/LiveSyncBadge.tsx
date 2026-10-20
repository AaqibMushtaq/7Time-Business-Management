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
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-blue-50 text-blue-600 border border-blue-200 shadow-2xs"
      >
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
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
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/80 hover:bg-emerald-100/70 transition-all cursor-pointer shadow-2xs"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span>LIVE</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onManualRefresh}
      title="Cached snapshot. Click to reconnect / refresh."
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200/70 transition-all cursor-pointer shadow-2xs"
    >
      <span className="w-2 h-2 rounded-full bg-slate-400" />
      <span>SYNC READY</span>
    </button>
  )
})
