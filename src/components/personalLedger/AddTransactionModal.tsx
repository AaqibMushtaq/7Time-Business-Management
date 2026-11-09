import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Loader2, X } from "lucide-react"
import type { PersonalTransactionType } from "@/services/personalLedger"

interface AddTransactionModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    entry_type: PersonalTransactionType
    amount: number
    transaction_date: string
    category: string
    particulars: string
    account: string
    to_account?: string
    notes?: string
  }) => Promise<void>
  initialType?: PersonalTransactionType
}

const INCOME_CATEGORIES = ["Salary", "Freelance", "Business Profit", "Investment", "Gift", "Rental Income", "Other Income"]
const EXPENSE_CATEGORIES = ["Groceries", "Rent", "Utilities", "Food & Dining", "Transport", "Health & Medical", "Shopping", "Education", "Bills", "Family", "Other Expense"]
const ACCOUNTS = ["Cash", "Bank Account", "Savings Account", "Digital Wallet"]

export default function AddTransactionModal({
  isOpen,
  onClose,
  onSubmit,
  initialType = "EXPENSE"
}: AddTransactionModalProps) {
  const [entryType, setEntryType] = useState<PersonalTransactionType>(initialType)
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0])
  const [category, setCategory] = useState(initialType === "INCOME" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0])
  const [particulars, setParticulars] = useState("")
  const [account, setAccount] = useState("Cash")
  const [toAccount, setToAccount] = useState("Bank Account")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleTypeChange = (type: PersonalTransactionType) => {
    setEntryType(type)
    if (type === "INCOME") setCategory(INCOME_CATEGORIES[0])
    else if (type === "EXPENSE") setCategory(EXPENSE_CATEGORIES[0])
    else setCategory("Transfer")
    setError(null)
  }

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

    if (entryType === "TRANSFER" && account === toAccount) {
      setError("Source and destination accounts must be different.")
      return
    }

    try {
      setIsSubmitting(true)
      await onSubmit({
        entry_type: entryType,
        amount: numAmount,
        transaction_date: date,
        category: entryType === "TRANSFER" ? "Transfer" : category,
        particulars: particulars.trim(),
        account,
        to_account: entryType === "TRANSFER" ? toAccount : undefined,
        notes: notes.trim() || undefined
      })
      onClose()
      setAmount("")
      setParticulars("")
      setNotes("")
    } catch (err: any) {
      setError(err.message || "Failed to record transaction.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg bg-white border border-[#D9E0E8] p-6 shadow-xl rounded-2xl animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-[#D9E0E8]">
          <div>
            <h3 className="text-xl font-bold text-[#172B4D]">
              Record Personal Transaction
            </h3>
            <p className="text-xs text-[#52627A]">
              Add personal income, expense, or account transfer to your ledger.
            </p>
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
          {/* Type Selector */}
          <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => handleTypeChange("INCOME")}
              className={`py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                entryType === "INCOME"
                  ? "bg-white text-emerald-700 shadow-xs border border-emerald-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" />
              Income
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange("EXPENSE")}
              className={`py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                entryType === "EXPENSE"
                  ? "bg-white text-rose-700 shadow-xs border border-rose-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ArrowUpRight className="h-3.5 w-3.5 text-rose-600" />
              Expense
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange("TRANSFER")}
              className={`py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                entryType === "TRANSFER"
                  ? "bg-white text-blue-700 shadow-xs border border-blue-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ArrowLeftRight className="h-3.5 w-3.5 text-blue-600" />
              Transfer
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Amount */}
            <div className="space-y-1.5">
              <Label htmlFor="tx-amount" className="text-xs font-bold text-[#172B4D]">
                Amount (₹) *
              </Label>
              <Input
                id="tx-amount"
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
              <Label htmlFor="tx-date" className="text-xs font-bold text-[#172B4D]">
                Date *
              </Label>
              <Input
                id="tx-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Particulars */}
          <div className="space-y-1.5">
            <Label htmlFor="tx-particulars" className="text-xs font-bold text-[#172B4D]">
              Particulars (Description) *
            </Label>
            <Input
              id="tx-particulars"
              type="text"
              placeholder={
                entryType === "INCOME"
                  ? "e.g. Monthly salary from employer"
                  : entryType === "EXPENSE"
                  ? "e.g. Supermarket grocery shopping"
                  : "e.g. Transfer cash to bank account"
              }
              value={particulars}
              onChange={(e) => setParticulars(e.target.value)}
              required
            />
          </div>

          {/* Category & Account selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {entryType !== "TRANSFER" ? (
              <div className="space-y-1.5">
                <Label htmlFor="tx-category" className="text-xs font-bold text-[#172B4D]">
                  Category *
                </Label>
                <select
                  id="tx-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  {(entryType === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="tx-to-account" className="text-xs font-bold text-[#172B4D]">
                  To Account *
                </Label>
                <select
                  id="tx-to-account"
                  value={toAccount}
                  onChange={(e) => setToAccount(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  {ACCOUNTS.map((acc) => (
                    <option key={acc} value={acc}>
                      {acc}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="tx-account" className="text-xs font-bold text-[#172B4D]">
                {entryType === "TRANSFER" ? "From Account *" : "Payment Account *"}
              </Label>
              <select
                id="tx-account"
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
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="tx-notes" className="text-xs font-bold text-[#172B4D]">
              Additional Notes (Optional)
            </Label>
            <textarea
              id="tx-notes"
              rows={2}
              placeholder="Any details or receipt references..."
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
              className={`font-bold ${
                entryType === "INCOME"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : entryType === "EXPENSE"
                  ? "bg-rose-600 hover:bg-rose-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {isSubmitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {entryType === "INCOME"
                ? "Save Income"
                : entryType === "EXPENSE"
                ? "Save Expense"
                : "Record Transfer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
