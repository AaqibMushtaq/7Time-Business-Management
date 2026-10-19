import type { HTMLAttributes, ReactNode, ButtonHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export interface DataTableActionsProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  align?: "left" | "center" | "right"
}

export function DataTableActions({
  children,
  align = "right",
  className,
  ...props
}: DataTableActionsProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1",
        align === "right" && "justify-end",
        align === "center" && "justify-center",
        align === "left" && "justify-start",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export interface DataTableActionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "variant"> {
  icon?: ReactNode | React.ComponentType<{ className?: string }>
  label: string
  actionVariant?: "primary" | "destructive" | "neutral" | "success"
  variant?: "primary" | "destructive" | "neutral" | "success"
}

export function DataTableActionButton({
  icon,
  label,
  actionVariant = "primary",
  variant,
  className,
  children,
  ...props
}: DataTableActionButtonProps) {
  const chosenVariant = variant || actionVariant

  const variantStyles = {
    primary: "text-[#2563EB] hover:text-[#1D4ED8] hover:bg-[#EEF4FF] border-transparent",
    destructive: "text-[#DC2626] hover:text-[#B42318] hover:bg-[#FDECEC] border-transparent",
    success: "text-[#059669] hover:text-[#047857] hover:bg-[#EAF7EF] border-transparent",
    neutral: "text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F4F8] border-transparent",
  }

  const renderIcon = () => {
    if (!icon) return null
    if (typeof icon === "function" || (typeof icon === "object" && icon !== null && "render" in icon)) {
      const IconComp = icon as React.ComponentType<{ className?: string }>
      return <IconComp className="h-4 w-4" />
    }
    return icon
  }

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center p-1.5 rounded-lg transition-colors border cursor-pointer disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20",
        variantStyles[chosenVariant],
        className
      )}
      {...props}
    >
      {renderIcon()}
      {children && <span className="ml-1 text-xs font-medium">{children}</span>}
    </button>
  )
}

export { DataTableActions as DataTableRowActions }
export type { DataTableActionsProps as DataTableRowActionsProps }


