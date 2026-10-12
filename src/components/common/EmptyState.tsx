import React from "react"
import { type LucideIcon, Package } from "lucide-react"

interface EmptyStateProps {
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
  className = ""
}: EmptyStateProps) {
  return (
    <div className={`text-center py-12 px-4 bg-white rounded-xl border border-dashed border-slate-200 ${className}`}>
      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-bold text-[#0E2A47]">{title}</h3>
      {description && <p className="text-xs text-[#64748B] mt-1 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
