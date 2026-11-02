import type { ManagedUserAccount } from "@/types/auth"
import { Users, UserCheck, UserX, Layers } from "lucide-react"

interface AccountSummaryCardsProps {
  users: ManagedUserAccount[]
  isLoading: boolean
}

export function AccountSummaryCards({ users, isLoading }: AccountSummaryCardsProps) {
  const totalAccounts = users.length
  const activeAccounts = users.filter((u) => u.is_active).length
  const suspendedAccounts = users.filter((u) => !u.is_active).length

  // Calculate distinct workspaces
  const workspaceIds = new Set<string>()
  for (const u of users) {
    for (const w of u.workspaces || []) {
      workspaceIds.add(w.id)
    }
  }
  const totalWorkspaces = workspaceIds.size

  const cards = [
    {
      title: "Total Accounts",
      value: totalAccounts,
      icon: Users,
      badge: "User Directory",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200/80",
    },
    {
      title: "Active Accounts",
      value: activeAccounts,
      icon: UserCheck,
      badge: "Access Granted",
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200/80",
    },
    {
      title: "Suspended Accounts",
      value: suspendedAccounts,
      icon: UserX,
      badge: "Access Blocked",
      color: "text-rose-600",
      bgColor: "bg-rose-50",
      borderColor: "border-rose-200/80",
    },
    {
      title: "Total Workspaces",
      value: totalWorkspaces,
      icon: Layers,
      badge: "Tenant Scopes",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200/80",
    },
  ]

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs animate-pulse space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-slate-200" />
              <div className="w-16 h-4 rounded-full bg-slate-100" />
            </div>
            <div className="space-y-1.5">
              <div className="w-12 h-6 bg-slate-200 rounded-md" />
              <div className="w-24 h-3.5 bg-slate-100 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.title}
            className={`p-4 sm:p-5 rounded-2xl bg-white border transition-all shadow-2xs hover:shadow-xs ${card.borderColor}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-bold ${card.bgColor} ${card.color}`}
              >
                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                {card.badge}
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {card.value}
              </div>
              <div className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
                {card.title}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

