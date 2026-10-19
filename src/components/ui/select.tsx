import * as React from "react"

import { cn } from "@/lib/utils"

const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { onValueChange?: (value: string) => void }
>(({ className, onValueChange, onChange, ...props }, ref) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (onChange) onChange(e)
    if (onValueChange) onValueChange(e.target.value)
  }

  return (
    <select
      className={cn(
        "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-[#D9E0E8] bg-white px-3 py-2 text-sm text-[#172B4D] shadow-xs placeholder:text-[#66758A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        className
      )}
      ref={ref}
      onChange={handleChange}
      {...props}
    />
  )
})
Select.displayName = "Select"

const SelectContent = ({ children }: { children: React.ReactNode; className?: string }) => {
  return <>{children}</>
}

const SelectItem = React.forwardRef<
  HTMLOptionElement,
  React.OptionHTMLAttributes<HTMLOptionElement>
>(({ className, children, ...props }, ref) => {
  return (
    <option ref={ref} className={className} {...props}>
      {children}
    </option>
  )
})
SelectItem.displayName = "SelectItem"

const SelectTrigger = ({ children }: { children: React.ReactNode; className?: string }) => {
  return <>{children}</>
}

const SelectValue = ({ placeholder, className }: { placeholder?: string; className?: string }) => {
  return <option value="" disabled className={className}>{placeholder}</option>
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
