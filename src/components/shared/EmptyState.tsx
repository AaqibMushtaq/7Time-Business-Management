import React from "react"
import { type LucideIcon, Package } from "lucide-react"
import { cn } from "@/lib/utils"

export interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon = Package,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "text-center py-12 px-4 bg-white rounded-2xl border border-dashed border-[#D9E0E8]",
        className
      )}
    >
      <div className="w-12 h-12 bg-[#EBF2FE] text-[#2563EB] rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-base font-bold text-[#172B4D]">{title}</h3>
      {description && (
        <p className="text-xs sm:text-sm text-[#52627A] mt-1 max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
