import { memo } from "react"
import { Link } from "react-router-dom"
import type { LucideIcon } from "lucide-react"

export interface ExecutiveKpiItem {
  id: string
  label: string
  value: string
  subtitle: string
  scope: string
  icon: LucideIcon
  iconColor: string
  iconBg: string
  accent: string
  href: string
  valueColor?: string
}

interface ExecutiveKpiGridProps {
  kpis: ExecutiveKpiItem[]
  scopeLabel: string
}

export const ExecutiveKpiGrid = memo(function ExecutiveKpiGrid({
  kpis,
  scopeLabel,
}: ExecutiveKpiGridProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
          Executive Key Metrics
        </h2>
        <span className="text-[11px] text-slate-500 font-medium">
          Scope: <span className="text-[#0E2A47] font-bold">{scopeLabel}</span>
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {kpis.map((kpi) => (
          <Link
            key={kpi.id}
            to={kpi.href}
            className={`bg-white rounded-xl border border-[#E5E7EB] p-3 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between ${kpi.accent} group`}
          >
            <div>
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <div className={`w-7 h-7 rounded-lg ${kpi.iconBg} flex items-center justify-center shrink-0`}>
                  <kpi.icon className={`w-3.5 h-3.5 ${kpi.iconColor}`} />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">
                  {kpi.scope}
                </span>
              </div>

              <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block truncate">
                {kpi.label}
              </span>

              <div
                className={`text-base sm:text-lg lg:text-xl font-extrabold tracking-tight mt-0.5 truncate ${
                  kpi.valueColor || "text-[#0E2A47]"
                }`}
              >
                {kpi.value}
              </div>
            </div>

            <p className="text-[10px] text-slate-400 mt-2 pt-1.5 border-t border-slate-100 truncate font-medium">
              {kpi.subtitle}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
})
