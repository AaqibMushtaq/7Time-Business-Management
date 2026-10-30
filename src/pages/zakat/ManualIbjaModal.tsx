import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { saveManualIbjaRates } from "@/services/zakatService"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Loader2, CheckCircle2, AlertCircle, ExternalLink, ShieldCheck } from "lucide-react"

interface ManualIbjaModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ManualIbjaModal({ isOpen, onClose }: ManualIbjaModalProps) {
  const queryClient = useQueryClient()
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0])
  const [session, setSession] = useState<"AM" | "PM">("PM")
  const [gold999Per10g, setGold999Per10g] = useState("140054")
  const [gold916Per10g, setGold916Per10g] = useState("128289")
  const [gold750Per10g, setGold750Per10g] = useState("105041")
  const [silver999PerKg, setSilver999PerKg] = useState("181344")
  const [verifiedBy, setVerifiedBy] = useState("User Manual Verification")
  const [notes, setNotes] = useState("Verified against official ibjarates.com published board")
  const [error, setError] = useState<string | null>(null)

  // Derived per-gram calculations for preview
  const gold999PerGram = gold999Per10g ? (parseFloat(gold999Per10g) / 10).toFixed(2) : "0.00"
  const gold916PerGram = gold916Per10g ? (parseFloat(gold916Per10g) / 10).toFixed(2) : "0.00"
  const gold750PerGram = gold750Per10g ? (parseFloat(gold750Per10g) / 10).toFixed(2) : "0.00"
  const silver999PerGram = silver999PerKg ? (parseFloat(silver999PerKg) / 1000).toFixed(2) : "0.00"

  const mutation = useMutation({
    mutationFn: async () => {
      const g999 = parseFloat(gold999Per10g) / 10
      const s999 = parseFloat(silver999PerKg) / 1000
      const g916 = gold916Per10g ? parseFloat(gold916Per10g) / 10 : undefined
      const g750 = gold750Per10g ? parseFloat(gold750Per10g) / 10 : undefined

      if (isNaN(g999) || g999 <= 0) {
        throw new Error("Please enter a valid positive rate for Gold 999.")
      }
      if (isNaN(s999) || s999 <= 0) {
        throw new Error("Please enter a valid positive rate for Silver 999.")
      }

      return saveManualIbjaRates({
        rateDate: date,
        session,
        gold999: g999,
        gold916: g916,
        gold750: g750,
        silver999: s999,
        enteredBy: verifiedBy,
        verifiedFromUrl: "https://ibjarates.com/",
        notes,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zakat-rates"] })
      queryClient.invalidateQueries({ queryKey: ["zakat-evaluation"] })
      queryClient.invalidateQueries({ queryKey: ["zakat-historical-rates"] })
      handleClose()
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to save manual IBJA rate entry.")
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

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-ibja-title"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h2 id="manual-ibja-title" className="text-base font-bold text-slate-900">
                Record Verified IBJA Benchmark Rates
              </h2>
              <p className="text-xs text-slate-500">
                Enter domestic rates directly from official IBJA public portal (ibjarates.com).
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

        {/* Verification Link Banner */}
        <div className="bg-blue-50/70 border-b border-blue-100 px-6 py-2.5 flex items-center justify-between text-xs text-blue-900">
          <span>Official Benchmark Source:</span>
          <a
            href="https://ibjarates.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline"
          >
            Open ibjarates.com <ExternalLink className="h-3 w-3" />
          </a>
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
            {/* Date and Session Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ibja-date" className="text-xs font-semibold text-slate-700">
                  Rate Date
                </Label>
                <Input
                  id="ibja-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 text-xs h-9"
                  required
                />
              </div>

              <div>
                <Label htmlFor="ibja-session" className="text-xs font-semibold text-slate-700">
                  Trading Session
                </Label>
                <select
                  id="ibja-session"
                  value={session}
                  onChange={(e) => setSession(e.target.value as "AM" | "PM")}
                  className="mt-1 w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="PM">PM Session (Closing Benchmark)</option>
                  <option value="AM">AM Session (Opening Benchmark)</option>
                </select>
              </div>
            </div>

            {/* Gold Rates Input (IBJA ₹ / 10g standard) */}
            <div className="p-3.5 rounded-xl border border-blue-100 bg-blue-50/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900">Gold Benchmark Inputs (₹ per 10g)</span>
                <span className="text-[10px] text-blue-600 font-medium">Auto-divides by 10</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="ibja-g999" className="text-[11px] font-semibold text-slate-700">
                    Gold 999 (24k) *
                  </Label>
                  <Input
                    id="ibja-g999"
                    type="number"
                    step="any"
                    placeholder="140054"
                    value={gold999Per10g}
                    onChange={(e) => setGold999Per10g(e.target.value)}
                    className="mt-1 text-xs h-8"
                    required
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    = ₹{gold999PerGram}/g
                  </span>
                </div>

                <div>
                  <Label htmlFor="ibja-g916" className="text-[11px] font-semibold text-slate-700">
                    Gold 916 (22k)
                  </Label>
                  <Input
                    id="ibja-g916"
                    type="number"
                    step="any"
                    placeholder="128289"
                    value={gold916Per10g}
                    onChange={(e) => setGold916Per10g(e.target.value)}
                    className="mt-1 text-xs h-8"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    = ₹{gold916PerGram}/g
                  </span>
                </div>

                <div>
                  <Label htmlFor="ibja-g750" className="text-[11px] font-semibold text-slate-700">
                    Gold 750 (18k)
                  </Label>
                  <Input
                    id="ibja-g750"
                    type="number"
                    step="any"
                    placeholder="105041"
                    value={gold750Per10g}
                    onChange={(e) => setGold750Per10g(e.target.value)}
                    className="mt-1 text-xs h-8"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    = ₹{gold750PerGram}/g
                  </span>
                </div>
              </div>
            </div>

            {/* Silver Rates Input (IBJA ₹ / 1kg standard) */}
            <div className="p-3.5 rounded-xl border border-amber-100 bg-amber-50/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900">Silver Benchmark Input (₹ per 1kg)</span>
                <span className="text-[10px] text-amber-700 font-medium">Auto-divides by 1,000</span>
              </div>

              <div>
                <Label htmlFor="ibja-s999" className="text-[11px] font-semibold text-slate-700">
                  Silver 999 (Fine Silver) *
                </Label>
                <Input
                  id="ibja-s999"
                  type="number"
                  step="any"
                  placeholder="181344"
                  value={silver999PerKg}
                  onChange={(e) => setSilver999PerKg(e.target.value)}
                  className="mt-1 text-xs h-8"
                  required
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  = ₹{silver999PerGram}/g (Nisab 612.36g = ₹{(parseFloat(silver999PerGram) * 612.36).toLocaleString("en-IN", { maximumFractionDigits: 0 })})
                </span>
              </div>
            </div>

            {/* Provenance & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ibja-verified-by" className="text-xs font-semibold text-slate-700">
                  Verified By
                </Label>
                <Input
                  id="ibja-verified-by"
                  type="text"
                  value={verifiedBy}
                  onChange={(e) => setVerifiedBy(e.target.value)}
                  className="mt-1 text-xs h-8"
                />
              </div>

              <div>
                <Label htmlFor="ibja-notes" className="text-xs font-semibold text-slate-700">
                  Audit Notes
                </Label>
                <Input
                  id="ibja-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 text-xs h-8"
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
              className="text-xs h-9 bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Saving Rates...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Record Benchmark Rates
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
