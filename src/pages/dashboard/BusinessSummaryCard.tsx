import { memo } from "react"
import { Link } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import type { BusinessSummaryCardModel, MetricVariant } from "./types"
import { formatMoney } from "@/lib/utils"

interface BusinessSummaryCardProps {
  card: BusinessSummaryCardModel
}

function getVariantColor(variant?: MetricVariant): string {
  switch (variant) {
    case "positive":
      return "text-emerald-700"
    case "warning":
      return "text-amber-700"
    case "danger":
      return "text-rose-700"
    case "muted":
      return "text-sky-700"
    case "neutral":
    default:
      return "text-slate-800"
  }
}

export const BusinessSummaryCard = memo(function BusinessSummaryCard({
  card,
}: BusinessSummaryCardProps) {
    const Icon = card.icon
    const BadgeIcon = card.badge?.icon

    return (
      <section
        id={card.id}
        aria-label={card.ariaLabel}
        className="bg-white rounded-xl border border-slate-200/80 p-3 sm:p-3.5 shadow-card hover:shadow-card-hover transition-all duration-200 flex flex-col justify-between group min-w-0"
      >
        <div>
          {/* Card Header: Icon, Title, Optional Badge, and View Details Link */}
          <div className="flex items-center justify-between gap-1 mb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <div
                className={`w-6 h-6 rounded-lg ${card.iconBg} ${card.iconBorder} border flex items-center justify-center ${card.iconColor} shrink-0 shadow-2xs`}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-center gap-1 min-w-0">
                <h3 className="text-xs font-bold text-slate-800 tracking-tight truncate">
                  {card.title}
                </h3>
                {card.badge && (
                  <span className="hidden sm:inline-flex items-center gap-0.5 text-[8px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-1 py-0.2 rounded border border-purple-200/80 shrink-0">
                    {BadgeIcon && <BadgeIcon className="w-2 h-2 text-purple-700" />}
                    {card.badge.text}
                  </span>
                )}
              </div>
            </div>

            <Link
              to={card.href}
              className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-0.5 shrink-0 transition-colors"
              title={card.viewDetailsTitle}
            >
              <span>View details</span>
              <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </Link>
          </div>

          {/* Primary Metric Amount */}
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block leading-tight">
              {card.primaryLabel}
            </span>
            <div
              title={formatMoney(card.primaryAmount)}
              className="text-base sm:text-lg lg:text-xl font-bold font-mono tracking-tight text-slate-900 mt-0.5 tabular-nums truncate"
            >
              {formatMoney(card.primaryAmount)}
            </div>
          </div>
        </div>

        {/* Secondary Financial Figures */}
        <div className="space-y-1 pt-2 mt-2.5 border-t border-slate-100 text-[10px]">
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            {card.secondaryFigures.map((sec, idx) => {
              const displayVal = sec.amount !== undefined ? formatMoney(sec.amount) : (sec.text ?? "")
              const textColor = getVariantColor(sec.variant)

              return (
                <div key={idx} className={`min-w-0 ${sec.colSpan === 2 ? "col-span-2" : ""}`}>
                  <span className="text-[9px] font-medium text-slate-500 block truncate">
                    {sec.label}
                  </span>
                  <div
                    title={displayVal}
                    className={`font-semibold font-mono truncate tabular-nums ${textColor}`}
                  >
                    {displayVal}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Optional Footer Metric (e.g. Net Contribution, Supplier Payables) */}
          {card.footerFigure && (
            <div className="flex items-center justify-between border-t border-slate-50 pt-0.5 min-w-0">
              <span className="text-[9px] font-medium text-slate-500 truncate">
                {card.footerFigure.label}
              </span>
              <span
                title={
                  card.footerFigure.amount !== undefined
                    ? formatMoney(card.footerFigure.amount)
                    : (card.footerFigure.text ?? "")
                }
                className={`font-bold font-mono text-[10px] truncate tabular-nums ${getVariantColor(
                  card.footerFigure.variant
                )}`}
              >
                {card.footerFigure.amount !== undefined
                  ? formatMoney(card.footerFigure.amount)
                  : card.footerFigure.text}
              </span>
            </div>
          )}
        </div>
      </section>
    )
  }
)
