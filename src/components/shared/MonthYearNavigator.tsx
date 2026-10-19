import React from "react"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getPreviousMonth, getNextMonth, formatMonthDisplay } from "@/lib/dateUtils"
import { cn } from "@/lib/utils"

export interface MonthYearNavigatorProps {
  selectedMonth: string
  onChange: (month: string) => void
  children?: React.ReactNode
  className?: string
}

export function MonthYearNavigator({
  selectedMonth,
  onChange,
  children,
  className,
}: MonthYearNavigatorProps) {
  const displayLabel = formatMonthDisplay(selectedMonth)

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 bg-white p-1.5 rounded-xl border border-[#D9E0E8] shadow-2xs",
        className
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onChange(getPreviousMonth(selectedMonth))}
        className="h-8 px-2.5 text-[#172B4D] hover:bg-[#F1F4F8] rounded-lg transition-colors font-medium text-xs"
        title="Previous Month"
        aria-label="Previous Month"
      >
        <ChevronLeft className="h-4 w-4 mr-1 text-[#52627A]" />
        Prev
      </Button>

      <div className="relative flex items-center">
        <span className="text-xs sm:text-sm font-bold text-[#172B4D] px-2.5 sm:px-3 whitespace-nowrap cursor-pointer hover:text-[#2563EB] transition-colors flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-[#2563EB]" />
          {displayLabel}
        </span>
        <input
          type="month"
          aria-label="Select month and year"
          value={selectedMonth}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onChange(getNextMonth(selectedMonth))}
        className="h-8 px-2.5 text-[#172B4D] hover:bg-[#F1F4F8] rounded-lg transition-colors font-medium text-xs"
        title="Next Month"
        aria-label="Next Month"
      >
        Next
        <ChevronRight className="h-4 w-4 ml-1 text-[#52627A]" />
      </Button>

      {children}
    </div>
  )
}
