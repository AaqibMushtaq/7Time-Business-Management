import React from "react"
import { type LucideIcon } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface SectionCardProps {
  title?: React.ReactNode
  description?: React.ReactNode
  icon?: LucideIcon
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  contentClassName?: string
  headerClassName?: string
  noPadding?: boolean
}

export function SectionCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  contentClassName,
  headerClassName,
  noPadding = false,
}: SectionCardProps) {
  const hasHeader = Boolean(title || description || action || Icon)

  return (
    <Card className={cn("border-[#D9E0E8] bg-white shadow-xs rounded-2xl overflow-hidden", className)}>
      {hasHeader && (
        <CardHeader
          className={cn(
            "border-b border-[#D9E0E8] bg-[#F8F7F2]/60 py-4 px-5 sm:px-6 flex flex-row items-center justify-between gap-3 space-y-0",
            headerClassName
          )}
        >
          <div className="space-y-0.5">
            {title && (
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-[#172B4D]">
                {Icon && <Icon className="h-5 w-5 text-[#2563EB] shrink-0" />}
                <span>{title}</span>
              </CardTitle>
            )}
            {description && (
              <CardDescription className="text-xs text-[#52627A]">
                {description}
              </CardDescription>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </CardHeader>
      )}
      <CardContent className={cn(noPadding ? "p-0" : "p-5 sm:p-6", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  )
}
