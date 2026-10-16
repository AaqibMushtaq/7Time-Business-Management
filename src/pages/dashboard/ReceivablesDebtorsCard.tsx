import { memo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { formatMoney } from "@/lib/utils"
import { Users, PlusCircle, CheckCircle2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import type { UnifiedDebtor } from "@/services/receivables"

interface ReceivablesSummaryData {
  totalOutstanding: number
  wholesaleOutstanding: number
  personalLedgerOutstanding?: number
  naeemOutstanding: number
  otherOutstanding: number
  debtorsCount: number
  debtors: UnifiedDebtor[]
}

interface ReceivablesDebtorsCardProps {
  totalReceivables: number
  receivablesSummary: ReceivablesSummaryData
  topReceivablesDebtors: UnifiedDebtor[]
  onOpenPaymentModal: (debtor: UnifiedDebtor | null) => void
}

export const ReceivablesDebtorsCard = memo(function ReceivablesDebtorsCard({
  totalReceivables,
  receivablesSummary,
  topReceivablesDebtors,
  onOpenPaymentModal,
}: ReceivablesDebtorsCardProps) {
  const navigate = useNavigate()

  const personalLedgerVal = receivablesSummary.personalLedgerOutstanding || 0
  const wholesaleVal = Math.max(0, receivablesSummary.wholesaleOutstanding - personalLedgerVal)

  return (
    <Card className="border-[#E5E7EB] shadow-xs">
      <CardHeader className="p-4 border-b border-slate-100 bg-emerald-50/40 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-emerald-950 flex items-center gap-1.5">
              <Users className="h-4 w-4 text-emerald-600" /> Outstanding Receivables
            </CardTitle>
            <CardDescription className="text-xs text-emerald-800">
              Total Due: <span className="font-bold">{formatMoney(totalReceivables)}</span>
              {receivablesSummary.debtorsCount > 0 && (
                <span className="ml-1.5 text-[11px] font-normal text-emerald-700">
                  across {receivablesSummary.debtorsCount} account{receivablesSummary.debtorsCount > 1 ? "s" : ""}
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenPaymentModal(topReceivablesDebtors[0] || null)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-2xs cursor-pointer"
              title="Receive payment from any debtor"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Receive Payment
            </button>
          </div>
        </div>

        {/* Source Breakdown Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-emerald-100/60 text-[11px]">
          <div className="bg-white/80 rounded-md p-1.5 border border-emerald-100">
            <span className="text-slate-500 block text-[10px] leading-tight truncate">Wholesale/Resellers</span>
            <span className="font-bold text-slate-800">{formatMoney(personalLedgerVal > 0 ? wholesaleVal : receivablesSummary.wholesaleOutstanding)}</span>
          </div>
          <div className="bg-white/80 rounded-md p-1.5 border border-emerald-100">
            <span className="text-slate-500 block text-[10px] leading-tight truncate">Personal Ledger</span>
            <span className="font-bold text-emerald-800">{formatMoney(personalLedgerVal)}</span>
          </div>
          <div className="bg-white/80 rounded-md p-1.5 border border-emerald-100">
            <span className="text-slate-500 block text-[10px] leading-tight truncate">NAEEM Dedicated</span>
            <span className="font-bold text-slate-800">{formatMoney(receivablesSummary.naeemOutstanding)}</span>
          </div>
          <div className="bg-white/80 rounded-md p-1.5 border border-emerald-100">
            <span className="text-slate-500 block text-[10px] leading-tight truncate">Other Receivables</span>
            <span className="font-bold text-slate-800">{formatMoney(receivablesSummary.otherOutstanding)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3">
        {topReceivablesDebtors.length > 0 ? (
          <div className="divide-y divide-slate-100 text-xs">
            {topReceivablesDebtors.map((debtor) => (
              <div
                key={debtor.id}
                className="py-2.5 px-2 -mx-1 rounded-lg hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3 group"
              >
                <div
                  onClick={() => navigate(debtor.routePath)}
                  className="cursor-pointer min-w-0 flex-1"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[#0E2A47] group-hover:text-[#2D7FF9] transition-colors truncate">
                      {debtor.name}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                        debtor.source === "NAEEM"
                          ? "bg-blue-100 text-blue-800"
                          : debtor.source === "PERSONAL_LEDGER"
                          ? "bg-emerald-100 text-emerald-800"
                          : debtor.source === "WHOLESALE_RESELLER"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-sky-100 text-sky-800"
                      }`}
                    >
                      {debtor.sourceLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                    {debtor.lastPaymentDate ? (
                      <span>Last paid: {debtor.lastPaymentDate}</span>
                    ) : (
                      <span>No payments recorded yet</span>
                    )}
                    <span>•</span>
                    <span className="text-[#2D7FF9] group-hover:underline">View Account</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-emerald-700 text-right">
                    {formatMoney(debtor.outstanding)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenPaymentModal(debtor)
                    }}
                    className="px-2 py-1 text-[11px] font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white transition-colors cursor-pointer"
                    title={`Receive payment from ${debtor.name}`}
                  >
                    Receive
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-1">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="font-semibold text-slate-700">All customer accounts are settled.</span>
            <span className="text-[11px] text-slate-400">
              Zero outstanding receivables currently pending across all modules.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
})
