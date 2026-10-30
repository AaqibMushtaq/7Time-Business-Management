import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { insertOrdinaryEntry } from "@/services/zakatService"
import type { WealthAssetCategory, WealthEntryType } from "@/types/zakat"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Loader2, Plus, AlertCircle } from "lucide-react"

interface AddEntryModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
}

const CATEGORY_OPTIONS: { label: string; value: WealthAssetCategory }[] = [
  { label: "Cash on Hand", value: "CASH" },
  { label: "Bank Account", value: "BANK" },
  { label: "Digital Wallet", value: "DIGITAL_WALLET" },
  { label: "Gold (Bullion/Jewelry)", value: "GOLD" },
  { label: "Silver (Bullion/Utensils)", value: "SILVER" },
  { label: "Business Inventory", value: "BUSINESS_INVENTORY" },
  { label: "Investments / Shares", value: "INVESTMENTS" },
  { label: "Strong Receivables (Expected Soon)", value: "RECEIVABLES_STRONG" },
  { label: "Doubtful / Bad Receivables (Exempt)", value: "RECEIVABLES_DOUBTFUL" },
  { label: "Immediate Debt (Deductible)", value: "LIABILITIES_IMMEDIATE" },
  { label: "Long-term Debt (Non-deductible)", value: "LIABILITIES_LONG_TERM" },
  { label: "Other Eligible Asset", value: "OTHER_ASSET" },
]

const ENTRY_TYPE_OPTIONS: { label: string; value: WealthEntryType }[] = [
  { label: "Acquired Wealth (Inflow / Salary / Gift)", value: "ACQUIRED" },
  { label: "Liability Incurred (Debt Taken)", value: "LIABILITY_INCURRED" },
  { label: "Liability Settled (Debt Paid)", value: "LIABILITY_SETTLED" },
  { label: "Expense (Personal Outflow)", value: "EXPENSE" },
]

export function AddEntryModal({ isOpen, onClose, userId }: AddEntryModalProps) {
  const queryClient = useQueryClient()
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split("T")[0])
  const [entryType, setEntryType] = useState<WealthEntryType>("ACQUIRED")
  const [category, setCategory] = useState<WealthAssetCategory>("CASH")
  const [amountInr, setAmountInr] = useState("")
  const [quantity, setQuantity] = useState("")
  const [purityCarat, setPurityCarat] = useState("24")
  const [source, setSource] = useState("Personal Funds")
  const [description, setDescription] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)

  const isMetal = category === "GOLD" || category === "SILVER"

  const mutation = useMutation({
    mutationFn: insertOrdinaryEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zakat-entries"] })
      queryClient.invalidateQueries({ queryKey: ["zakat-evaluation"] })
      handleClose()
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to save wealth entry.")
    },
  })

  function handleClose() {
    setError(null)
    setAmountInr("")
    setQuantity("")
    setDescription("")
    setNotes("")
    onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const numAmount = parseFloat(amountInr)
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid positive amount in INR.")
      return
    }

    if (!description.trim()) {
      setError("Description is required.")
      return
    }

    let numQuantity: number | null = null
    let numPurity: number | null = null

    if (isMetal) {
      numQuantity = quantity.trim() !== "" ? parseFloat(quantity) : null
      numPurity = purityCarat.trim() !== "" ? parseFloat(purityCarat) : null

      if (numQuantity !== null && (isNaN(numQuantity) || numQuantity <= 0)) {
        setError("Metal weight must be a positive number in grams.")
        return
      }

      if (numPurity !== null && (isNaN(numPurity) || numPurity < 1 || numPurity > 24)) {
        setError("Purity must be between 1 and 24 carats.")
        return
      }
    }

    mutation.mutate({
      user_id: userId,
      entry_date: entryDate,
      entry_type: entryType,
      category,
      source: source.trim() || "Personal Funds",
      amount_inr: numAmount,
      quantity: numQuantity,
      purity_carat: numPurity,
      linked_entry_id: null,
      description: description.trim(),
      notes: notes.trim() || null,
      correction_of_entry_id: null,
    })
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-entry-title"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-[#D9E0E8] overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <h2 id="add-entry-title" className="text-base font-bold text-[#172B4D]">
                Add Wealth Entry
              </h2>
              <p className="text-xs text-[#52627A]">
                Record assets, debts, cash inflows, or jewelry for Zakat calculation.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0]/60 transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-[#FDECEC] border border-[#F87171]/40 flex items-center gap-2 text-xs font-medium text-[#DC2626]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="entryDate" className="text-xs font-bold text-[#172B4D]">
                  Date
                </Label>
                <Input
                  id="entryDate"
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="mt-1 text-xs"
                  required
                />
              </div>

              <div>
                <Label htmlFor="entryType" className="text-xs font-bold text-[#172B4D]">
                  Entry Type
                </Label>
                <select
                  id="entryType"
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value as WealthEntryType)}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {ENTRY_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="category" className="text-xs font-bold text-[#172B4D]">
                Asset / Debt Category
              </Label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as WealthAssetCategory)}
                className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="amountInr" className="text-xs font-bold text-[#172B4D]">
                Amount / Value (₹ INR)
              </Label>
              <Input
                id="amountInr"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 50000"
                value={amountInr}
                onChange={(e) => setAmountInr(e.target.value)}
                className="mt-1 text-xs font-medium"
                required
              />
            </div>

            {isMetal && (
              <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/60 space-y-3">
                <span className="text-[11px] font-bold text-amber-900 block">
                  {category} Metal Details (for dynamic revaluation)
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quantity" className="text-xs text-amber-800">
                      Weight (Grams)
                    </Label>
                    <Input
                      id="quantity"
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder="e.g. 15.5"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="mt-1 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="purity" className="text-xs text-amber-800">
                      Purity (Carat)
                    </Label>
                    <select
                      id="purity"
                      value={purityCarat}
                      onChange={(e) => setPurityCarat(e.target.value)}
                      className="mt-1 w-full h-9 rounded-md border border-input bg-white px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="24">24 Karat (99.9% Pure)</option>
                      <option value="22">22 Karat (91.6% Jewelry)</option>
                      <option value="18">18 Karat (75.0% Jewelry)</option>
                      <option value="14">14 Karat (58.3%)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="description" className="text-xs font-bold text-[#172B4D]">
                Description
              </Label>
              <Input
                id="description"
                placeholder="e.g. Gold necklace, Monthly savings, Loan to friend"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="source" className="text-xs font-bold text-[#172B4D]">
                  Source / Tag
                </Label>
                <Input
                  id="source"
                  placeholder="e.g. Salary, Business"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label htmlFor="notes" className="text-xs font-bold text-[#172B4D]">
                  Notes (Optional)
                </Label>
                <Input
                  id="notes"
                  placeholder="Optional notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={mutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : (
                "Save Entry"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

