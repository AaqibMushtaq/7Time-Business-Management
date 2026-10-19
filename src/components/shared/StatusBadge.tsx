import React from "react"
import { cn } from "@/lib/utils"

export type StatusType =
  | "healthy"
  | "low_stock"
  | "out_of_stock"
  | "paid"
  | "pending"
  | "partial"
  | "active"
  | "inactive"
  | "completed"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "brand"

export interface StatusBadgeProps {
  status: StatusType | string
  label?: React.ReactNode
  size?: "sm" | "md"
  dot?: boolean
  className?: string
}

const statusConfigs: Record<
  string,
  {
    bg: string
    text: string
    border: string
    dot: string
    defaultLabel: string
  }
> = {
  healthy: {
    bg: "bg-[#EAF7EF]",
    text: "text-[#087443]",
    border: "border-emerald-200",
    dot: "bg-[#087443]",
    defaultLabel: "Healthy",
  },
  success: {
    bg: "bg-[#EAF7EF]",
    text: "text-[#087443]",
    border: "border-emerald-200",
    dot: "bg-[#087443]",
    defaultLabel: "Success",
  },
  low_stock: {
    bg: "bg-[#FFF4D6]",
    text: "text-[#92400E]",
    border: "border-amber-200",
    dot: "bg-[#92400E]",
    defaultLabel: "Low Stock",
  },
  warning: {
    bg: "bg-[#FFF4D6]",
    text: "text-[#92400E]",
    border: "border-amber-200",
    dot: "bg-[#92400E]",
    defaultLabel: "Warning",
  },
  out_of_stock: {
    bg: "bg-[#FDECEC]",
    text: "text-[#B42318]",
    border: "border-rose-200",
    dot: "bg-[#B42318]",
    defaultLabel: "Out of Stock",
  },
  danger: {
    bg: "bg-[#FDECEC]",
    text: "text-[#B42318]",
    border: "border-rose-200",
    dot: "bg-[#B42318]",
    defaultLabel: "Danger",
  },
  overdue: {
    bg: "bg-[#FDECEC]",
    text: "text-[#B42318]",
    border: "border-rose-200",
    dot: "bg-[#B42318]",
    defaultLabel: "Overdue",
  },
  paid: {
    bg: "bg-[#EAF7EF]",
    text: "text-[#087443]",
    border: "border-emerald-200",
    dot: "bg-[#087443]",
    defaultLabel: "Paid",
  },
  settled: {
    bg: "bg-[#EAF7EF]",
    text: "text-[#059669]",
    border: "border-emerald-200",
    dot: "bg-[#059669]",
    defaultLabel: "Settled",
  },
  outstanding: {
    bg: "bg-[#FDECEC]",
    text: "text-[#DC2626]",
    border: "border-rose-200",
    dot: "bg-[#DC2626]",
    defaultLabel: "Outstanding",
  },
  completed: {
    bg: "bg-[#EAF7EF]",
    text: "text-[#087443]",
    border: "border-emerald-200",
    dot: "bg-[#087443]",
    defaultLabel: "Completed",
  },
  pending: {
    bg: "bg-[#FFF4D6]",
    text: "text-[#92400E]",
    border: "border-amber-200",
    dot: "bg-[#92400E]",
    defaultLabel: "Pending",
  },
  partially_paid: {
    bg: "bg-[#FFF4D6]",
    text: "text-[#D97706]",
    border: "border-amber-200",
    dot: "bg-[#D97706]",
    defaultLabel: "Partially Paid",
  },
  partial: {
    bg: "bg-[#EBF2FE]",
    text: "text-[#2563EB]",
    border: "border-blue-200",
    dot: "bg-[#2563EB]",
    defaultLabel: "Partial",
  },
  active: {
    bg: "bg-[#EBF2FE]",
    text: "text-[#2563EB]",
    border: "border-blue-200",
    dot: "bg-[#2563EB]",
    defaultLabel: "Active",
  },
  inactive: {
    bg: "bg-[#F1F4F8]",
    text: "text-[#52627A]",
    border: "border-[#D9E0E8]",
    dot: "bg-[#66758A]",
    defaultLabel: "Inactive",
  },
  info: {
    bg: "bg-[#EBF2FE]",
    text: "text-[#2563EB]",
    border: "border-blue-200",
    dot: "bg-[#2563EB]",
    defaultLabel: "Info",
  },
  neutral: {
    bg: "bg-[#F1F4F8]",
    text: "text-[#52627A]",
    border: "border-[#D9E0E8]",
    dot: "bg-[#66758A]",
    defaultLabel: "Neutral",
  },
  brand: {
    bg: "bg-[#EBF2FE]",
    text: "text-[#2563EB]",
    border: "border-blue-200",
    dot: "bg-[#2563EB]",
    defaultLabel: "7TIME",
  },
}

export function StatusBadge({
  status,
  label,
  size = "sm",
  dot = true,
  className,
}: StatusBadgeProps) {
  const normalizedKey = status.toLowerCase().replace(/[\s-]/g, "_")
  const config =
    statusConfigs[normalizedKey] || {
      bg: "bg-slate-100",
      text: "text-[#607087]",
      border: "border-slate-200",
      dot: "bg-slate-400",
      defaultLabel: status,
    }

  const displayText = label !== undefined ? label : config.defaultLabel

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold rounded-full border transition-colors select-none",
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm",
        config.bg,
        config.text,
        config.border,
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "rounded-full shrink-0",
            size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2",
            config.dot
          )}
        />
      )}
      <span>{displayText}</span>
    </span>
  )
}
