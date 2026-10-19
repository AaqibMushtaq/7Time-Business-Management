import React from "react"
import { cn } from "@/lib/utils"

export interface PageHeaderProps {
  title: string
  description?: string
  badge?: string | {
    label: string
    variant?: "brand" | "neutral" | "success" | "warning"
  }
  actions?: React.ReactNode
  className?: string
}

const badgeVariants = {
  brand: "bg-[#EBF2FE] text-[#2563EB] border-blue-200",
  neutral: "bg-[#F1F4F8] text-[#52627A] border-[#D9E0E8]",
  success: "bg-[#EAF7EF] text-[#087443] border-emerald-200",
  warning: "bg-[#FFF4D6] text-[#92400E] border-amber-200",
}

export function PageHeader({
  title,
  description,
  badge,
  actions,
  className,
}: PageHeaderProps) {
  const badgeLabel = typeof badge === "string" ? badge : badge?.label
  const badgeVariant = typeof badge === "string" ? "brand" : badge?.variant || "brand"

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4",
        className
      )}
    >
      <div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#172B4D]">
            {title}
          </h1>
          {badgeLabel && (
            <span
              className={cn(
                "px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold border tracking-wider uppercase",
                badgeVariants[badgeVariant]
              )}
            >
              {badgeLabel}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-[#52627A] mt-1 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
          {actions}
        </div>
      )}
    </div>
  )
}
