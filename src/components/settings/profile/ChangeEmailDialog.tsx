import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, X } from "lucide-react"
import { initiateSelfEmailChange, isValidEmail } from "@/services/profileService"

interface ChangeEmailDialogProps {
  isOpen: boolean
  onClose: () => void
  currentEmail?: string
  onSuccess?: () => void
}

export function ChangeEmailDialog({
  isOpen,
  onClose,
  currentEmail = "",
  onSuccess,
}: ChangeEmailDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [confirmEmail, setConfirmEmail] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<{ message: string; pendingEmail?: string } | null>(null)

  useEffect(() => {
    if (isOpen) {
      setCurrentPassword("")
      setNewEmail("")
      setConfirmEmail("")
      setShowPassword(false)
      setError(null)
      setSuccessInfo(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessInfo(null)

    if (!currentPassword) {
      setError("Please enter your current password to authorize this email change.")
      return
    }

    const trimmedNew = newEmail.trim().toLowerCase()
    const trimmedConfirm = confirmEmail.trim().toLowerCase()

    if (!isValidEmail(trimmedNew)) {
      setError("Please enter a valid new email address.")
      return
    }

    if (trimmedNew === currentEmail.trim().toLowerCase()) {
      setError("The new email address must be different from your current email address.")
      return
    }

    if (trimmedNew !== trimmedConfirm) {
      setError("New email and confirmation email do not match.")
      return
    }

    try {
      setIsSubmitting(true)
      const res = await initiateSelfEmailChange(currentPassword, trimmedNew)
      setSuccessInfo({
        message: res.message,
        pendingEmail: res.pendingEmail,
      })
      onSuccess?.()
    } catch (err: any) {
      setError(err?.message || "Failed to update email address. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (isSubmitting) return
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-50 duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-email-title"
    >
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 id="change-email-title" className="text-base font-extrabold text-slate-900 tracking-tight">
                Change Email Address
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify your password and request a new email address.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {successInfo ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Email Verification Sent</span>
                </div>
                <p className="leading-relaxed">{successInfo.message}</p>
                {successInfo.pendingEmail && (
                  <p className="text-emerald-700 pt-1 border-t border-emerald-200/60">
                    Target Email: <strong>{successInfo.pendingEmail}</strong>
                  </p>
                )}
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-800">
                <p className="font-semibold mb-0.5">What happens next?</p>
                <p className="text-slate-600 leading-relaxed">
                  You can continue using your current email (<strong>{currentEmail}</strong>) until you click the confirmation link in the verification email.
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="button"
                  onClick={handleClose}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
                >
                  Understood
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

              {/* Current Active Email (Display) */}
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Current Email Address
                </Label>
                <div className="text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
                  {currentEmail || "—"}
                </div>
              </div>

              {/* Current Password Reauthentication */}
              <div className="space-y-1.5">
                <Label htmlFor="current-pw-for-email" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Current Password *
                </Label>
                <div className="relative">
                  <Input
                    id="current-pw-for-email"
                    type={showPassword ? "text" : "password"}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password to authorize"
                    className="pr-10 rounded-xl border-slate-200 focus-visible:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Required to prevent unauthorized modifications to your account.
                </p>
              </div>

              {/* New Email */}
              <div className="space-y-1.5">
                <Label htmlFor="new-email-input" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  New Email Address *
                </Label>
                <Input
                  id="new-email-input"
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. yourname@domain.com"
                  className="rounded-xl border-slate-200 focus-visible:ring-blue-600"
                />
              </div>

              {/* Confirm New Email */}
              <div className="space-y-1.5">
                <Label htmlFor="confirm-email-input" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Confirm New Email Address *
                </Label>
                <Input
                  id="confirm-email-input"
                  type="email"
                  required
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder="Re-enter new email address"
                  className="rounded-xl border-slate-200 focus-visible:ring-blue-600"
                />
              </div>

              {/* Dialog Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={handleClose}
                  className="rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 border-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Send Verification Email"
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
