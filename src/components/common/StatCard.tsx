import React from "react"
import { type LucideIcon, AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export interface StatCardProps {
  title: string
  value: React.ReactNode
  subtitle?: React.ReactNode
  icon?: LucideIcon
  isLoading?: boolean
  isError?: boolean
  onClick?: () => void
  active?: boolean
  variant?: "default" | "blue" | "amber" | "green" | "purple" | "rose"
  className?: string
  tabIndex?: number
  titleTooltip?: string
}

const variantStyles = {
  default: {
    base: "bg-white border-[#DCE5F0] hover:border-slate-300",
    active: "ring-2 ring-[#207FF9] bg-[#F0F6FE]/50 border-[#207FF9]",
    title: "text-[#607087]",
    value: "text-[#102B46]",
    dot: "bg-slate-400",
    dotActive: "bg-[#207FF9] ring-2 ring-blue-300"
  },
  blue: {
    base: "bg-[#F0F6FE] border-[#C6DCFC] hover:border-[#96BFFB]",
    active: "ring-2 ring-[#207FF9] bg-[#DBEAFE] border-[#207FF9]",
    title: "text-[#207FF9]",
    value: "text-[#0E4399]",
    dot: "bg-[#207FF9]",
    dotActive: "bg-[#0E4399] ring-2 ring-blue-400"
  },
  amber: {
    base: "bg-[#FFFBEB] border-amber-200 hover:border-amber-300",
    active: "ring-2 ring-[#F59E0B] bg-[#FEF3C7] border-[#F59E0B]",
    title: "text-[#D97706]",
    value: "text-[#92400E]",
    dot: "bg-[#F59E0B]",
    dotActive: "bg-[#92400E] ring-2 ring-amber-400"
  },
  green: {
    base: "bg-[#F0FDF4] border-green-200 hover:border-green-300",
    active: "ring-2 ring-[#22C55E] bg-[#DCFCE7] border-[#22C55E]",
    title: "text-[#16A34A]",
    value: "text-[#14532D]",
    dot: "bg-[#22C55E]",
    dotActive: "bg-[#14532D] ring-2 ring-green-400"
  },
  purple: {
    base: "bg-[#F3EEFB] border-[#D4C5F4] hover:border-[#B79EEC]",
    active: "ring-2 ring-[#5427B8] bg-[#E3D6F7] border-[#5427B8]",
    title: "text-[#5427B8]",
    value: "text-[#311470]",
    dot: "bg-[#5427B8]",
    dotActive: "bg-[#311470] ring-2 ring-purple-300"
  },
  rose: {
    base: "bg-rose-50/50 border-rose-200 hover:border-rose-300",
    active: "ring-2 ring-[#DC2626] bg-rose-100 border-[#DC2626]",
    title: "text-[#DC2626]",
    value: "text-[#991B1B]",
    dot: "bg-[#DC2626]",
    dotActive: "bg-[#991B1B] ring-2 ring-rose-300"
  }
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  isLoading = false,
  isError = false,
  onClick,
  active = false,
  variant = "default",
  className = "",
  tabIndex,
  titleTooltip
}: StatCardProps) {
  const styles = variantStyles[variant]
  const isClickable = Boolean(onClick)

  return (
    <Card
      onClick={onClick}
      className={`transition-all border shadow-xs ${isClickable ? "cursor-pointer hover:shadow-md" : ""} ${
        active ? styles.active : styles.base
      } ${className}`}
      tabIndex={isClickable ? (tabIndex ?? 0) : undefined}
      title={titleTooltip}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
    >
      <CardContent className="p-4 pt-4 sm:pt-5">
        <div className="flex items-center justify-between">
          <span className={`text-[11px] sm:text-xs font-bold uppercase tracking-wider ${styles.title}`}>
            {title}
          </span>
          {Icon ? (
            <Icon className="h-4 w-4 text-slate-400" />
          ) : (
            <div className={`w-2.5 h-2.5 rounded-full ${active ? styles.dotActive : styles.dot}`} />
          )}
        </div>
        <div className={`text-2xl sm:text-3xl font-extrabold mt-1.5 sm:mt-2 ${styles.value}`}>
          {isLoading ? (
            <span className="text-slate-400 text-base">Loading...</span>
          ) : isError ? (
            <span className="text-[#EF4444] text-base font-semibold flex items-center gap-1">
              <AlertCircle className="w-4 h-4 inline" /> Unavailable
            </span>
          ) : (
            value
          )}
        </div>
        {subtitle && (
          <div className="text-[11px] mt-1 flex items-center justify-between">
            {subtitle}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
