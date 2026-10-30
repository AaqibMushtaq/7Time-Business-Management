import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { saveSrinagarLocalRate, setValuationSourcePreference } from "@/services/zakatService"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Loader2, CheckCircle2, AlertCircle, MapPin, Info } from "lucide-react"

interface SrinagarResaleModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function SrinagarResaleModal({ isOpen, onClose, onSuccess }: SrinagarResaleModalProps) {
  const queryClient = useQueryClient()
  const [jewellerName, setJewellerName] = useState("Hari Singh High Street Jewellers")
  const [metal, setMetal] = useState<"GOLD" | "SILVER">("GOLD")
  const [purity, setPurity] = useState<"999" | "995" | "916" | "750" | "585">("916")
  const [buyBackRate, setBuyBackRate] = useState("11800")
  const [verifiedAt, setVerifiedAt] = useState(() => new Date().toISOString().split("T")[0])
  const [enteredBy, setEnteredBy] = useState("Aaqib")
  const [verificationNote, setVerificationNote] = useState("Direct shop counter quote for net cash buy-back (excluding making charges)")
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      const rate = parseFloat(buyBackRate)
      if (isNaN(rate) || rate <= 0) {
        throw new Error("Please enter a valid positive buy-back rate in INR per gram.")
      }
      if (!jewellerName.trim()) {
        throw new Error("Please provide the jeweller or Sarafa establishment name.")
      }

      saveSrinagarLocalRate({
        jewellerName: jewellerName.trim(),
        metal,
        purity,
        buyBackRate: rate,
        verifiedAt,
        enteredBy: enteredBy.trim() || "User",
        verificationNote: verificationNote.trim() || "Local Srinagar resale quote",
      })

      // Update preference so evaluation activates local rate
      setValuationSourcePreference("SRINAGAR_LOCAL")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zakat-evaluation"] })
      queryClient.invalidateQueries({ queryKey: ["srinagar-rates"] })
      if (onSuccess) onSuccess()
      handleClose()
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to record Srinagar local resale quote.")
    },
  })

  const handleClose = () => {
    setError(null)
    onClose()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    mutation.mutate()
  }

  return isOpen ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="srinagar-resale-title"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-200">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <h2 id="srinagar-resale-title" className="text-base font-bold text-slate-900">
                Record Srinagar Local Jeweller Resale Quote
              </h2>
              <p className="text-xs text-slate-500">
                Optional Kashmir Sarafa market quote for local resale/buy-back valuation.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Fiqh Explanation Banner */}
        <div className="bg-purple-50/70 border-b border-purple-100 px-6 py-2.5 flex items-start gap-2 text-xs text-purple-950">
          <Info className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
          <span className="leading-relaxed text-[11px]">
            Classical Hanafi scholars permit valuing jewellery at net cash resale/scrap buy-back value (what you would actually receive if sold today, excluding making charges and jewel profit).
          </span>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs font-medium text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Jeweller Name */}
            <div>
              <Label htmlFor="srinagar-jeweller" className="text-xs font-semibold text-slate-700">
                Jeweller / Sarafa Shop Name *
              </Label>
              <Input
                id="srinagar-jeweller"
                type="text"
                value={jewellerName}
                onChange={(e) => setJewellerName(e.target.value)}
                placeholder="e.g. Hari Singh High Street Jewellers, Sarafa Bazaar Srinagar"
                className="mt-1 text-xs h-9"
                required
              />
            </div>

            {/* Metal & Purity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="srinagar-metal" className="text-xs font-semibold text-slate-700">
                  Precious Metal
                </Label>
                <select
                  id="srinagar-metal"
                  value={metal}
                  onChange={(e) => {
                    const m = e.target.value as "GOLD" | "SILVER"
                    setMetal(m)
                    if (m === "SILVER") setPurity("999")
                    else setPurity("916")
                  }}
                  className="mt-1 w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="GOLD">Gold</option>
                  <option value="SILVER">Silver</option>
                </select>
              </div>

              <div>
                <Label htmlFor="srinagar-purity" className="text-xs font-semibold text-slate-700">
                  Purity / Carat
                </Label>
                {metal === "GOLD" ? (
                  <select
                    id="srinagar-purity"
                    value={purity}
                    onChange={(e) => setPurity(e.target.value as "999" | "995" | "916" | "750" | "585")}
                    className="mt-1 w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="999">24k (Fine Bullion 999)</option>
                    <option value="916">22k (Standard Jewellery 916)</option>
                    <option value="750">18k (Jewellery 750)</option>
                    <option value="585">14k (Jewellery 585)</option>
                  </select>
                ) : (
                  <select
                    id="srinagar-purity"
                    value={purity}
                    onChange={(e) => setPurity(e.target.value as "999" | "995" | "916" | "750" | "585")}
                    className="mt-1 w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="999">Silver 999 (Fine Silver)</option>
                  </select>
                )}
              </div>
            </div>

            {/* Buy-back Rate and Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="srinagar-rate" className="text-xs font-semibold text-slate-700">
                  Cash Buy-Back Rate (₹ per gram) *
                </Label>
                <Input
                  id="srinagar-rate"
                  type="number"
                  step="any"
                  value={buyBackRate}
                  onChange={(e) => setBuyBackRate(e.target.value)}
                  placeholder="e.g. 11800"
                  className="mt-1 text-xs h-9"
                  required
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Excluding making charges and stone weights
                </span>
              </div>

              <div>
                <Label htmlFor="srinagar-date" className="text-xs font-semibold text-slate-700">
                  Quote Date
                </Label>
                <Input
                  id="srinagar-date"
                  type="date"
                  value={verifiedAt}
                  onChange={(e) => setVerifiedAt(e.target.value)}
                  className="mt-1 text-xs h-9"
                  required
                />
              </div>
            </div>

            {/* Entered By and Verification Note */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="srinagar-entered-by" className="text-xs font-semibold text-slate-700">
                  Recorded By
                </Label>
                <Input
                  id="srinagar-entered-by"
                  type="text"
                  value={enteredBy}
                  onChange={(e) => setEnteredBy(e.target.value)}
                  className="mt-1 text-xs h-9"
                />
              </div>

              <div>
                <Label htmlFor="srinagar-note" className="text-xs font-semibold text-slate-700">
                  Quote Verification Details
                </Label>
                <Input
                  id="srinagar-note"
                  type="text"
                  value={verificationNote}
                  onChange={(e) => setVerificationNote(e.target.value)}
                  placeholder="e.g. In-person counter quote"
                  className="mt-1 text-xs h-9"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={mutation.isPending}
              className="text-xs h-9 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={mutation.isPending}
              className="text-xs h-9 bg-purple-600 hover:bg-purple-700 text-white cursor-pointer"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Recording Quote...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Save & Apply Quote
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  ) : null
}
