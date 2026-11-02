import { useState } from "react"
import type { ManagedUserAccount, ModuleKey } from "@/types/auth"
import { AccountModuleGrid } from "./AccountModuleGrid"
import { AccountWorkspacesTab } from "./AccountWorkspacesTab"
import { Button } from "@/components/ui/button"
import {
  User,
  Shield,
  Mail,
  Phone,
  Edit2,
  KeyRound,
  Trash2,
  UserX,
  UserCheck,
  Copy,
  Check,
  Layers,
  FileText,
  Building2,
} from "lucide-react"

export interface AccountDetailPanelProps {
  user: ManagedUserAccount | null
  currentUserId?: string
  onEdit: (user: ManagedUserAccount) => void
  onDelete: (user: ManagedUserAccount) => void
  onResetPassword: (user: ManagedUserAccount) => void
  onToggleSuspend: (user: ManagedUserAccount) => void
  onToggleModule: (userId: string, moduleKey: ModuleKey, currentEnabled: boolean) => Promise<void>
  isTogglingModule: boolean
  pendingModuleId: ModuleKey | null
  activeTab: "modules" | "details" | "workspaces"
  onTabChange: (tab: "modules" | "details" | "workspaces") => void
}

export function AccountDetailPanel({
  user,
  currentUserId,
  onEdit,
  onDelete,
  onResetPassword,
  onToggleSuspend,
  onToggleModule,
  isTogglingModule,
  pendingModuleId,
  activeTab,
  onTabChange,
}: AccountDetailPanelProps) {
  const [copiedId, setCopiedId] = useState(false)

  if (!user) {
    return (
      <div className="h-full min-h-[480px] flex flex-col items-center justify-center p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
          <User className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-slate-800">
          No Account Selected
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed">
          Select an account from the directory on the left to inspect profile details, manage
          module entitlements, or configure administrative access.
        </p>
      </div>
    )
  }

  const isSuperAdmin = user.system_role === "SUPER_ADMIN"
  const isSelf = Boolean(currentUserId && user.id === currentUserId)
  const isSuspended = !user.is_active

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "Never"
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    } catch {
      return dateStr
    }
  }

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return "Never"
    try {
      return new Date(dateStr).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return dateStr
    }
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(user.id)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  // Authoritative active module count (consistent with AccountModuleGrid and AccountListItem)
  const activeModuleCount = isSuperAdmin
    ? 12
    : (user.entitlements || []).filter((e) => e.is_enabled).length

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
      {/* 1. Identity Header */}
      <div className="p-6 border-b border-slate-100 bg-white">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          {/* Avatar & Profile Information */}
          <div className="flex items-start gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center font-extrabold text-lg shrink-0 border ${
                isSuperAdmin
                  ? "bg-purple-100 text-purple-700 border-purple-200"
                  : isSuspended
                  ? "bg-slate-100 text-slate-400 border-slate-200"
                  : "bg-blue-50 text-blue-700 border-blue-200"
              }`}
            >
              {user.full_name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 truncate">
                  {user.full_name || "Unnamed Account"}
                </h2>

                {/* Role Pill */}
                {isSuperAdmin ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                    <Shield className="w-3.5 h-3.5 fill-current" />
                    Super Admin
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    Member
                  </span>
                )}

                {/* Status Pill */}
                {isSuspended ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Suspended
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </span>
                )}

                {isSelf && (
                  <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    You
                  </span>
                )}
              </div>

              {/* Email & Phone Contact Line */}
              <div className="mt-1.5 flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5 truncate">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {user.email}
                </span>

                {user.phone ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {user.phone}
                  </span>
                ) : (
                  <span className="text-slate-400 italic">No phone configured</span>
                )}
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onEdit(user)}
              className="text-xs font-semibold gap-1.5 h-8.5 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-blue-600"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit Account
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onResetPassword(user)}
              className="text-xs font-semibold gap-1.5 h-8.5 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-blue-600"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Password
            </Button>

            {/* Suspend / Reactivate */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onToggleSuspend(user)}
              disabled={isSelf || isSuperAdmin}
              title={
                isSelf
                  ? "Cannot suspend your own account"
                  : isSuperAdmin
                  ? "Super Admin accounts cannot be suspended"
                  : isSuspended
                  ? "Reactivate account"
                  : "Suspend account"
              }
              className={`text-xs font-semibold gap-1.5 h-8.5 ${
                isSuspended
                  ? "text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100"
                  : "text-amber-800 bg-amber-50 border-amber-300 hover:bg-amber-100"
              }`}
            >
              {isSuspended ? (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  Reactivate
                </>
              ) : (
                <>
                  <UserX className="w-3.5 h-3.5" />
                  Suspend
                </>
              )}
            </Button>

            {/* Delete Account */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onDelete(user)}
              disabled={isSelf || isSuperAdmin}
              title={
                isSelf
                  ? "Cannot delete your own account"
                  : isSuperAdmin
                  ? "Super Admin accounts cannot be deleted"
                  : "Permanently delete account"
              }
              className="text-xs font-semibold gap-1.5 h-8.5 text-rose-700 bg-rose-50 border-rose-300 hover:bg-rose-100"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </Button>
          </div>
        </div>

        {/* 2. Quick Stat Row */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Role
            </span>
            <p className="text-xs font-bold text-slate-900 mt-0.5 truncate">
              {isSuperAdmin ? "Super Administrator" : "Standard Member"}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Workspaces
            </span>
            <p className="text-xs font-bold text-slate-900 mt-0.5">
              {user.workspaces?.length || 0} Authorized
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Account Created
            </span>
            <p className="text-xs font-bold text-slate-900 mt-0.5">
              {formatDate(user.created_at)}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Last Login
            </span>
            <p className="text-xs font-bold text-slate-900 mt-0.5">
              {formatDate(user.last_sign_in_at)}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Tab Navigation */}
      <div className="px-6 border-b border-slate-200 flex items-center gap-1 bg-white">
        <button
          type="button"
          onClick={() => onTabChange("modules")}
          className={`py-3.5 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === "modules"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Module Access</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === "modules"
                ? "bg-blue-100 text-blue-800"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {isSuperAdmin ? "12/12" : `${activeModuleCount}/12`}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange("details")}
          className={`py-3.5 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === "details"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Account Details</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange("workspaces")}
          className={`py-3.5 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === "workspaces"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Workspaces</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === "workspaces"
                ? "bg-blue-100 text-blue-800"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {user.workspaces?.length || 0}
          </span>
        </button>
      </div>

      {/* 4. Tab Content Area */}
      <div className="p-6 flex-1 bg-white">
        {activeTab === "modules" && (
          <div className="space-y-4">
            <AccountModuleGrid
              user={user}
              onToggleModule={(moduleId, isEnabled) =>
                onToggleModule(user.id, moduleId, isEnabled)
              }
              isPending={isTogglingModule}
              pendingModuleId={pendingModuleId}
            />
          </div>
        )}

        {activeTab === "details" && (
          <div className="space-y-6 max-w-3xl">
            {/* Identity & System Credentials */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Identity & System Credentials
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500">Full Name</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {user.full_name || "(Not configured)"}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500">Email Address</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {user.email}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500">Phone Number</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {user.phone || "(Not configured)"}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500">Account Status</span>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 font-bold ${
                        isSuspended ? "text-rose-700" : "text-emerald-700"
                      }`}
                    >
                      {isSuspended ? "SUSPENDED" : "ACTIVE"}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500">Role Classification</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {user.system_role}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500">User ID (UUID)</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <code className="text-[11px] font-mono bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-800 truncate max-w-[200px]">
                      {user.id}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyId}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                      title="Copy User ID"
                    >
                      {copiedId ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Audit & Timestamps */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Security & Audit Trail
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500">Registered On</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {formatDateTime(user.created_at)}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500">Last Authentication</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {formatDateTime(user.last_sign_in_at)}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500">Workspace Authorization</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {user.workspaces?.length ? `${user.workspaces.length} Active Memberships` : "Default Personal Workspace"}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500">Total Active Entitlements</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {isSuperAdmin ? "12 / 12 (Super Admin Override)" : `${activeModuleCount} / 12 Modules Assigned`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "workspaces" && (
          <div className="space-y-4">
            <AccountWorkspacesTab user={user} />
          </div>
        )}
      </div>
    </div>
  )
}
