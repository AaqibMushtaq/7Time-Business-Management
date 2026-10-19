import React from "react"
import { SearchInput } from "./SearchInput"

export interface DataTableToolbarProps {
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  filters?: React.ReactNode
  actions?: React.ReactNode
  selectedCount?: number
  className?: string
}

export function DataTableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search records...",
  filters,
  actions,
  selectedCount,
  className,
}: DataTableToolbarProps) {
  const hasContent = onSearchChange || filters || actions || selectedCount

  if (!hasContent) return null

  return (
    <div
      className={`flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 border-b border-[#D9E0E8] bg-white rounded-t-2xl ${className || ""}`}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2.5">
        {onSearchChange && (
          <div className="w-full sm:w-72">
            <SearchInput
              value={searchValue || ""}
              onChange={onSearchChange}
              placeholder={searchPlaceholder}
              className="h-9 text-xs"
            />
          </div>
        )}
        {filters}
        {selectedCount !== undefined && selectedCount > 0 && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
            {selectedCount} selected
          </span>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {actions}
        </div>
      )}
    </div>
  )
}
