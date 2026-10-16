import { memo } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { formatMoney } from "@/lib/utils"
import { Scale, Users, Building2, ShieldCheck, ArrowRight } from "lucide-react"
import { Link } from "react-router-dom"
import type { OutstandingBalancesBreakdownData } from "@/services/dashboard"

interface OutstandingBalancesBreakdownCardProps {
  data: OutstandingBalancesBreakdownData
}

export const OutstandingBalancesBreakdownCard = memo(function OutstandingBalancesBreakdownCard({
  data,
}: OutstandingBalancesBreakdownCardProps) {
  const { receivables, payables, netWorkingPosition } = data

  const totalRec = receivables.total
  const wholesalePct = totalRec > 0 ? ((receivables.wholesale / totalRec) * 100).toFixed(1) : "0.0"
  const personalPct = totalRec > 0 ? ((receivables.personalLedger / totalRec) * 100).toFixed(1) : "0.0"
  const naeemPct = totalRec > 0 ? ((receivables.naeem / totalRec) * 100).toFixed(1) : "0.0"

  return (
    <Card className="border-[#E5E7EB] shadow-xs">
      <CardHeader className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm sm:text-base font-bold text-[#0E2A47] flex items-center gap-2">
              <Scale className="h-4 w-4 text-[#2D7FF9]" />
              Outstanding Balances & Exposure Breakdown
            </CardTitle>
            <CardDescription className="text-xs text-[#64748B] mt-0.5">
              Verified cumulative balance sheet claims across all customers, proprietors, routes, and suppliers
            </CardDescription>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200/60 rounded-lg self-start sm:self-auto">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Strict Non-Netting Enforced</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-5">
        {/* Two-Column Grid: Receivables Side vs Payables Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* RECEIVABLES (ASSETS: WHO OWES 7TIME) */}
          <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/20 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-100/70">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                    Total Receivables (They Owe Us)
                  </h3>
                  <span className="text-[10px] text-emerald-700">Cumulative uncollected claims across all sources</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-base sm:text-lg font-extrabold text-emerald-800">
                  {formatMoney(totalRec)}
                </span>
              </div>
            </div>

            {/* Segmented Proportion Bar */}
            {totalRec > 0 && (
              <div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-2xs">
                  <div
                    style={{ width: `${wholesalePct}%` }}
                    className="bg-[#4A39D6] transition-all"
                    title={`Wholesale Trade: ${wholesalePct}% (${formatMoney(receivables.wholesale)})`}
                  />
                  <div
                    style={{ width: `${personalPct}%` }}
                    className="bg-[#10B981] transition-all"
                    title={`Personal Ledger: ${personalPct}% (${formatMoney(receivables.personalLedger)})`}
                  />
                  <div
                    style={{ width: `${naeemPct}%` }}
                    className="bg-[#2D7FF9] transition-all"
                    title={`NAEEM Contract: ${naeemPct}% (${formatMoney(receivables.naeem)})`}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#4A39D6]" /> Wholesale ({wholesalePct}%)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#10B981]" /> Personal ({personalPct}%)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#2D7FF9]" /> NAEEM ({naeemPct}%)
                  </span>
                </div>
              </div>
            )}

            {/* Detailed Source Breakdown Cards */}
            <div className="space-y-2 text-xs">
              {/* Wholesale Trade */}
              <div className="p-2.5 rounded-lg bg-white border border-slate-200/70 flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#0E2A47] block">Wholesale Trade Receivables</span>
                  <span className="text-[10px] text-slate-400">Inventory dispatched on credit to resellers</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-[#4A39D6] block">{formatMoney(receivables.wholesale)}</span>
                  <span className="text-[10px] text-slate-500">{wholesalePct}% of total</span>
                </div>
              </div>

              {/* Personal Ledger */}
              <div className="p-2.5 rounded-lg bg-white border border-slate-200/70 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-[#0E2A47] block">Personal Ledger (Qard Hasan & Expense on Behalf)</span>
                    <span className="text-[10px] text-slate-400">Personal & proprietor credit segregated from wholesale</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-700 block">{formatMoney(receivables.personalLedger)}</span>
                    <span className="text-[10px] text-slate-500">{personalPct}% of total</span>
                  </div>
                </div>

                {/* Sub-attribution pills */}
                {receivables.personalLedger > 0 && (
                  <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-slate-100 text-[10px]">
                    <div className="bg-blue-50/70 rounded p-1 text-center">
                      <span className="text-slate-500 block">7TIME Funds:</span>
                      <span className="font-bold text-blue-900">{formatMoney(receivables.personalLedger7Time)}</span>
                    </div>
                    <div className="bg-emerald-50/70 rounded p-1 text-center">
                      <span className="text-slate-500 block">Personal Funds:</span>
                      <span className="font-bold text-emerald-900">{formatMoney(receivables.personalLedgerPersonal)}</span>
                    </div>
                    <div className="bg-slate-50 rounded p-1 text-center">
                      <span className="text-slate-500 block">Unallocated:</span>
                      <span className="font-bold text-slate-700">{formatMoney(receivables.personalLedgerUnallocated)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* NAEEM Contract */}
              <div className="p-2.5 rounded-lg bg-white border border-slate-200/70 flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#0E2A47] block">NAEEM Dedicated Route Contract</span>
                  <span className="text-[10px] text-slate-400">Dedicated freight contract balance due</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-[#2D7FF9] block">{formatMoney(receivables.naeem)}</span>
                  <span className="text-[10px] text-slate-500">{naeemPct}% of total</span>
                </div>
              </div>
            </div>
          </div>

          {/* PAYABLES (LIABILITIES: WHOM 7TIME OWES) */}
          <div className="p-4 rounded-xl border border-red-100 bg-red-50/20 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-red-100/70">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-md bg-red-100 flex items-center justify-center text-red-700 font-bold text-xs">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-red-950 uppercase tracking-wider">
                    Total Payables (We Owe Suppliers)
                  </h3>
                  <span className="text-[10px] text-red-700">Cumulative supplier obligations ({payables.dealersCount} creditors)</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-base sm:text-lg font-extrabold text-red-600">
                  {formatMoney(payables.total)}
                </span>
              </div>
            </div>

            {/* Top Creditor Suppliers with Proportion Progress Bars */}
            <div className="space-y-2 text-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Top Creditor Liabilities
              </span>

              {payables.topPayables.length > 0 ? (
                payables.topPayables.map((supplier) => (
                  <div key={supplier.id} className="p-2.5 rounded-lg bg-white border border-slate-200/70 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Link
                        to={`/dealers/${supplier.id}`}
                        className="font-bold text-[#0E2A47] hover:text-[#2D7FF9] transition-colors flex items-center gap-1"
                      >
                        {supplier.name} <ArrowRight className="w-3 h-3 text-slate-400" />
                      </Link>
                      <span className="font-bold text-red-600">
                        {formatMoney(supplier.amount)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${supplier.percentageOfTotal}%` }}
                          className="h-full bg-red-500 rounded-full transition-all"
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                        {supplier.percentageOfTotal}% of payables
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-slate-400 bg-white rounded-lg border border-slate-200/70">
                  <p className="font-semibold text-slate-600 text-xs">All supplier accounts settled</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Zero outstanding balances owed to suppliers.</p>
                </div>
              )}
            </div>

            {/* Net Working Ledger Summary */}
            <div className="p-3 rounded-lg bg-white border border-slate-200/80 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-[#0E2A47] block">Net Outstanding Position</span>
                <span className="text-[10px] text-slate-400">Total Receivables minus Total Payables</span>
              </div>
              <div className="text-right">
                <span className={`text-sm font-extrabold ${netWorkingPosition >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {formatMoney(netWorkingPosition)}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {netWorkingPosition >= 0 ? "Net Asset Surplus" : "Net Obligation Deficit"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Accounting Invariant Footer */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] text-slate-400 gap-1">
          <span>* All receivables and payables are cumulative balance sheet positions. Customer credits and supplier advances are never cross-netted.</span>
          <span className="font-semibold text-slate-500">Totals reconcile with Executive KPI Cards</span>
        </div>
      </CardContent>
    </Card>
  )
})
