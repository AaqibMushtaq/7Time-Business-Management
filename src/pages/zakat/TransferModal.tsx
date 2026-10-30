import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createPairedConversion } from "@/services/zakatService"
import type { WealthAssetCategory } from "@/types/zakat"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Loader2, ArrowRightLeft, AlertCircle, ShieldCheck } from "lucide-react"

interface TransferModalProps {
  isOpen: boolean
  onClose: () => void
}

const CONVERTIBLE_CATEGORIES: { label: string; value: WealthAssetCategory }[] = [
  { label: "Cash on Hand", value: "CASH" },
  { label: "Bank Account", value: "BANK" },
  { label: "Digital Wallet", value: "DIGITAL_WALLET" },
  { label: "Gold (Bullion/Jewelry)", value: "GOLD" },
  { label: "Silver (Bullion/Utensils)", value: "SILVER" },
  { label: "Business Inventory", value: "BUSINESS_INVENTORY" },
  { label: "Investments", value: "INVESTMENTS" },
  { label: "Strong Receivables", value: "RECEIVABLES_STRONG" },
  { label: "Other Asset", value: "OTHER_ASSET" },
]

export function TransferModal({ isOpen, onClose }: TransferModalProps) {
  const queryClient = useQueryClient()
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0])
  const [sourceCategory, setSourceCategory] = useState<WealthAssetCategory>("CASH")
  const [destCategory, setDestCategory] = useState<WealthAssetCategory>("BANK")
  const [amountInr, setAmountInr] = useState("")
  const [description, setDescription] = useState("")
  const [destQuantity, setDestQuantity] = useState("")
  const [destPurityCarat, setDestPurityCarat] = useState("24")
  const [error, setError] = useState<string | null>(null)

  const isDestMetal = destCategory === "GOLD" || destCategory === "SILVER"

  const mutation = useMutation({
    mutationFn: createPairedConversion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zakat-entries"] })
      queryClient.invalidateQueries({ queryKey: ["zakat-evaluation"] })
      handleClose()
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to create paired conversion.")
    },
  })

  function handleClose() {
    setError(null)
    setAmountInr("")
    setDescription("")
    setDestQuantity("")
    onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (sourceCategory === destCategory) {
      setError("Source and destination categories must differ.")
      return
    }

    const numAmount = parseFloat(amountInr)
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid positive transfer amount in INR.")
      return
    }

    let numDestQuantity: number | undefined = undefined
    let numDestPurity: number | undefined = undefined

    if (isDestMetal) {
      if (destQuantity.trim() !== "") {
        numDestQuantity = parseFloat(destQuantity)
        if (isNaN(numDestQuantity) || numDestQuantity <= 0) {
          setError("Metal weight must be a positive number in grams.")
          return
        }
      }
      if (destPurityCarat.trim() !== "") {
        numDestPurity = parseFloat(destPurityCarat)
        if (isNaN(numDestPurity) || numDestPurity < 1 || numDestPurity > 24) {
          setError("Purity must be between 1 and 24 carats.")
          return
        }
      }
    }

    mutation.mutate({
      date,
      sourceCategory,
      destCategory,
      amountInr: numAmount,
      description: description.trim() || `Transfer from ${sourceCategory} to ${destCategory}`,
      destQuantity: numDestQuantity,
      destPurityCarat: numDestPurity,
    })
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-modal-title"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-[#D9E0E8] overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            <div>
              <h2 id="transfer-modal-title" className="text-base font-bold text-[#172B4D]">
                Asset Transfer / Conversion
              </h2>
              <p className="text-xs text-[#52627A]">
                Convert cash to bank, buy gold/silver, or reallocate assets atomically.
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

        {/* Double Entry Notice */}
        <div className="mx-6 mt-4 p-3 rounded-xl bg-blue-50/70 border border-blue-200/60 flex items-start gap-2.5 text-xs text-blue-900">
          <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <span>
            <strong>Double-Entry Ledger Guarantee:</strong> Creates balanced reciprocal records (outgoing and incoming) ensuring total wealth remains conserved with zero double-counting.
          </span>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-[#FDECEC] border border-[#F87171]/40 flex items-center gap-2 text-xs font-medium text-[#DC2626]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <Label htmlFor="transferDate" className="text-xs font-bold text-[#172B4D]">
                Transfer Date
              </Label>
              <Input
                id="transferDate"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sourceCategory" className="text-xs font-bold text-[#172B4D]">
                  From (Source)
                </Label>
                <select
                  id="sourceCategory"
                  value={sourceCategory}
                  onChange={(e) => setSourceCategory(e.target.value as WealthAssetCategory)}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {CONVERTIBLE_CATEGORIES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="destCategory" className="text-xs font-bold text-[#172B4D]">
                  To (Destination)
                </Label>
                <select
                  id="destCategory"
                  value={destCategory}
                  onChange={(e) => setDestCategory(e.target.value as WealthAssetCategory)}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {CONVERTIBLE_CATEGORIES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="transferAmount" className="text-xs font-bold text-[#172B4D]">
                Transfer Amount (₹ INR)
              </Label>
              <Input
                id="transferAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 25000"
                value={amountInr}
                onChange={(e) => setAmountInr(e.target.value)}
                className="mt-1 text-xs font-medium"
                required
              />
            </div>

            {isDestMetal && (
              <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/60 space-y-3">
                <span className="text-[11px] font-bold text-amber-900 block">
                  Purchased {destCategory} Details
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="destQuantity" className="text-xs text-amber-800">
                      Acquired Weight (Grams)
                    </Label>
                    <Input
                      id="destQuantity"
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder="e.g. 3.25"
                      value={destQuantity}
                      onChange={(e) => setDestQuantity(e.target.value)}
                      className="mt-1 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="destPurity" className="text-xs text-amber-800">
                      Purity (Carat)
                    </Label>
                    <select
                      id="destPurity"
                      value={destPurityCarat}
                      onChange={(e) => setDestPurityCarat(e.target.value)}
                      className="mt-1 w-full h-9 rounded-md border border-input bg-white px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="24">24 Karat (99.9%)</option>
                      <option value="22">22 Karat (91.6%)</option>
                      <option value="18">18 Karat (75.0%)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="transferDesc" className="text-xs font-bold text-[#172B4D]">
                Description / Memo
              </Label>
              <Input
                id="transferDesc"
                placeholder="e.g. Purchased 24k gold bullion, ATM Cash Deposit"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 text-xs"
              />
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
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Transferring...
                </>
              ) : (
                "Execute Transfer"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

