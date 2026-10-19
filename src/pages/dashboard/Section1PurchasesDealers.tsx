import React from "react"
import { ShoppingCart, ArrowUpRight, ShieldCheck, ExternalLink } from "lucide-react"
import { Link } from "react-router-dom"
import type { PurchasesSectionData, MonthlyFinancialTrend } from "@/services/dashboard"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CurrencyDisplay } from "@/components/shared"
import { formatMoney } from "@/lib/utils"

interface Section1PurchasesDealersProps {
  data: PurchasesSectionData
  monthlyTrends?: MonthlyFinancialTrend[]
}

export const Section1PurchasesDealers: React.FC<Section1PurchasesDealersProps> = ({ data, monthlyTrends }) => {
  const topPayables = data.topPayables || []
  const hasTrends = Boolean(monthlyTrends && monthlyTrends.length > 0)
  const recentPurchases = hasTrends
    ? monthlyTrends!.slice(-6).map(t => t.purchases)
    : []
  const maxPurchase = Math.max(...recentPurchases, 1)

  return (
    <div className="dashboard-domain-card bg-white border border-[#D9E0E8] rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between transition-all hover:border-slate-300">
      {/* Section Header */}
      <div className="px-4 py-3 border-b border-[#D9E0E8] bg-[#F8F7F2]/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#EBF2FE] border border-blue-200 flex items-center justify-center text-[#2563EB] shrink-0">
            <ShoppingCart className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-[#172B4D] leading-tight">
              Total Purchases & Dealer Payments
            </h2>
            <p className="text-[10px] text-[#52627A] leading-tight mt-0.5">
              Supplier commitments & traceable payables
            </p>
          </div>
        </div>
        <Link
          to="/dealers"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors shrink-0"
        >
          <span>Ledgers</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      <div className="p-4 space-y-3.5 flex-1 flex flex-col justify-between">
        {/* 3 Core Metric Figures */}
        <div className="grid grid-cols-2 gap-2">
          {/* Metric 1: Total Purchases with Mini Bar Histogram */}
          <div className="p-3 rounded-xl border border-[#D9E0E8] bg-[#F8F7F2] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-[#66758A] uppercase tracking-wider block leading-tight">
                Total Purchases
              </span>
              <div className="text-base sm:text-lg lg:text-xl font-black font-mono text-[#172B4D] mt-0.5 break-words">
                {formatMoney(data.total)}
              </div>
              <p className="text-[10px] text-[#66758A] mt-0.5 leading-tight">
                Gross inventory sourced in period
              </p>
            </div>
            {/* Mini bar histogram */}
            {hasTrends && recentPurchases.length > 0 && (
              <div className="flex items-end gap-1 h-8 shrink-0 pr-1">
                {recentPurchases.map((val, idx) => {
                  const heightPct = Math.max(15, Math.round((val / maxPurchase) * 100))
                  return (
                    <div
                      key={idx}
                      className="w-1.5 rounded-full bg-gradient-to-t from-[#2563EB] to-sky-400 transition-all"
                      style={{ height: `${heightPct}%` }}
                      title={`Purchases: ${formatMoney(val)}`}
                    />
                  )
                })}
              </div>
            )}
          </div>

          {/* Metric 2: Total Paid to Dealers */}
          <div className="p-3 rounded-xl border border-emerald-200 bg-[#EAF7EF]">
            <span className="text-[10px] font-bold text-[#087443] uppercase tracking-wider block leading-tight">
              Total Paid to Dealers
            </span>
            <div className="text-base sm:text-lg lg:text-xl font-black font-mono text-[#087443] mt-0.5 break-words">
              {formatMoney(data.totalPaidToDealers ?? data.paid ?? 0)}
            </div>
            <p className="text-[10px] text-[#087443]/80 mt-0.5 leading-tight">
              Cash settlements paid to suppliers
            </p>
          </div>

          {/* Metric 3: Outstanding Amount We Owe Dealers */}
          <div className="p-3 rounded-xl border border-amber-200 bg-[#FFF4D6] col-span-2">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <span className="text-[10px] font-bold text-[#92400E] uppercase tracking-wider block leading-tight">
                Outstanding Amount We Owe Dealers
              </span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-[#92400E] border border-amber-300 shrink-0">
                {(data.totalPayable ?? data.outstanding ?? 0) > 0 ? "Unsettled" : "Settled"}
              </span>
            </div>
            <div className="text-base sm:text-lg lg:text-xl font-black font-mono text-[#92400E] mt-0.5 break-words">
              {formatMoney(data.totalPayable ?? data.outstanding ?? 0)}
            </div>
            <p className="text-[10px] text-[#92400E]/80 mt-0.5 leading-tight">
              Traceable net cumulative payables
            </p>
          </div>
        </div>

        {/* Compact Paid-vs-Outstanding Visual Bar */}
        {data.total > 0 && (
          <div className="p-3 rounded-xl border border-[#D9E0E8] bg-[#F8F7F2] space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="text-[#52627A]">
                Dealer Settlement Ratio (Paid vs Purchases)
              </span>
              <span className="text-[#087443] font-bold">
                {Math.min(100, Math.round(((data.totalPaidToDealers ?? data.paid ?? 0) / data.total) * 100))}% Settled
              </span>
            </div>
            <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden flex">
              <div
                className="bg-[#087443] h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.round(((data.totalPaidToDealers ?? data.paid ?? 0) / data.total) * 100))}%`
                }}
              />
            </div>
          </div>
        )}

        {/* Dealer-wise Purchase & Payment Breakdown */}
        {topPayables.length > 0 ? (
          <div className="pt-2 border-t border-[#D9E0E8] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-[#172B4D]">
                <span>Dealer Payables Breakdown ({topPayables.length})</span>
                <span className="text-slate-400">:</span>
              </div>
              <Link
                to="/dealers"
                className="text-[11px] font-semibold text-[#2563EB] hover:underline inline-flex items-center gap-1"
              >
                <span>View Full Dealer Ledgers</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            {/* Compact Responsive Table */}
            <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white">
              <Table className="w-full min-w-[420px] text-left text-xs border-collapse">
                <TableHeader>
                  <TableRow className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <TableHead className="py-2.5 px-3 text-[10px] uppercase font-bold text-[#64748B] tracking-wider">Dealer</TableHead>
                    <TableHead className="py-2.5 px-3 text-right text-[10px] uppercase font-bold text-[#0F172A] tracking-wider">Purchases</TableHead>
                    <TableHead className="py-2.5 px-3 text-right text-[10px] uppercase font-bold text-[#0F172A] tracking-wider">Payments</TableHead>
                    <TableHead className="py-2.5 px-3 text-right text-[10px] uppercase font-bold text-[#64748B] tracking-wider">Opening Bal</TableHead>
                    <TableHead className="py-2.5 px-3 text-right text-[10px] uppercase font-bold text-[#0F172A] tracking-wider">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-[#E2E8F0]">
                  {topPayables.slice(0, 5).map((dealer) => (
                    <TableRow key={dealer.id} className="hover:bg-[#EEF4FF] border-b border-[#E2E8F0] transition-colors">
                      <TableCell className="py-2.5 px-3 font-semibold text-[#0F172A] max-w-[130px] truncate" title={dealer.name}>
                        <Link to="/dealers" className="hover:text-[#2563EB] transition-colors">
                          {dealer.name}
                        </Link>
                      </TableCell>
                      <TableCell className="py-2.5 px-3 text-right font-medium">
                        <CurrencyDisplay amount={dealer.purchases ?? 0} />
                      </TableCell>
                      <TableCell className="py-2.5 px-3 text-right font-medium">
                        <CurrencyDisplay amount={dealer.paid ?? 0} variant="positive" />
                      </TableCell>
                      <TableCell className="py-2.5 px-3 text-right text-[#64748B]">
                        <CurrencyDisplay amount={dealer.openingBalance ?? 0} />
                      </TableCell>
                      <TableCell className="py-2.5 px-3 text-right">
                        <CurrencyDisplay amount={dealer.outstanding} variant="warning" className="font-bold" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="py-2.5 px-3 rounded-xl bg-[#EAF7EF] border border-emerald-200 text-[#087443] text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-[#087443]" />
            <span>All dealer accounts are fully settled. Zero outstanding payables owed to suppliers.</span>
          </div>
        )}

        {/* Subtle Accounting Rule Info */}
        <div className="text-[11px] text-[#52627A] flex items-center gap-1.5 pt-0.5">
          <ArrowUpRight className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
          <span>
            Purchases and payments remain distinct concepts. Cumulative dealer payables include previous opening balances without offsetting other suppliers.
          </span>
        </div>
      </div>
    </div>
  )
}
