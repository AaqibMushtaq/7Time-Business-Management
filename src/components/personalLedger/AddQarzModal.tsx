import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { HandCoins, ArrowUpRight, ArrowDownLeft, Loader2, Info, X } from "lucide-react"
import type { QarzDirection } from "@/services/personalLedger"

interface AddQarzModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    person_name: string
    direction: QarzDirection
    original_amount: number
    transaction_date: string
    account: string
    due_date?: string
    notes?: string
  }) => Promise<void>
  initialDirection?: QarzDirection
  existingPeople?: string[]
}

const ACCOUNTS = ["Cash", "Bank Account", "Savings Account", "Digital Wallet"]

export default function AddQarzModal({
  isOpen,
  onClose,
  onSubmit,
  initialDirection = "GIVEN",
  existingPeople = []
}: AddQarzModalProps) {
  const [direction, setDirection] = useState<QarzDirection>(initialDirection)
  const [personName, setPersonName] = useState("")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0])
  const [dueDate, setDueDate] = useState("")
  const [account, setAccount] = useState("Cash")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!personName.trim()) {
      setError("Person's name is required.")
      return
    }

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid amount greater than zero.")
      return
    }

    try {
      setIsSubmitting(true)
      await onSubmit({
        person_name: personName.trim(),
        direction,
        original_amount: numAmount,
        transaction_date: date,
        account,
        due_date: dueDate.trim() || undefined,
        notes: notes.trim() || undefined
      })
      onClose()
      setPersonName("")
      setAmount("")
      setDueDate("")
      setNotes("")
    } catch (err: any) {
      setError(err.message || "Failed to record Qarz entry.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg bg-white border border-[#D9E0E8] p-6 shadow-xl rounded-2xl animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-[#D9E0E8]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <HandCoins className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#172B4D]">
                Record Qarz-e-Hasana (قرضِ حسنہ)
              </h3>
              <p className="text-xs text-[#52627A]">
                Interest-free loan given to or received from an individual.
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
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Direction toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setDirection("GIVEN")}
              className={`py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                direction === "GIVEN"
                  ? "bg-white text-purple-800 shadow-xs border border-purple-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ArrowUpRight className="h-3.5 w-3.5 text-purple-600" />
              Qarz Given (I Lent Money)
            </button>
            <button
              type="button"
              onClick={() => setDirection("RECEIVED")}
              className={`py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                direction === "RECEIVED"
                  ? "bg-white text-indigo-800 shadow-xs border border-indigo-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ArrowDownLeft className="h-3.5 w-3.5 text-indigo-600" />
              Qarz Received (I Borrowed)
            </button>
          </div>

          <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-xl text-[11px] text-purple-900 flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 text-purple-600 mt-0.5" />
            <span>
              {direction === "GIVEN"
                ? "This decreases your selected payment account balance and establishes an asset receivable. It is NOT counted as an expense."
                : "This increases your selected payment account balance and establishes a payable liability. It is NOT counted as income."}
            </span>
          </div>

          {/* Person Name */}
          <div className="space-y-1.5">
            <Label htmlFor="qarz-person" className="text-xs font-bold text-[#172B4D]">
              Person's Name *
            </Label>
            <Input
              id="qarz-person"
              type="text"
              placeholder="e.g. Tariq Ahmad, Brother Bilal"
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              required
              list="existing-people-list"
            />
            {existingPeople.length > 0 && (
              <datalist id="existing-people-list">
                {existingPeople.map((name, i) => (
                  <option key={i} value={name} />
                ))}
              </datalist>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Amount */}
            <div className="space-y-1.5">
              <Label htmlFor="qarz-amount" className="text-xs font-bold text-[#172B4D]">
                Loan Amount (₹) *
              </Label>
              <Input
                id="qarz-amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="font-mono text-base font-bold"
              />
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label htmlFor="qarz-date" className="text-xs font-bold text-[#172B4D]">
                Transaction Date *
              </Label>
              <Input
                id="qarz-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Account */}
            <div className="space-y-1.5">
              <Label htmlFor="qarz-account" className="text-xs font-bold text-[#172B4D]">
                {direction === "GIVEN" ? "Disbursed From Account *" : "Received Into Account *"}
              </Label>
              <select
                id="qarz-account"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                {ACCOUNTS.map((acc) => (
                  <option key={acc} value={acc}>
                    {acc}
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div className="space-y-1.5">
              <Label htmlFor="qarz-due-date" className="text-xs font-bold text-[#172B4D]">
                Expected Repayment Date (Optional)
              </Label>
              <Input
                id="qarz-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="qarz-notes" className="text-xs font-bold text-[#172B4D]">
              Notes / Mutual Terms (Optional)
            </Label>
            <textarea
              id="qarz-notes"
              rows={2}
              placeholder="e.g. For medical emergency, agreed repayment after next month..."
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
              disabled={isSubmitting}
              className="bg-purple-700 hover:bg-purple-800 text-white font-bold"
            >
              {isSubmitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {direction === "GIVEN" ? "Record Qarz Given" : "Record Qarz Received"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
