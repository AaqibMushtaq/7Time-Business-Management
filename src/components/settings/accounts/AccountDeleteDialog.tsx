import React, { useState, useEffect } from "react"
import type { ManagedUserAccount } from "@/types/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle, Trash2, Loader2, X, ShieldAlert } from "lucide-react"

interface AccountDeleteDialogProps {
  isOpen: boolean
  onClose: () => void
  user: ManagedUserAccount | null
  onConfirmDelete: (userId: string, transferWorkspaces: boolean) => Promise<void>
  isDeleting: boolean
}

export function AccountDeleteDialog({
  isOpen,
  onClose,
  user,
  onConfirmDelete,
  isDeleting,
}: AccountDeleteDialogProps) {
  const [typedEmail, setTypedEmail] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setTypedEmail("")
      setError(null)
    }
  }, [isOpen])

  if (!isOpen || !user) return null

  const targetEmail = user.email.trim().toLowerCase()
  const isMatch = typedEmail.trim().toLowerCase() === targetEmail

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isMatch || isDeleting) return
    setError(null)

    try {
      await onConfirmDelete(user.id, true)
      onClose()
    } catch (err: any) {
      setError(err?.message || "Failed to delete account. Please try again.")
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-50 duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-rose-200 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 bg-rose-50/70 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-rose-950 tracking-tight">
                Permanently Delete Account
              </h3>
              <p className="text-xs text-rose-700 mt-0.5">
                This action is irreversible and revokes all user access.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="text-rose-400 hover:text-rose-700 p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleDelete} className="p-5 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Account Card Summary */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm">
              {(user.full_name || user.email).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 truncate">
                {user.full_name || user.email}
              </div>
              <div className="text-xs text-slate-500 font-mono truncate">
                {user.email}
              </div>
            </div>
          </div>

          {/* Warning Notice */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Data Preservation & Safety Strategy</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-amber-800 text-[11px] leading-relaxed">
              <li>
                <strong>Authentication & Profile:</strong> The login identity and profile will be permanently deleted from Supabase Auth.
              </li>
              <li>
                <strong>Module Entitlements:</strong> All individual module permissions assigned to this user will be purged.
              </li>
              <li>
                <strong>Financial & Business Records:</strong> Empty personal workspaces are safely removed. Any workspace containing historical business records (credits, sales, purchases, deliveries) will be <strong>reassigned to you (Super Admin)</strong> to preserve accounting auditability.
              </li>
            </ul>
          </div>

          {/* Confirmation Input Guard */}
          <div className="space-y-2 pt-1">
            <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Type <span className="font-mono text-rose-600 select-all font-bold lowercase">{user.email}</span> to confirm:
            </Label>
            <Input
              type="text"
              required
              placeholder={user.email}
              value={typedEmail}
              onChange={(e) => setTypedEmail(e.target.value)}
              disabled={isDeleting}
              className="rounded-xl text-sm font-mono border-rose-200 focus:border-rose-500 focus:ring-rose-500"
              autoComplete="off"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={onClose}
              className="rounded-xl text-xs font-semibold h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isMatch || isDeleting}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold h-9 px-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Deleting Account...
                </>
              ) : (
                "Permanently Delete Account"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

