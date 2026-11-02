import { useState, useMemo } from "react"
import type { ManagedUserAccount, ModuleKey } from "@/types/auth"
import {
  Users,
  Coins,
  Package,
  ShoppingCart,
  Wallet,
  Truck,
  FileText,
  Sparkles,
  Calculator,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
} from "lucide-react"

interface ModuleMeta {
  id: ModuleKey
  name: string
  category: "PERSONAL" | "BUSINESS" | "OTHER"
  description: string
  icon: any
}

export const MODULE_CATALOG: ModuleMeta[] = [
  {
    id: "personal_ledger",
    name: "Personal Ledger",
    category: "PERSONAL",
    description: "Personal debts, cash loans & repayments with contact ledger.",
    icon: Users,
  },
  {
    id: "zakat_tracker",
    name: "Zakat Tracker",
    category: "PERSONAL",
    description: "Hanafi wealth calculation & live metal benchmark tracking.",
    icon: Coins,
  },
  {
    id: "dealers",
    name: "Dealers & Suppliers",
    category: "BUSINESS",
    description: "Supplier directory & outstanding balance tracking.",
    icon: Users,
  },
  {
    id: "products",
    name: "Product Catalog",
    category: "BUSINESS",
    description: "Product catalog, buying rates & pricing defaults.",
    icon: Package,
  },
  {
    id: "price_calculator",
    name: "Price Calculator",
    category: "BUSINESS",
    description: "Wholesale & retail pricing and margin calculations.",
    icon: Calculator,
  },
  {
    id: "purchases",
    name: "Purchases Ledger",
    category: "BUSINESS",
    description: "Procurement records, bills & inward supplier stock.",
    icon: ShoppingCart,
  },
  {
    id: "dealer_payments",
    name: "Dealer Payments",
    category: "BUSINESS",
    description: "Direct settlements and recorded supplier payments.",
    icon: Wallet,
  },
  {
    id: "inventory",
    name: "Inventory Valuation",
    category: "BUSINESS",
    description: "Current inventory counts & valuation metrics.",
    icon: Package,
  },
  {
    id: "wholesale_sales",
    name: "Wholesale Sales",
    category: "BUSINESS",
    description: "Wholesale customer billing, invoices & settlements.",
    icon: ShoppingCart,
  },
  {
    id: "deliveries",
    name: "Deliveries",
    category: "BUSINESS",
    description: "General daily deliveries & dedicated contract driver ledgers.",
    icon: Truck,
  },
  {
    id: "reports",
    name: "Business Reports",
    category: "BUSINESS",
    description: "Consolidated operational CSV reports & financial summaries.",
    icon: FileText,
  },
  {
    id: "ai_assistant",
    name: "AI Assistant",
    category: "OTHER",
    description: "Conversational assistant for real-time inventory lookups.",
    icon: Sparkles,
  },
]

export interface AccountModuleGridProps {
  user: ManagedUserAccount
  onToggleModule: (moduleId: ModuleKey, currentEnabled: boolean) => void
  isPending: boolean
  pendingModuleId: ModuleKey | null
}

export function AccountModuleGrid({
  user,
  onToggleModule,
  isPending,
  pendingModuleId,
}: AccountModuleGridProps) {
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | "PERSONAL" | "BUSINESS" | "OTHER">("ALL")
  const isSuperAdmin = user.system_role === "SUPER_ADMIN"

  // Authoritative enabled modules set
  const enabledSet = useMemo(() => {
    return new Set(
      (user.entitlements || []).filter((e) => e.is_enabled).map((e) => e.module_id)
    )
  }, [user.entitlements])

  // Total enabled count across all 12 modules regardless of active category filter
  const totalEnabled = isSuperAdmin ? 12 : enabledSet.size

  const filteredModules = useMemo(() => {
    if (categoryFilter === "ALL") return MODULE_CATALOG
    return MODULE_CATALOG.filter((m) => m.category === categoryFilter)
  }, [categoryFilter])

  return (
    <div className="space-y-4">
      {/* Category Filter Pills & Authoritative Counter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["ALL", "PERSONAL", "BUSINESS", "OTHER"] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                categoryFilter === cat
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200/80"
              }`}
            >
              {cat === "ALL" && "All Modules (12)"}
              {cat === "PERSONAL" && "Personal (2)"}
              {cat === "BUSINESS" && "Business (9)"}
              {cat === "OTHER" && "Other (1)"}
            </button>
          ))}
        </div>

        <span className="text-xs font-bold text-slate-700">
          {isSuperAdmin ? (
            <span className="text-purple-700 font-extrabold flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" />
              All 12 Modules (Super Admin)
            </span>
          ) : (
            `${totalEnabled} of 12 Active`
          )}
        </span>
      </div>

      {/* Module Cards Grid: 3 cols on xl, 2 on md, 1 on sm */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {filteredModules.map((mod) => {
          const isEnabled = isSuperAdmin ? true : enabledSet.has(mod.id)
          const isThisPending = isPending && pendingModuleId === mod.id
          const Icon = mod.icon

          return (
            <div
              key={mod.id}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                isEnabled
                  ? "bg-blue-50/70 border-blue-300 ring-1 ring-blue-200/50 shadow-xs"
                  : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
              }`}
            >
              {/* Header: Icon, Title, Category Badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                      isEnabled
                        ? "bg-blue-100 text-blue-700 border-blue-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold leading-tight truncate text-slate-900">
                    {mod.name}
                  </span>
                </div>

                {/* Consistent Category Badge */}
                <span
                  className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded shrink-0 border ${
                    mod.category === "PERSONAL"
                      ? "bg-amber-100 text-amber-900 border-amber-300"
                      : mod.category === "BUSINESS"
                      ? "bg-blue-100 text-blue-900 border-blue-300"
                      : "bg-purple-100 text-purple-900 border-purple-300"
                  }`}
                >
                  {mod.category}
                </span>
              </div>

              {/* Description (Dark, Crisp and Readable) */}
              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                {mod.description}
              </p>

              {/* Footer: Status label & Toggle switch */}
              <div className="pt-2.5 flex items-center justify-between border-t border-slate-200/80 mt-1">
                <div className="flex items-center gap-1.5">
                  {isEnabled ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Enabled
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                      <XCircle className="w-3.5 h-3.5 text-slate-400" />
                      Disabled
                    </span>
                  )}
                </div>

                {isSuperAdmin ? (
                  <span className="text-[10px] text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    Permanent
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={isPending || !user.is_active}
                    onClick={() => onToggleModule(mod.id, isEnabled)}
                    aria-label={`Toggle access for ${mod.name}`}
                    className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                      isEnabled ? "bg-blue-600" : "bg-slate-300 hover:bg-slate-400"
                    }`}
                  >
                    {isThisPending ? (
                      <Loader2 className="w-3.5 h-3.5 text-white animate-spin absolute top-1 left-3" />
                    ) : (
                      <span
                        className={`w-4 h-4 rounded-full bg-white block transition-transform absolute top-0.75 left-0.75 shadow-xs ${
                          isEnabled ? "translate-x-4.5" : "translate-x-0"
                        }`}
                      />
                    )}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
