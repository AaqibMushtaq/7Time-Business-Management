import type { ManagedUserAccount } from "@/types/auth"
import { ShieldCheck, Phone } from "lucide-react"

interface AccountListItemProps {
  user: ManagedUserAccount
  isSelected: boolean
  isCurrentUser: boolean
  onSelect: (user: ManagedUserAccount) => void
}

export function AccountListItem({
  user,
  isSelected,
  isCurrentUser,
  onSelect,
}: AccountListItemProps) {
  const isSuperAdmin = user.system_role === "SUPER_ADMIN"
  const enabledCount = user.entitlements.filter((e) => e.is_enabled).length
  const initial = (user.full_name || user.email || "U").charAt(0).toUpperCase()

  return (
    <button
      type="button"
      onClick={() => onSelect(user)}
      className={`w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 relative focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
        isSelected
          ? "bg-blue-50/70 border-blue-400 shadow-xs ring-1 ring-blue-300"
          : "bg-white border-slate-200/90 hover:bg-slate-50/80 hover:border-slate-300"
      }`}
    >
      {/* Active Selection Indicator Bar */}
      {isSelected && (
        <span className="absolute left-0 top-3 bottom-3 w-1 bg-blue-600 rounded-r-full" />
      )}

      {/* Avatar Circle */}
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border mt-0.5 ${
          isSuperAdmin
            ? "bg-purple-100 text-purple-700 border-purple-200"
            : "bg-blue-50 text-blue-700 border-blue-200"
        }`}
      >
        {initial}
      </div>

      {/* Account Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="font-bold text-slate-900 text-sm truncate flex items-center gap-1.5">
            {user.full_name || user.email}
            {isCurrentUser && (
              <span className="text-[10px] font-semibold text-blue-600 bg-blue-100/70 px-1.5 py-0.2 rounded">
                You
              </span>
            )}
          </span>

          {/* Status Dot Pill */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
              user.is_active
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-rose-50 text-rose-700 border border-rose-200"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                user.is_active ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
            {user.is_active ? "Active" : "Suspended"}
          </span>
        </div>

        <div className="text-xs text-slate-500 truncate font-mono">
          {user.email}
        </div>

        {user.phone && (
          <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1 truncate">
            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
            <span>{user.phone}</span>
          </div>
        )}

        {/* Footer badges */}
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100/80">
          {isSuperAdmin ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
              <ShieldCheck className="w-3 h-3" />
              Super Admin
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              {enabledCount} of 12 Modules
            </span>
          )}

          {user.workspaces && user.workspaces.length > 0 && (
            <span className="text-[10px] font-medium text-slate-500">
              • {user.workspaces.length} Workspace{user.workspaces.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

