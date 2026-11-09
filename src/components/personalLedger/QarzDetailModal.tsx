import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/utils"
import { 
  HandCoins, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Calendar, 
  Wallet, 
  Plus, 
  Clock, 
  CheckCircle2,
  X
} from "lucide-react"
import type { PersonalQarzEntry } from "@/services/personalLedger"

interface QarzDetailModalProps {
  isOpen: boolean
  onClose: () => void
  qarzEntry: PersonalQarzEntry | null
  onRecordRepayment: (entry: PersonalQarzEntry) => void
}

export default function QarzDetailModal({
  isOpen,
  onClose,
  qarzEntry,
  onRecordRepayment
}: QarzDetailModalProps) {
  if (!isOpen || !qarzEntry) return null

  const isGiven = qarzEntry.direction === "GIVEN"
  const currentBalance = qarzEntry.balance !== undefined
    ? qarzEntry.balance
    : Math.max(0, qarzEntry.original_amount - (qarzEntry.amount_repaid || 0))
  const isSettled = currentBalance <= 0 || qarzEntry.status === "FULLY_SETTLED"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl bg-white border border-[#D9E0E8] p-6 shadow-xl rounded-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-[#D9E0E8]">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-purple-100 text-purple-700">
              <HandCoins className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#172B4D]">
                {qarzEntry.person_name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    isGiven
                      ? "bg-purple-100 text-purple-800"
                      : "bg-indigo-100 text-indigo-800"
                  }`}
                >
                  {isGiven ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                  {isGiven ? "Qarz Given (Receivable)" : "Qarz Received (Payable)"}
                </span>

                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    isSettled
                      ? "bg-emerald-100 text-emerald-800"
                      : qarzEntry.status === "PARTIALLY_REPAID"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {isSettled
                    ? "Fully Settled"
                    : qarzEntry.status === "PARTIALLY_REPAID"
                    ? "Partially Repaid"
                    : "Outstanding"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isSettled && (
              <Button
                size="sm"
                onClick={() => {
                  onClose()
                  onRecordRepayment(qarzEntry)
                }}
                className="bg-purple-700 hover:bg-purple-800 text-white font-bold shadow-xs text-xs"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Record Repayment
              </Button>
            )}
            <button 
              type="button" 
              onClick={onClose}
              className="text-[#66758A] hover:text-[#172B4D] p-1 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 3 Metric Summary Tiles */}
        <div className="grid grid-cols-3 gap-3 pt-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-[#52627A] uppercase tracking-wider block">
              Original Amount
            </span>
            <span className="text-base font-extrabold text-[#172B4D] font-mono mt-0.5 block">
              {formatMoney(qarzEntry.original_amount)}
            </span>
          </div>

          <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">
              Total Repaid
            </span>
            <span className="text-base font-extrabold text-emerald-700 font-mono mt-0.5 block">
              {formatMoney(qarzEntry.amount_repaid || 0)}
            </span>
          </div>

          <div className={`rounded-xl p-3 border ${
            isSettled 
              ? "bg-emerald-50 border-emerald-200" 
              : "bg-purple-50/60 border-purple-200"
          }`}>
            <span className={`text-[11px] font-semibold uppercase tracking-wider block ${
              isSettled ? "text-emerald-700" : "text-purple-700"
            }`}>
              Remaining Balance
            </span>
            <span className={`text-base font-extrabold font-mono mt-0.5 block ${
              isSettled ? "text-emerald-700" : "text-purple-700"
            }`}>
              {formatMoney(currentBalance)}
            </span>
          </div>
        </div>

        {/* Loan Details Grid */}
        <div className="mt-4 bg-white border border-[#D9E0E8] rounded-xl p-4 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[#52627A] flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#66758A]" /> Date Issued:
            </span>
            <span className="font-bold text-[#172B4D]">{qarzEntry.transaction_date}</span>
          </div>

          {qarzEntry.due_date && (
            <div className="flex items-center justify-between">
              <span className="text-[#52627A] flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-600" /> Expected Due Date:
              </span>
              <span className="font-bold text-amber-700">{qarzEntry.due_date}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-[#52627A] flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5 text-[#66758A]" /> Account:
            </span>
            <span className="font-bold text-[#172B4D]">{qarzEntry.account}</span>
          </div>

          {qarzEntry.notes && (
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[#52627A] block font-semibold mb-1">Notes:</span>
              <p className="text-[#172B4D] bg-slate-50 p-2 rounded-lg italic">
                {qarzEntry.notes}
              </p>
            </div>
          )}
        </div>

        {/* Repayment History Timeline */}
        <div className="mt-4 space-y-2">
          <h4 className="text-xs font-bold text-[#172B4D] uppercase tracking-wider flex items-center justify-between">
            <span>Repayment History ({qarzEntry.repayments?.length || 0})</span>
            {isSettled && (
              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Full Settlement Complete
              </span>
            )}
          </h4>

          {qarzEntry.repayments && qarzEntry.repayments.length > 0 ? (
            <div className="border border-[#D9E0E8] rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
              {qarzEntry.repayments.map((repay, index) => (
                <div key={repay.id || index} className="p-3 flex items-center justify-between bg-white hover:bg-slate-50">
                  <div className="space-y-0.5">
                    <div className="font-bold text-[#172B4D]">
                      {repay.repayment_date}
                    </div>
                    <div className="text-[11px] text-[#52627A]">
                      Account: {repay.payment_account} {repay.notes ? `• ${repay.notes}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-sm font-mono text-emerald-600">
                      +{formatMoney(repay.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 border border-dashed border-[#D9E0E8] rounded-xl text-xs text-[#52627A] bg-slate-50/50">
              <Clock className="h-6 w-6 text-[#66758A] mx-auto mb-1.5 opacity-50" />
              No repayments have been recorded for this loan yet.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
