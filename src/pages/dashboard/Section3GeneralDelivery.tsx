import React from "react"
import { formatMoney } from "@/lib/utils"
import { Truck, CheckCircle2, AlertTriangle, ExternalLink, Calculator } from "lucide-react"
import { Link } from "react-router-dom"
import type { GeneralDeliverySectionData } from "@/services/dashboard"

interface Section3GeneralDeliveryProps {
  data: GeneralDeliverySectionData
}

export const Section3GeneralDelivery: React.FC<Section3GeneralDeliveryProps> = ({ data }) => {
  const recon = data.reconciliation

  return (
    <div className="dashboard-domain-card bg-white border border-[#D9E0E8] rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between transition-all hover:border-slate-300">
      {/* Section Header */}
      <div className="px-4 py-3 border-b border-[#D9E0E8] bg-[#F8F7F2]/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0">
            <Truck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-[#172B4D] leading-tight">
              General Delivery (including NAEEM)
            </h2>
            <p className="text-[10px] text-[#52627A] leading-tight mt-0.5">
              Fleet deliveries, fuel & NAEEM reconciliation
            </p>
          </div>
        </div>
        <Link
          to="/general-deliveries"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors shrink-0"
        >
          <span>Ledger</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      <div className="p-4 space-y-3.5 flex-1 flex flex-col justify-between">
        {/* 5 Essential Figures */}
        <div className="grid grid-cols-2 gap-2">
          {/* 1. Combined General Delivery Amount */}
          <div className="p-3 rounded-xl border border-[#D9E0E8] bg-[#F8F7F2]">
            <span className="text-[10px] font-bold text-[#66758A] uppercase tracking-wider block leading-tight">
              Combined Delivery
            </span>
            <div className="text-base sm:text-lg lg:text-xl font-black font-mono text-[#172B4D] mt-0.5 break-words">
              {formatMoney(data.combinedTotal)}
            </div>
            <p className="text-[10px] text-[#66758A] mt-0.5 leading-tight">
              {data.activeDays} active days
            </p>
          </div>

          {/* 2. NAEEM Delivery Amount Included */}
          <div className="p-3 rounded-xl border border-[#D9E0E8] bg-[#F1F4F8]">
            <span className="text-[10px] font-bold text-[#52627A] uppercase tracking-wider block leading-tight">
              NAEEM Included
            </span>
            <div className="text-base sm:text-lg lg:text-xl font-black font-mono text-[#172B4D] mt-0.5 break-words">
              {formatMoney(data.naeemIncluded)}
            </div>
            <p className="text-[10px] text-[#66758A] mt-0.5 leading-tight">
              In combined workflow
            </p>
          </div>

          {/* 3. General Delivery Excluding NAEEM */}
          <div className="p-3 rounded-xl border border-[#D9E0E8] bg-[#F1F4F8]">
            <span className="text-[10px] font-bold text-[#52627A] uppercase tracking-wider block leading-tight">
              General Excl. NAEEM
            </span>
            <div className="text-base sm:text-lg lg:text-xl font-black font-mono text-[#172B4D] mt-0.5 break-words">
              {formatMoney(data.excludingNaeem)}
            </div>
            <p className="text-[10px] text-[#66758A] mt-0.5 leading-tight">
              Independent routes
            </p>
          </div>

          {/* 4. Applicable Fuel Expenses */}
          <div className="p-3 rounded-xl border border-rose-200 bg-[#FDECEC]">
            <span className="text-[10px] font-bold text-[#B42318] uppercase tracking-wider block leading-tight">
              Fuel Expenses
            </span>
            <div className="text-base sm:text-lg lg:text-xl font-black font-mono text-[#B42318] mt-0.5 break-words">
              {formatMoney(data.fuel)}
            </div>
            <p className="text-[10px] text-[#B42318]/80 mt-0.5 leading-tight">
              Fleet fuel receipts
            </p>
          </div>

          {/* 5. Net Contribution After Costs */}
          <div className="p-3 rounded-xl border border-emerald-200 bg-[#EAF7EF] col-span-2">
            <span className="text-[10px] font-bold text-[#087443] uppercase tracking-wider block leading-tight">
              Net Contribution
            </span>
            <div className="text-base sm:text-lg lg:text-xl font-black font-mono text-[#087443] mt-0.5 break-words">
              {formatMoney(data.net)}
            </div>
            <p className="text-[10px] text-[#087443]/80 mt-0.5 leading-tight">
              Delivery minus fuel
            </p>
          </div>
        </div>

        {/* Compact Fleet Distribution Visual Bar */}
        {data.combinedTotal > 0 && (
          <div className="p-3 rounded-xl border border-[#D9E0E8] bg-[#F8F7F2] space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="text-[#52627A]">
                Combined Billing Distribution
              </span>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1 text-sky-700 font-bold">
                  <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
                  Excl. NAEEM ({Math.round((data.excludingNaeem / data.combinedTotal) * 100)}%)
                </span>
                <span className="flex items-center gap-1 text-indigo-700 font-bold">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                  NAEEM ({Math.round((data.naeemIncluded / data.combinedTotal) * 100)}%)
                </span>
              </div>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
              <div
                className="bg-sky-500 h-full transition-all"
                style={{ width: `${Math.min(100, Math.round((data.excludingNaeem / data.combinedTotal) * 100))}%` }}
                title={`Excluding NAEEM: ${formatMoney(data.excludingNaeem)}`}
              />
              <div
                className="bg-indigo-500 h-full transition-all"
                style={{ width: `${Math.max(0, 100 - Math.min(100, Math.round((data.excludingNaeem / data.combinedTotal) * 100)))}%` }}
                title={`NAEEM Included: ${formatMoney(data.naeemIncluded)}`}
              />
            </div>
          </div>
        )}

        {/* Compact Mathematical Reconciliation Row */}
        <div className="p-3 rounded-xl border border-[#D9E0E8] bg-[#F8F7F2] space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-[#172B4D] flex-wrap">
              <Calculator className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
              <span>General Delivery Reconciliation Formula</span>
              <span className="text-slate-400">:</span>
              <span className="font-mono text-[#172B4D] break-words">
                Combined ({formatMoney(data.combinedTotal)}) = Excl. NAEEM ({formatMoney(data.excludingNaeem)}) + NAEEM Included ({formatMoney(data.naeemIncluded)})
              </span>
            </div>
            {recon.status === "RECONCILED" || recon.status === "EMPTY" ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#EAF7EF] text-[#087443] border border-emerald-200 shrink-0 self-start sm:self-auto">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#087443]" />
                Formula Reconciled
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FFF4D6] text-[#92400E] border border-amber-200 shrink-0 self-start sm:self-auto">
                <AlertTriangle className="w-3.5 h-3.5 text-[#92400E]" />
                Shortfall / Audit Notice
              </span>
            )}
          </div>

          <p className="text-[11px] text-[#52627A] leading-normal">
            <strong className="text-[#172B4D]">Critical Double-Counting Protection:</strong> Daily deliveries recorded in the General Delivery workflow already contain the NAEEM delivery component. NAEEM is not added a second time to consolidated operational totals, preserving independent ledger accessibility without duplicating operational revenue.
          </p>
        </div>
      </div>
    </div>
  )
}
