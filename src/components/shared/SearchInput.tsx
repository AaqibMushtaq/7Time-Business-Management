import React from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string
  onChange: (value: string) => void
  onClear?: () => void
  containerClassName?: string
}

export function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = "Search...",
  className,
  containerClassName,
  ...props
}: SearchInputProps) {
  const handleClear = () => {
    onChange("")
    onClear?.()
  }

  return (
    <div className={cn("relative flex items-center w-full max-w-sm", containerClassName)}>
      <Search className="absolute left-3 h-4 w-4 text-[#66758A] pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "pl-9 pr-9 border-[#D9E0E8] bg-white text-[#172B4D] placeholder:text-[#66758A]/60 focus-visible:ring-[#2563EB]/20 focus-visible:border-[#2563EB] h-10 rounded-xl",
          className
        )}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-3 p-0.5 rounded-full text-[#66758A] hover:text-[#172B4D] hover:bg-[#F1F4F8] transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
