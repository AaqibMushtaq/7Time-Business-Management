import * as React from "react"
import { Slot } from "@radix-ui/react-slot" // Wait, I need radix-ui slot.
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    // I can't use cva without installing class-variance-authority, I'll use standard classes
    const Comp = asChild ? Slot : "button"
    
    let baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
    
    let variants = {
      default: "bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs active:scale-[0.99]",
      destructive: "bg-[#B42318] text-white hover:bg-red-700 shadow-xs active:scale-[0.99]",
      outline: "border border-[#D9E0E8] bg-white hover:bg-[#F1F4F8] text-[#172B4D] shadow-xs active:scale-[0.99]",
      secondary: "bg-[#F1F4F8] border border-[#D9E0E8] text-[#172B4D] hover:bg-slate-200 shadow-xs active:scale-[0.99]",
      ghost: "hover:bg-[#F1F4F8] text-[#52627A] hover:text-[#172B4D]",
      link: "text-[#2563EB] hover:text-[#1D4ED8] underline-offset-4 hover:underline",
    }
    
    let sizes = {
      default: "h-11 md:h-10 px-4 py-2",
      sm: "h-11 md:h-9 rounded-md px-3",
      lg: "h-12 md:h-11 rounded-md px-8",
      icon: "h-11 w-11 md:h-10 md:w-10",
    }

    return (
      <Comp
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
