import React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { formatMoney } from "@/lib/utils"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Percent,
  Wallet,
  Truck,
  Building2,
  Users,
  ChevronRight,
  Info,
} from "lucide-react"
import { Link } from "react-router-dom"
import type { BusinessPerformanceInsights } from "@/services/dashboard"

interface BusinessPerformanceInsightsCardProps {
  insights: BusinessPerformanceInsights
  selectedPeriodLabel: string
}

export const BusinessPerformanceInsightsCard: React.FC<BusinessPerformanceInsightsCardProps> = ({
  insights,
  selectedPeriodLabel,
}) => {
  const {
    comparisonMonthLabel,
    salesMoM,
    grossProfitMoM,
    wholesaleMargin,
    cashCollectionRatio,
    supplierActivity,
    fleetContribution,
    topExposureDebtors,
  } = insights

  const renderTrendBadge = (trend: "UP" | "DOWN" | "FLAT", percentage: number | null) => {
    if (percentage === null) {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
          <Minus className="w-3 h-3" /> Baseline
        </span>
      )
    }

    if (trend === "UP") {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
          <TrendingUp className="w-3 h-3" /> +{percentage.toFixed(1)}%
        </span>
      )
    }

    if (trend === "DOWN") {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
          <TrendingDown className="w-3 h-3" /> {percentage.toFixed(1)}%
        </span>
      )
    }

    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
        <Minus className="w-3 h-3" /> 0.0%
      </span>
    )
  }

  const getMarginBadgeClass = (status: "HEALTHY" | "MODERATE" | "LOW" | "NO_SALES") => {
    switch (status) {
      case "HEALTHY":
        return "bg-emerald-100 text-emerald-800 border-emerald-200"
      case "MODERATE":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "LOW":
        return "bg-amber-100 text-amber-800 border-amber-200"
      default:
        return "bg-slate-100 text-slate-600 border-slate-200"
    }
  }

  return (
    <Card className="border-[#E5E7EB] shadow-xs overflow-hidden">
      <CardHeader className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-blue-50/40 via-white to-purple-50/30">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base sm:text-lg font-bold text-[#0E2A47] flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#2D7FF9]" /> Business Performance Insights
              </CardTitle>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100/70 text-[#2D7FF9] border border-blue-200/60">
                VERIFIED METRICS
              </span>
            </div>
            <CardDescription className="text-xs text-[#64748B] mt-0.5">
              Month-over-month trajectory, margin health, collection velocity, and working capital shifts
            </CardDescription>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-semibold text-slate-500 block">Active Scope</span>
            <span className="text-xs font-bold text-[#0E2A47]">{selectedPeriodLabel}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* TOP ROW: 3 KEY RATIOS & MOM VELOCITY TILES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* TILE 1: WHOLESALE SALES MOM */}
          <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 flex flex-col justify-between hover:border-blue-200 transition-colors">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  Wholesale Sales MoM
                </span>
                <span className="text-xs text-slate-400">vs {comparisonMonthLabel}</span>
              </div>
              {renderTrendBadge(salesMoM.trend, salesMoM.changePercentage)}
            </div>

            <div className="space-y-1">
              <div className="text-lg font-extrabold text-[#0E2A47]">
                {formatMoney(salesMoM.current)}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-200/60">
                <span>Prior: {formatMoney(salesMoM.previous)}</span>
                <span className={salesMoM.changeAmount >= 0 ? "text-emerald-700 font-semibold" : "text-rose-600 font-semibold"}>
                  {salesMoM.changeAmount >= 0 ? "+" : ""}{formatMoney(salesMoM.changeAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* TILE 2: WHOLESALE GROSS PROFIT MOM & MARGIN */}
          <div className="p-3.5 rounded-xl bg-purple-50/50 border border-purple-200/70 flex flex-col justify-between hover:border-purple-300 transition-colors">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-900 block">
                  Wholesale Gross Profit MoM
                </span>
                <span className="text-xs text-purple-700/70">vs {comparisonMonthLabel}</span>
              </div>
              {renderTrendBadge(grossProfitMoM.trend, grossProfitMoM.changePercentage)}
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-extrabold text-purple-950">
                  {formatMoney(grossProfitMoM.current)}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getMarginBadgeClass(wholesaleMargin.status)}`}>
                  {wholesaleMargin.marginPercentage.toFixed(1)}% margin
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-purple-900/80 pt-1 border-t border-purple-200/60">
                <span>Prior: {formatMoney(grossProfitMoM.previous)}</span>
                <span className={grossProfitMoM.changeAmount >= 0 ? "text-emerald-700 font-semibold" : "text-rose-600 font-semibold"}>
                  {grossProfitMoM.changeAmount >= 0 ? "+" : ""}{formatMoney(grossProfitMoM.changeAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* TILE 3: CASH COLLECTION EFFICIENCY */}
          <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200/70 flex flex-col justify-between hover:border-emerald-300 transition-colors sm:col-span-2 lg:col-span-1">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 block">
                  Cash Collected vs Wholesale Sales
                </span>
                <span className="text-xs text-emerald-700/70">Period collection velocity</span>
              </div>
              <div className="p-1 rounded bg-emerald-100 text-emerald-800">
                <Percent className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-extrabold text-emerald-950">
                  {cashCollectionRatio.ratioPercentage !== null
                    ? `${cashCollectionRatio.ratioPercentage.toFixed(1)}%`
                    : "No Sales"}
                </span>
                <span className="text-[11px] font-semibold text-emerald-800">
                  {cashCollectionRatio.label}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-emerald-900/80 pt-1 border-t border-emerald-200/60">
                <span>Collected: {formatMoney(cashCollectionRatio.totalCashCollected)}</span>
                <span>Sales: {formatMoney(cashCollectionRatio.totalSales)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM ROW: WORKING CAPITAL SHIFTS & FOLLOW-UP PRIORITY */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 pt-1">
          {/* SUPPLIER OBLIGATIONS & ACTIVITY */}
          <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs text-[#0E2A47]">
                <Building2 className="w-4 h-4 text-slate-600" />
                <span>Supplier Payables Activity</span>
              </div>
              <Link to="/dealers" className="text-[11px] font-semibold text-[#2D7FF9] hover:underline flex items-center">
                Dealers <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-500 block">Period Purchases</span>
                <span className="font-bold text-slate-800">{formatMoney(supplierActivity.purchases)}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-500 block">Payments Made</span>
                <span className="font-bold text-emerald-700">{formatMoney(supplierActivity.payments)}</span>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-slate-50/80 border border-slate-200/60 text-xs flex justify-between items-center">
              <span className="text-slate-600 text-[11px]">Period Obligation Shift:</span>
              <span className={`font-bold ${supplierActivity.netObligationChange > 0 ? "text-rose-600" : "text-emerald-700"}`}>
                {supplierActivity.netObligationChange > 0 ? "+" : ""}{formatMoney(supplierActivity.netObligationChange)}
              </span>
            </div>

            <div className="text-[11px] text-slate-500 flex justify-between">
              <span>Cumulative Outstanding:</span>
              <span className="font-bold text-slate-800">{formatMoney(supplierActivity.cumulativePayable)}</span>
            </div>
          </div>

          {/* FLEET EFFICIENCY (STRICTLY NET CONTRIBUTION AFTER FUEL) */}
          <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs text-[#0E2A47]">
                <Truck className="w-4 h-4 text-[#33C5F3]" />
                <span>General Delivery Fleet Activity</span>
              </div>
              <Link to="/general-deliveries" className="text-[11px] font-semibold text-[#2D7FF9] hover:underline flex items-center">
                Fleet <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-500 block">Gross Billing</span>
                <span className="font-bold text-slate-800">{formatMoney(fleetContribution.billed)}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-500 block">Fuel Burned</span>
                <span className="font-bold text-rose-600">{formatMoney(fleetContribution.fuel)}</span>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-sky-50/70 border border-sky-200/60 text-xs flex justify-between items-center">
              <span className="text-sky-900 text-[11px] font-semibold">Net Contribution After Fuel:</span>
              <span className="font-bold text-emerald-700">{formatMoney(fleetContribution.netContribution)}</span>
            </div>

            <div className="text-[11px] text-slate-500 flex justify-between">
              <span>Active Dispatch Days:</span>
              <span className="font-bold text-slate-800">{fleetContribution.activeDays} days</span>
            </div>
          </div>

          {/* RECEIVABLES REQUIRING FOLLOW-UP (LARGEST EXPOSURE BALANCES) */}
          <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs text-[#0E2A47]">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>Follow-up Priority (Largest Balances)</span>
              </div>
              <Link to="/resellers" className="text-[11px] font-semibold text-[#2D7FF9] hover:underline flex items-center">
                All Debtors <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {topExposureDebtors.length === 0 ? (
              <div className="h-28 flex flex-col items-center justify-center text-center p-3 rounded-lg bg-slate-50 border border-slate-100">
                <Wallet className="w-5 h-5 text-slate-300 mb-1" />
                <span className="text-xs font-semibold text-slate-600">No active receivables</span>
                <span className="text-[10px] text-slate-400">All trade credit accounts are fully cleared</span>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {topExposureDebtors.map((debtor) => (
                  <Link
                    key={debtor.id}
                    to={debtor.routePath}
                    className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors text-xs group"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-[#0E2A47] group-hover:text-[#2D7FF9] truncate">
                        {debtor.name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {debtor.sourceLabel}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-rose-600 block">
                        {formatMoney(debtor.amount)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <div className="text-[10px] text-slate-400 flex items-center gap-1 pt-1 border-t border-slate-100">
              <Info className="w-3 h-3 text-slate-400 shrink-0" />
              <span>Ranked strictly by cumulative balance. Due date terms apply per contract.</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
