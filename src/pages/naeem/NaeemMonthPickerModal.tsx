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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-[#D9E0E8] w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-[#D9E0E8] bg-[#F8F7F2] flex items-center justify-between">
          <h3 className="font-bold text-[#172B4D]">Select Month & Year</h3>
          <Button variant="ghost" size="icon" className="w-8 h-8 text-[#52627A] hover:text-[#172B4D] hover:bg-[#F1F4F8]" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-5 space-y-6">
          <div className="space-y-2">
            <Label className="text-[#52627A] text-xs font-semibold uppercase tracking-wider">Year</Label>
            <div className="flex items-center justify-between bg-[#F8F7F2] border border-[#D9E0E8] rounded-lg p-1">
              <Button variant="ghost" size="sm" className="text-[#52627A] hover:text-[#172B4D]" onClick={() => setPickerYear(y => y - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="font-bold text-lg text-[#172B4D]">{pickerYear}</span>
              <Button variant="ghost" size="sm" className="text-[#52627A] hover:text-[#172B4D]" onClick={() => setPickerYear(y => y + 1)}>
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
                  className={isSelected ? "bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs" : "bg-white text-[#172B4D] border-[#D9E0E8] hover:bg-[#F1F4F8]"}
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
