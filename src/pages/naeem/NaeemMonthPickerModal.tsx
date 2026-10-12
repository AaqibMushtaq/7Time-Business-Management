import React from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ChevronLeft, ChevronRight, X } from "lucide-react"

interface NaeemMonthPickerModalProps {
  isOpen: boolean
  onClose: () => void
  pickerYear: number
  setPickerYear: React.Dispatch<React.SetStateAction<number>>
  selectedMonth: string
  onSelectMonth: (month: string) => void
}

export function NaeemMonthPickerModal({
  isOpen,
  onClose,
  pickerYear,
  setPickerYear,
  selectedMonth,
  onSelectMonth
}: NaeemMonthPickerModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Select Month & Year</h3>
          <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-500" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-5 space-y-6">
          <div className="space-y-2">
            <Label className="text-slate-600 text-xs font-semibold uppercase tracking-wider">Year</Label>
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-1">
              <Button variant="ghost" size="sm" onClick={() => setPickerYear(y => y - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="font-bold text-lg text-slate-900">{pickerYear}</span>
              <Button variant="ghost" size="sm" onClick={() => setPickerYear(y => y + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 12 }).map((_, i) => {
              const mStr = String(i + 1).padStart(2, "0")
              const isSelected = selectedMonth === `${pickerYear}-${mStr}`
              const monthName = new Date(2000, i, 1).toLocaleDateString("en-US", { month: "short" })
              return (
                <Button 
                  key={i} 
                  variant={isSelected ? "default" : "outline"}
                  className={isSelected ? "bg-blue-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}
                  onClick={() => {
                    onSelectMonth(`${pickerYear}-${mStr}`)
                    onClose()
                  }}
                >
                  {monthName}
                </Button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
