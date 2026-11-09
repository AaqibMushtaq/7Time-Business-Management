import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Loader2, X } from "lucide-react"
import type { PersonalTransaction } from "@/services/personalLedger"

interface EditTransactionModalProps {
  isOpen: boolean
  onClose: () => void
  transaction: PersonalTransaction | null
  onUpdate: (id: string, data: {
    amount: number
    transaction_date: string
    category: string
    particulars: string
    account: string
    to_account?: string | null
    notes?: string | null
  }) => Promise<void>
}

const INCOME_CATEGORIES = ["Salary", "Freelance", "Business Profit", "Investment", "Gift", "Rental Income", "Other Income"]
const EXPENSE_CATEGORIES = ["Groceries", "Rent", "Utilities", "Food & Dining", "Transport", "Health & Medical", "Shopping", "Education", "Bills", "Family", "Other Expense"]
const ACCOUNTS = ["Cash", "Bank Account", "Savings Account", "Digital Wallet"]

export default function EditTransactionModal({
  isOpen,
  onClose,
  transaction,
  onUpdate
}: EditTransactionModalProps) {
  const [amount, setAmount] = useState(() => (transaction ? String(transaction.amount) : ""))
  const [date, setDate] = useState(() => transaction?.transaction_date || new Date().toISOString().split("T")[0])
  const [category, setCategory] = useState(() => transaction?.category || (transaction?.entry_type === "INCOME" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]))
  const [particulars, setParticulars] = useState(() => transaction?.particulars || "")
  const [account, setAccount] = useState(() => transaction?.account || "Cash")
  const [toAccount, setToAccount] = useState(() => transaction?.to_account || "Bank Account")
  const [notes, setNotes] = useState(() => transaction?.notes || "")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen || !transaction) return null

  const isIncome = transaction.entry_type === "INCOME"
  const isExpense = transaction.entry_type === "EXPENSE"
  const isTransfer = transaction.entry_type === "TRANSFER"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid amount greater than zero.")
      return
    }

    if (!particulars.trim()) {
      setError("Particulars description is required.")
      return
    }

    if (isTransfer && account.trim() === toAccount.trim()) {
      setError("Source and destination accounts must be different.")
      return
    }

    try {
      setIsSubmitting(true)
      await onUpdate(transaction.id, {
        amount: numAmount,
        transaction_date: date,
        category: isTransfer ? "Transfer" : category,
        particulars: particulars.trim(),
        account,
        to_account: isTransfer ? toAccount : null,
        notes: notes.trim() || null
      })
      onClose()
    } catch (err: any) {
      setError(err.message || "Failed to update transaction.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg bg-white border border-[#D9E0E8] p-6 shadow-xl rounded-2xl animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-[#D9E0E8]">
          <div className="flex items-center gap-2">
            {isIncome && <ArrowDownLeft className="h-5 w-5 text-emerald-600" />}
            {isExpense && <ArrowUpRight className="h-5 w-5 text-rose-600" />}
            {isTransfer && <ArrowLeftRight className="h-5 w-5 text-blue-600" />}
            <h2 className="text-base font-bold text-[#1A202C]">
              Edit Personal {isIncome ? "Income" : isExpense ? "Expense" : "Transfer"}
            </h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold text-[#4A5568]">Amount (₹) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="mt-1 font-mono font-bold text-base"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-[#4A5568]">Transaction Date *</Label>
              <Input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {!isTransfer && (
            <div>
              <Label className="text-xs font-bold text-[#4A5568]">Category *</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {(isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <Label className="text-xs font-bold text-[#4A5568]">Particulars / Description *</Label>
            <Input
              type="text"
              required
              value={particulars}
              onChange={(e) => setParticulars(e.target.value)}
              placeholder="e.g. Monthly salary, Grocery run, Rent"
              className="mt-1 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold text-[#4A5568]">
                {isTransfer ? "From Account *" : "Account *"}
              </Label>
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {ACCOUNTS.map((acc) => (
                  <option key={acc} value={acc}>
                    {acc}
                  </option>
                ))}
              </select>
            </div>

            {isTransfer && (
              <div>
                <Label className="text-xs font-bold text-[#4A5568]">To Account *</Label>
                <select
                  value={toAccount}
                  onChange={(e) => setToAccount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {ACCOUNTS.map((acc) => (
                    <option key={acc} value={acc}>
                      {acc}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs font-bold text-[#4A5568]">Notes (Optional)</Label>
            <Input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional memo or reference"
              className="mt-1 text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D9E0E8]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="rounded-xl bg-[#1A202C] hover:bg-slate-800 text-white font-bold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
