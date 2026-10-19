import React from "react"
import { cn } from "@/lib/utils"

export interface PageContainerProps {
  children: React.ReactNode
  className?: string
  maxWidth?: "full" | "7xl" | "6xl" | "5xl"
}

export function PageContainer({
  children,
  className,
  maxWidth = "7xl",
}: PageContainerProps) {
  const maxWidthClass = {
    full: "max-w-full",
    "7xl": "max-w-7xl",
    "6xl": "max-w-6xl",
    "5xl": "max-w-5xl",
  }[maxWidth]

  return (
    <div
      className={cn(
        "p-4 sm:p-6 lg:p-8 space-y-6 w-full mx-auto animate-in fade-in-50 duration-200",
        maxWidthClass,
        className
      )}
    >
      {children}
    </div>
  )
}
