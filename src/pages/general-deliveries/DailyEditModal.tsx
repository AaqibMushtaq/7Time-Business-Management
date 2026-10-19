import React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/utils"
import { formatDateRow } from "@/lib/dateUtils"
import { X, AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

interface DailyEditModalProps {
  editingDate: string | null
  onClose: () => void
  editExpression: string
  setEditExpression: (val: string) => void
  editFuel: string
  setEditFuel: (val: string) => void
  editRemarks: string
  setEditRemarks: (val: string) => void
  modalError: string | null
  onSave: (e: React.FormEvent) => void
  isSaving: boolean
  parsedExpressionPreview: {
    isValid: boolean
    value: number | null
    isIncomplete?: boolean
    errorMessage?: string | null
  } | null
}

export function DailyEditModal({
  editingDate,
  onClose,
  editExpression,
  setEditExpression,
  editFuel,
  setEditFuel,
  editRemarks,
  setEditRemarks,
  modalError,
  onSave,
  isSaving,
  parsedExpressionPreview
}: DailyEditModalProps) {
  if (!editingDate) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-[#D9E0E8] max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        <div className="p-5 bg-[#F8F7F2] border-b border-[#D9E0E8] flex justify-between items-center">
          <div>
            <h3 className="font-extrabold text-lg text-[#172B4D] leading-tight">Edit Daily Operations</h3>
            <p className="text-xs text-[#52627A] mt-0.5 font-medium">
              {formatDateRow(editingDate).display}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 text-[#52627A] hover:text-[#172B4D] hover:bg-slate-200 rounded-full cursor-pointer"
            title="Close modal"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={onSave} className="p-6 space-y-4">
          {modalError && (
            <div className="p-3 bg-[#FDECEC] border border-red-200 text-[#B42318] rounded-xl text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#B42318]" />
              <span>{modalError}</span>
            </div>
          )}

          {/* All Deliveries Arithmetic Expression */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#172B4D] uppercase tracking-wide flex justify-between items-center">
              <span>All Deliveries Expression *</span>
              <span className="text-[11px] text-[#52627A] font-normal lowercase">
                supports addition (e.g. 10+350+10)
              </span>
            </label>
            <Input
              autoFocus
              value={editExpression}
              onChange={(e) => setEditExpression(e.target.value)}
              placeholder="e.g. 10+350+10 or 370"
              className="font-mono text-sm border-[#D9E0E8] bg-white text-[#172B4D] focus-visible:ring-[#2563EB]"
            />

            {/* Real-time expression evaluation badge */}
            {parsedExpressionPreview && (
              <div className="mt-1.5 flex items-center gap-2 text-xs">
                {parsedExpressionPreview.isValid && parsedExpressionPreview.value !== null ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-[#087443] bg-[#EAF7EF] px-2 py-0.5 rounded-md border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#087443]" />
                    Calculated Total: {formatMoney(parsedExpressionPreview.value)}
                  </span>
                ) : parsedExpressionPreview.isIncomplete ? (
                  <span className="inline-flex items-center gap-1 text-[#92400E] bg-[#FFF4D6] px-2 py-0.5 rounded-md border border-amber-200">
                    <Loader2 className="w-3 h-3 animate-spin text-[#92400E]" />
                    Typing expression (ends with '+')...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[#B42318] bg-[#FDECEC] px-2 py-0.5 rounded-md border border-red-200">
                    <AlertCircle className="w-3 h-3 text-[#B42318]" />
                    {parsedExpressionPreview.errorMessage || "Invalid expression"}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Fuel Expenses */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#172B4D] uppercase tracking-wide">
              Fuel Expenses (₹)
            </label>
            <Input
              type="number"
              min="0"
              step="any"
              value={editFuel}
              onChange={(e) => setEditFuel(e.target.value)}
              placeholder="0.00"
              className="font-mono text-sm border-[#D9E0E8] bg-white text-[#172B4D] focus-visible:ring-[#2563EB]"
            />
          </div>

          {/* Remarks / Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#172B4D] uppercase tracking-wide">
              Remarks / Notes
            </label>
            <textarea
              rows={3}
              value={editRemarks}
              onChange={(e) => setEditRemarks(e.target.value)}
              placeholder="e.g. Route details, driver notes, extra deliveries..."
              className="w-full text-sm p-3 rounded-xl border border-[#D9E0E8] bg-white text-[#172B4D] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#D9E0E8]">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold shadow-xs cursor-pointer"
              disabled={isSaving || (parsedExpressionPreview !== null && !parsedExpressionPreview.isValid)}
            >
              {isSaving ? "Saving..." : "Save Daily Entry"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
