import { memo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { formatMoney } from "@/lib/utils"
import { Wallet, ArrowRight, CheckCircle2 } from "lucide-react"
import { Link } from "react-router-dom"

export interface DealerToPay {
  id: string
  name: string
  outstanding: number
}

interface DealersToPayCardProps {
  totalPayables: number
  topDealersToPay: DealerToPay[]
}

export const DealersToPayCard = memo(function DealersToPayCard({
  totalPayables,
  topDealersToPay,
}: DealersToPayCardProps) {
  return (
    <Card className="border-[#E5E7EB] shadow-xs">
      <CardHeader className="p-4 border-b border-slate-100 bg-red-50/40 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-bold text-red-950 flex items-center gap-1.5">
            <Wallet className="h-4 w-4 text-red-600" /> Payments to Make
          </CardTitle>
          <CardDescription className="text-xs text-red-800">
            Total Due: <span className="font-bold">{formatMoney(totalPayables)}</span>
          </CardDescription>
        </div>
        <Link
          to="/dealers"
          className="text-xs font-semibold text-[#2D7FF9] hover:text-blue-800 flex items-center gap-0.5"
        >
          Manage Dealers <ArrowRight className="w-3 h-3" />
        </Link>
      </CardHeader>
      <CardContent className="p-3">
        {topDealersToPay.length > 0 ? (
          <div className="divide-y divide-slate-100 text-xs">
            {topDealersToPay.map((d) => (
              <div key={d.id} className="py-2 flex items-center justify-between">
                <div>
                  <Link
                    to={`/dealers/${d.id}`}
                    className="font-bold text-[#0E2A47] hover:text-[#2D7FF9] transition-colors"
                  >
                    {d.name}
                  </Link>
                  <p className="text-[10px] text-slate-500">Supplier Payable</p>
                </div>
                <span className="font-bold text-red-600">
                  {formatMoney(d.outstanding)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-1">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="font-semibold text-slate-700">All supplier accounts are settled.</span>
            <span className="text-[11px] text-slate-400">Zero outstanding payables currently due.</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
})
