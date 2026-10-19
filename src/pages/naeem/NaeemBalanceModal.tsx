import React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

interface NaeemBalanceModalProps {
  isOpen: boolean
  onClose: () => void
  displayMonthYear: string
  balanceInput: string
  setBalanceInput: (val: string) => void
  onSave: (e: React.FormEvent) => void
  isSaving: boolean
  isManualOverride: boolean
  onClearOverride: () => void
  isClearing: boolean
}

export function NaeemBalanceModal({
  isOpen,
  onClose,
  displayMonthYear,
  balanceInput,
  setBalanceInput,
  onSave,
  isSaving,
  isManualOverride,
  onClearOverride,
  isClearing
}: NaeemBalanceModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-[#D9E0E8] w-full max-w-sm animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-[#D9E0E8] bg-[#F8F7F2] rounded-t-xl">
          <h3 className="text-lg font-bold text-[#172B4D]">Edit Previous Balance</h3>
          <p className="text-sm text-[#52627A] mt-1">{displayMonthYear}</p>
        </div>
        <div className="p-5">
          <form id="balance-form" onSubmit={onSave} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#172B4D] font-medium">Opening Balance Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-[#52627A] font-medium">₹</span>
                <Input 
                  type="number" 
                  required 
                  min="0"
                  step="0.01"
                  value={balanceInput}
                  onChange={e => setBalanceInput(e.target.value)}
                  autoFocus
                  className="pl-8 text-lg font-bold bg-white text-[#172B4D] border-[#D9E0E8] focus-visible:ring-[#2563EB]"
                />
              </div>
              <p className="text-xs text-[#52627A] mt-2">
                This is the opening outstanding balance carried into {displayMonthYear} before any activity occurred.
              </p>
            </div>
          </form>
        </div>
        <div className="p-4 border-t border-[#D9E0E8] flex flex-col gap-2 bg-[#F8F7F2]/60 rounded-b-xl">
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 bg-white border-[#D9E0E8] hover:bg-[#F1F4F8] text-[#172B4D] cursor-pointer" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              form="balance-form" 
              disabled={isSaving} 
              className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Save"}
            </Button>
          </div>
          {isManualOverride && (
            <Button 
              variant="ghost" 
              className="w-full text-[#B42318] hover:text-[#912018] hover:bg-[#FDECEC] text-xs cursor-pointer"
              disabled={isClearing}
              onClick={onClearOverride}
            >
              {isClearing ? "Clearing..." : "Clear override & use automatic balance"}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
