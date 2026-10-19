import React from "react"
import { cn } from "@/lib/utils"

export interface ResponsiveTableProps {
  children: React.ReactNode
  minWidth?: number | string
  className?: string
  containerClassName?: string
}

export function ResponsiveTable({
  children,
  minWidth = 800,
  className,
  containerClassName,
}: ResponsiveTableProps) {
  const minWidthStyle =
    typeof minWidth === "number" ? `${minWidth}px` : minWidth

  return (
    <div
      className={cn(
        "overflow-x-auto w-full scrollbar-thin scrollbar-thumb-[#E2E8F0] scrollbar-track-transparent",
        containerClassName
      )}
    >
      <div style={{ minWidth: minWidthStyle }} className={cn("w-full", className)}>
        {children}
      </div>
    </div>
  )
}
