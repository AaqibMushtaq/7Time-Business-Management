import { useState, useEffect } from "react"
import type { ManagedUserAccount } from "@/types/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pencil, Loader2, AlertCircle, X, ShieldCheck } from "lucide-react"

interface AccountEditDialogProps {
  isOpen: boolean
  onClose: () => void
  user: ManagedUserAccount | null
  onSave: (data: { userId: string; full_name?: string; email?: string; phone?: string }) => Promise<void>
  isSaving: boolean
}

export function AccountEditDialog({
  isOpen,
  onClose,
  user,
  onSave,
  isSaving,
}: AccountEditDialogProps) {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user && isOpen) {
      setFullName(user.full_name || "")
      setEmail(user.email || "")
      setPhone(user.phone || "")
      setError(null)
    }
  }, [user, isOpen])

  if (!isOpen || !user) return null

  const isSuperAdmin = user.system_role === "SUPER_ADMIN"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSaving) return
    setError(null)

    const trimmedEmail = email.trim().toLowerCase()
    const trimmedName = fullName.trim()
    const trimmedPhone = phone.trim()

    if (!trimmedName || trimmedName.length < 2) {
      setError("Full name must be at least 2 characters long.")
      return
    }

    if (!trimmedEmail) {
      setError("Email address is required.")
      return
    }

    // Standard email validation pattern
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmedEmail)) {
      setError("Please enter a valid email address.")
      return
    }

    try {
      await onSave({
        userId: user.id,
        full_name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone || undefined,
      })
      onClose()
    } catch (err: any) {
      setError(err?.message || "Failed to update account. Please try again.")
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-50 duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Edit Account Profile
                </h3>
                {isSuperAdmin && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                    <ShieldCheck className="w-3 h-3" />
                    Super Admin
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Update user credentials and profile details.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {isSuperAdmin && (
            <div className="p-3 bg-slate-50 border border-slate-200 text-slate-600 text-xs rounded-xl flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <span>
                System role is permanently protected as <strong>Super Administrator</strong> and cannot be altered.
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Full Name / Identifier *
            </Label>
            <Input
              type="text"
              required
              placeholder="e.g. Basit Bhai (Personal) or Dispatch Operator"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isSaving}
              className="rounded-xl text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Email Address *
            </Label>
            <Input
              type="email"
              required
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSaving}
              className="rounded-xl text-sm"
            />
            <p className="text-[11px] text-slate-400">
              Used for authentication login and system notifications.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Phone Number (Optional)
            </Label>
            <Input
              type="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isSaving}
              className="rounded-xl text-sm"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={onClose}
              className="rounded-xl text-xs font-semibold h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold h-9 px-4 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
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

