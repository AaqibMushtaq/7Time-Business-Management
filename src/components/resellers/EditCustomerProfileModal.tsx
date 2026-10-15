import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { updateReseller, type ResellerCustomer } from "@/services/resellers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Loader2, AlertCircle, User, Phone, MapPin, FileText } from "lucide-react"

interface EditCustomerProfileModalProps {
  isOpen: boolean
  onClose: () => void
  customer: ResellerCustomer
  onSuccess?: () => void
}

export default function EditCustomerProfileModal({
  isOpen,
  onClose,
  customer,
  onSuccess
}: EditCustomerProfileModalProps) {
  const queryClient = useQueryClient()

  const [name, setName] = useState(customer.name || "")
  const [phone, setPhone] = useState(customer.phone || "")
  const [address, setAddress] = useState(customer.address || "")
  const [notes, setNotes] = useState(customer.notes || "")
  const [openingBalance, setOpeningBalance] = useState(customer.opening_balance ? customer.opening_balance.toString() : "0")
  const [formError, setFormError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (data: Partial<ResellerCustomer>) => updateReseller(customer.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reseller", customer.id] })
      queryClient.invalidateQueries({ queryKey: ["resellers"] })
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] })
      onSuccess?.()
      onClose()
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to update person details")
    }
  })

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setFormError("Name is required.")
      return
    }

    const payload: Partial<ResellerCustomer> = {
      name: trimmedName,
      phone: phone.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
      opening_balance: parseFloat(openingBalance) || 0
    }

    mutation.mutate(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div 
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
      >
        {/* Header */}
        <div 
          className="px-6 py-4.5 text-white flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, #2D7FF9 0%, #4A39D6 100%)" }}
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shadow-inner">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 id="edit-profile-title" className="text-lg font-bold leading-tight">
                Edit Person Details
              </h2>
              <p className="text-xs text-blue-100 font-medium">
                Update contact details and personal ledger notes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-xs">Validation Error</p>
                <p className="text-xs text-red-600 mt-0.5">{formError}</p>
              </div>
            </div>
          )}

          {/* Person Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor="customer-name" className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-slate-400" />
              Full Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="customer-name"
              required
              placeholder="e.g. Ishfaq Ahmad"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={mutation.isPending}
              className="border-slate-200 focus-visible:ring-[#2D7FF9] font-medium"
            />
          </div>

          {/* Phone Number */}
          <div className="space-y-1.5">
            <Label htmlFor="customer-phone" className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-slate-400" />
              Phone Number
            </Label>
            <Input
              id="customer-phone"
              placeholder="+91..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={mutation.isPending}
              className="border-slate-200 focus-visible:ring-[#2D7FF9]"
            />
          </div>

          {/* Address / Location */}
          <div className="space-y-1.5">
            <Label htmlFor="customer-address" className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              Address / Locality
            </Label>
            <textarea
              id="customer-address"
              rows={2}
              className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-[#2D7FF9] focus:outline-hidden focus:ring-2 focus:ring-[#2D7FF9]/20"
              placeholder="Locality, residence, or delivery landmark"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={mutation.isPending}
            />
          </div>

          {/* Personal Ledger Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="customer-notes" className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              Personal Ledger Notes / Terms
            </Label>
            <textarea
              id="customer-notes"
              rows={3}
              className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-[#2D7FF9] focus:outline-hidden focus:ring-2 focus:ring-[#2D7FF9]/20"
              placeholder="Important notes, agreement, or special instructions"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={mutation.isPending}
            />
          </div>

          {/* Opening Balance */}
          <div className="space-y-1.5">
            <Label htmlFor="customer-opening-balance" className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Opening Balance (Rs) (Optional)
            </Label>
            <Input
              id="customer-opening-balance"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              disabled={mutation.isPending}
              className="border-slate-200 focus-visible:ring-[#2D7FF9]"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={mutation.isPending}
              className="text-slate-600 font-medium text-xs sm:text-sm"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="bg-[#2D7FF9] hover:bg-[#2068d4] text-white font-semibold text-xs sm:text-sm"
            >
              {mutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
