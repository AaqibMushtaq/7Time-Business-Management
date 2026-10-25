import { memo } from "react"
import { Link, useNavigate } from "react-router-dom"
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
  const navigate = useNavigate()
  const Icon = card.icon
  const BadgeIcon = card.badge?.icon

  // Card surface click handler
  const handleCardClick = (e: React.MouseEvent<HTMLElement>) => {
    // If the click originated from an inner link or button, avoid duplicate navigation
    if ((e.target as HTMLElement).closest("a, button")) {
      return
    }
    navigate(card.href)
  }

  // Keyboard accessibility handler for Enter and Space keys
  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    // If the key event originated on an inner link or button, let that element handle its own event
    if ((e.target as HTMLElement).closest("a, button") && e.target !== e.currentTarget) {
      return
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      navigate(card.href)
    }
  }

  return (
    <section
      id={card.id}
      role="region"
      aria-label={card.ariaLabel}
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-card hover:shadow-card-hover hover:border-blue-200/90 transition-all duration-200 flex flex-col justify-between group min-w-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-hidden motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.99]"
    >
      <div>
        {/* Card Header: Icon, Title, Optional Badge, and View Details Link */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-xl ${card.iconBg} ${card.iconBorder} border flex items-center justify-center ${card.iconColor} shrink-0 shadow-2xs group-hover:scale-105 transition-transform duration-200`}
            >
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="text-sm font-bold text-slate-800 group-hover:text-blue-600 tracking-tight truncate transition-colors">
                {card.title}
              </h3>
              {card.badge && (
                <span className="hidden sm:inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-md border border-purple-200/80 shrink-0">
                  {BadgeIcon && <BadgeIcon className="w-2.5 h-2.5 text-purple-700" />}
                  {card.badge.text}
                </span>
              )}
            </div>
          </div>

          <Link
            to={card.href}
            onClick={(e) => {
              // Prevent event bubbling so the card container click handler does not fire twice
              e.stopPropagation()
            }}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1 shrink-0 transition-colors py-1 px-1.5 -mr-1 rounded-lg hover:bg-blue-50/70 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-hidden"
            title={card.viewDetailsTitle}
            aria-label={`View details for ${card.title}`}
          >
            <span>View details</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all duration-150" />
          </Link>
        </div>

        {/* Primary Metric Amount */}
        <div className="mt-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block leading-tight">
            {card.primaryLabel}
          </span>
          <div
            title={formatMoney(card.primaryAmount)}
            className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900 mt-1 tabular-nums truncate"
          >
            {formatMoney(card.primaryAmount)}
          </div>
        </div>
      </div>

      {/* Secondary Financial Figures */}
      <div className="space-y-2 pt-3 mt-3 border-t border-slate-100 text-xs">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {card.secondaryFigures.map((sec, idx) => {
            const displayVal = sec.amount !== undefined ? formatMoney(sec.amount) : (sec.text ?? "")
            const textColor = getVariantColor(sec.variant)

            return (
              <div key={idx} className={`min-w-0 ${sec.colSpan === 2 ? "col-span-2" : ""}`}>
                <span className="text-[11px] font-medium text-slate-500 block truncate">
                  {sec.label}
                </span>
                <div
                  title={displayVal}
                  className={`font-semibold font-mono truncate tabular-nums text-xs sm:text-sm ${textColor}`}
                >
                  {displayVal}
                </div>
              </div>
            )
          })}
        </div>

        {/* Optional Footer Metric (e.g. Net Contribution) */}
        {card.footerFigure && (
          <div className="flex items-center justify-between border-t border-slate-50 pt-1.5 mt-1 min-w-0">
            <span className="text-[11px] font-medium text-slate-500 truncate">
              {card.footerFigure.label}
            </span>
            <span
              title={
                card.footerFigure.amount !== undefined
                  ? formatMoney(card.footerFigure.amount)
                  : (card.footerFigure.text ?? "")
              }
              className={`font-bold font-mono text-xs sm:text-sm truncate tabular-nums ${getVariantColor(
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
})
