import { useState } from "react"
import type { ManagedUserAccount } from "@/types/auth"
import { Briefcase, User, Copy, Check, Layers } from "lucide-react"

interface AccountWorkspacesTabProps {
  user: ManagedUserAccount
}

export function AccountWorkspacesTab({ user }: AccountWorkspacesTabProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const workspaces = user.workspaces || []

  if (workspaces.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-50/50 rounded-xl border border-slate-200 space-y-2">
        <Layers className="w-8 h-8 text-slate-300 mx-auto" />
        <h3 className="text-xs font-bold text-slate-700">No Workspaces Found</h3>
        <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
          This user does not currently own or belong to any tenant workspaces.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Authorized Workspaces ({workspaces.length})
        </span>
        <span className="text-[11px] text-slate-500 font-medium">
          Tenant database partitions accessible by this user
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {workspaces.map((ws: any) => {
          const isBusiness = ws.workspace_type === "BUSINESS"
          const isOwner = ws.role === "OWNER" || !ws.role
          const isCopied = copiedId === ws.id

          return (
            <div
              key={ws.id}
              className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 border ${
                      isBusiness
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}
                  >
                    {isBusiness ? (
                      <Briefcase className="w-4 h-4" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 truncate">
                      {ws.name}
                    </h4>
                    <span className="text-[10px] text-slate-500 font-medium capitalize">
                      {ws.workspace_type?.toLowerCase()} Workspace
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${
                      isOwner
                        ? "bg-purple-50 text-purple-700 border border-purple-200"
                        : "bg-slate-100 text-slate-600 border border-slate-200"
                    }`}
                  >
                    {isOwner ? "Owner" : ws.role || "Member"}
                  </span>
                </div>
              </div>

              {/* Workspace ID & Copy */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span className="font-mono text-[10px] truncate max-w-[200px]" title={ws.id}>
                  {ws.id}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(ws.id)}
                  className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                  title="Copy Workspace ID"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy ID</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

