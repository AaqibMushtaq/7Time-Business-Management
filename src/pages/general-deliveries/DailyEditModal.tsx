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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        <div 
          className="p-5 text-white flex justify-between items-center"
          style={{ background: "linear-gradient(135deg, #0E2A47 0%, #1E3A8A 100%)" }}
        >
          <div>
            <h3 className="font-extrabold text-lg leading-tight">Edit Daily Operations</h3>
            <p className="text-xs text-blue-200 mt-0.5 font-medium">
              {formatDateRow(editingDate).display}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 text-white/80 hover:text-white hover:bg-white/10 rounded-full"
            title="Close modal"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={onSave} className="p-6 space-y-4">
          {modalError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{modalError}</span>
            </div>
          )}

          {/* All Deliveries Arithmetic Expression */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex justify-between items-center">
              <span>All Deliveries Expression *</span>
              <span className="text-[11px] text-slate-400 font-normal lowercase">
                supports addition (e.g. 10+350+10)
              </span>
            </label>
            <Input
              autoFocus
              value={editExpression}
              onChange={(e) => setEditExpression(e.target.value)}
              placeholder="e.g. 10+350+10 or 370"
              className="font-mono text-sm border-slate-200 focus-visible:ring-[#2D7FF9]"
            />

            {/* Real-time expression evaluation badge */}
            {parsedExpressionPreview && (
              <div className="mt-1.5 flex items-center gap-2 text-xs">
                {parsedExpressionPreview.isValid && parsedExpressionPreview.value !== null ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-md border border-green-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    Calculated Total: {formatMoney(parsedExpressionPreview.value)}
                  </span>
                ) : parsedExpressionPreview.isIncomplete ? (
                  <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                    Typing expression (ends with '+')...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                    <AlertCircle className="w-3 h-3 text-red-500" />
                    {parsedExpressionPreview.errorMessage || "Invalid expression"}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Fuel Expenses */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Fuel Expenses (₹)
            </label>
            <Input
              type="number"
              min="0"
              step="any"
              value={editFuel}
              onChange={(e) => setEditFuel(e.target.value)}
              placeholder="0.00"
              className="font-mono text-sm border-slate-200 focus-visible:ring-[#2D7FF9]"
            />
          </div>

          {/* Remarks / Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Remarks / Notes
            </label>
            <textarea
              rows={3}
              value={editRemarks}
              onChange={(e) => setEditRemarks(e.target.value)}
              placeholder="e.g. Route details, driver notes, extra deliveries..."
              className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2D7FF9]/20 focus:border-[#2D7FF9]"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="border-slate-200 text-slate-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#2D7FF9] hover:bg-[#2068d4] text-white font-semibold shadow-sm"
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
