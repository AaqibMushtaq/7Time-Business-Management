import type { ManagedUserAccount } from "@/types/auth"
import { Button } from "@/components/ui/button"
import { UserX, UserCheck, Loader2, X, ShieldAlert, ShieldCheck } from "lucide-react"

interface AccountSuspendDialogProps {
  isOpen: boolean
  onClose: () => void
  user: ManagedUserAccount | null
  onConfirm: (userId: string, targetStatus: "ACTIVE" | "SUSPENDED") => Promise<void>
  isSaving: boolean
}

export function AccountSuspendDialog({
  isOpen,
  onClose,
  user,
  onConfirm,
  isSaving,
}: AccountSuspendDialogProps) {
  if (!isOpen || !user) return null

  // Authoritative check: user is active if is_active is true (or fallback status === 'ACTIVE')
  const isCurrentlyActive = Boolean(user.is_active ?? (user as any).status === "ACTIVE")
  const targetStatus = isCurrentlyActive ? "SUSPENDED" : "ACTIVE"

  const handleAction = async () => {
    await onConfirm(user.id, targetStatus)
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="suspend-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header Banner */}
        <div
          className={`p-6 border-b ${
            isCurrentlyActive
              ? "bg-amber-50 border-amber-200 text-amber-900"
              : "bg-emerald-50 border-emerald-200 text-emerald-900"
          } flex items-start gap-4`}
        >
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
              isCurrentlyActive
                ? "bg-amber-100 text-amber-800 border-amber-300"
                : "bg-emerald-100 text-emerald-800 border-emerald-300"
            }`}
          >
            {isCurrentlyActive ? (
              <ShieldAlert className="w-6 h-6" />
            ) : (
              <ShieldCheck className="w-6 h-6" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2
              id="suspend-dialog-title"
              className="text-lg font-bold text-slate-900"
            >
              {isCurrentlyActive ? "Suspend User Account" : "Reactivate User Account"}
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              {isCurrentlyActive
                ? "Temporarily revoke application access"
                : "Restore application access and permissions"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-md cursor-pointer disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center shrink-0 text-sm">
              {user.full_name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 truncate">
                {user.full_name || "Unnamed Account"}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {user.email}
              </p>
            </div>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                isCurrentlyActive
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              Currently {isCurrentlyActive ? "Active" : "Suspended"}
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-600">
            {isCurrentlyActive ? (
              <>
                <p className="font-bold text-slate-900">
                  When you suspend this account:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-1 text-slate-600 leading-relaxed">
                  <li>The user will be immediately signed out and unable to log in.</li>
                  <li>All assigned module entitlements and workspace memberships will remain preserved.</li>
                  <li>No business data, transactions, or audit logs will be affected.</li>
                  <li>You can reactivate this user at any time with full access restoration.</li>
                </ul>
              </>
            ) : (
              <>
                <p className="font-bold text-slate-900">
                  When you reactivate this account:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-1 text-slate-600 leading-relaxed">
                  <li>The user will be able to sign in immediately with their existing credentials.</li>
                  <li>Their previously configured module permissions will become effective again.</li>
                  <li>Workspace access and collaborator roles will be restored.</li>
                </ul>
              </>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
            className="text-xs font-semibold bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleAction}
            disabled={isSaving}
            className={`text-xs font-bold gap-1.5 ${
              isCurrentlyActive
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {isCurrentlyActive ? "Suspending..." : "Reactivating..."}
              </>
            ) : isCurrentlyActive ? (
              <>
                <UserX className="w-3.5 h-3.5" />
                Suspend Account
              </>
            ) : (
              <>
                <UserCheck className="w-3.5 h-3.5" />
                Reactivate Account
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
