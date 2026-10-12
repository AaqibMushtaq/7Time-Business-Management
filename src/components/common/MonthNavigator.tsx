import React from "react"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getPreviousMonth, getNextMonth, formatMonthDisplay } from "@/lib/dateUtils"

interface MonthNavigatorProps {
  selectedMonth: string
  onChange: (month: string) => void
  children?: React.ReactNode
  className?: string
}

export function MonthNavigator({
  selectedMonth,
  onChange,
  children,
  className = ""
}: MonthNavigatorProps) {
  const displayLabel = formatMonthDisplay(selectedMonth)

  return (
    <div className={`flex flex-wrap items-center gap-2 bg-[#F8FAFC] p-1.5 rounded-xl border border-[#E5E7EB] ${className}`}>
      {/* Previous Month */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange(getPreviousMonth(selectedMonth))}
        className="h-8 px-2.5 text-slate-700 hover:text-slate-900"
        title="Previous Month"
        aria-label="Previous Month"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Prev
      </Button>

      {/* Direct Month Selector with accessible native overlay */}
      <div className="relative flex items-center">
        <span className="text-xs sm:text-sm font-bold text-[#0E2A47] px-2.5 sm:px-3 whitespace-nowrap cursor-pointer hover:text-[#2D7FF9] transition-colors flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5 text-[#2D7FF9]" />
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

      {/* Next Month */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange(getNextMonth(selectedMonth))}
        className="h-8 px-2.5 text-slate-700 hover:text-slate-900"
        title="Next Month"
        aria-label="Next Month"
      >
        Next
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>

      {/* Slot for additional controls (e.g. view mode toggle, chart toggle) */}
      {children}
    </div>
  )
}
