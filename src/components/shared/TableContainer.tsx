import type { HTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface TableContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  minWidth?: number | string
  bordered?: boolean
  className?: string
  containerClassName?: string
}

export function TableContainer({
  children,
  minWidth = 800,
  bordered = true,
  className,
  containerClassName,
  ...props
}: TableContainerProps) {
  const minWidthStyle = typeof minWidth === "number" ? `${minWidth}px` : minWidth

  return (
    <div
      className={cn(
        "w-full overflow-x-auto scrollbar-thin scrollbar-thumb-[#E2E8F0] scrollbar-track-transparent",
        bordered && "rounded-2xl border border-[#E2E8F0] bg-white shadow-2xs",
        containerClassName
      )}
      {...props}
    >
      <div style={{ minWidth: minWidthStyle }} className={cn("w-full", className)}>
        {children}
      </div>
    </div>
  )
}
