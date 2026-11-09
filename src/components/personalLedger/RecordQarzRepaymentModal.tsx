import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney } from "@/lib/utils"
import { CheckCircle2, Loader2, ArrowDownLeft, ArrowUpRight, AlertCircle, X } from "lucide-react"
import type { PersonalQarzEntry } from "@/services/personalLedger"

interface RecordQarzRepaymentModalProps {
  isOpen: boolean
  onClose: () => void
  qarzEntry: PersonalQarzEntry | null
  onSubmit: (data: {
    qarz_entry_id: string
    amount: number
    repayment_date: string
    payment_account: string
    notes?: string
  }) => Promise<void>
}

const ACCOUNTS = ["Cash", "Bank Account", "Savings Account", "Digital Wallet"]

export default function RecordQarzRepaymentModal({
  isOpen,
  onClose,
  qarzEntry,
  onSubmit
}: RecordQarzRepaymentModalProps) {
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0])
  const [paymentAccount, setPaymentAccount] = useState("Cash")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen || !qarzEntry) return null

  const isGiven = qarzEntry.direction === "GIVEN"
  const currentBalance = qarzEntry.balance !== undefined 
    ? qarzEntry.balance 
    : Math.max(0, qarzEntry.original_amount - (qarzEntry.amount_repaid || 0))

  const numAmount = parseFloat(amount) || 0
  const remainingAfterRepayment = Math.max(0, currentBalance - numAmount)
  const isOverRepayment = numAmount > currentBalance

  const handleFullSettlementClick = () => {
    setAmount(currentBalance.toFixed(2))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (numAmount <= 0) {
      setError("Repayment amount must be greater than zero.")
      return
    }

    if (isOverRepayment) {
      setError(
        `Repayment amount (${formatMoney(numAmount)}) exceeds outstanding loan balance (${formatMoney(currentBalance)}).`
      )
      return
    }

    try {
      setIsSubmitting(true)
      await onSubmit({
        qarz_entry_id: qarzEntry.id,
        amount: numAmount,
        repayment_date: date,
        payment_account: paymentAccount,
        notes: notes.trim() || undefined
      })
      onClose()
      setAmount("")
      setNotes("")
    } catch (err: any) {
      setError(err.message || "Failed to record repayment.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md bg-white border border-[#D9E0E8] p-6 shadow-xl rounded-2xl animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-[#D9E0E8]">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${isGiven ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
              {isGiven ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#172B4D]">
                {isGiven ? "Record Repayment Received" : "Record Repayment Paid"}
              </h3>
              <p className="text-xs text-[#52627A]">
                {isGiven 
                  ? `Receive loan return from ${qarzEntry.person_name}` 
                  : `Return borrowed money to ${qarzEntry.person_name}`}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="text-[#66758A] hover:text-[#172B4D] p-1 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loan Context Overview */}
        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#52627A]">Original Loan:</span>
            <span className="font-bold text-[#172B4D]">{formatMoney(qarzEntry.original_amount)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#52627A]">Already Repaid:</span>
            <span className="font-bold text-emerald-600">{formatMoney(qarzEntry.amount_repaid || 0)}</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
            <span className="font-bold text-[#172B4D]">Current Outstanding:</span>
            <span className="font-extrabold text-sm text-purple-700 font-mono">
              {formatMoney(currentBalance)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Repayment Amount */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="repay-amount" className="text-xs font-bold text-[#172B4D]">
                Repayment Amount (₹) *
              </Label>
              <button
                type="button"
                onClick={handleFullSettlementClick}
                className="text-[11px] font-bold text-purple-700 hover:text-purple-900 underline cursor-pointer"
              >
                Pay Full Balance ({formatMoney(currentBalance)})
              </button>
            </div>
            <Input
              id="repay-amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="font-mono text-base font-bold"
            />
            {numAmount > 0 && !isOverRepayment && (
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                Remaining balance after this repayment:{" "}
                <span className="font-bold text-[#172B4D]">{formatMoney(remainingAfterRepayment)}</span>
                {remainingAfterRepayment === 0 && (
                  <span className="ml-1 text-emerald-600 font-bold">(Fully Settled)</span>
                )}
              </p>
            )}
            {isOverRepayment && (
              <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-1">
                <AlertCircle className="h-3 w-3 text-red-600 shrink-0" />
                Repayment amount exceeds outstanding loan balance ({formatMoney(currentBalance)}).
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Date */}
            <div className="space-y-1.5">
              <Label htmlFor="repay-date" className="text-xs font-bold text-[#172B4D]">
                Repayment Date *
              </Label>
              <Input
                id="repay-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            {/* Payment Account */}
            <div className="space-y-1.5">
              <Label htmlFor="repay-account" className="text-xs font-bold text-[#172B4D]">
                {isGiven ? "Received Into *" : "Paid From *"}
              </Label>
              <select
                id="repay-account"
                value={paymentAccount}
                onChange={(e) => setPaymentAccount(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                {ACCOUNTS.map((acc) => (
                  <option key={acc} value={acc}>
                    {acc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="repay-notes" className="text-xs font-bold text-[#172B4D]">
              Notes / Receipt Details (Optional)
            </Label>
            <textarea
              id="repay-notes"
              rows={2}
              placeholder="e.g. Bank transfer reference #1234, cash in person..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2.5 rounded-md border border-input bg-background text-xs resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D9E0E8]">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isOverRepayment || numAmount <= 0}
              className={`font-bold ${
                isGiven
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-purple-700 hover:bg-purple-800 text-white"
              }`}
            >
              {isSubmitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Save Repayment
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
