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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
          <h3 className="text-lg font-bold text-slate-900">Edit Previous Balance</h3>
          <p className="text-sm text-slate-500 mt-1">{displayMonthYear}</p>
        </div>
        <div className="p-5">
          <form id="balance-form" onSubmit={onSave} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-700">Opening Balance Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-500 font-medium">₹</span>
                <Input 
                  type="number" 
                  required 
                  min="0" 
                  step="0.01" 
                  value={balanceInput} 
                  onChange={e => setBalanceInput(e.target.value)} 
                  autoFocus 
                  className="pl-8 text-lg font-bold bg-white" 
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                This is the opening outstanding balance carried into {displayMonthYear} before any activity occurred.
              </p>
            </div>
          </form>
        </div>
        <div className="p-4 border-t border-slate-100 flex flex-col gap-2 bg-slate-50/50 rounded-b-xl">
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 bg-white" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              form="balance-form" 
              disabled={isSaving} 
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Save"}
            </Button>
          </div>
          {isManualOverride && (
            <Button 
              variant="ghost" 
              className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 text-xs" 
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
