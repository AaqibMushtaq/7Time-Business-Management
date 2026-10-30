import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { saveUserSettings } from "@/services/zakatService"
import type { ZakatUserSettingsRow } from "@/types/zakat"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Loader2, Settings, AlertCircle, Info } from "lucide-react"

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  currentSettings: ZakatUserSettingsRow | null
}

export function SettingsModal(props: SettingsModalProps) {
  if (!props.isOpen) return null
  return <SettingsModalContent {...props} />
}

function SettingsModalContent({
  onClose,
  userId,
  currentSettings,
}: Omit<SettingsModalProps, "isOpen">) {
  const queryClient = useQueryClient()
  const [preferredStandard, setPreferredStandard] = useState<"SILVER" | "GOLD">(
    currentSettings?.preferred_nisab_standard || "SILVER"
  )
  const [silverGrams, setSilverGrams] = useState(
    String(currentSettings?.silver_nisab_grams || "612.36")
  )
  const [goldGrams, setGoldGrams] = useState(
    String(currentSettings?.gold_nisab_grams || "87.48")
  )
  const [hijriOffset, setHijriOffset] = useState(
    String(currentSettings?.hijri_day_offset ?? 0)
  )
  const [customStartDate, setCustomStartDate] = useState(
    currentSettings?.custom_hawl_start_date || ""
  )
  const [isConfirmed, setIsConfirmed] = useState(
    Boolean(currentSettings?.is_hawl_start_date_confirmed)
  )
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: saveUserSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zakat-settings"] })
      queryClient.invalidateQueries({ queryKey: ["zakat-evaluation"] })
      onClose()
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to update Zakat settings.")
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const numSilver = parseFloat(silverGrams)
    const numGold = parseFloat(goldGrams)
    const numOffset = parseInt(hijriOffset, 10)

    if (isNaN(numSilver) || numSilver <= 0) {
      setError("Silver Nisab threshold must be a positive number.")
      return
    }

    if (isNaN(numGold) || numGold <= 0) {
      setError("Gold Nisab threshold must be a positive number.")
      return
    }

    if (isNaN(numOffset) || numOffset < -2 || numOffset > 2) {
      setError("Hijri day offset must be between -2 and +2.")
      return
    }

    mutation.mutate({
      user_id: userId,
      preferred_nisab_standard: preferredStandard,
      silver_nisab_grams: numSilver,
      gold_nisab_grams: numGold,
      hijri_day_offset: numOffset,
      custom_hawl_start_date: customStartDate.trim() || null,
      is_hawl_start_date_confirmed: isConfirmed,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-[#D9E0E8] overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <Settings className="h-4 w-4" />
            </div>
            <div>
              <h2 id="settings-modal-title" className="text-base font-bold text-[#172B4D]">
                Zakat & Hawl Configuration
              </h2>
              <p className="text-xs text-[#52627A]">
                Customize Nisab standards, lunar calendar calibration, and Hawl anniversary date.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
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

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Preferred Standard */}
            <div>
              <Label className="text-xs font-bold text-[#172B4D]">
                Preferred Nisab Standard
              </Label>
              <div className="grid grid-cols-2 gap-3 mt-1.5">
                <button
                  type="button"
                  onClick={() => setPreferredStandard("SILVER")}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    preferredStandard === "SILVER"
                      ? "border-blue-500 bg-blue-50/40 text-blue-900 ring-2 ring-blue-500"
                      : "border-slate-200 hover:border-slate-300 text-slate-700"
                  }`}
                >
                  <span className="font-bold text-xs block">Silver Nisab (Default)</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Classical Hanafi ruling for mixed currency/trade wealth (612.36g).
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreferredStandard("GOLD")}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    preferredStandard === "GOLD"
                      ? "border-blue-500 bg-blue-50/40 text-blue-900 ring-2 ring-blue-500"
                      : "border-slate-200 hover:border-slate-300 text-slate-700"
                  }`}
                >
                  <span className="font-bold text-xs block">Gold Nisab</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Higher threshold standard (87.48g pure gold).
                  </span>
                </button>
              </div>
            </div>

            {/* Threshold Grams */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="silverGrams" className="text-xs font-bold text-[#172B4D]">
                  Silver Grams (52.5 Tolas)
                </Label>
                <Input
                  id="silverGrams"
                  type="number"
                  step="0.01"
                  value={silverGrams}
                  onChange={(e) => setSilverGrams(e.target.value)}
                  className="mt-1 text-xs"
                  required
                />
              </div>

              <div>
                <Label htmlFor="goldGrams" className="text-xs font-bold text-[#172B4D]">
                  Gold Grams (7.5 Tolas)
                </Label>
                <Input
                  id="goldGrams"
                  type="number"
                  step="0.01"
                  value={goldGrams}
                  onChange={(e) => setGoldGrams(e.target.value)}
                  className="mt-1 text-xs"
                  required
                />
              </div>
            </div>

            {/* Regional Sighting Calibration */}
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="hijriOffset" className="text-xs font-bold text-[#172B4D]">
                  Regional Moon Sighting Offset (Days)
                </Label>
                <span className="text-[11px] text-slate-500">Kashmir / India: 0 or +1</span>
              </div>
              <select
                id="hijriOffset"
                value={hijriOffset}
                onChange={(e) => setHijriOffset(e.target.value)}
                className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="-2">-2 Days (Early sighting)</option>
                <option value="-1">-1 Day (1 day earlier)</option>
                <option value="0">0 Days (Standard Umm al-Qura)</option>
                <option value="1">+1 Day (Regional India/Pakistan sighting)</option>
                <option value="2">+2 Days (Late sighting)</option>
              </select>
            </div>

            {/* Custom Hawl Start Date */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Info className="h-3.5 w-3.5 text-blue-600" />
                <span>Custom Hawl Anniversary Date</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                If you have an established annual Zakat date (e.g. 1st Ramadan), set it below. Otherwise, the ledger will detect your first qualifying date automatically.
              </p>
              <div>
                <Label htmlFor="customDate" className="text-xs text-slate-700">
                  Established Start Date (Gregorian)
                </Label>
                <Input
                  id="customDate"
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="mt-1 text-xs bg-white"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer mt-2">
                <input
                  type="checkbox"
                  checked={isConfirmed}
                  onChange={(e) => setIsConfirmed(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="text-xs text-slate-700 font-medium">
                  Confirm this is my verified Hawl start date
                </span>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
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
                "Save Preferences"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

