import React from "react"
import { type LucideIcon, AlertCircle, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type MetricVariant =
  | "default"
  | "cyan"
  | "blue"
  | "indigo"
  | "purple"
  | "green"
  | "amber"
  | "red"

export interface MetricCardProps {
  title: string
  value: React.ReactNode
  subtitle?: React.ReactNode
  icon?: LucideIcon
  trend?: {
    value: string
    isPositive?: boolean
    label?: string
  }
  variant?: MetricVariant
  isLoading?: boolean
  isError?: boolean
  onClick?: () => void
  active?: boolean
  className?: string
  tabIndex?: number
  titleTooltip?: string
}

const variantStyles: Record<
  MetricVariant,
  {
    base: string
    active: string
    title: string
    value: string
    iconBg: string
    iconColor: string
    dot: string
    dotActive: string
  }
> = {
  default: {
    base: "bg-white border-[#D9E0E8] hover:border-slate-300 shadow-xs rounded-2xl",
    active: "ring-2 ring-[#2563EB] border-[#2563EB] bg-blue-50/20",
    title: "text-[#66758A]",
    value: "text-[#172B4D]",
    iconBg: "bg-[#F1F4F8]",
    iconColor: "text-[#52627A]",
    dot: "bg-slate-400",
    dotActive: "bg-[#2563EB] ring-2 ring-blue-300",
  },
  cyan: {
    base: "bg-white border-[#D9E0E8] hover:border-slate-300 shadow-xs rounded-2xl",
    active: "ring-2 ring-[#2563EB] border-[#2563EB] bg-sky-50/20",
    title: "text-[#66758A]",
    value: "text-[#0284C7]",
    iconBg: "bg-sky-50 border border-sky-100",
    iconColor: "text-[#0284C7]",
    dot: "bg-[#0284C7]",
    dotActive: "bg-[#0284C7] ring-2 ring-sky-300",
  },
  blue: {
    base: "bg-white border-[#D9E0E8] hover:border-slate-300 shadow-xs rounded-2xl",
    active: "ring-2 ring-[#2563EB] border-[#2563EB] bg-blue-50/20",
    title: "text-[#66758A]",
    value: "text-[#2563EB]",
    iconBg: "bg-blue-50 border border-blue-100",
    iconColor: "text-[#2563EB]",
    dot: "bg-[#2563EB]",
    dotActive: "bg-[#2563EB] ring-2 ring-blue-300",
  },
  indigo: {
    base: "bg-white border-[#D9E0E8] hover:border-slate-300 shadow-xs rounded-2xl",
    active: "ring-2 ring-[#2563EB] border-[#2563EB] bg-indigo-50/20",
    title: "text-[#66758A]",
    value: "text-[#4338CA]",
    iconBg: "bg-indigo-50 border border-indigo-100",
    iconColor: "text-[#4338CA]",
    dot: "bg-[#4338CA]",
    dotActive: "bg-[#4338CA] ring-2 ring-indigo-300",
  },
  purple: {
    base: "bg-white border-[#D9E0E8] hover:border-slate-300 shadow-xs rounded-2xl",
    active: "ring-2 ring-[#2563EB] border-[#2563EB] bg-purple-50/20",
    title: "text-[#66758A]",
    value: "text-[#7C3AED]",
    iconBg: "bg-purple-50 border border-purple-100",
    iconColor: "text-[#7C3AED]",
    dot: "bg-[#7C3AED]",
    dotActive: "bg-[#7C3AED] ring-2 ring-purple-300",
  },
  green: {
    base: "bg-white border-[#D9E0E8] hover:border-slate-300 shadow-xs rounded-2xl",
    active: "ring-2 ring-[#087443] border-[#087443] bg-emerald-50/20",
    title: "text-[#66758A]",
    value: "text-[#087443]",
    iconBg: "bg-[#EAF7EF] border border-emerald-100",
    iconColor: "text-[#087443]",
    dot: "bg-[#087443]",
    dotActive: "bg-[#087443] ring-2 ring-emerald-300",
  },
  amber: {
    base: "bg-white border-[#D9E0E8] hover:border-slate-300 shadow-xs rounded-2xl",
    active: "ring-2 ring-[#92400E] border-[#92400E] bg-amber-50/20",
    title: "text-[#66758A]",
    value: "text-[#92400E]",
    iconBg: "bg-[#FFF4D6] border border-amber-100",
    iconColor: "text-[#92400E]",
    dot: "bg-[#92400E]",
    dotActive: "bg-[#92400E] ring-2 ring-amber-300",
  },
  red: {
    base: "bg-white border-[#D9E0E8] hover:border-slate-300 shadow-xs rounded-2xl",
    active: "ring-2 ring-[#B42318] border-[#B42318] bg-rose-50/20",
    title: "text-[#66758A]",
    value: "text-[#B42318]",
    iconBg: "bg-[#FDECEC] border border-rose-100",
    iconColor: "text-[#B42318]",
    dot: "bg-[#B42318]",
    dotActive: "bg-[#B42318] ring-2 ring-rose-300",
  },
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  isLoading = false,
  isError = false,
  onClick,
  active = false,
  className,
  tabIndex,
  titleTooltip,
}: MetricCardProps) {
  const styles = variantStyles[variant]
  const isClickable = Boolean(onClick)

  return (
    <Card
      onClick={onClick}
      className={cn(
        "transition-all duration-200 border shadow-xs select-none",
        isClickable && "cursor-pointer hover:shadow-md hover:-translate-y-0.5",
        active ? styles.active : styles.base,
        className
      )}
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
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "text-[11px] sm:text-xs font-bold uppercase tracking-wider",
              styles.title
            )}
          >
            {title}
          </span>
          {Icon ? (
            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", styles.iconBg)}>
              <Icon className={cn("h-4 w-4", styles.iconColor)} />
            </div>
          ) : (
            <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", active ? styles.dotActive : styles.dot)} />
          )}
        </div>

        <div className={cn("text-2xl sm:text-3xl font-extrabold mt-2 tracking-tight", styles.value)}>
          {isLoading ? (
            <span className="text-[#66758A] text-base font-normal animate-pulse">Loading...</span>
          ) : isError ? (
            <span className="text-[#B42318] text-base font-semibold flex items-center gap-1">
              <AlertCircle className="w-4 h-4 inline" /> Unavailable
            </span>
          ) : (
            value
          )}
        </div>

        {(subtitle || trend) && (
          <div className="text-[11px] sm:text-xs mt-2 flex items-center justify-between text-[#52627A] gap-2 pt-1">
            {subtitle && <span>{subtitle}</span>}
            {trend && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-bold px-1.5 py-0.5 rounded text-[11px]",
                  trend.isPositive
                    ? "text-[#087443] bg-[#EAF7EF]"
                    : "text-[#B42318] bg-[#FDECEC]"
                )}
              >
                {trend.isPositive ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {trend.value} {trend.label}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
