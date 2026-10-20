import { memo } from "react"
import { LiveSyncBadge } from "./LiveSyncBadge"

interface DashboardHeaderProps {
  isConnected: boolean
  isFetching: boolean
  onRefresh: () => void
}

export const DashboardHeader = memo(function DashboardHeader({
  isConnected,
  isFetching,
  onRefresh,
}: DashboardHeaderProps) {
    return (
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 p-1 flex items-center justify-center shrink-0 shadow-2xs">
          <img
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            alt="7TIME Logo"
            className="w-5 h-5 shrink-0 object-contain"
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
              7TIME Business Management
            </h1>
            <LiveSyncBadge
              isConnected={isConnected}
              isFetching={isFetching}
              onManualRefresh={onRefresh}
            />
          </div>
          <p className="text-[10.5px] text-slate-500 font-normal leading-tight hidden sm:block">
            Five clear business sections: Wholesale, Purchases, General Delivery, NAEEM, and Personal Ledger
          </p>
        </div>
      </div>
    )
  }
)
